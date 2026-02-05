import { test, expect } from '@playwright/test';
import fs from 'fs';
import waitForFrontend from './utils/waitForFrontend';

const maxPages = Number(process.env.MAX_PAGES || 40);
const destructivePattern = /delete|remove|destroy|reset|revert|purge|drop|execute|run|clear|terminate|kill/i;

const normalizeUrl = (url: string, baseURL: string) => {
  const parsed = new URL(url, baseURL);
  parsed.hash = '';
  return parsed.toString();
};

const uiTest = process.env.PW_UI === 'true' ? test : test.skip;

uiTest('button/link sweep (non-destructive)', async ({ page, request }, testInfo) => {
  const baseURL =
    process.env.BASE_URL ||
    (typeof testInfo.project.use.baseURL === 'string' ? testInfo.project.use.baseURL : '') ||
    'http://127.0.0.1:3090';
  const origin = new URL(baseURL).origin;

  await waitForFrontend(request, origin);

  const visited = new Set<string>();
  const queue: string[] = [normalizeUrl(baseURL, baseURL)];
  const failures: string[] = [];
  const skippedDestructive: string[] = [];
  const consoleErrors: string[] = [];
  const externalLinks: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[console] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  while (queue.length > 0 && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    await page.goto(current, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const links = page.getByRole('link');
    const linkCount = await links.count();
    for (let i = 0; i < linkCount; i += 1) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      if (!href) {
        continue;
      }
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        continue;
      }
      const target = new URL(href, baseURL);
      if (target.origin === origin) {
        const normalized = normalizeUrl(target.toString(), baseURL);
        if (!visited.has(normalized)) {
          queue.push(normalized);
        }
      } else {
        externalLinks.push(target.toString());
      }
    }

    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i += 1) {
      const button = buttons.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      const isDisabled = await button.isDisabled().catch(() => true);
      if (!isVisible || isDisabled) {
        continue;
      }
      const label = (await button.innerText().catch(() => '')) || (await button.getAttribute('aria-label')) || '';
      if (destructivePattern.test(label)) {
        skippedDestructive.push(`${current} :: ${label || '(no label)'}`);
        continue;
      }

      try {
        await button.click({ timeout: 5000 });
        await page.waitForTimeout(300);
      } catch (error) {
        failures.push(`Button failed: ${label || '(no label)'} @ ${current} :: ${String(error)}`);
      }
    }
  }

  const report = {
    baseURL,
    visited: Array.from(visited),
    failures,
    consoleErrors,
    skippedDestructive,
    externalLinks: Array.from(new Set(externalLinks))
  };

  const reportPath = testInfo.outputPath('button_link_smoke.report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  expect(failures, `Button failures found. See ${reportPath}`).toEqual([]);
  expect(consoleErrors, `Console errors found. See ${reportPath}`).toEqual([]);
});
