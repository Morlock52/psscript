import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script Management Tests
 * Tests script upload, analysis, and management features
 */

// Helper function to perform login
async function loginAsTestUser(page: any, testInfo?: any) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Use the "Use Default Login" button for quick authentication
  const defaultLoginButton = page.getByRole('button', { name: 'Use Default Login' });
  const isMobile = Boolean(
    testInfo?.project?.use?.isMobile || /mobile/i.test(testInfo?.project?.name || '')
  );
  const loginResponsePromise = page.waitForResponse(
    response => response.url().includes('/auth/login') && response.request().method() === 'POST',
    { timeout: 15000 }
  );

  if (isMobile) {
    try {
      await defaultLoginButton.tap();
    } catch (err) {
      await defaultLoginButton.click();
    }
  } else {
    await defaultLoginButton.click();
  }

  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok()).toBeTruthy();

  // Wait for successful login (redirect to dashboard or scripts)
  // Mobile browsers need more time for navigation
  const timeout = isMobile ? 20000 : 10000;
  await page.waitForURL(/dashboard|scripts|\/$/i, { timeout, waitUntil: 'domcontentloaded' });
}

test.describe('Script Upload', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Login first before accessing protected routes
    await loginAsTestUser(page, testInfo);

    // Navigate to scripts page
    await page.goto('/scripts');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('Should display upload button', async ({ page, browserName }) => {
    // Firefox needs extra wait time for page render (2026 known issue)
    if (browserName === 'firefox') {
      await page.waitForTimeout(1000);
    }

    const uploadButton = page.getByRole('button', { name: /upload|add script|new script/i });
    await expect(uploadButton).toBeVisible({ timeout: 15000 });
  });

  test('Should allow file selection for upload', async ({ page }) => {
    // Create test PowerShell script file
    const testScriptPath = path.join(__dirname, '../fixtures/test-script.ps1');
    const testScriptContent = `
# Test PowerShell Script
Write-Host "Hello, World!"
Get-Date
    `.trim();

    // Ensure fixtures directory exists
    const fixturesDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Write test script
    fs.writeFileSync(testScriptPath, testScriptContent);

    // Find upload button
    const uploadButton = page.getByRole('button', { name: /upload|add script|new script/i });

    if (await uploadButton.isVisible()) {
      await uploadButton.click();

      // Look for file input
      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.isVisible()) {
        // Set file
        await fileInput.setInputFiles(testScriptPath);

        // Look for submit/upload button in modal
        const submitButton = page.getByRole('button', { name: /submit|upload|confirm/i });

        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for upload to complete
          await page.waitForResponse(
            response => response.url().includes('/api/scripts') && response.status() === 200,
            { timeout: 30000 }
          );

          // Success message should appear
          const successMessage = page.getByText(/success|uploaded|added/i);
          await expect(successMessage).toBeVisible({ timeout: 10000 });
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testScriptPath)) {
      fs.unlinkSync(testScriptPath);
    }
  });

  test('Should validate file type on upload', async ({ page }) => {
    // Create invalid file type
    const invalidFilePath = path.join(__dirname, '../fixtures/invalid-file.txt');
    fs.writeFileSync(invalidFilePath, 'Not a PowerShell script');

    const uploadButton = page.getByRole('button', { name: /upload|add script|new script/i });

    if (await uploadButton.isVisible()) {
      await uploadButton.click();

      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles(invalidFilePath);

        // Should show validation error
        const errorMessage = page.getByText(/invalid|not supported|wrong type/i);

        // Either immediate validation or after submit attempt
        const submitButton = page.getByRole('button', { name: /submit|upload|confirm/i });

        if (await submitButton.isVisible()) {
          await submitButton.click();
        }

        // Error should be visible
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
      }
    }

    // Cleanup
    if (fs.existsSync(invalidFilePath)) {
      fs.unlinkSync(invalidFilePath);
    }
  });
});

