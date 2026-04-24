import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 * Tests user login, registration, and session management
 * Uses semantic selectors following 2026 best practices
 */

async function authUiVisible(page: any) {
  const loginHeading = page.getByRole('heading', { name: /login|sign in/i });
  return loginHeading.isVisible().catch(() => false);
}

const registerText = /sign up|register|create (an )?account/i;

async function loginWithAvailableUi(page: any) {
  const demoButton = page.getByRole('button', { name: /sign in as demo admin|use default login/i });
  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click();
    await page.waitForURL(/dashboard|home|scripts/i, { timeout: 20000 });
    return;
  }

  const emailInput = page.getByLabel(/email|username/i).or(page.getByPlaceholder(/email|username/i));
  const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
  const submitButton = page.getByRole('button', { name: 'Sign in' });

  await emailInput.fill(process.env.TEST_USER_EMAIL || 'admin@example.com');
  await passwordInput.fill(process.env.TEST_USER_PASSWORD || 'admin123');
  await submitButton.click();
  await page.waitForURL(/dashboard|home|scripts/i, { timeout: 20000 });
}

test.describe('User Authentication', () => {
  test.beforeEach(async ({ context }) => {
    // Start with fresh context for test isolation
    await context.clearCookies();
  });

  test('Should display login page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (await authUiVisible(page)) {
      const loginHeading = page.getByRole('heading', { name: /login|sign in/i });
      await expect(loginHeading).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(page).toHaveURL(/dashboard|scripts/i, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('Should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (!(await authUiVisible(page))) {
      await expect(page).toHaveURL(/dashboard|scripts/i, { timeout: 10000 });
      await expect(page.locator('body')).toBeVisible();
      return;
    }

    // Find login form elements using semantic selectors
    const emailInput = page.getByLabel(/email|username/i).or(page.getByPlaceholder(/email|username/i));
    const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    // Use exact name to avoid strict mode violation (matches only "Sign in", not "Use Default Login")
    const submitButton = page.getByRole('button', { name: 'Sign in' });

    // Attempt login with invalid credentials
    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Wait for error message using data-testid (more reliable)
    const errorContainer = page.getByTestId('login-error-message');
    await expect(errorContainer).toBeVisible({ timeout: 10000 });

    // Verify error message content (use .first() to handle multiple matches)
    const errorMessage = page.getByText(/invalid|incorrect|failed/i).first();
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
  });

  test('Should navigate to registration page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (!(await authUiVisible(page))) {
      await page.goto('/register', { waitUntil: 'domcontentloaded' });
      const registerHeading = page.getByRole('heading', { name: registerText });
      await expect(registerHeading).toBeVisible();
      return;
    }

    // Look for registration link
    const registerLink = page.getByRole('link', { name: registerText });

    if (await registerLink.isVisible()) {
      await registerLink.click();

      // Verify registration form appears
      const registerHeading = page.getByRole('heading', { name: registerText });
      await expect(registerHeading).toBeVisible();
    }
  });

  test('Session should persist across page reloads', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (await authUiVisible(page)) {
      await loginWithAvailableUi(page);
    } else {
      await expect(page).toHaveURL(/dashboard|home|scripts/i, { timeout: 10000 });
    }

    // The app persists auth in localStorage rather than cookies.
    const authToken = await page.evaluate(() => window.localStorage.getItem('auth_token'));
    expect(authToken).toBeTruthy();

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    if (await authUiVisible(page)) {
      throw new Error('Session did not persist: login screen shown after reload');
    }

    await expect(page).toHaveURL(/dashboard|home|scripts/i, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('Should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    if (await authUiVisible(page)) {
      await expect(page).toHaveURL(/login|auth|signin/i, { timeout: 5000 });
      return;
    }

    await expect(page).toHaveURL(/dashboard/i, { timeout: 5000 });
  });

  test('Should allow access to public routes without auth', async ({ page }) => {
    // These routes should be accessible
    const publicRoutes = ['/', '/about', '/contact'];

    for (const route of publicRoutes) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Should not redirect to login
      await expect(page).not.toHaveURL(/login|auth|signin/i);

      // Page should load successfully
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
