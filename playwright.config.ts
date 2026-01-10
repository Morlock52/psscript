import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for PSScript Platform
 * Tests: React Frontend (3000), Express Backend (4000), FastAPI AI Service (8000)
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests (2026 best practice: always retry for flaky test resilience)
  retries: process.env.CI ? 2 : 1,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for page.goto('/')
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time each action can take (increased for slower environments)
    actionTimeout: 15000,

    // Navigation timeout (2026 best practice: generous timeout for initial loads)
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports for responsive testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  // NOTE: Disabled because services are running in Docker
  // Enable this if you want Playwright to manage the services instead
  // webServer: [
  //   {
  //     command: 'cd src/frontend && npm run dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120000,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  //   {
  //     command: 'cd src/backend && npm run dev',
  //     url: 'http://localhost:4000/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120000,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  //   {
  //     command: 'cd src/ai && python -m uvicorn main:app --reload --port 8000',
  //     url: 'http://localhost:8000/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120000,
  //     stdout: 'pipe',
  //     stderr: 'pipe',
  //   },
  // ],

  // Global timeout for each test (increased for complex interactions)
  timeout: 60000,

  // Expect timeout (increased for dynamic content)
  expect: {
    timeout: 10000,
  },
});
