import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const PORT_LSP = Number(process.env.PORT_LSP || 7001);
const PORT_HTTP = Number(process.env.PORT_HTTP || 7002);
const PSES_BUNDLE_PATH = process.env.PSES_BUNDLE_PATH || '/opt/powershell-editor-services';
const PSES_START = path.join(PSES_BUNDLE_PATH, 'PowerShellEditorServices', 'Start-EditorServices.ps1');

function jsonReply(res, status, payload) {
  res.status(status).json(payload);
}

async function writeTempPs1(content) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'psscript-'));
  const file = path.join(dir, 'script.ps1');
  await fs.writeFile(file, content ?? '', 'utf8');
  return { dir, file };
}

async function runPwshJson(script, args = []) {
  return await new Promise((resolve, reject) => {
    const ps = spawn('pwsh', ['-NoLogo', '-NoProfile', '-NonInteractive', ...args, '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    ps.stdout.on('data', (d) => (out += d.toString('utf8')));
    ps.stderr.on('data', (d) => (err += d.toString('utf8')));
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `pwsh exited ${code}`));
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(new Error(`Failed to parse pwsh JSON. stderr=${err}`));
      }
    });
  });
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => jsonReply(res, 200, { status: 'ok', psesBundlePath: PSES_BUNDLE_PATH }));

// Deterministic lint using PSScriptAnalyzer (Invoke-ScriptAnalyzer)
app.post('/lint', async (req, res) => {
  const content = String(req.body?.content ?? '');
  const { dir, file } = await writeTempPs1(content);
  try {
    const ps = `
$ErrorActionPreference = 'Stop'
Import-Module PSScriptAnalyzer -ErrorAction Stop
$results = Invoke-ScriptAnalyzer -Path '${file.replace(/'/g, "''")}' -Recurse:$false
$issues = @()
foreach ($r in $results) {
  $issues += [pscustomobject]@{
    severity = [string]$r.Severity
    ruleName = [string]$r.RuleName
    message  = [string]$r.Message
    line     = [int]$r.Line
    column   = [int]$r.Column
  }
}
@{ issues = $issues } | ConvertTo-Json -Depth 6 -Compress
`;
    const data = await runPwshJson(ps);
    return jsonReply(res, 200, data);
  } catch (e) {
    return jsonReply(res, 500, { message: 'lint failed' });
  } finally {
    try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
  }
});

// Deterministic format using PSScriptAnalyzer Invoke-Formatter (best effort)
app.post('/format', async (req, res) => {
  const content = String(req.body?.content ?? '');
  const { dir, file } = await writeTempPs1(content);
  try {
    const ps = `
$ErrorActionPreference = 'Stop'
Import-Module PSScriptAnalyzer -ErrorAction Stop
$formatted = Invoke-Formatter -ScriptDefinition (Get-Content -Raw '${file.replace(/'/g, "''")}') 
@{ formatted = [string]$formatted } | ConvertTo-Json -Depth 4 -Compress
`;
    const data = await runPwshJson(ps);
    return jsonReply(res, 200, data);
  } catch (_e) {
    return jsonReply(res, 500, { message: 'format failed' });
  } finally {
    try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
  }
});

app.listen(PORT_HTTP, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`pwsh-tools http on :${PORT_HTTP}`);
});

// --- LSP over WS bridge (JSON over WS <-> LSP framed over stdio) ---
function encodeLsp(json) {
  const body = Buffer.from(json, 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
  return Buffer.concat([header, body]);
}

function makeLspDecoder(onMessage) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        // invalid framing; drop buffer
        buf = Buffer.alloc(0);
        return;
      }
      const len = Number(m[1]);
      const total = headerEnd + 4 + len;
      if (buf.length < total) return;
      const body = buf.slice(headerEnd + 4, total).toString('utf8');
      buf = buf.slice(total);
      onMessage(body);
    }
  };
}

function startPsesProcess() {
  const sessionId = crypto.randomBytes(8).toString('hex');
  const logPath = `/tmp/pses-${sessionId}.log`;
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', PSES_START,
    '-Stdio',
    '-BundledModulesPath', PSES_BUNDLE_PATH,
    '-LogPath', logPath,
    '-LogLevel', 'Normal',
    '-SessionDetailsPath', `/tmp/pses-session-${sessionId}.json`,
    '-HostName', 'PSScript',
    '-HostProfileId', 'psscript',
    '-HostVersion', '1.0.0'
  ];

  const child = spawn('pwsh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  return { child, sessionId, logPath };
}

const wss = new WebSocketServer({ port: PORT_LSP });

wss.on('connection', (ws) => {
  const { child } = startPsesProcess();

  const decode = makeLspDecoder((json) => {
    if (ws.readyState === ws.OPEN) ws.send(json);
  });

  child.stdout.on('data', decode);
  child.stderr.on('data', (d) => {
    // eslint-disable-next-line no-console
    console.warn('PSES stderr:', d.toString('utf8').slice(0, 400));
  });

  ws.on('message', (data) => {
    try {
      const json = typeof data === 'string' ? data : data.toString('utf8');
      child.stdin.write(encodeLsp(json));
    } catch {
      // ignore
    }
  });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch {}
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

// eslint-disable-next-line no-console
console.log(`pwsh-tools lsp ws on :${PORT_LSP}`);

