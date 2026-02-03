import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOCS_ROOT = path.join(repoRoot, 'docs-site', 'docs');
const STATIC_ROOT = path.join(repoRoot, 'docs-site', 'static', 'images', 'screenshots');
const BASE_URL = 'http://127.0.0.1:3090';

const screenshotRegex = /!\[[^\]]*\]\(([^)]+)\)/g;

const ROUTE_MAP = [
  { match: /login/i, route: '/login' },
  { match: /register/i, route: '/register' },
  { match: /dashboard/i, route: '/dashboard' },
  { match: /analytics/i, route: '/analytics' },
  { match: /scripts/i, route: '/scripts' },
  { match: /script-detail|detail/i, route: '/scripts/1' },
  { match: /analysis/i, route: '/scripts/1/analysis' },
  { match: /upload/i, route: '/scripts/upload' },
  { match: /documentation|docs/i, route: '/documentation' },
  { match: /crawler|crawl/i, route: '/documentation/crawl' },
  { match: /data/i, route: '/documentation/data' },
  { match: /chat/i, route: '/chat' },
  { match: /agent/i, route: '/ai/assistant' },
  { match: /settings/i, route: '/settings' },
  { match: /profile/i, route: '/settings/profile' },
  { match: /appearance/i, route: '/settings/appearance' },
  { match: /security/i, route: '/settings/security' },
  { match: /notifications/i, route: '/settings/notifications' },
  { match: /api/i, route: '/settings/api' },
  { match: /users/i, route: '/settings/users' },
];

const FALLBACK_ROUTES = [
  '/dashboard',
  '/scripts',
  '/scripts/1',
  '/scripts/1/analysis',
  '/documentation',
  '/documentation/crawl',
  '/documentation/data',
  '/chat',
  '/analytics',
  '/settings',
];

const collectScreenshotRefs = (rootDir) => {
  const refs = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8');
        let match;
        while ((match = screenshotRegex.exec(content))) {
          const url = match[1];
          if (url.includes('screenshots/')) {
            refs.push(url);
          }
        }
      }
    }
  };
  walk(rootDir);
  return Array.from(new Set(refs));
};

const pickRoute = (filename, index) => {
  for (const rule of ROUTE_MAP) {
    if (rule.match.test(filename)) return rule.route;
  }
  return FALLBACK_ROUTES[index % FALLBACK_ROUTES.length];
};

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
};

const run = async () => {
  const refs = collectScreenshotRefs(DOCS_ROOT);
  if (!refs.length) {
    console.error('No screenshot references found.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const report = {
    baseUrl: BASE_URL,
    total: refs.length,
    captured: [],
    failed: [],
  };

  for (let i = 0; i < refs.length; i += 1) {
    const ref = refs[i];
    const filename = path.basename(ref);
    const route = pickRoute(filename, i);
    const targetPath = path.join(STATIC_ROOT, ref.replace(/^\/?images\/screenshots\//, ''));
    ensureDir(targetPath);

    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      const scrollY = (i % 5) * 120;
      if (scrollY) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: targetPath, fullPage: false });
      report.captured.push({ ref, route, file: targetPath });
    } catch (err) {
      report.failed.push({ ref, route, error: String(err) });
    }
  }

  await browser.close();

  const reportPath = path.join(STATIC_ROOT, '_capture-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Captured: ${report.captured.length}, Failed: ${report.failed.length}`);
  console.log(`Report: ${reportPath}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
