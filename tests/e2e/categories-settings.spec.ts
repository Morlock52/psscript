import { test, expect } from '@playwright/test';
import waitForFrontend from './utils/waitForFrontend';

async function loginIfNeeded(page: any, testInfo?: any) {
  // Go directly to login to avoid flakiness from the splash screen + initial redirect.
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Use the built-in Demo Admin shortcut (fast + resilient to API URL changes).
  const demoBtn = page.getByRole('button', { name: /Sign in as Demo Admin/i });
  await expect(demoBtn).toBeVisible();
  await demoBtn.click();

  // Wait for token to be stored (AuthContext persists auth_token on success).
  await expect
    .poll(async () => page.evaluate(() => Boolean(localStorage.getItem('auth_token'))), { timeout: 20_000 })
    .toBe(true);
}

test.describe('Settings Categories', () => {
  test('Create, edit, delete, and uncategorize-delete works end-to-end', async ({ page, request }, testInfo) => {
    const baseURL =
      process.env.PW_BASE_URL ||
      process.env.BASE_URL ||
      (typeof testInfo.project.use.baseURL === 'string' ? testInfo.project.use.baseURL : '') ||
      'https://127.0.0.1:3090';
    await waitForFrontend(request, new URL(baseURL).origin);

    const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'https://127.0.0.1:4000';
    const apiBase = `${backendBase}/api`;

    await loginIfNeeded(page, testInfo);
    await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Script Categories/i })).toBeVisible();

    const catName = `E2E Category ${Date.now()}`;

    await page.getByLabel(/Name/i).fill(catName);
    await page.getByLabel(/Description/i).fill('Created by Playwright');
    await page.getByRole('button', { name: /^Create$/ }).click();

    // Wait until the row exists inside the list container (avoid matching nav/sidebar).
    const list = page.getByTestId('categories-list');
    await expect(list.getByText(catName)).toBeVisible({ timeout: 15000 });

    // Edit description
    const row = list.locator('[data-category-name]').filter({ hasText: catName }).first();
    await row.getByRole('button', { name: /^Edit$/ }).click();
    await row.getByLabel(/Description/i).fill('Updated by Playwright');
    await row.getByRole('button', { name: /^Save$/ }).click();
    await expect(row.getByText('Updated by Playwright')).toBeVisible({ timeout: 15000 });

    // Create a script assigned to this category (via API), then delete via uncategorize flow.
    const catsResp = await request.get(`${apiBase}/categories`);
    expect(catsResp.ok()).toBeTruthy();
    const catsJson = await catsResp.json();
    const createdCat = (catsJson.categories || []).find((c: any) => c.name === catName);
    expect(createdCat?.id).toBeTruthy();

    const scriptResp = await request.post(`${apiBase}/scripts`, {
      data: {
        title: `E2E Script ${Date.now()}`,
        description: 'Created by Playwright',
        content: 'Write-Output \"hello\"\\n',
        categoryId: createdCat.id,
      },
    });
    expect([200, 201]).toContain(scriptResp.status());
    const scriptJson = await scriptResp.json();
    const scriptId = Number(scriptJson?.script?.id ?? scriptJson?.id);
    expect(scriptId).toBeTruthy();

    // Refresh so scriptCount updates.
    await page.getByRole('button', { name: /Refresh/i }).click();
    await page.waitForTimeout(600);

    const row2 = list.locator('[data-category-name]').filter({ hasText: catName }).first();
    await row2.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('dialog', { name: /Delete category and uncategorize scripts/i })).toBeVisible();
    await page.getByRole('button', { name: /Uncategorize and delete/i }).click();

    await expect(page.getByText(catName)).toHaveCount(0);

    const scriptAfter = await request.get(`${apiBase}/scripts/${scriptId}`);
    expect(scriptAfter.ok()).toBeTruthy();
    const scriptAfterJson = await scriptAfter.json();
    const scriptObj = scriptAfterJson?.script || scriptAfterJson;
    expect(scriptObj?.categoryId ?? null).toBeNull();

    // Cleanup: delete script
    await request.delete(`${apiBase}/scripts/${scriptId}`);
  });
});
