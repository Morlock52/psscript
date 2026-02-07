/* Minimal LSP client for Monaco (PowerShell) over WebSocket.
 * We intentionally keep this lightweight (no monaco-languageclient dependency)
 * and focus on diagnostics + completion + hover.
 */

export type LspStatus = 'connecting' | 'online' | 'offline';

type JsonRpcRequest = { jsonrpc: '2.0'; id: number; method: string; params?: any };
type JsonRpcNotification = { jsonrpc: '2.0'; method: string; params?: any };
type JsonRpcResponse = { jsonrpc: '2.0'; id: number; result?: any; error?: any };

export type LspClient = {
  status: () => LspStatus;
  dispose: () => void;
};

function pathToWs(apiUrl: string): string {
  // apiUrl like http://host:4000/api
  return apiUrl.replace(/^http/i, 'ws');
}

function toUri(scriptId?: string): string {
  const id = scriptId && String(scriptId).trim().length ? String(scriptId) : 'scratch';
  return `inmemory://script/${encodeURIComponent(id)}.ps1`;
}

function posToLsp(position: { lineNumber: number; column: number }) {
  return { line: Math.max(0, position.lineNumber - 1), character: Math.max(0, position.column - 1) };
}

function lspToMonacoRange(monaco: any, start: any, end: any) {
  return new monaco.Range(
    (start?.line ?? 0) + 1,
    (start?.character ?? 0) + 1,
    (end?.line ?? 0) + 1,
    (end?.character ?? 0) + 1
  );
}

function mapCompletionItem(monaco: any, item: any) {
  const kind = (() => {
    // LSP CompletionItemKind -> Monaco CompletionItemKind is not 1:1, pick sane defaults.
    const k = Number(item?.kind || 0);
    if (k === 2) return monaco.languages.CompletionItemKind.Method;
    if (k === 3) return monaco.languages.CompletionItemKind.Function;
    if (k === 4) return monaco.languages.CompletionItemKind.Constructor;
    if (k === 5) return monaco.languages.CompletionItemKind.Field;
    if (k === 6) return monaco.languages.CompletionItemKind.Variable;
    if (k === 7) return monaco.languages.CompletionItemKind.Class;
    if (k === 10) return monaco.languages.CompletionItemKind.Property;
    if (k === 12) return monaco.languages.CompletionItemKind.Keyword;
    if (k === 14) return monaco.languages.CompletionItemKind.Snippet;
    return monaco.languages.CompletionItemKind.Text;
  })();

  return {
    label: String(item?.label ?? ''),
    kind,
    detail: item?.detail ? String(item.detail) : undefined,
    documentation: item?.documentation?.value ? String(item.documentation.value) : item?.documentation ? String(item.documentation) : undefined,
    insertText: item?.insertText ? String(item.insertText) : String(item?.label ?? ''),
  };
}

