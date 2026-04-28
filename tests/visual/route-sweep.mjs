#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Visual route sweep — captures and/or diffs full-page screenshots
 * across every route × surface × theme × motion-pref combination.
 *
 * Usage:
 *   node tests/visual/route-sweep.mjs --baseline   # write to __baseline__/
 *   node tests/visual/route-sweep.mjs --diff       # write to __current__/ and emit __diff__/
 *
 * Env:
 *   SWEEP_BASE_URL   default http://127.0.0.1:4173
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const BASE_URL = process.env.SWEEP_BASE_URL ?? 'http://127.0.0.1:4173';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const MODE = process.argv.includes('--baseline') ? 'baseline' : 'diff';
const OUT_DIR = MODE === 'baseline' ? '__baseline__' : '__current__';
const DIFF_DIR = '__diff__';
const VIEWPORT = { width: 1440, height: 900 };
const FULL_PAGE = true;
const SETTLE_MS = 800;

async function loadManifest() {
  return JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
}

function captureName(page, surface, theme, motion) {
  return `${surface}__${theme}__${motion}__${page.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
}

async function ensureDir(p) {
  await fs.mkdir(path.join(ROOT, p), { recursive: true });
}

async function captureRoute(browser, route, surface, theme, motion, name) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(SETTLE_MS);
    const buf = await page.screenshot({ fullPage: FULL_PAGE, type: 'png' });
    await fs.writeFile(path.join(ROOT, OUT_DIR, name), buf);
    return { ok: true, name };
  } catch (err) {
    return { ok: false, name, error: err.message };
  } finally {
    await ctx.close();
  }
}

async function diffOne(name) {
  const baselinePath = path.join(ROOT, '__baseline__', name);
  const currentPath = path.join(ROOT, '__current__', name);
  const diffPath = path.join(ROOT, DIFF_DIR, name);
  let baseBuf, curBuf;
  try {
    [baseBuf, curBuf] = await Promise.all([
      fs.readFile(baselinePath),
      fs.readFile(currentPath),
    ]);
  } catch {
    return { name, status: 'missing' };
  }
  const base = PNG.sync.read(baseBuf);
  const cur = PNG.sync.read(curBuf);
  if (base.width !== cur.width || base.height !== cur.height) {
    return { name, status: 'size-changed', baseline: [base.width, base.height], current: [cur.width, cur.height] };
  }
  const diff = new PNG({ width: base.width, height: base.height });
  const mismatch = pixelmatch(base.data, cur.data, diff.data, base.width, base.height, { threshold: 0.1 });
  await fs.writeFile(diffPath, PNG.sync.write(diff));
  return { name, status: 'diffed', mismatchPixels: mismatch };
}

async function run() {
  const manifest = await loadManifest();
  await ensureDir(OUT_DIR);
  if (MODE === 'diff') await ensureDir(DIFF_DIR);

  const browser = await chromium.launch();
  const results = [];

  // Brand: dark only, both motion preferences
  for (const item of manifest.brand) {
    for (const motion of ['default', 'reduce']) {
      const name = captureName(item.page, 'brand', 'dark', motion);
      results.push(await captureRoute(browser, item.route, 'brand', 'dark', motion, name));
    }
  }
  // Operator: dark + light, both motion preferences
  for (const item of manifest.operator) {
    for (const theme of ['dark', 'light']) {
      for (const motion of ['default', 'reduce']) {
        const name = captureName(item.page, 'operator', theme, motion);
        results.push(await captureRoute(browser, item.route, 'operator', theme, motion, name));
      }
    }
  }
  // Critical detail captures
  for (const item of manifest.criticalDetail) {
    const name = captureName(`${item.page}__${item.interaction}`, 'operator', 'dark', 'default');
    results.push(await captureRoute(browser, item.route, 'operator', 'dark', 'default', name));
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ mode: MODE, total: results.length, failed: failed.length, failures: failed.slice(0, 20) }, null, 2));

  if (MODE === 'diff') {
    const diffSummary = [];
    for (const item of results.filter((r) => r.ok)) {
      diffSummary.push(await diffOne(item.name));
    }
    const totalMismatch = diffSummary.reduce((sum, d) => sum + (d.mismatchPixels ?? 0), 0);
    console.log(JSON.stringify({ diffSample: diffSummary.slice(0, 10), totalMismatch }, null, 2));
  }

  process.exit(failed.length > 0 && MODE === 'diff' ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
