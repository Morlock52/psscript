import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Captures screenshots that demonstrate progress indicators:
 * - Global top loading bar (any in-flight API request)
 * - Documentation crawl progress bar (demo mode)
 * - Script upload progress bar
 *
 * Run manually as needed:
 *   npx playwright test tests/e2e/progress-gauges.screenshots.spec.ts --project=chromium --workers=1
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'artifacts', 'progress');

test.describe('Progress Gauges Screenshots', () => {
  test('Capture global loading bar', async ({ page }) => {
    ensureDir(OUT_DIR);

    // Keep any scripts request "in flight" long enough to see the global bar.
    await page.route('**/api/scripts**', async (route) => {
      const response = await route.fetch();
      await new Promise((r) => setTimeout(r, 1600));
      await route.fulfill({ response });
    });

    await page.goto('/scripts', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.global-loading-bar')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(OUT_DIR, '01-global-loading-bar.png'), fullPage: true });

    await page.unroute('**/api/scripts**');
  });

  test('Capture documentation crawl progress (demo mode)', async ({ page }) => {
    ensureDir(OUT_DIR);

    await page.goto('/documentation/crawl', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Import PowerShell Documentation/i })).toBeVisible();

    // Disable AI so the UI uses the built-in demo crawl loop (fast + deterministic).
    const aiToggle = page.getByLabel(/AI-Powered Crawl/i);
    if (await aiToggle.isChecked()) {
      await aiToggle.uncheck();
    }

    await page.getByRole('button', { name: /Start Import/i }).click();
    await expect(page.getByText('Import in Progress', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/% Complete/i).first()).toBeVisible({ timeout: 10_000 });

    // Let the progress advance a bit so the bar isn't near 0%.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, '02-doc-crawl-progress.png'), fullPage: true });
  });

  test('Capture script upload progress bar', async ({ page }) => {
    ensureDir(OUT_DIR);

    // Avoid any persisted localStorage toggles (e.g., upload auth) affecting this capture.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('authenticate_uploads');
        localStorage.removeItem('auth_token');
      } catch (_e) {
        // ignore
      }
    });

    await page.goto('/scripts/upload', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Upload Script/i })).toBeVisible();

    // Create a >2MB PowerShell script so the UI uses the "large file upload" endpoint.
    const line = 'Write-Output "hello world"';
    const payload = (line + '\n').repeat(120_000); // ~3MB-ish
    const buffer = Buffer.from(payload, 'utf-8');

    // Hold the upload request open so the UI's progress indicators remain visible
    // long enough for a screenshot (without having to upload huge data slowly).
    let releaseUpload: null | (() => void) = null;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    await page.route('**/api/scripts/upload/**', async (route) => {
      // Don't stall CORS preflight.
      if (route.request().method() === 'OPTIONS') {
        await route.continue();
        return;
      }

      try {
        await uploadGate;
        await route.continue();
      } catch (_e) {
        // If the page navigates/closes while we're waiting, Playwright may abort the route.
      }
    });

    await page.locator('input[type="file"]').setInputFiles({
      name: 'progress-demo.ps1',
      mimeType: 'text/plain',
      buffer,
    });

    // Wait for FileReader to populate `content` state so form validation passes.
    await expect(page.getByText(/Script loaded successfully/i)).toBeVisible({ timeout: 15_000 });

    // Ensure title is present (it usually auto-fills from filename).
    const title = page.locator('#title');
    if ((await title.inputValue()).trim().length === 0) {
      await title.fill('progress-demo');
    }

    const uploadReq = page.waitForRequest('**/api/scripts/upload/**', { timeout: 15_000 });
    const submit = page.getByRole('button', { name: 'Upload Script', exact: true });
    await expect(submit).toBeEnabled();
    await submit.scrollIntoViewIfNeeded();
    await submit.click();
    await uploadReq;

    // Give React time to render the pending UI, then capture regardless.
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT_DIR, '03-upload-progress.png'), fullPage: true });

    // If the progress UI isn't present, also dump quick debug text to help diagnose.
    const hasUploadingText = await page.evaluate(() => document.body?.innerText?.includes('Uploading...') ?? false);
    if (!hasUploadingText) {
      const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
      fs.writeFileSync(path.join(OUT_DIR, '03-upload-debug.txt'), bodyText.slice(0, 20_000), 'utf-8');
    }

    // Let the request continue so we don't leave a hung network call behind.
    releaseUpload?.();
    await page.unroute('**/api/scripts/upload/**');
  });
});
