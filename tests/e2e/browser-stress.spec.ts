import { test, expect } from '@playwright/test';
import waitForFrontend from './utils/waitForFrontend';

const iters = Number(process.env.STRESS_ITERS || 20);

test('browser stress: key routes remain responsive (non-destructive)', async ({ page, request }, testInfo) => {
  const baseURL =
    process.env.BASE_URL ||
    (typeof testInfo.project.use.baseURL === 'string' ? testInfo.project.use.baseURL : '') ||
    'http://127.0.0.1:3090';
  const origin = new URL(baseURL).origin;

  await waitForFrontend(request, origin);

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  const routes = [
    '/dashboard',
    '/scripts',
    '/scripts/upload',
    '/documentation',
    '/documentation/data',
    '/chat',
    '/ai/assistant',
    '/ai/agents',
    '/analytics',
    '/settings',
    '/settings/api',
  ];

  // This is intentionally long-running; scale timeout with configured iterations.
  // Default Playwright test timeout (60s) is far too small for hundreds of navigations.
  const computedMs = 60_000 + iters * routes.length * 4_000;
  testInfo.setTimeout(Math.min(Math.max(computedMs, 10 * 60_000), 30 * 60_000));

  // Warm-up: confirm the app shell renders.
  await page.goto(`${origin}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/PSScript/i);

  for (let i = 0; i < iters; i += 1) {
    for (const route of routes) {
      const res = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `Expected 2xx/3xx for ${route} (iter ${i + 1})`).toBeLessThan(400);
      await page.waitForTimeout(150);
    }

    // Exercise the scripts list a bit (without executing destructive actions).
    await page.goto(`${origin}/scripts`, { waitUntil: 'domcontentloaded' });
    const firstScriptLink = page.locator('a[href^="/scripts/"]').first();
    if (await firstScriptLink.count()) {
      await firstScriptLink.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }

  expect(consoleErrors, `Console errors found during stress run`).toEqual([]);
});
