import { test, expect } from '@playwright/test';

/**
 * Authentication Flow Tests
 * Tests user login, registration, and session management
 * Uses semantic selectors following 2026 best practices
 */

test.describe.skip('User Authentication', () => {
  test.beforeEach(async ({ context }) => {
    // Start with fresh context for test isolation
    await context.clearCookies();
  });

  test('Should display login page', async ({ page }) => {
    await page.goto('/');

    // Use semantic selectors (getByRole, getByLabel, getByPlaceholder)
    const loginHeading = page.getByRole('heading', { name: /login|sign in/i });
    await expect(loginHeading).toBeVisible({ timeout: 10000 });
  });

  test('Should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/');

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
    await page.goto('/');

    // Look for registration link
    const registerLink = page.getByRole('link', { name: /sign up|register|create account/i });

    if (await registerLink.isVisible()) {
      await registerLink.click();

      // Verify registration form appears
      const registerHeading = page.getByRole('heading', { name: /sign up|register|create account/i });
      await expect(registerHeading).toBeVisible();
    }
  });

  test('Session should persist across page reloads', async ({ page, context }) => {
    // This test assumes a valid test user exists
    // Skip if no valid credentials available
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto('/');

    // Login
    const emailInput = page.getByLabel(/email|username/i).or(page.getByPlaceholder(/email|username/i));
    const passwordInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    // Use exact name to avoid strict mode violation
    const submitButton = page.getByRole('button', { name: 'Sign in' });

    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);
    await submitButton.click();

    // Wait for successful login (redirect or dashboard appears)
    await page.waitForURL(/dashboard|home|scripts/i, { timeout: 10000 });

    // Get cookies before reload
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('token') || c.name.includes('session'));

    expect(authCookie).toBeDefined();

    // Reload page
    await page.reload();

    // Should still be logged in
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe.skip('Protected Routes', () => {
  test('Should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login|auth|signin/i, { timeout: 5000 });
  });

  test('Should allow access to public routes without auth', async ({ page }) => {
    // These routes should be accessible
    const publicRoutes = ['/', '/about', '/contact'];

    for (const route of publicRoutes) {
      await page.goto(route);

      // Should not redirect to login
      await expect(page).not.toHaveURL(/login|auth|signin/i);

      // Page should load successfully
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
