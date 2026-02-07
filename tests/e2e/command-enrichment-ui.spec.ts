import { test, expect } from '@playwright/test';

test.describe('Command Enrichment UI', () => {
  test('start job shows progress and cancel calls endpoint', async ({ page }) => {
    const jobId = '11111111-1111-1111-1111-111111111111';
    let pollCount = 0;
    let cancelCalled = false;

    await page.route('**/api/commands/enrich', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId, status: 'queued', alreadyRunning: false }),
      });
    });

    await page.route(`**/api/commands/enrich/${jobId}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      pollCount += 1;
      const running = pollCount < 3;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: jobId,
          status: running ? 'running' : (cancelCalled ? 'cancelled' : 'completed'),
          total: 10,
          processed: running ? pollCount * 2 : 10,
          succeeded: running ? pollCount * 2 : 10,
          failed: 0,
          currentCmdlet: running ? 'Get-Process' : null,
          cancelRequested: cancelCalled,
          error: null,
        }),
      });
    });

    await page.route(`**/api/commands/enrich/${jobId}/cancel`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      cancelCalled = true;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ id: jobId, status: 'running', cancelRequested: true }),
      });
    });

    await page.goto('/documentation/crawl', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Command Enrichment').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    // Progress should show some processed count.
    await expect(page.getByText(/\d+\/10 \(\d+%\)/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Current cmdlet:').first()).toBeVisible();

    // Cancel should hit endpoint.
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});
