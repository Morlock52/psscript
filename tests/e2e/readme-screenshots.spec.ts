import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.join(process.cwd(), 'docs', 'screenshots');

const ensureDir = () => {
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
};

test.describe('README screenshots', () => {
  test.beforeAll(() => {
    ensureDir();
  });

  test('capture key screens', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'login.png'), fullPage: true });

    const defaultLoginButton = page.getByRole('button', { name: 'Use Default Login' });
    await defaultLoginButton.click();
    await page.waitForURL(/dashboard|scripts|\/$/i, { timeout: 20000 });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, 'dashboard.png'), fullPage: true });

    await page.goto('/scripts');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'scripts.png'), fullPage: true });

    await page.goto('/scripts/upload');
    await page.waitForLoadState('networkidle');

    const scriptPath = path.join(process.cwd(), 'test-script.ps1');
    const fileInput = page.locator('input[type="file"]');
    const uploadButton = page.getByRole('button', { name: 'Upload Script' });

    if (fs.existsSync(scriptPath)) {
      await fileInput.setInputFiles(scriptPath);
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: path.join(screenshotDir, 'upload.png'), fullPage: true });

    let detailPath: string | null = null;
    try {
      if (await uploadButton.isEnabled()) {
        await uploadButton.click();
        await page.waitForURL(/\/scripts\//i, { timeout: 20000 });
        detailPath = new URL(page.url()).pathname;
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(screenshotDir, 'script-detail.png'), fullPage: true });
      }
    } catch (error) {
      detailPath = null;
    }

    if (detailPath) {
      await page.goto(`${detailPath}/analysis`);
    } else {
      await page.goto('/scripts/1/analysis');
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'analysis.png'), fullPage: true });

    await page.goto('/documentation');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'documentation.png'), fullPage: true });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'chat.png'), fullPage: true });

    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(screenshotDir, 'analytics.png'), fullPage: true });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('heading', { name: 'Documentation & Training' }).waitFor({ state: 'visible' });
    await page.getByRole('link', { name: 'Training Guide PDF (Local)' }).waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(screenshotDir, 'settings.png'), fullPage: true });
  });
});
