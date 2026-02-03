import { test, expect } from '@playwright/test';

/**
 * Documentation UI
 * Regression test: ensure the frontend does NOT attempt to call http://backend:4000 from the browser.
 * This used to happen when VITE_API_URL was set to http://backend:4000/api in the frontend image.
 */

test.describe('Documentation UI', () => {
  test.setTimeout(120_000);

  test('Loads /documentation without docker-only hostname requests', async ({ page }) => {
    const failed: string[] = [];

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('backend:4000')) {
        failed.push(url);
      }
    });

    await page.goto('/documentation', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'PowerShell Documentation Explorer' })).toBeVisible();

    expect(failed, `Unexpected docker-only hostnames in browser requests:\n${failed.join('\n')}`).toHaveLength(0);
  });
});

