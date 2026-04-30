import { Pool, QueryResultRow } from 'pg';
import fs from 'node:fs';
import { getEnv, requireEnv } from './env';

let pool: Pool | null = null;

function getSslConfig() {
  if (getEnv('DB_SSL', 'true') !== 'true') {
    return undefined;
  }

  const rejectUnauthorized = getEnv('DB_SSL_REJECT_UNAUTHORIZED', 'true') !== 'false';
  const inlineCa = getEnv('DB_SSL_CA').replace(/\\n/g, '\n');
  const caPath = getEnv('DB_SSL_CA_PATH');
  const ca = inlineCa || (caPath ? fs.readFileSync(caPath, 'utf8') : undefined);

  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPoolMax(): number {
  const configuredMax = parsePositiveInt(getEnv('DB_POOL_MAX', '1'), 1);
  const allowHigherServerlessPool = getEnv('DB_POOL_ALLOW_HIGH_CONCURRENCY', 'false') === 'true';

  return allowHigherServerlessPool ? configuredMax : Math.min(configuredMax, 1);
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv('DATABASE_POOLER_URL') || requireEnv('DATABASE_URL'),
      max: getPoolMax(),
      connectionTimeoutMillis: parsePositiveInt(getEnv('DB_CONNECTION_TIMEOUT_MS', '5000'), 5000),
      idleTimeoutMillis: parsePositiveInt(getEnv('DB_IDLE_TIMEOUT_MS', '10000'), 10000),
      maxLifetimeSeconds: parsePositiveInt(getEnv('DB_MAX_LIFETIME_SECONDS', '60'), 60),
      allowExitOnIdle: true,
      ssl: getSslConfig(),
    });
  }

  return pool;
}

function isConnectionPressureError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const message = err?.message || '';

  return (
    err?.code === '53300' ||
    message.includes('EMAXCONNSESSION') ||
    message.includes('max clients reached') ||
    message.includes('remaining connection slots are reserved') ||
    message.includes('Connection terminated unexpectedly')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const attempts = parsePositiveInt(getEnv('DB_QUERY_RETRY_ATTEMPTS', '2'), 2);
  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await getPool().query<T>(text, params);
    } catch (error) {
      lastError = error;
      if (!isConnectionPressureError(error) || attempt === attempts) {
        throw error;
      }

      await delay(75 * (attempt + 1));
    }
  }

  throw lastError;
}
