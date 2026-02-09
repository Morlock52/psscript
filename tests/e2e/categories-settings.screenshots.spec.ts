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

    // Navigate to the protected page; if auth is enabled, use the demo login button.
    await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });
    if (/\/login\b/i.test(page.url())) {
      await page.getByRole('button', { name: 'Use Default Login' }).click();
      await page.waitForURL((u: URL) => !/\/login\b/i.test(u.pathname), { timeout: 15_000, waitUntil: 'domcontentloaded' });
      await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });
    }

    await expect(page.getByRole('heading', { name: /Script Categories/i })).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, 'settings-categories-v1.png'), fullPage: true });

    // Ensure there's a category with at least 1 script so the uncategorize-delete confirm appears.
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    const authHeaders =
      token && token !== 'dev-auth-disabled' ? { Authorization: `Bearer ${token}` } : undefined;

    const suffix = Date.now();
    const categoryName = `Screenshot Category ${suffix}`;

    const createCategoryRes = await page.request.post('https://127.0.0.1:4000/api/categories', {
      data: { name: categoryName, description: 'Created by screenshots spec' },
      headers: authHeaders,
    });
    expect(createCategoryRes.ok()).toBeTruthy();
    const createdCategory = await createCategoryRes.json();

    const createScriptRes = await page.request.post('https://127.0.0.1:4000/api/scripts', {
      data: {
        title: `Screenshot Script ${suffix}`,
        description: 'Created by screenshots spec',
        content: "Write-Host 'Hello from screenshot spec'",
        categoryId: createdCategory.id,
      },
      headers: authHeaders,
    });
    expect(createScriptRes.ok()).toBeTruthy();

    await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Script Categories/i })).toBeVisible();

    // Filter so the newly-created row is in view (list can be scrollable).
    await page.getByPlaceholder(/filter categories/i).fill(categoryName);

    // Find the created category row and click Delete -> should open confirm dialog.
    const createdRow = page.locator(`[data-category-name="${categoryName}"]`).first();
    await expect(createdRow).toBeVisible({ timeout: 15_000 });

    const deleteBtn = createdRow.getByRole('button', { name: 'Delete' });
    await deleteBtn.click();

    const dlg = page.getByRole('dialog', { name: /Delete category and uncategorize scripts/i });
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'settings-categories-delete-confirm-v1.png'), fullPage: true });
  });
});