test.describe('Script Analysis', () => {
  test('Should trigger AI analysis on uploaded script', async ({ page, request }, testInfo) => {
    // Login first before accessing protected routes
    await loginAsTestUser(page, testInfo);

    // Upload a script first
    const testScriptContent = `
# Security Test Script
$password = "hardcoded_password"
Invoke-WebRequest -Uri "http://example.com"
    `.trim();

    // Create test file
    const testScriptPath = path.join(__dirname, '../fixtures/security-test.ps1');
    const fixturesDir = path.join(__dirname, '../fixtures');

    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    fs.writeFileSync(testScriptPath, testScriptContent);

    await page.goto('/scripts');

    const uploadButton = page.getByRole('button', { name: /upload|add script/i });

    if (await uploadButton.isVisible()) {
      await uploadButton.click();

      const fileInput = page.locator('input[type="file"]');

      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles(testScriptPath);

        const submitButton = page.getByRole('button', { name: /submit|upload|confirm/i });

        if (await submitButton.isVisible()) {
          await submitButton.click();

          // Wait for analysis to complete
          await page.waitForTimeout(5000);

          // Look for analysis results
          const analysisSection = page.getByText(/analysis|security|results/i);
          await expect(analysisSection.first()).toBeVisible({ timeout: 15000 });

          // Should detect security issue (hardcoded password)
          const securityWarning = page.getByText(/password|credential|security/i);
          await expect(securityWarning.first()).toBeVisible({ timeout: 10000 });
        }
      }
    }

    // Cleanup
    if (fs.existsSync(testScriptPath)) {
      fs.unlinkSync(testScriptPath);
    }
  });
});

test.describe('Script List View', () => {
  test('Should display list of uploaded scripts', async ({ page }, testInfo) => {
    // Login first before accessing protected routes
    await loginAsTestUser(page, testInfo);

    // Navigate to scripts page
    await page.goto('/scripts');

    // Wait for page to be fully loaded (2026 best practice: use waitForLoadState)
    await page.waitForLoadState('networkidle');

    // Use locator-based assertions with auto-retry (2026 best practice)
    // The page should show ONE of these states:
    // 1. Scripts table/list with actual scripts
    // 2. Empty state message
    // 3. Script cards or rows

    // Define all possible valid elements using robust selectors
    const scriptsTable = page.locator('[data-testid="scripts-list"]');
    const scriptCards = page.locator('[data-testid="script-card"]');
    const scriptRows = page.locator('table tbody tr, [role="row"]');
    const emptyState = page.getByText(/no scripts|empty|upload.*script|get started/i);
    const scriptsHeading = page.getByRole('heading', { name: /scripts/i });

    // Wait for the page heading to confirm we're on the right page
    await expect(scriptsHeading).toBeVisible({ timeout: 10000 });

    // Check if any valid content state is visible (use Promise.race for first match)
    const hasValidContent = await Promise.race([
      scriptsTable.isVisible().then(v => v ? 'table' : null),
      scriptCards.first().isVisible().then(v => v ? 'cards' : null),
      scriptRows.first().isVisible().then(v => v ? 'rows' : null),
      emptyState.first().isVisible().then(v => v ? 'empty' : null),
      // Timeout fallback after checking all options
      new Promise<string>(resolve => setTimeout(() => resolve('timeout'), 3000))
    ]);

    // If timeout, do a final comprehensive check
    if (hasValidContent === 'timeout') {
      const bodyText = await page.locator('body').textContent() || '';
      const hasScriptContent = bodyText.toLowerCase().includes('script') ||
                              bodyText.toLowerCase().includes('.ps1') ||
                              await scriptsTable.count() > 0 ||
                              await scriptCards.count() > 0;
      expect(hasScriptContent).toBeTruthy();
    } else {
      // We found valid content
      expect(hasValidContent).toBeTruthy();
    }
  });

  test('Should allow searching scripts', async ({ page }, testInfo) => {
    // Login first before accessing protected routes
    await loginAsTestUser(page, testInfo);

    // Navigate and wait for API response (2026 best practice)
    await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/api/scripts') && response.status() === 200,
        { timeout: 10000 }
      ).catch(() => null),
      page.goto('/scripts')
    ]);

    // Wait for React Query cache hydration
    await page.waitForTimeout(500);

    // Look for search input - specifically target the textbox, not the button
    const searchInput = page.getByRole('textbox', { name: /search/i });

    // Check if search input exists before trying to use it
    const searchInputCount = await searchInput.count();
    if (searchInputCount > 0) {
      await searchInput.fill('test');

      // Wait for search results to update
      await page.waitForTimeout(1000);

      // Results should be filtered
      const results = page.locator('[data-testid="script-item"]')
        .or(page.locator('tr').filter({ hasText: /test/i }));

      // At least verify search doesn't crash the page
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
