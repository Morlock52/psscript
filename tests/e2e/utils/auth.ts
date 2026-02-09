import { expect, type Page } from '@playwright/test';

/**
 * Login helper that works in both modes:
 * - Auth disabled (VITE_DISABLE_AUTH=true): /login redirects away immediately.
 * - Auth enabled: uses the Quick Access demo/admin button (preferred), falling back to "Use Default Login".
 */
export async function loginIfNeeded(page: Page, testInfo?: any): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // If auth is disabled, Login.tsx navigates away from /login via an effect.
  // That redirect can happen after domcontentloaded, so give it a moment and
  // treat "already on app shell" as logged-in.
  if (/\/login/i.test(page.url())) {
    await Promise.race([
      // Redirect away from /login (auth-disabled mode).
      page
        .waitForURL((url) => !/\/login/i.test(url.pathname), { timeout: 2500, waitUntil: 'domcontentloaded' })
        .catch(() => {}),
      // Or the login heading becomes visible (auth-enabled mode).
      page.getByRole('heading', { name: /login/i }).waitFor({ state: 'visible', timeout: 2500 }).catch(() => {}),
    ]);
  }

  // If we are not actually on the login route (or the app shell is already rendered), we can proceed.
  if (!/\/login/i.test(page.url())) return;
  if ((await page.getByRole('navigation').count()) > 0) return;

  // The UI has varied across iterations; support the current "Sign in as Demo Admin"
  // button as well as older "Use Default Login".
  const demoAdminButton = page.getByRole('button', { name: /sign in as demo admin/i });
  const defaultLoginButton = page.getByRole('button', { name: /use default login/i });
  const loginButton = (await demoAdminButton.count()) > 0 ? demoAdminButton : defaultLoginButton;

  await expect(loginButton).toBeVisible({ timeout: 15000 });

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
    { timeout: 20000 }
  );

  const isMobile = Boolean(
    testInfo?.project?.use?.isMobile || /mobile/i.test(testInfo?.project?.name || '')
  );

  if (isMobile) {
    try {
      await loginButton.tap();
    } catch {
      await loginButton.click();
    }
  } else {
    await loginButton.click();
  }

  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok()).toBeTruthy();

  // Wait for successful navigation
  await page.waitForURL(/dashboard|scripts|\/$/i, { timeout: 20000, waitUntil: 'domcontentloaded' });
}
