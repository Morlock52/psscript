import { test, expect } from '@playwright/test';
import waitForFrontend from './utils/waitForFrontend';

const uiDescribe = process.env.PW_UI === 'true' ? test.describe : test.describe.skip;

async function loginAsTestUser(page: any, testInfo?: any) {
  await page.goto('/scripts');
  await page.waitForLoadState('domcontentloaded');

  const onLoginRoute = /\/login\b/i.test(new URL(page.url()).pathname);
  const defaultLoginButton = page.getByRole('button', { name: /Use Default Login|Sign in as Demo Admin/i });
  const isMobile = Boolean(
    testInfo?.project?.use?.isMobile || /mobile/i.test(testInfo?.project?.name || '')
  );
  const canDefaultLogin = await defaultLoginButton.isVisible().catch(() => false);

  if (!onLoginRoute && !canDefaultLogin) return;

  const loginResponsePromise = page
    .waitForResponse(
      (response: any) => response.url().includes('/auth/login') && response.request().method() === 'POST',
      { timeout: 15000 }
    )
    .catch(() => null);

  if (isMobile) {
    try {
      await defaultLoginButton.tap();
    } catch {
      await defaultLoginButton.click();
    }
  } else {
    await defaultLoginButton.click();
  }

  const loginResponse = await loginResponsePromise;
  if (loginResponse) expect(loginResponse.ok()).toBeTruthy();

  const timeout = isMobile ? 20000 : 10000;
  await page.waitForURL(/dashboard|scripts|\/$/i, { timeout, waitUntil: 'domcontentloaded' });
}

uiDescribe('Script Editor (Modern)', () => {
  test('Autosave, Problems panel, and command palette render', async ({ page, request }, testInfo) => {
    const baseURL =
      process.env.PW_BASE_URL ||
      process.env.BASE_URL ||
      (typeof testInfo.project.use.baseURL === 'string' ? testInfo.project.use.baseURL : '') ||
      'http://127.0.0.1:3090';
    await waitForFrontend(request, new URL(baseURL).origin);

    const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';
    const apiBase = `${backendBase}/api`;

    // Create a script via API (auth disabled in local dev)
    const createResp = await request.post(`${apiBase}/scripts`, {
      data: {
        title: 'Editor Test Script',
        description: 'Created by Playwright',
        content: 'Write-Host \"hello\"\\n',
      },
    });
    expect([200, 201]).toContain(createResp.status());
    const created = await createResp.json();
    const scriptId = String(created?.script?.id ?? created?.id ?? created?.data?.id);
    expect(scriptId).toMatch(/\d+/);

    // Stub deterministic lint endpoint (so Problems panel can show content)
    await page.route('**/api/editor/lint', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          issues: [
            { severity: 'Warning', ruleName: 'TestRule', message: 'Example warning', line: 1, column: 1 },
            { severity: 'Error', ruleName: 'TestRule2', message: 'Example error', line: 2, column: 1 },
          ],
        }),
      });
    });

    await loginAsTestUser(page, testInfo);

    await page.goto(`/scripts/${scriptId}/edit`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Commands/i })).toBeVisible();
    await expect(page.getByText(/Problems\s*\(\d+\/\d+\/\d+\)/i)).toBeVisible();

    // Trigger lint and verify problems show up
    await page.getByRole('button', { name: /^Lint$/i }).click();
    await expect(page.getByText(/Example warning/i)).toBeVisible();
    await expect(page.getByText(/Example error/i)).toBeVisible();

    // Type and verify autosave hits update endpoint
    const saveRespPromise = page.waitForResponse(
      (r) => r.url().includes(`/api/scripts/${scriptId}`) && r.request().method() === 'PUT',
      { timeout: 30000 }
    );

    // Focus editor and type
    await page.click('.monaco-editor');
    await page.keyboard.type('\\nWrite-Host \"world\"');
    await saveRespPromise;

    // Command palette shortcut
    await page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('KeyP');
    await page.keyboard.up('Shift');
    await page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');

    await expect(page.getByText(/Editor Command Palette/i)).toBeVisible();
  });
});

