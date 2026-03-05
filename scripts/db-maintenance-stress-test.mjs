#!/usr/bin/env node
import process from 'node:process';
import { writeFile } from 'node:fs/promises';

const DEFAULT_BASE_URL = 'http://localhost:3001';
const DEFAULT_CYCLES = 3;
const DEFAULT_TIMEOUT_MS = 20_000;

const args = process.argv.slice(2);

function getArgValue(flag, fallback) {
  const index = args.findIndex((arg) => arg === `--${flag}`);
  if (index === -1) {
    return fallback;
  }

  return args[index + 1] ?? fallback;
}

function hasFlag(flag) {
  return args.includes(`--${flag}`);
}

function parseJsonOrText(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const text = String(raw || '');
    const message = text.startsWith('<!DOCTYPE html>')
      ? 'Received HTML response (likely wrong API base URL).'
      : text;
    return {
      message: message.length > 240 ? `${message.slice(0, 240)}...` : message
    };
  }
}

function safeError(error) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return String(error);
}

function sanitizeCycleCount(rawValue) {
  const parsed = Number(rawValue);
  return Number.isNaN(parsed) || parsed < 1 ? DEFAULT_CYCLES : parsed;
}

function printUsage() {
  console.log(`Usage: node scripts/db-maintenance-stress-test.mjs [options]

Options:
  --base-url URL           Backend API base URL (default: ${DEFAULT_BASE_URL}, fallback API_URL / API_BASE_URL)
  --cycles N               Number of stress cycles (default: ${DEFAULT_CYCLES}, fallback DB_STRESS_CYCLES)
  --token TOKEN            Auth token (fallback ADMIN_TOKEN / ADMIN_JWT / API_TOKEN)
  --smoke-only             Run smoke checks only
  --no-smoke               Skip smoke checks
  --no-backup-first         Disable backup-before-clear behavior
  --restore-after-clear     Restore from the cycle backup after clear operation
  --insecure-tls           Disable TLS certificate verification (local/self-signed only)
  --help                   Show this help text

Environment:
  API_URL / API_BASE_URL                Default API base URL
  DB_STRESS_CYCLES                      Default cycles
  DB_STRESS_REQUEST_TIMEOUT_MS          Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  DB_STRESS_REPORT_FILE                  Optional path to write JSON summary
  ADMIN_TOKEN / ADMIN_JWT / API_TOKEN    API auth token
`);
  process.exit(0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const apiBase = getArgValue('base-url', process.env.API_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL);
const cycles = sanitizeCycleCount(getArgValue('cycles', process.env.DB_STRESS_CYCLES || DEFAULT_CYCLES));
const requestTimeoutMs = Number(process.env.DB_STRESS_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
const token = process.env.ADMIN_TOKEN || process.env.ADMIN_JWT || process.env.API_TOKEN || getArgValue('token', null);
const backupFirstDefault = !hasFlag('no-backup-first');
const smokeOnly = hasFlag('smoke-only');
const skipSmoke = hasFlag('no-smoke');
const restoreAfterClearDefault = hasFlag('restore-after-clear');
const insecureTls = hasFlag('insecure-tls');

if (insecureTls) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('TLS certificate verification disabled via --insecure-tls');
}

if (hasFlag('help')) {
  printUsage();
}

const summary = {
  startedAt: new Date().toISOString(),
  apiBase,
  cycles,
  smoke: null,
  options: {
    backupFirstDefault,
    restoreAfterClearDefault
  },
  results: [],
  failures: []
};

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await response.text();
    const payload = text ? parseJsonOrText(text) : {};

    if (!response.ok) {
      const message = payload?.message || text || 'Request failed';
      const error = new Error(`${message} (HTTP ${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${requestTimeoutMs}ms: ${method} ${path}`);
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function createBackup(name) {
  const payload = await request('POST', '/api/admin/db/backup', { filename: name });
  assert(payload?.success, 'Backup response did not return success=true.');
  return payload.backup?.name || name;
}

async function restoreBackup(filename) {
  const payload = await request('POST', '/api/admin/db/restore', { filename });
  assert(payload?.success, 'Restore response did not return success=true.');
  return payload;
}

async function clearTestData(tables, backupFirst, backupFilename) {
  const payload = await request('POST', '/api/admin/db/clear-test-data', {
    confirmText: 'CLEAR TEST DATA',
    backupFirst,
    backupFilename,
    ...(tables ? { tables } : {})
  });
  assert(payload?.success, 'Clear response did not return success=true.');
  assert(Array.isArray(payload?.clearedTables), 'Clear response does not include clearedTables array.');
  return payload;
}

async function listBackups() {
  const payload = await request('GET', '/api/admin/db/backups');
  assert(Array.isArray(payload?.backups), 'Backups response does not include backups array.');
  return payload.backups;
}

async function runSmokeCheck() {
  const checks = [];
  const start = Date.now();
  const timestamp = Date.now();
  const backupName = `smoke-check-${timestamp}`;
  const preclearBackupName = `smoke-preclear-${timestamp}`;

  const backupsBefore = await listBackups();
  checks.push({ name: 'list-backups', ok: true, backupCount: backupsBefore.length });

  const createdBackup = await createBackup(backupName);
  const backupsAfterCreate = await listBackups();
  checks.push({
    name: 'create-backup',
    ok: backupsAfterCreate.some((backup) => backup?.name === createdBackup),
    backup: createdBackup,
    backupCount: backupsAfterCreate.length
  });
  assert(
    backupsAfterCreate.some((backup) => backup?.name === createdBackup),
    `Created backup was not listed by /api/admin/db/backups: ${createdBackup}`
  );

  const restorePayload = await restoreBackup(createdBackup);
  checks.push({
    name: 'restore-backup',
    ok: Boolean(restorePayload?.success),
    restoredFrom: restorePayload?.restoredFrom,
    backupFilename: restorePayload?.restoredFrom
  });

  const clearPayload = await clearTestData(undefined, false, preclearBackupName);
  checks.push({
    name: 'clear-test-data',
    ok: Boolean(clearPayload?.success),
    clearedTables: clearPayload?.clearedTables,
    requestedTables: clearPayload?.requestedTables || [],
    filteredTables: clearPayload?.filteredTables || [],
    ignoredTables: clearPayload?.ignoredTables || []
  });

  const cleanupRestorePayload = await restoreBackup(createdBackup);
  checks.push({
    name: 'restore-after-clear',
    ok: Boolean(cleanupRestorePayload?.success),
    restoredFrom: cleanupRestorePayload?.restoredFrom
  });

  return {
    checks,
    durationMs: Date.now() - start
  };
}

async function runOnce(cycle) {
  const timestamp = Date.now();
  const backupName = `stress-${cycle}-${timestamp}`;
  const filterCycle = cycle % 2 === 0 ? ['scripts', 'script_versions'] : undefined;
  const backupFilename = `pre-clear-${cycle}-${timestamp}`;

  const backupFromCreate = await createBackup(backupName);
  const afterCreate = await listBackups();

  if (!afterCreate.some((backup) => backup?.name === backupFromCreate)) {
    throw new Error(`Backup not found after create: ${backupFromCreate}`);
  }

  await restoreBackup(backupFromCreate);

  const clearPayload = await clearTestData(filterCycle, backupFirstDefault, backupFilename);
  let postClearRestore = null;

  if (restoreAfterClearDefault) {
    postClearRestore = await restoreBackup(backupFromCreate);
    if (!postClearRestore?.success) {
      throw new Error(`Restore-after-clear failed for cycle ${cycle}`);
    }
  }

  return {
    cycle,
    backupName: backupFromCreate,
    filteredClearAttempted: filterCycle,
    clearedTables: clearPayload.clearedTables,
    requestedTables: clearPayload.requestedTables || null,
    filteredTables: clearPayload.filteredTables || null,
    ignoredTables: clearPayload.ignoredTables || null,
    backupFromClear: clearPayload.backup?.name || null,
    restoredAfterClear: restoreAfterClearDefault ? {
      success: Boolean(postClearRestore?.success),
      restoredFrom: postClearRestore?.restoredFrom || null
    } : null
  };
}

(async () => {
  try {
    console.log(`Running data maintenance stress test (${cycles} cycles)`);
    console.log(`API: ${apiBase}`);

    if (!skipSmoke || smokeOnly) {
      if (smokeOnly && skipSmoke) {
        console.log('Ignoring --no-smoke because --smoke-only requires validation checks.');
      }
      console.log('Running maintenance smoke check');
      summary.smoke = await runSmokeCheck();
      console.log(`Smoke check passed (${summary.smoke.durationMs}ms)`);
    }

    if (smokeOnly) {
      summary.completed = 0;
      summary.failed = false;
      summary.finishedAt = new Date().toISOString();
      const json = JSON.stringify(summary, null, 2);

      if (process.env.DB_STRESS_REPORT_FILE) {
        await writeFile(process.env.DB_STRESS_REPORT_FILE, `${json}\n`);
      }

      console.log('Smoke summary:');
      console.log(json);
      process.exitCode = 0;
      return;
    }

    for (let cycle = 1; cycle <= cycles; cycle += 1) {
      const start = Date.now();
      try {
        console.log(`[cycle ${cycle}] start`);
        const result = await runOnce(cycle);
        result.durationMs = Date.now() - start;
        summary.results.push(result);
        console.log(`[cycle ${cycle}] ok (${result.durationMs}ms)`);
      } catch (error) {
        const message = safeError(error);
        summary.failures.push({ cycle, message });
        console.error(`[cycle ${cycle}] failed: ${message}`);
        break;
      }
    }

    summary.completed = summary.results.length;
    summary.failed = summary.failures.length > 0;
    summary.finishedAt = new Date().toISOString();

    const json = JSON.stringify(summary, null, 2);

    if (process.env.DB_STRESS_REPORT_FILE) {
      await writeFile(process.env.DB_STRESS_REPORT_FILE, `${json}\n`);
    }

    console.log('Stress run summary:');
    console.log(json);

    process.exitCode = summary.failed ? 1 : 0;
  } catch (error) {
    console.error('Stress test failed:', safeError(error));

    summary.failed = true;
    summary.finishedAt = new Date().toISOString();
    summary.failures.push({ cycle: 0, message: safeError(error) });

    const json = JSON.stringify(summary, null, 2);
    if (process.env.DB_STRESS_REPORT_FILE) {
      await writeFile(process.env.DB_STRESS_REPORT_FILE, `${json}\n`);
    }
    process.exitCode = 1;
  }
})();