export function attachPowerShellLsp(opts: {
  apiUrl: string;
  scriptId?: string;
  editor: any;
  monaco: any;
  getText: () => string;
  onDiagnostics: (diags: Array<{ severity: string; message: string; line: number; column: number; ruleName?: string }>) => void;
  setStatus: (s: LspStatus) => void;
}): LspClient {
  const { apiUrl, scriptId, editor, monaco, getText, onDiagnostics, setStatus } = opts;
  const uri = toUri(scriptId);

  let ws: WebSocket | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  let disposed = false;
  let lspStatus: LspStatus = 'offline';

  const sendReq = (method: string, params?: any) =>
    new Promise<any>((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('LSP offline'));
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      ws.send(JSON.stringify(msg));
    });

  const sendNotif = (method: string, params?: any) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    ws.send(JSON.stringify(msg));
  };

  const connect = async () => {
    if (disposed) return;
    setStatus('connecting');
    lspStatus = 'connecting';

    const wsApi = pathToWs(apiUrl);
    const wsUrl = `${wsApi.replace(/\/$/, '')}/editor/lsp`;
    ws = new WebSocket(wsUrl);

    ws.onopen = async () => {
      if (disposed) return;
      setStatus('online');
      lspStatus = 'online';

      const capabilities = {
        textDocument: {
          synchronization: { dynamicRegistration: false, willSave: false, didSave: false },
          completion: { completionItem: { snippetSupport: false } },
          hover: { dynamicRegistration: false },
        },
        workspace: {},
      };

      try {
        await sendReq('initialize', {
          processId: null,
          rootUri: null,
          capabilities,
          clientInfo: { name: 'PSScript', version: '1.0.0' },
        });
        sendNotif('initialized', {});
        sendNotif('textDocument/didOpen', {
          textDocument: {
            uri,
            languageId: 'powershell',
            version: 1,
            text: getText(),
          },
        });
      } catch {
        // If init fails, mark offline and let caller continue without LSP.
        try { ws?.close(); } catch {}
      }
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as JsonRpcResponse | JsonRpcNotification;
        if ((msg as any).id !== undefined) {
          const id = Number((msg as any).id);
          const p = pending.get(id);
          if (!p) return;
          pending.delete(id);
          if ((msg as any).error) p.reject((msg as any).error);
          else p.resolve((msg as any).result);
          return;
        }

        if ((msg as any).method === 'textDocument/publishDiagnostics') {
          const params = (msg as any).params || {};
          const diags = Array.isArray(params.diagnostics) ? params.diagnostics : [];
          const mapped = diags.map((d: any) => ({
            severity: d.severity === 1 ? 'Error' : d.severity === 2 ? 'Warning' : 'Info',
            message: String(d.message || ''),
            line: (d.range?.start?.line ?? 0) + 1,
            column: (d.range?.start?.character ?? 0) + 1,
          }));
          onDiagnostics(mapped);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      for (const [id, p] of pending.entries()) {
        pending.delete(id);
        p.reject(new Error('LSP disconnected'));
      }
      if (disposed) return;
      setStatus('offline');
      lspStatus = 'offline';
    };
    ws.onerror = () => {
      if (disposed) return;
      setStatus('offline');
      lspStatus = 'offline';
    };
  };

  // Monaco providers
  const completionProvider = monaco.languages.registerCompletionItemProvider('powershell', {
    triggerCharacters: ['-', ':', '.', '\\\\', '/', '$'],
    provideCompletionItems: async (model: any, position: any) => {
      if (lspStatus !== 'online') return { suggestions: [] };
      const text = model.getValue();
      const lines = text.split('\\n');
      const lineText = lines[position.lineNumber - 1] || '';
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);

      try {
        const result = await sendReq('textDocument/completion', {
          textDocument: { uri },
          position: posToLsp(position),
          context: { triggerKind: 1 },
        });
        const items = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : [];
        return {
          suggestions: items.map((it: any) => ({ ...mapCompletionItem(monaco, it), range })),
        };
      } catch {
        return { suggestions: [] };
      }
    },
  });

  const hoverProvider = monaco.languages.registerHoverProvider('powershell', {
    provideHover: async (_model: any, position: any) => {
      if (lspStatus !== 'online') return null;
      try {
        const result = await sendReq('textDocument/hover', {
          textDocument: { uri },
          position: posToLsp(position),
        });
        if (!result) return null;
        const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
        const value = contents
          .map((c: any) => (typeof c === 'string' ? c : c?.value ? String(c.value) : c?.language && c?.value ? String(c.value) : ''))
          .filter(Boolean)
          .join('\\n\\n');
        if (!value) return null;
        return {
          contents: [{ value }],
          range: result.range ? lspToMonacoRange(monaco, result.range.start, result.range.end) : undefined,
        };
      } catch {
        return null;
      }
    },
  });

  // didChange (debounced full sync)
  let version = 1;
  let changeTimer: any = null;
  const model = editor.getModel?.();
  const didChangeDisposable = editor.onDidChangeModelContent?.(() => {
    version += 1;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      if (lspStatus !== 'online') return;
      sendNotif('textDocument/didChange', {
        textDocument: { uri, version },
        contentChanges: [{ text: getText() }],
      });
    }, 250);
  });

  void connect();

  return {
    status: () => lspStatus,
    dispose: () => {
      disposed = true;
      try { completionProvider.dispose(); } catch {}
      try { hoverProvider.dispose(); } catch {}
      try { didChangeDisposable?.dispose?.(); } catch {}
      try { ws?.close?.(); } catch {}
      ws = null;
      setStatus('offline');
    },
  };
}
