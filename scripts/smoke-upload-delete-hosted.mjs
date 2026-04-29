import 'dotenv/config';
import crypto from 'node:crypto';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const baseUrl = (process.env.SMOKE_BASE_URL || 'https://pstest.morloksmaze.com').replace(/\/+$/, '');
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL');
}

const stamp = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const email = `psscript-upload-delete-${stamp}@example.invalid`;
const password = `Psscript-${stamp}-Aa1!`;
const titlePrefix = `codex-upload-delete-${stamp}`;
const testDescription = 'Codex hosted upload/delete smoke test';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

let authUserId = '';

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body ? body.message || body.error : body;
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${message}`);
  }
  return body;
}

function scriptPayload(suffix) {
  return {
    title: `${titlePrefix}-${suffix}.ps1`,
    description: testDescription,
    content: [
      `# ${titlePrefix}-${suffix}`,
      'param([string]$Name = "Codex")',
      'Write-Output "Hosted upload/delete smoke: $Name"',
      '',
    ].join('\n'),
    file_name: `${titlePrefix}-${suffix}.ps1`,
    tags: ['codex-smoke', 'delete-test'],
    is_public: false,
    analyze_with_ai: false,
  };
}

async function cleanup() {
  try {
    await db.query('DELETE FROM scripts WHERE title LIKE $1 OR description = $2', [`${titlePrefix}%`, testDescription]);
    if (authUserId) {
      await db.query('DELETE FROM app_profiles WHERE id = $1', [authUserId]);
      await admin.auth.admin.deleteUser(authUserId);
    }
  } finally {
    await db.end().catch(() => undefined);
  }
}

async function main() {
  await db.connect();

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `codex-smoke-${stamp}` },
  });
  if (created.error) throw created.error;
  authUserId = created.data.user.id;

  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const token = signedIn.data.session.access_token;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  await api('/api/auth/me', { headers });

  const single = await api('/api/scripts/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(scriptPayload('single')),
  });
  const singleId = String(single.script.id);
  if (!singleId || single.analysis !== null) {
    throw new Error('Single upload did not return the expected script payload');
  }

  const list = await api('/api/scripts?limit=20', { headers });
  if (!Array.isArray(list.scripts) || !list.scripts.some((script) => String(script.id) === singleId)) {
    throw new Error('Uploaded script was not returned by the scripts list');
  }

  const deleted = await api(`/api/scripts/${singleId}`, { method: 'DELETE', headers });
  if (deleted.deleted !== 1 || !deleted.deletedIds.map(String).includes(singleId)) {
    throw new Error('Single delete did not report the deleted script id');
  }

  const missing = await fetch(`${baseUrl}/api/scripts/${singleId}`, { headers });
  if (missing.status !== 404) {
    throw new Error(`Deleted script returned ${missing.status}; expected 404`);
  }

  const bulkA = await api('/api/scripts/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(scriptPayload('bulk-a')),
  });
  const bulkB = await api('/api/scripts/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(scriptPayload('bulk-b')),
  });
  const bulkIds = [String(bulkA.script.id), String(bulkB.script.id)];
  const bulkDeleted = await api('/api/scripts/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: bulkIds }),
  });
  if (bulkDeleted.deleted !== 2 || bulkDeleted.notDeletedIds.length !== 0) {
    throw new Error(`Bulk delete result was not exact: ${JSON.stringify(bulkDeleted)}`);
  }

  const zeroDelete = await fetch(`${baseUrl}/api/scripts/${singleId}`, { method: 'DELETE', headers });
  if (zeroDelete.status !== 404) {
    throw new Error(`Repeat delete returned ${zeroDelete.status}; expected 404`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    userId: authUserId,
    uploadedAndDeleted: [singleId, ...bulkIds],
    repeatDeleteStatus: zeroDelete.status,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
