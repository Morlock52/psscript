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

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireEnv('DATABASE_URL'),
      max: Number(getEnv('DB_POOL_MAX', '3')),
      ssl: getSslConfig(),
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
