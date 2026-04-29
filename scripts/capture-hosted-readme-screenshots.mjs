import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const screenshotDir = path.join(root, 'docs/screenshots');
const baseUrl = (process.env.SCREENSHOT_BASE_URL || 'https://pstest.morloksmaze.com').replace(/\/+$/, '');
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL');
}

const stamp = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const email = `psscript-readme-shot-${stamp}@example.invalid`;
const password = `Psscript-${stamp}-Aa1!`;
const titlePrefix = `README Screenshot ${stamp}`;
const testDescription = 'Temporary README screenshot seed data';

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
let accessToken = '';
let firstScriptId = '';

const appShots = [
  ['dashboard.png', '/dashboard'],
  ['scripts.png', '/scripts'],
  ['upload.png', '/scripts/upload'],
  ['documentation.png', '/documentation'],
  ['chat.png', '/chat'],
  ['analytics.png', '/analytics'],
  ['settings.png', '/settings'],
  ['settings-profile.png', '/settings/profile'],
  ['data-maintenance.png', '/settings/data'],
  ['agentic-assistant.png', '/agentic'],
  ['agent-orchestration.png', '/agentic-ai'],
  ['ui-components.png', '/ui-components'],
];

function scriptPayload(suffix, content) {
  return {
    title: `${titlePrefix} ${suffix}`,
    description: testDescription,
    content,
    file_name: `${titlePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}.ps1`,
    tags: ['readme-screenshot', 'hosted'],
    is_public: false,
    analyze_with_ai: false,
  };
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body ? body.message || body.error : body;
    throw new Error(`${options.method || 'GET'} ${pathname} failed (${response.status}): ${message}`);
  }
  return body;
}

async function seedHostedData() {
  await db.connect();

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `readme-shot-${stamp}` },
  });
  if (created.error) throw created.error;
  authUserId = created.data.user.id;

  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  accessToken = signedIn.data.session.access_token;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  await api('/api/auth/me', { headers });
  await db.query(
    "UPDATE app_profiles SET role = 'admin', is_enabled = true, username = $2 WHERE id = $1",
    [authUserId, `readme-shot-${stamp}`]
  );

  const first = await api('/api/scripts/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(scriptPayload('Inventory Audit', [
      'param([string]$ComputerName = $env:COMPUTERNAME)',
      'Get-CimInstance Win32_OperatingSystem -ComputerName $ComputerName |',
      '  Select-Object CSName, Caption, Version, LastBootUpTime',
      'Write-Output "Inventory audit complete"',
      '',
    ].join('\n'))),
  });
  firstScriptId = String(first.script.id);

  await api('/api/scripts/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify(scriptPayload('Service Health', [
      '$services = "Spooler", "WinRM", "BITS"',
      'foreach ($service in $services) {',
      '  Get-Service -Name $service | Select-Object Name, Status, StartType',
      '}',
      '',
    ].join('\n'))),
  });

  await db.query(
    `
      INSERT INTO script_analysis (
        script_id,
        purpose,
        security_score,
        quality_score,
        risk_score,
        suggestions,
        command_details,
        security_issues,
        best_practice_violations,
        performance_insights,
        execution_summary,
        analysis_version
      )
      VALUES (
        $1,
        $2,
        8.4,
        8.1,
        2.2,
        $3::jsonb,
        $4::jsonb,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        'readme-screenshot-v2026-04-29'
      )
      ON CONFLICT (script_id)
      DO UPDATE SET
        purpose = EXCLUDED.purpose,
        security_score = EXCLUDED.security_score,
        quality_score = EXCLUDED.quality_score,
        risk_score = EXCLUDED.risk_score,
        suggestions = EXCLUDED.suggestions,
        command_details = EXCLUDED.command_details,
        security_issues = EXCLUDED.security_issues,
        best_practice_violations = EXCLUDED.best_practice_violations,
        performance_insights = EXCLUDED.performance_insights,
        execution_summary = EXCLUDED.execution_summary,
        analysis_version = EXCLUDED.analysis_version
    `,
    [
      firstScriptId,
      'Collects basic operating system inventory for a target Windows host and reports the result without changing system state.',
      JSON.stringify(['Add comment-based help.', 'Add explicit error handling for unreachable hosts.', 'Use approved output formatting for scheduled reports.']),
      JSON.stringify([{ command: 'Get-CimInstance', purpose: 'Reads operating system inventory through CIM.' }]),
      JSON.stringify(['No credential material or destructive operation was detected.']),
      JSON.stringify(['Add [CmdletBinding()] and parameter validation for ComputerName.']),
      JSON.stringify(['For large host lists, stream hostnames through the pipeline rather than materializing arrays.']),
      JSON.stringify({ canRunHosted: false, recommendation: 'Review locally with WhatIf-style validation before scheduling.' }),
    ]
  );
}

async function capture(page, fileName) {
  await page.screenshot({
    path: path.join(screenshotDir, fileName),
    fullPage: false,
    timeout: 60000,
  });
}

async function waitForSettle(page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForFunction(() => document.querySelectorAll('.animate-spin').length === 0, null, {
    timeout: 10000,
  }).catch(() => undefined);
  await page.waitForTimeout(900);
}

async function captureScreenshots() {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Sign in to PSScript/i).first().waitFor({ state: 'visible', timeout: 30000 });
    await capture(page, 'login.png');

    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 });
    await waitForSettle(page);

    for (const [fileName, route] of appShots) {
      console.log(`Capturing ${fileName} from ${baseUrl}${route}`);
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitForSettle(page);
      await capture(page, fileName);
    }

    console.log(`Capturing script-detail.png from ${baseUrl}/scripts/${firstScriptId}`);
    await page.goto(`${baseUrl}/scripts/${firstScriptId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForSettle(page);
    await capture(page, 'script-detail.png');

    console.log(`Capturing analysis.png from ${baseUrl}/scripts/${firstScriptId}/analysis`);
    await page.goto(`${baseUrl}/scripts/${firstScriptId}/analysis`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForSettle(page);
    await capture(page, 'analysis.png');
  } finally {
    await browser.close();
  }
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
  await seedHostedData();
  await captureScreenshots();
  console.log(JSON.stringify({ ok: true, baseUrl, userId: authUserId, firstScriptId }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(cleanup);
