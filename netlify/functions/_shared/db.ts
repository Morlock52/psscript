import { Pool, QueryResultRow } from 'pg';
import { getEnv, requireEnv } from './env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: requireEnv('DATABASE_URL'),
      max: Number(getEnv('DB_POOL_MAX', '3')),
      ssl: getEnv('DB_SSL', 'true') === 'true' ? { rejectUnauthorized: true } : undefined,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
