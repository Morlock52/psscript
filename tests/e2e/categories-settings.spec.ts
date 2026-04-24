import { test, expect } from '@playwright/test';
import waitForFrontend from './utils/waitForFrontend';

async function loginIfNeeded(page: any, testInfo?: any) {
  await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });
  if (!page.url().includes('/login')) return;

  const demoBtn = page.getByRole('button', { name: /Sign in as Demo Admin/i });
  await expect(demoBtn).toBeVisible({ timeout: 15000 });
  await demoBtn.click();

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

    const frontendUrl = new URL(baseURL);
    const backendBase =
      process.env.PW_BACKEND_URL ||
      process.env.BACKEND_URL ||
      (
        (frontendUrl.hostname === '127.0.0.1' || frontendUrl.hostname === 'localhost') &&
        frontendUrl.port === '3091'
          ? `${frontendUrl.protocol}//${frontendUrl.hostname}:4000`
          : 'https://127.0.0.1:4000'
      );
    const apiBase = `${backendBase}/api`;

    await loginIfNeeded(page, testInfo);
    await page.goto('/settings/categories', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Script Categories/i })).toBeVisible();

    const catName = `E2E Category ${Date.now()}`;

    await page.getByLabel(/Name/i).fill(catName);
    await page.getByLabel(/Description/i).fill('Created by Playwright');
    await page.getByRole('button', { name: /^Create$/ }).click();

    const list = page.getByTestId('categories-list');
    await expect(list.getByText(catName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('categories-refreshing')).not.toContainText('Refreshing', { timeout: 15000 });

    const rowByText = list.locator('[data-category-name]').filter({ hasText: catName }).first();
    let categoryId: string | null = null;
    await expect
      .poll(async () => {
        const id = await rowByText.getAttribute('data-category-id');
        categoryId = typeof id === 'string' ? id : null;
        return categoryId && !categoryId.startsWith('-') ? categoryId : null;
      }, { timeout: 20000 })
      .not.toBeNull();
    categoryId = categoryId as string;

    const row = list.locator(`[data-category-id="${categoryId}"]`).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('categories-refreshing')).not.toContainText('Refreshing', { timeout: 15000 });

    await row.getByRole('button', { name: /^Edit$/ }).click();
    const descInput = row.getByTestId('category-edit-description');
    await expect(descInput).toBeVisible({ timeout: 15000 });
    await descInput.fill('Updated by Playwright');
    await row.getByRole('button', { name: /^Save$/ }).click();
    await expect(row.getByText('Updated by Playwright')).toBeVisible({ timeout: 15000 });

    const catsResp = await request.get(`${apiBase}/categories`);
    expect(catsResp.ok()).toBeTruthy();
    const catsJson = await catsResp.json();
    const createdCat = (catsJson.categories || []).find((c: any) => c.name === catName);
    expect(createdCat?.id).toBeTruthy();

    const scriptResp = await request.post(`${apiBase}/scripts`, {
      data: {
        title: `E2E Script ${Date.now()}`,
        description: 'Created by Playwright',
        content: 'Write-Output "hello"\\n',
        categoryId: createdCat.id,
      },
    });
    expect([200, 201]).toContain(scriptResp.status());
    const scriptJson = await scriptResp.json();
    const scriptId = Number(scriptJson?.script?.id ?? scriptJson?.id);
    expect(scriptId).toBeTruthy();

    await page.getByRole('button', { name: /Refresh/i }).click();

    const row2 = list.locator(`[data-category-id="${categoryId}"]`).first();
    await expect(row2.getByText('1', { exact: true })).toBeVisible({ timeout: 15000 });
    await row2.getByRole('button', { name: 'Delete' }).click();

    const confirmButton = page.getByRole('button', { name: /Uncategorize and delete/i });
    await expect(confirmButton).toBeVisible({ timeout: 10000 });
    await confirmButton.click();

    await expect(page.getByText(catName)).toHaveCount(0);

    await expect
      .poll(async () => {
        const scriptAfter = await request.get(`${apiBase}/scripts/${scriptId}`);
        if (!scriptAfter.ok()) return undefined;
        const scriptAfterJson = await scriptAfter.json();
        const scriptObj = scriptAfterJson?.script || scriptAfterJson;
        return scriptObj?.categoryId ?? null;
      }, { timeout: 60000 })
      .toBeNull();

    await request.delete(`${apiBase}/scripts/${scriptId}`);
  });
});
