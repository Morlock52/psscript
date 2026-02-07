import { test, expect } from '@playwright/test';

/**
 * Chat UI (Frontend)
 * Verifies the /chat page can send a message and render an assistant reply.
 */

test.describe('Chat UI', () => {
  test.setTimeout(180_000);

  test('Can send a message and receive an assistant response', async ({ page }) => {
    // Avoid stale keys/settings from previous runs overriding the server-side OPENAI_API_KEY.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('openai_api_key');
        localStorage.removeItem('psscript_mock_mode');
      } catch {
        // ignore
      }
    });

    // Uses Playwright baseURL (PW_BASE_URL / BASE_URL) from playwright.config.ts
    await page.goto('/chat', { waitUntil: 'networkidle' });

    // Wait for the initial assistant welcome message so we don't race React render.
    await expect(page.getByText('Welcome to PowerShell AI Assistant', { exact: false })).toBeVisible();

    const assistantBlocks = page.locator('.markdown-content');
    const before = await assistantBlocks.count();

    await page.getByPlaceholder('Type your PowerShell question...').fill('Reply with exactly: ok');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(assistantBlocks).toHaveCount(before + 1, { timeout: 120_000 });

    const lastAssistant = assistantBlocks.last();
    await expect(lastAssistant).toContainText(/ok/i);
  });
});
