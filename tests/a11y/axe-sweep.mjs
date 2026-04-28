#!/usr/bin/env node
/* eslint-disable no-console */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.SWEEP_BASE_URL ?? 'http://127.0.0.1:4173';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

const ROUTES = [
  { path: '/login',            tag: 'brand'    },
  { path: '/register',         tag: 'brand'    },
  { path: '/auth/callback',    tag: 'brand'    },
  { path: '/pending-approval', tag: 'brand'    },
  { path: '/landing',          tag: 'brand'    },
  { path: '/404',              tag: 'brand'    },
  { path: '/dashboard',        tag: 'operator' },
  { path: '/scripts',          tag: 'operator' },
  { path: '/settings/profile', tag: 'operator' },
];

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const summary = [];
  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
      summary.push({ route: route.path, tag: route.tag, violations, total: violations.length });
    } catch (err) {
      summary.push({ route: route.path, tag: route.tag, error: err.message });
    } finally {
      await page.close();
    }
  }
  await browser.close();
  await fs.writeFile(path.join(ROOT, 'results.json'), JSON.stringify(summary, null, 2));
  const total = summary.reduce((sum, s) => sum + (s.total ?? 0), 0);
  const byImpact = summary.flatMap((s) => s.violations ?? []).reduce((acc, v) => {
    acc[v.impact ?? 'unknown'] = (acc[v.impact ?? 'unknown'] ?? 0) + (v.nodes ?? 1);
    return acc;
  }, {});
  console.log(JSON.stringify({
    routes: summary.length,
    totalViolations: total,
    byImpact,
    perRoute: summary.map((s) => ({ route: s.route, count: s.total ?? 'error' })),
  }, null, 2));
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(2); });
