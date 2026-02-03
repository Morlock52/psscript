import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Agent Orchestration UI
 * Regression: the frontend must NOT call /api/api/... when using apiClient (runtime base URL prefixing).
 * Also verifies the end-to-end agentic workflow returns an AI response.
 */
test.describe('Agent Orchestration UI', () => {
  test.setTimeout(180_000);

  test('Create agent, send message, and receive response (UI)', async ({ page }) => {
    const badUrls: string[] = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('/api/api/')) badUrls.push(url);
    });

    await page.goto('/ai/agents', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Agent Orchestration/i })).toBeVisible();

    // Select a template (card is clickable)
    await page.getByText('PowerShell Expert', { exact: true }).click();
    await page.getByRole('button', { name: /Create & Start Chat/i }).click();

    const input = page.getByPlaceholder(/Ask .*PowerShell/i);
    await expect(input).toBeVisible({ timeout: 60_000 });
    await expect(input).toBeEnabled({ timeout: 60_000 });

    const prompt = 'Reply with exactly this single token: UI_TEST_OK';
    await input.fill(prompt);
    await page.getByRole('button', { name: /^Send$/ }).click();

    // Wait for the processing indicator to appear and then disappear.
    await expect(page.getByText('Thinking...')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Thinking...')).toHaveCount(0, { timeout: 120_000 });

    await expect(page.getByText('UI_TEST_OK')).toBeVisible({ timeout: 30_000 });

    expect(badUrls, `Unexpected double /api prefix in browser requests:\n${badUrls.join('\n')}`).toHaveLength(0);

    const outDir = path.join(process.cwd(), 'artifacts', 'screenshots');
    ensureDir(outDir);
    await page.screenshot({ path: path.join(outDir, 'agent_orchestration_chat.png'), fullPage: true });
  });
});

