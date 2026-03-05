#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';

const DEFAULT_PORT = 3001;
const DEFAULT_HEALTH_TIMEOUT_MS = 120_000;
const DEFAULT_BACKUP_DIR = '/tmp/psscript-db-backups';
const DEFAULT_LOG_FILE = '/tmp/psscript-maintenance-e2e-backend.log';

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(`--${flag}`);
}

function getArgValue(flag, fallback) {
  const index = args.findIndex((arg) => arg === `--${flag}`);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function printUsage() {
  console.log(`Usage: node scripts/verify-data-maintenance-e2e.mjs [options]

Options:
  --port N                  Backend port (default: ${DEFAULT_PORT})
  --base-url URL            API base URL (default: http://127.0.0.1:<port>)
  --token TOKEN             Optional admin token forwarded to smoke script
  --health-timeout-ms N     Startup health wait timeout (default: ${DEFAULT_HEALTH_TIMEOUT_MS})
  --backup-dir PATH         Backup directory for backend (default: ${DEFAULT_BACKUP_DIR})
  --log-file PATH           Backend log file path (default: ${DEFAULT_LOG_FILE})
  --no-build                Skip backend build step
  --reuse-backend           Do not start/stop backend, only run smoke script
  --insecure-tls            Disable TLS certificate verification (local/self-signed only)
  --help                    Show this help text

Behavior:
  1) Build backend (unless --no-build or --reuse-backend)
  2) Start backend with DISABLE_AUTH=true
  3) Wait for /api/health
  4) Run maintenance smoke + restore verification
  5) Stop backend cleanly
`);
}

async function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      ...options
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(' ')} failed with exit code ${code}`));
      }
    });
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(baseUrl, timeoutMs) {
  const start = Date.now();
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/health`;

  while ((Date.now() - start) < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // service not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`Backend did not become healthy at ${healthUrl} within ${timeoutMs}ms`);
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');

  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (!child.killed && child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function main() {
  if (hasFlag('help')) {
    printUsage();
    return;
  }

  const cwd = process.cwd();
  const backendDir = path.join(cwd, 'src', 'backend');
  const backendEntry = path.join(backendDir, 'dist', 'index.js');
  const port = toPositiveInt(getArgValue('port', process.env.PORT || DEFAULT_PORT), DEFAULT_PORT);
  const baseUrl = getArgValue('base-url', `http://127.0.0.1:${port}`);
  const token = getArgValue('token', process.env.ADMIN_TOKEN || process.env.ADMIN_JWT || process.env.API_TOKEN || '');
  const healthTimeoutMs = toPositiveInt(
    getArgValue('health-timeout-ms', process.env.MAINTENANCE_E2E_HEALTH_TIMEOUT_MS || DEFAULT_HEALTH_TIMEOUT_MS),
    DEFAULT_HEALTH_TIMEOUT_MS
  );
  const backupDir = getArgValue('backup-dir', process.env.DB_BACKUP_DIR || DEFAULT_BACKUP_DIR);
  const logFile = getArgValue('log-file', process.env.MAINTENANCE_E2E_LOG_FILE || DEFAULT_LOG_FILE);
  const skipBuild = hasFlag('no-build');
  const reuseBackend = hasFlag('reuse-backend');
  const insecureTls = hasFlag('insecure-tls');
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/psscript';

  if (insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn('TLS certificate verification disabled via --insecure-tls');
  }

  let backendProcess = null;
  const logStream = createWriteStream(logFile, { flags: 'a' });

  try {
    console.log('Running data maintenance end-to-end verification');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Log file: ${logFile}`);

    if (!reuseBackend) {
      const portFree = await isPortAvailable(port);
      if (!portFree) {
        throw new Error(`Port ${port} is already in use. Choose a different --port/--base-url or stop the conflicting service.`);
      }

      if (!skipBuild) {
        console.log('Building backend');
        await runCommand('npm', ['run', 'build'], { cwd: backendDir });
      }

      if (!(await fileExists(backendEntry))) {
        throw new Error(`Backend entry not found after build: ${backendEntry}`);
      }

      console.log('Starting backend');
      backendProcess = spawn('node', [backendEntry], {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'test',
          DISABLE_AUTH: 'true',
          PORT: String(port),
          DB_BACKUP_DIR: backupDir,
          DATABASE_URL: databaseUrl,
          DB_HOST: '127.0.0.1',
          DB_PORT: '5432',
          DB_NAME: 'psscript',
          DB_USER: 'postgres',
          DB_PASSWORD: 'postgres'
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      backendProcess.stdout.on('data', (chunk) => logStream.write(chunk));
      backendProcess.stderr.on('data', (chunk) => logStream.write(chunk));
      backendProcess.on('error', (error) => {
        logStream.write(`\n[backend-process-error] ${String(error?.message || error)}\n`);
      });
      backendProcess.on('exit', (code, signal) => {
        logStream.write(`\n[backend-process-exit] code=${String(code)} signal=${String(signal)}\n`);
      });

      console.log('Waiting for backend health');
      await waitForHealth(baseUrl, healthTimeoutMs);
      if (backendProcess.exitCode !== null) {
        throw new Error(`Backend exited before verification. Check log file: ${logFile}`);
      }
    } else {
      console.log('Reusing existing backend instance');
      await waitForHealth(baseUrl, healthTimeoutMs);
    }

    const smokeArgs = [
      'scripts/db-maintenance-stress-test.mjs',
      '--smoke-only',
      '--restore-after-clear',
      '--base-url',
      baseUrl
    ];

    if (insecureTls) {
      smokeArgs.push('--insecure-tls');
    }

    if (token) {
      smokeArgs.push('--token', token);
    }

    console.log('Running maintenance smoke + restore check');
    await runCommand('node', smokeArgs, { cwd });
    console.log('Data maintenance verification completed successfully');
  } finally {
    if (!reuseBackend) {
      await stopProcess(backendProcess);
    }
    logStream.end();
  }
}

main().catch((error) => {
  console.error(`Verification failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
