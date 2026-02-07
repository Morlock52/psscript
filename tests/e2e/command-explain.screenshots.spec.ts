import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Captures screenshots demonstrating clickable PowerShell command pills + the Explain drawer.
 *
 * Run:
 *   npx playwright test tests/e2e/command-explain.screenshots.spec.ts --project=chromium --workers=1
 */

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

test.describe('Command Explain Screenshots', () => {
  test('Capture documentation + modal + explain drawer', async ({ page }) => {
    const outDir = path.join(process.cwd(), '.tmp', 'show');
    ensureDir(outDir);

    await page.goto('/documentation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Documentation page
    await expect(page.getByRole('heading', { name: /PowerShell Documentation Explorer/i })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, '01-documentation-page.png'), fullPage: true });

    // Open first doc card (SummaryCard renders as an <article>)
    const cards = page.locator('article');
    const cardCount = await cards.count();
    await expect(cards.first()).toBeVisible();

    let opened = false;
    for (let i = 0; i < Math.min(cardCount, 6); i += 1) {
      await cards.nth(i).click();
      await page.waitForTimeout(900);

      // Only some docs have extractedCommands; try a few cards until we find the section.
      const commandsHeading = page.getByRole('heading', { name: 'PowerShell Commands', exact: true });
      if (await commandsHeading.count()) {
        opened = true;
        break;
      }

      // Close modal and try next card.
      const closeBtn = page.getByRole('button', { name: /Close modal/i });
      if (await closeBtn.count()) {
        await closeBtn.first().click();
        await page.waitForTimeout(500);
      } else {
        // Backdrop click fallback
        await page.mouse.click(10, 10);
        await page.waitForTimeout(500);
      }
    }

    expect(opened).toBeTruthy();
    await page.screenshot({ path: path.join(outDir, '02-doc-modal.png'), fullPage: true });

    // Click a command pill inside the modal to open the drawer.
    const commandsHeading = page.getByRole('heading', { name: 'PowerShell Commands', exact: true });
    const commandsSection = commandsHeading.locator('..').locator('..');
    const cmdButton = commandsSection.getByRole('button', { name: /[A-Za-z]+-[A-Za-z]/ }).first();
    await expect(cmdButton).toBeVisible({ timeout: 15_000 });
    await cmdButton.click();
    await page.waitForTimeout(900);

    await expect(page.getByRole('dialog', { name: 'Explain Command' })).toBeVisible();
    await page.screenshot({ path: path.join(outDir, '03-command-explain-drawer.png'), fullPage: true });
  });
});
