import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const envPath = path.join(repoRoot, '.env');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')])
  );
}

function projectRefFromSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  const hostname = new URL(rawUrl).hostname;
  return hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : '';
}

const dotEnv = loadDotEnv(envPath);
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || dotEnv.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF ||
  dotEnv.SUPABASE_PROJECT_REF ||
  projectRefFromSupabaseUrl(process.env.SUPABASE_URL || dotEnv.SUPABASE_URL);

if (!accessToken) {
  console.error('SUPABASE_ACCESS_TOKEN is required. Create a Supabase management access token with auth:write scope.');
  process.exit(1);
}

if (!projectRef) {
  console.error('SUPABASE_PROJECT_REF is required, or SUPABASE_URL must point at a *.supabase.co project URL.');
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ password_hibp_enabled: true }),
});

const text = await response.text();
let body;
try {
  body = text ? JSON.parse(text) : {};
} catch {
  body = { raw: text };
}

if (!response.ok) {
  console.error(`Failed to enable leaked password protection: HTTP ${response.status}`);
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(`Leaked password protection enabled for Supabase project ${projectRef}.`);
