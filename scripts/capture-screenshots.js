/**
 * Screenshot capture script for documentation.
 * Assumes local frontend auth bypass may be enabled.
 */
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'https://127.0.0.1:3090';
const LOGIN_EMAIL = process.env.SCREENSHOT_EMAIL || 'admin@example.com';
const LOGIN_PASSWORD = process.env.SCREENSHOT_PASSWORD || 'admin123';

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('Starting screenshot capture...\n');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  if (page.url().includes('/login')) {
    console.log('Capturing login page...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'login.png'),
      fullPage: false,
    });

    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if (await emailInput.count()) {
      await emailInput.first().fill(LOGIN_EMAIL);
      await page.fill('input[type="password"], input[name="password"]', LOGIN_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }
  } else {
    console.log('Auth bypass is enabled; login page redirected into the app shell.');
  }

  const pagesToCapture = [
    { name: 'dashboard.png', path: '/dashboard' },
    { name: 'settings-profile.png', path: '/settings/profile' },
    { name: 'data-maintenance.png', path: '/settings/data' },
  ];

  for (const pageInfo of pagesToCapture) {
    console.log(`Capturing: ${pageInfo.name}`);
    await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, pageInfo.name),
      fullPage: false,
    });
  }

  await browser.close();
  console.log('\nScreenshot capture completed.');
}

captureScreenshots().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
