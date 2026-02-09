import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outDir = process.env.OUT_DIR || path.resolve(process.cwd(), 'logs', 'qa', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.BASE_URL || 'https://localhost:3090';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  // 1) Dashboard (auth disabled should land here without login)
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, 'dashboard.png'), fullPage: true });

  // 2) Documentation Import (show progress + cancel)
  await page.goto(`${baseUrl}/documentation/crawl`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Import PowerShell Documentation');

  // Make it fast: depth=0, maxPages=1
  await page.fill('input[name="maxPages"]', '1');
  await page.fill('input[name="depth"]', '0');
  await page.click('button:has-text("Start Import")');

  // Wait until the cancel button renders (means job started and polling began).
  await page.waitForSelector('button:has-text("Cancel Import")', { timeout: 20000 });
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, 'documentation-import-running.png'), fullPage: true });

  // 3) Script Categories settings
  await page.goto(`${baseUrl}/settings/categories`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Script Categories');
  await page.waitForTimeout(750);
  await page.screenshot({ path: path.join(outDir, 'settings-categories.png'), fullPage: true });

  // 4) User management (verify list loads and no network error banner)
  await page.goto(`${baseUrl}/settings/users`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=User Management');
  await page.waitForTimeout(750);
  await page.screenshot({ path: path.join(outDir, 'settings-users.png'), fullPage: true });

  await browser.close();

  // Print paths for CI/log visibility
  console.log(JSON.stringify({
    outDir,
    files: [
      'dashboard.png',
      'documentation-import-running.png',
      'settings-categories.png',
      'settings-users.png'
    ].map((f) => path.join(outDir, f))
  }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

