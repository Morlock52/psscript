import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Non-assertive UI smoke that captures screenshots for quick human verification.
 * Run manually as needed:
 *   npx playwright test tests/e2e/app-screenshots.spec.ts --project=chromium --workers=1
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe('App Screenshots', () => {
  test('Capture home + chat screenshots', async ({ page }) => {
    const outDir = path.join(process.cwd(), 'artifacts', 'screenshots');
    ensureDir(outDir);

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/PSScript/i);
    await page.screenshot({ path: path.join(outDir, 'home.png'), fullPage: true });

    await page.goto('/chat', { waitUntil: 'networkidle' });
    await expect(page.getByPlaceholder('Type your PowerShell question...')).toBeVisible();
    await page.screenshot({ path: path.join(outDir, 'chat.png'), fullPage: true });

    await page.goto('/documentation', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'PowerShell Documentation Explorer' })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, 'documentation.png'), fullPage: true });

    await page.goto('/ai/assistant', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'PowerShell AI Assistant' })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, 'ai_assistant.png'), fullPage: true });

    await page.goto('/ai/agents', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Agent Orchestration/i })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, 'agent_orchestration.png'), fullPage: true });
  });
});
