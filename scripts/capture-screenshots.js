/**
 * Capture the canonical documentation screenshots from the current local UI.
 * Assumes local frontend auth bypass may be enabled.
 */
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');
const BASE_URL = process.env.SCREENSHOT_BASE_URL || 'https://127.0.0.1:3090';

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('Starting screenshot capture...\n');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  if (page.url().includes('/login')) {
    console.log('Capturing login page...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'login.png'),
      fullPage: false,
    });
  } else {
    console.log('Auth bypass is enabled; login page redirected into the app shell.');
  }

  const pagesToCapture = [
    { name: 'dashboard.png', path: '/dashboard' },
    { name: 'scripts.png', path: '/scripts' },
    { name: 'settings-profile.png', path: '/settings/profile' },
    { name: 'data-maintenance.png', path: '/settings/data' },
  ];

  for (const pageInfo of pagesToCapture) {
    console.log(`Capturing: ${pageInfo.name}`);
    await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
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
