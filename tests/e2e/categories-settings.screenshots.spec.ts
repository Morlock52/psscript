import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Captures screenshots for Settings -> Script Categories page.
 *
 * Run:
 *   npx playwright test tests/e2e/categories-settings.screenshots.spec.ts --project=chromium --workers=1
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe('Categories Settings Screenshots', () => {
  test('Capture categories page + delete confirm', async ({ page }) => {
    const root = process.cwd();
    const outDir = path.join(root, 'docs-site', 'static', 'images', 'screenshots', 'variants');
    ensureDir(outDir);

    // Login with seeded admin credentials.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Email Address/i).fill('admin@example.com');
    await page.getByLabel(/^Password$/i).fill('admin123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await page.waitForURL((u: URL) => !/\/login\b/i.test(u.pathname), { timeout: 15_000, waitUntil: 'domcontentloaded' });

    await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Script Categories/i })).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, 'settings-categories-v1.png'), fullPage: true });

    // Create a category then open delete-confirm (scriptCount will be 0; modal won't show)
    // For modal screenshot, stub a row in-place by clicking delete on any row with scripts, if present.
    const deleteButtons = page.getByRole('button', { name: 'Delete' });
    if (await deleteButtons.count()) {
      await deleteButtons.first().click();
      const dlg = page.getByRole('dialog', { name: /Delete category and uncategorize scripts/i });
      if (await dlg.count()) {
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, 'settings-categories-delete-confirm-v1.png'), fullPage: true });
      }
    }
  });
});
