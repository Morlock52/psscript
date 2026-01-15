/**
 * Screenshot capture script for training documentation
 * Captures actual app screenshots to replace loading screen placeholders
 */
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');
const BASE_URL = 'http://localhost:3000';

const screenshots = [
  { name: 'login.png', path: '/login', waitFor: 'form', needsLogout: true },
  { name: 'settings.png', path: '/settings', waitFor: '.container', needsLogin: true },
  { name: 'chat.png', path: '/chat', waitFor: '.container', needsLogin: true },
  { name: 'scripts.png', path: '/scripts', waitFor: '.container', needsLogin: true },
  { name: 'documentation.png', path: '/documentation', waitFor: '.container', needsLogin: true },
  { name: 'analytics.png', path: '/', waitFor: '.container', needsLogin: true }, // Dashboard has analytics
];

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Starting screenshot capture...\n');

  // First, login to capture authenticated pages
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('form', { timeout: 10000 });

  // Capture login page first (before logging in)
  console.log('Capturing: login.png');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'login.png'),
    fullPage: false
  });
  console.log('  ✓ login.png saved\n');

  // Now login
  await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
  await page.fill('input[type="password"], input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/');
  await page.waitForTimeout(2000); // Wait for content to load
  console.log('Logged in successfully\n');

  // Capture remaining screenshots
  const pagesToCapture = [
    { name: 'settings.png', path: '/settings' },
    { name: 'chat.png', path: '/chat' },
    { name: 'scripts.png', path: '/scripts' },
    { name: 'documentation.png', path: '/documentation' },
    { name: 'analysis.png', path: '/scripts' }, // Script analysis view
    { name: 'analytics.png', path: '/' }, // Dashboard
  ];

  for (const pageInfo of pagesToCapture) {
    try {
      console.log(`Capturing: ${pageInfo.name}`);
      await page.goto(`${BASE_URL}${pageInfo.path}`);
      await page.waitForTimeout(2000); // Wait for content to load

      // Wait for loading to complete (no loading spinners)
      await page.waitForFunction(() => {
        const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"]');
        return loadingElements.length === 0 ||
               Array.from(loadingElements).every(el => el.offsetParent === null);
      }, { timeout: 10000 }).catch(() => {});

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, pageInfo.name),
        fullPage: false
      });
      console.log(`  ✓ ${pageInfo.name} saved\n`);
    } catch (error) {
      console.log(`  ✗ Failed to capture ${pageInfo.name}: ${error.message}\n`);
    }
  }

  await browser.close();
  console.log('\nScreenshot capture complete!');
}

captureScreenshots().catch(console.error);
