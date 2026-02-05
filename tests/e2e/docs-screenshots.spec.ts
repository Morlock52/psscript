import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const docsScreenshotsDir = path.join(ROOT, 'docs', 'screenshots');
const docsSiteVariantsDir = path.join(ROOT, 'docs-site', 'static', 'images', 'screenshots', 'variants');

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const viewportVariants = [
  { width: 1440, height: 900, scrollY: 0 },
  { width: 1365, height: 900, scrollY: 0 },
  { width: 1280, height: 900, scrollY: 240 },
  { width: 1536, height: 900, scrollY: 120 }
];

const routeFor = (name: string) => {
  if (name.startsWith('login')) return '/login';
  if (name.startsWith('dashboard')) return '/dashboard';
  if (name.startsWith('scripts')) return '/scripts';
  if (name.startsWith('upload')) return '/scripts/upload';
  if (name.startsWith('script-detail')) return '/scripts/44';
  if (name.startsWith('analysis')) return '/scripts/44/analysis';
  if (name.startsWith('documentation')) return '/documentation';
  if (name.startsWith('chat')) return '/chat';
  if (name.startsWith('analytics')) return '/analytics';
  if (name.startsWith('settings')) return '/settings';
  return '/';
};

const getPngs = (dir: string) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(file => file.endsWith('.png')).map(file => path.join(dir, file))
    : [];

const capture = async (page: any, filePath: string, index: number) => {
  const name = path.basename(filePath);
  const baseName = name.split('-v')[0].replace('.png', '');
  const route = routeFor(baseName);
  const variant = viewportVariants[index % viewportVariants.length];

  await page.setViewportSize({ width: variant.width, height: variant.height });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);

  if (variant.scrollY > 0) {
    await page.evaluate((y: number) => window.scrollTo(0, y), variant.scrollY);
    await page.waitForTimeout(300);
  }

  ensureDir(path.dirname(filePath));
  await page.screenshot({ path: filePath, fullPage: true });
};

test.describe('Docs screenshots (real UI)', () => {
  test('capture all referenced screenshots', async ({ page }) => {
    test.setTimeout(6 * 60 * 1000);
    ensureDir(docsScreenshotsDir);
    ensureDir(docsSiteVariantsDir);

    const targets = [
      ...getPngs(docsScreenshotsDir),
      ...getPngs(docsSiteVariantsDir)
    ];

    const unique = Array.from(new Set(targets));
    const offset = Number(process.env.CAPTURE_OFFSET || 0);
    const limit = Number(process.env.CAPTURE_LIMIT || unique.length);
    const windowed = unique.slice(offset, offset + limit);
    const loginTargets = windowed.filter(file => path.basename(file).startsWith('login'));
    const otherTargets = windowed.filter(file => !path.basename(file).startsWith('login'));

    for (let i = 0; i < loginTargets.length; i += 1) {
      await capture(page, loginTargets[i], i);
    }

    // Log in once for the rest
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const demoButton = page.getByRole('button', { name: /Sign in as Demo Admin/i });
    if (await demoButton.count()) {
      await demoButton.first().click();
      await page.waitForTimeout(1200);
    }

    for (let i = 0; i < otherTargets.length; i += 1) {
      await capture(page, otherTargets[i], i + loginTargets.length);
    }
  });
});
