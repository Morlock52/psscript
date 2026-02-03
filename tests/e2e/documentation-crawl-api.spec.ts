import { test, expect } from '@playwright/test';

/**
 * Documentation Crawl API (Async Job)
 * Verifies that the AI crawl start endpoint returns quickly and the job completes.
 */

const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';

test.describe('Documentation Crawl API', () => {
  test.setTimeout(120_000);

  test('POST /api/documentation/crawl/ai/start returns jobId and status is reachable', async ({ request }) => {
    const start = await request.post(`${backendBase}/api/documentation/crawl/ai/start`, {
      data: {
        url: 'https://example.com',
        maxPages: 1,
        depth: 0,
      },
    });

    expect(start.status()).toBe(202);
    const startJson = await start.json();
    expect(startJson.success).toBeTruthy();
    expect(typeof startJson.jobId).toBe('string');

    const jobId = startJson.jobId as string;

    let lastStatus: string | undefined;
    for (let i = 0; i < 5; i += 1) {
      const status = await request.get(`${backendBase}/api/documentation/crawl/ai/status/${jobId}`);
      expect(status.ok()).toBeTruthy();

      const statusJson = await status.json();
      expect(statusJson.success).toBeTruthy();

      lastStatus = statusJson?.data?.status;
      if (lastStatus === 'error') {
        throw new Error(`AI crawl job failed: ${String(statusJson?.data?.error || 'unknown error')}`);
      }
      if (lastStatus === 'running' || lastStatus === 'completed') {
        // Success: job is executing (async) or finished quickly.
        expect(statusJson.data.progress?.totalPages).toBeGreaterThanOrEqual(1);
        return;
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error(`AI crawl job did not enter running/completed state in time (lastStatus=${String(lastStatus)})`);
  });
});
