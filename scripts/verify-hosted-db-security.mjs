import 'dotenv/config';
import { Pool } from 'pg';

const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'];
const DATABASE_URL = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

function parseDatabaseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHostedSupabaseUrl(value) {
  const parsed = parseDatabaseUrl(value);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return SUPABASE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

if (!DATABASE_URL) {
  console.error('DATABASE_POOLER_URL or DATABASE_URL is required.');
  process.exit(1);
}

if (!isHostedSupabaseUrl(DATABASE_URL) && process.env.ALLOW_NON_SUPABASE_DB_SECURITY_CHECK !== 'true') {
  console.error('Refusing to run security drift checks against a non-Supabase database URL.');
  process.exit(1);
}

const requiredTables = ['admin_db_backups', 'audit_events', 'provider_api_keys'];
const requiredPolicies = new Map([
  ['audit_events', ['audit events readable by enabled profile']],
]);
const noClientPrivilegeTables = ['admin_db_backups', 'provider_api_keys'];
const clientRoles = ['anon', 'authenticated'];

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
  allowExitOnIdle: true,
  ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
});

const failures = [];

try {
  const tableResult = await pool.query(
    `
      SELECT relname, relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
    `,
    [requiredTables]
  );
  const tableByName = new Map(tableResult.rows.map((row) => [row.relname, row]));

  for (const table of requiredTables) {
    const row = tableByName.get(table);
    if (!row) {
      failures.push(`public.${table} is missing`);
      continue;
    }
    if (!row.relrowsecurity) {
      failures.push(`public.${table} does not have RLS enabled`);
    }
  }

  const policyResult = await pool.query(
    `
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [requiredTables]
  );
  const policiesByTable = new Map();
  for (const row of policyResult.rows) {
    const policies = policiesByTable.get(row.tablename) || new Set();
    policies.add(row.policyname);
    policiesByTable.set(row.tablename, policies);
  }

  for (const [table, policies] of requiredPolicies.entries()) {
    const actual = policiesByTable.get(table) || new Set();
    for (const policy of policies) {
      if (!actual.has(policy)) {
        failures.push(`public.${table} is missing policy "${policy}"`);
      }
    }
  }

  const privilegeResult = await pool.query(
    `
      SELECT c.relname, r.rolname,
        has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
        has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
        has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
        has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_roles r ON r.rolname = ANY($2::text[])
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
    `,
    [noClientPrivilegeTables, clientRoles]
  );

  for (const row of privilegeResult.rows) {
    const grants = ['select', 'insert', 'update', 'delete'].filter((privilege) => row[`can_${privilege}`]);
    if (grants.length) {
      failures.push(`role ${row.rolname} has ${grants.join(', ')} on public.${row.relname}`);
    }
  }

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, checkedTables: requiredTables, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, checkedTables: requiredTables }, null, 2));
} finally {
  await pool.end();
}
