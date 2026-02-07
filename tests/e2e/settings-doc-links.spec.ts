import { test, expect } from '@playwright/test';
import waitForFrontend from './utils/waitForFrontend';

/**
 * Settings Docs Links
 * Ensures the Settings page uses the correct GitHub repo and raw file links,
 * and that the in-app README viewer loads via the backend endpoint.
 */

async function loginAsTestUser(page: any, testInfo?: any) {
  // Navigate to a protected page; if auth is disabled, this should just work.
  await page.goto('/settings');
  await page.waitForLoadState('domcontentloaded');

  const onLoginRoute = /\/login\b/i.test(new URL(page.url()).pathname);

  // Use the "Use Default Login" button for quick authentication (if present)
  const defaultLoginButton = page.getByRole('button', { name: /Use Default Login|Sign in as Demo Admin/i });
  const isMobile = Boolean(
    testInfo?.project?.use?.isMobile || /mobile/i.test(testInfo?.project?.name || '')
  );
  const canDefaultLogin = await defaultLoginButton.isVisible().catch(() => false);

  if (!onLoginRoute && !canDefaultLogin) {
    // Auth is likely disabled; nothing to do.
    return;
  }

  const loginResponsePromise = page
    .waitForResponse(
      (response: any) => response.url().includes('/auth/login') && response.request().method() === 'POST',
      { timeout: 15000 }
    )
    .catch(() => null);

  if (isMobile) {
    try {
      await defaultLoginButton.tap();
    } catch (_err) {
      await defaultLoginButton.click();
    }
  } else {
    await defaultLoginButton.click();
  }

  const loginResponse = await loginResponsePromise;
  if (loginResponse) {
    expect(loginResponse.ok()).toBeTruthy();
  }

  const timeout = isMobile ? 20000 : 10000;
  await page.waitForURL(/dashboard|settings|\/$/i, { timeout, waitUntil: 'domcontentloaded' });
}

const uiDescribe = process.env.PW_UI === 'true' ? test.describe : test.describe.skip;

uiDescribe('Settings docs links', () => {
  test('Docs exports links and README modal load correctly', async ({ page, request }, testInfo) => {
    const baseURL =
      process.env.PW_BASE_URL ||
      process.env.BASE_URL ||
      (typeof testInfo.project.use.baseURL === 'string' ? testInfo.project.use.baseURL : '') ||
      'http://127.0.0.1:3090';
    await waitForFrontend(request, new URL(baseURL).origin);

    const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';

    const exportsFixture = {
      repo: 'Morlock52/psscript',
      branch: 'main',
      pdf: [
        {
          filename: 'Training-Suite.pdf',
          localUrl: '/docs/exports/pdf/Training-Suite.pdf',
          githubRawUrl: 'https://raw.githubusercontent.com/Morlock52/psscript/main/docs/exports/pdf/Training-Suite.pdf',
          bytes: 123,
          modifiedAt: new Date('2026-02-07T00:00:00.000Z').toISOString(),
        },
      ],
      docx: [
        {
          filename: 'Training-Suite.docx',
          localUrl: '/docs/exports/docx/Training-Suite.docx',
          githubRawUrl: 'https://raw.githubusercontent.com/Morlock52/psscript/main/docs/exports/docx/Training-Suite.docx',
          bytes: 456,
          modifiedAt: new Date('2026-02-07T00:00:00.000Z').toISOString(),
        },
      ],
    };

    await page.route('**/api/docs/exports', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(exportsFixture),
      });
    });

    await page.route('**/api/docs/readme', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repo: 'Morlock52/psscript',
          branch: 'main',
          source: 'local',
          content: '# README\n\nSee [Example](https://example.com)\n',
        }),
      });
    });

    await loginAsTestUser(page, testInfo);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Documentation & Training/i })).toBeVisible();

    const pdfRow = page.getByTestId('docs-export-pdf-Training-Suite.pdf');
    const localPdfLink = pdfRow.getByRole('link', { name: /Open \(Local\)/i });
    const ghPdfLink = pdfRow.getByRole('link', { name: /Download \(GitHub\)/i });

    await expect(localPdfLink).toHaveAttribute('href', `${backendBase}${exportsFixture.pdf[0].localUrl}`);
    await expect(ghPdfLink).toHaveAttribute('href', exportsFixture.pdf[0].githubRawUrl);

    await page.getByRole('button', { name: /View README \(In App\)/i }).click();
    await expect(page.getByText(/Project README/i)).toBeVisible();
    const link = page.locator('a[href="https://example.com"]');
    await expect(link).toHaveAttribute('target', '_blank');
  });
});
