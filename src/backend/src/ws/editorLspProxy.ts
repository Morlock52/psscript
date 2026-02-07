import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

function getToolsWsUrl(): string | null {
  return process.env.PWSH_TOOLS_WS_URL || null;
}

export function attachEditorLspProxy(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/api/editor/lsp') return;

      wss.handleUpgrade(req, socket as any, head, (client) => {
        wss.emit('connection', client, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (client: WebSocket) => {
    const toolsUrl = getToolsWsUrl();
    if (!toolsUrl) {
      try { client.close(1013, 'pwsh-tools not configured'); } catch {}
      return;
    }

    const upstream = new WebSocket(toolsUrl);
    const queue: any[] = [];
    let upstreamReady = false;

    const closeBoth = () => {
      try { client.close(); } catch {}
      try { upstream.close(); } catch {}
    };

    upstream.on('open', () => {
      upstreamReady = true;
      // flush buffered messages (client may send immediately on connect)
      while (queue.length) {
        const msg = queue.shift();
        try { upstream.send(msg); } catch {}
      }
      // Pipe client -> upstream
      client.on('message', (data) => {
        if (upstream.readyState === upstream.OPEN) upstream.send(data);
      });
      // Pipe upstream -> client
      upstream.on('message', (data) => {
        if (client.readyState === client.OPEN) client.send(data);
      });
    });

    // Buffer early client messages until upstream is open.
    client.on('message', (data) => {
      if (upstreamReady) return;
      queue.push(data);
    });

    client.on('close', closeBoth);
    client.on('error', closeBoth);
    upstream.on('close', closeBoth);
    upstream.on('error', closeBoth);
  });
}
