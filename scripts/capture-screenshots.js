/**
 * Capture the canonical documentation screenshots from the current local UI.
 *
 * Defaults:
 * - App shell screenshots come from the standard local stack on 3090.
 * - Login screenshot can come from a separate auth-enabled frontend via SCREENSHOT_LOGIN_URL.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');
const APP_BASE_URL = process.env.SCREENSHOT_BASE_URL || 'https://127.0.0.1:3090';
const LOGIN_BASE_URL = process.env.SCREENSHOT_LOGIN_URL || APP_BASE_URL;

const APP_SHOTS = [
  { name: 'dashboard.png', path: '/dashboard' },
  { name: 'scripts.png', path: '/scripts' },
  { name: 'upload.png', path: '/scripts/upload' },
  { name: 'analysis.png', path: '/scripts/1/analysis' },
  { name: 'documentation.png', path: '/documentation' },
  { name: 'chat.png', path: '/chat' },
  { name: 'analytics.png', path: '/analytics' },
  { name: 'settings.png', path: '/settings' },
  { name: 'settings-profile.png', path: '/settings/profile' },
  { name: 'data-maintenance.png', path: '/settings/data' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function waitForHeading(page, regex, timeout = 15000) {
  await page.getByRole('heading', { name: regex }).first().waitFor({ state: 'visible', timeout });
}

async function captureLogin(page) {
  console.log(`Capturing login from ${LOGIN_BASE_URL}/login`);
  await page.goto(`${LOGIN_BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForHeading(page, /login/i);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'login.png'),
    fullPage: true,
  });
}

async function ensureAppReady(page) {
  await page.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');

  if (page.url().includes('/login')) {
    const defaultLoginButton = page.getByRole('button', { name: /use default login|sign in as demo admin/i });
    if (await defaultLoginButton.count()) {
      await defaultLoginButton.first().click();
      await page.waitForURL((url) => !/\/login$/i.test(url.pathname), { timeout: 30000 });
    } else {
      throw new Error(`App at ${APP_BASE_URL} requires login but no supported quick-login button was found.`);
    }
  }
}

async function captureAppScreens(page) {
  for (const pageInfo of APP_SHOTS) {
    console.log(`Capturing ${pageInfo.name} from ${APP_BASE_URL}${pageInfo.path}`);
    await page.goto(`${APP_BASE_URL}${pageInfo.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, pageInfo.name),
      fullPage: true,
    });
  }
}

async function captureScriptDetail(page) {
  console.log(`Capturing script-detail.png from ${APP_BASE_URL}/scripts`);
  await page.goto(`${APP_BASE_URL}/scripts`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle');

  const scriptLink = page.locator('a[href^="/scripts/"]').first();
  if (await scriptLink.count()) {
    await scriptLink.click();
    await page.waitForURL(/\/scripts\/\d+$/i, { timeout: 30000 });
  } else {
    await page.goto(`${APP_BASE_URL}/scripts/1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'script-detail.png'),
    fullPage: true,
  });
}

async function main() {
  ensureDir(SCREENSHOTS_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    console.log('Starting canonical screenshot capture\n');
    await captureLogin(page);
    await ensureAppReady(page);
    await captureAppScreens(page);
    await captureScriptDetail(page);
    console.log('\nScreenshot capture completed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});
