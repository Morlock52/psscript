import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Captures screenshots demonstrating the modern Script Editor (VS Code-like shell).
 *
 * Run:
 *   npx playwright test tests/e2e/script-editor.screenshots.spec.ts --project=chromium --workers=1
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs-site', 'static', 'images', 'screenshots', 'variants');

const SCRIPT_ID = 900;
const SCRIPT_TITLE = 'Modern Editor Demo';
const SCRIPT_DESCRIPTION = 'Demonstration script used for documentation screenshots.';

const V1 = `#region Demo
function Get-Greeting {
  param([string]$Name)
  Write-Output "Hello, $Name"
}

Get-Greeting -Name "World"
#endregion
`;

const V2 = `#region Demo
function Get-Greeting {
  param([string]$Name)
  Write-Output "Hello, $Name"
}

Get-Greeting -Name "World"

# Intentional issue for Problems panel demo
Write-Host $undefinedVar
#endregion
`;

const V3 = `#region Demo
function Get-Greeting {
  param([Parameter(Mandatory)][string]$Name)
  Write-Output "Hello, $Name"
}

Get-Greeting -Name "World"

# Intentional issue for Problems panel demo
Write-Host $undefinedVar
#endregion
`;

function json(data: any) {
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  };
}

test.describe('Script Editor Screenshots', () => {
  test('Capture editor, palette, problems, diff', async ({ page }) => {
    test.setTimeout(120_000);
    ensureDir(OUT_DIR);

    // Best-effort login; safe in auth-disabled mode.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const demoButton = page.getByRole('button', { name: /Sign in as Demo Admin/i });
    if (await demoButton.count()) {
      await demoButton.first().click();
      await page.waitForTimeout(1200);
    }

    // Stub script + versions endpoints so screenshots are stable even if DB contents vary.
    await page.route(`**/api/scripts/${SCRIPT_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill(
          json({
            script: {
              id: SCRIPT_ID,
              title: SCRIPT_TITLE,
              description: SCRIPT_DESCRIPTION,
              content: V3,
              version: 3,
              updatedAt: new Date('2026-02-07T12:00:00.000Z').toISOString(),
            },
          })
        );
        return;
      }

      if (method === 'PUT' || method === 'PATCH') {
        const body = route.request().postDataJSON?.() || {};
        await route.fulfill(
          json({
            script: {
              id: SCRIPT_ID,
              title: body.title ?? SCRIPT_TITLE,
              description: body.description ?? SCRIPT_DESCRIPTION,
              content: body.content ?? V3,
              version: 4,
              updatedAt: new Date('2026-02-07T12:01:00.000Z').toISOString(),
            },
          })
        );
        return;
      }

      await route.fallback();
    });

    await page.route(`**/api/scripts/${SCRIPT_ID}/versions`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill(
        json({
          scriptId: SCRIPT_ID,
          scriptTitle: SCRIPT_TITLE,
          currentVersion: 3,
          totalVersions: 3,
          versions: [
            {
              id: 1,
              version: 3,
              changelog: 'Updated parameter constraints + added diagnostics demo',
              userId: 1,
              createdAt: new Date('2026-02-07T11:50:00.000Z').toISOString(),
              user: { id: 1, username: 'admin' },
              linesChanged: 4,
            },
            {
              id: 2,
              version: 2,
              changelog: 'Added Problems panel demo issue',
              userId: 1,
              createdAt: new Date('2026-02-07T11:40:00.000Z').toISOString(),
              user: { id: 1, username: 'admin' },
              linesChanged: 2,
            },
            {
              id: 3,
              version: 1,
              changelog: 'Initial version',
              userId: 1,
              createdAt: new Date('2026-02-07T11:30:00.000Z').toISOString(),
              user: { id: 1, username: 'admin' },
              linesChanged: 0,
            },
          ],
        })
      );
    });

    await page.route(`**/api/scripts/${SCRIPT_ID}/versions/*`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const url = route.request().url();
      const m = url.match(/\/versions\/(\d+)$/);
      const version = m ? Number(m[1]) : 3;
      const content = version === 1 ? V1 : version === 2 ? V2 : V3;
      await route.fulfill(
        json({
          scriptId: SCRIPT_ID,
          scriptTitle: SCRIPT_TITLE,
          currentVersion: 3,
          version: {
            id: version,
            scriptId: SCRIPT_ID,
            version,
            content,
            changelog: version === 1 ? 'Initial version' : version === 2 ? 'Added Problems panel demo issue' : 'Updated parameter constraints + added diagnostics demo',
            userId: 1,
            createdAt: new Date('2026-02-07T11:00:00.000Z').toISOString(),
            user: { id: 1, username: 'admin' },
          },
          isCurrentVersion: version === 3,
        })
      );
    });

    await page.route('**/api/editor/lint', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill(
        json({
          issues: [
            {
              severity: 'Warning',
              ruleName: 'PSUseDeclaredVarsMoreThanAssignments',
              message: 'The variable $undefinedVar is assigned but never used or declared in this scope.',
              line: 12,
              column: 12,
            },
            {
              severity: 'Info',
              ruleName: 'PSAvoidUsingWriteHost',
              message: 'Write-Host writes directly to the host and is harder to test. Consider Write-Output.',
              line: 12,
              column: 1,
            },
          ],
        })
      );
    });

    await page.goto(`/scripts/${SCRIPT_ID}/edit`, { waitUntil: 'domcontentloaded' });
    // The app renders a global page title plus the page-local title; scope to main.
    await expect(page.getByRole('main').getByRole('heading', { name: /Edit Script/i })).toBeVisible();
    await page.waitForTimeout(1200);

    // 1) Base editor shell
    await page.screenshot({ path: path.join(OUT_DIR, 'script-editor-v1.png'), fullPage: true });

    // 2) Command palette
    await page.getByRole('button', { name: /Commands/i }).click();
    await expect(page.getByRole('dialog', { name: /Command Palette/i })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'script-editor-palette-v1.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    // 3) Problems panel (run lint)
    await page.getByRole('button', { name: /^Lint$/ }).click();
    await page.waitForTimeout(650);
    await expect(page.getByText(/Source: PSScriptAnalyzer|AI lint/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(OUT_DIR, 'script-editor-problems-v1.png'), fullPage: true });

    // 4) Diff panel
    const diffBtn = page.getByRole('button', { name: /Diff vs current/i }).nth(1);
    await diffBtn.click();
    await page.waitForTimeout(900);
    await expect(page.getByText(/Comparing v\d+ → v\d+/i)).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, 'script-editor-diff-v1.png'), fullPage: true });
  });
});
