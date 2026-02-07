import { test, expect } from '@playwright/test';

test.describe('Command Explain Drawer', () => {
  test('clicking a PowerShell command pill opens drawer with breakdown + AI', async ({ page }) => {
    const doc = {
      id: 1,
      // Matches actual UI rendering (it may normalize "PowerShell" -> "Power Shell").
      title: 'Install Power Shell on Windows',
      url: 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows',
      content: 'Example content',
      summary: 'How to install PowerShell.',
      source: 'Microsoft Learn',
      contentType: 'doc',
      category: 'Security',
      crawledAt: new Date().toISOString(),
      tags: ['cmdlet', 'has-scripts'],
      extractedCommands: ['Set-Item', 'Get-Credential'],
      extractedFunctions: [],
      extractedModules: [],
      metadata: {},
    };

    // The documentation UI uses axios directly (not apiClient) so it hits absolute URLs like:
    //   http://host.docker.internal:4000/api/documentation?limit=50
    // Stub both /api/documentation* and /documentation* to be safe across environments.
    await page.route('**/{api/,}documentation**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      if ((path.endsWith('/api/documentation') || path.endsWith('/documentation')) && url.searchParams.has('limit')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [doc] }),
        });
        return;
      }

      if (path.endsWith('/api/documentation/sources') || path.endsWith('/documentation/sources')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: ['Microsoft Learn'] }),
        });
        return;
      }

      if (path.endsWith('/api/documentation/tags') || path.endsWith('/documentation/tags')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: ['cmdlet', 'has-scripts'] }),
        });
        return;
      }

      if (path.endsWith('/api/documentation/stats') || path.endsWith('/documentation/stats')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              total: 1,
              sources: { 'Microsoft Learn': 1 },
              tagsCount: 2,
              lastCrawled: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      if (path.endsWith('/api/documentation/search') || path.endsWith('/documentation/search')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [], total: 0, limit: 5, offset: 0 }),
        });
        return;
      }

      await route.continue();
    });

    // Stub the AI explain endpoint used by explainWithAgent().
    await page.route('**/api/scripts/explain', async (route) => {
      const req = route.request();
      let postData: any = {};
      try {
        postData = await req.postDataJSON();
      } catch (_e) {
        postData = {};
      }
      const type = String(postData?.type || 'detailed');
      const explanation =
        type === 'security'
          ? 'Security: This command can be destructive; consider adding -WhatIf.'
          : `Explanation: ${postData?.content || ''}`.slice(0, 200);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ explanation }),
      });
    });

    // Stub command insights (enriched cmdlet card).
    await page.route('**/{api/,}commands/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      // Match /api/commands/Set-Item (or /commands/Set-Item depending on proxy)
      if (path.endsWith('/api/commands/Set-Item') || path.endsWith('/commands/Set-Item')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            cmdletName: 'Set-Item',
            description: 'Sets the value of an item at a location.',
            howToUse: 'Set-Item -Path <path> -Value <value>',
            keyParameters: [{ name: '-Path', description: 'Target path', required: true, dangerous: false }],
            useCases: [{ title: 'Update a registry value', scenario: 'Set a registry value safely', exampleCommand: 'Set-Item -Path HKCU:\\Software\\Demo -Value 1', sampleOutput: '' }],
            examples: [{ title: 'Set a file attribute', command: 'Set-Item -Path .\\file.txt -Value \"hello\"', explanation: 'Updates content/value depending on provider.', sampleOutput: '' }],
            sampleOutput: '',
            flags: [{ severity: 'warn', pattern: '-Force', reason: 'Can overwrite or bypass checks', saferAlternative: 'Use -WhatIf first' }],
            docsUrls: [{ title: 'Microsoft Learn search', url: 'https://learn.microsoft.com/search/?terms=Set-Item' }]
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not_found' }),
      });
    });

    await page.goto('/documentation', { waitUntil: 'domcontentloaded' });

    // Open the document modal (click the card title as rendered in the UI).
    await expect(page.getByText('Install Power Shell on Windows').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Install Power Shell on Windows').first().click();

    // Click a command pill (now a button).
    await page.getByRole('button', { name: 'Set-Item', exact: true }).click();

    // Drawer appears with breakdown.
    await expect(page.getByRole('dialog', { name: 'Explain Command' })).toBeVisible();
    await expect(page.getByText('Breakdown', { exact: true })).toBeVisible();
    await expect(page.getByText('Cmdlet Card', { exact: true })).toBeVisible();
    await expect(page.getByText('Flags', { exact: true })).toBeVisible();
    await expect(page.getByText('AI Explain', { exact: true })).toBeVisible();
  });
});
