import { test, expect } from '@playwright/test';

/**
 * Health Check Tests for PSScript Platform
 * Verifies all services are running and responding correctly
 */

test.describe('Service Health Checks', () => {
  const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';
  const apiBase = `${backendBase}/api`;
  const ui = process.env.PW_UI === 'true' ? test : test.skip;

  ui('Frontend should be accessible', async ({ page }) => {
    await page.goto('/');

    // Check that page loads without errors
    await expect(page).toHaveTitle(/PSScript/i);

    // Verify no console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('Backend health endpoint should return OK', async ({ request }) => {
    const response = await request.get(`${backendBase}/health`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('AI agent router should be available', async ({ request }) => {
    const response = await request.post(`${apiBase}/ai-agent/route`, { data: {} });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('model');
    expect(data).toHaveProperty('reason');
  });

  test('Database connection should be healthy', async ({ request }) => {
    const response = await request.get(`${backendBase}/health`);
    const data = await response.json();

    // Health endpoint should include database status
    expect(data).toHaveProperty('database');
    expect(data.database).toMatch(/connected|ok/i);
  });

  test('Redis connection should be healthy', async ({ request }) => {
    const response = await request.get(`${backendBase}/health`);
    const data = await response.json();

    // Health endpoint should include Redis status
    expect(data).toHaveProperty('redis');
    expect(data.redis).toMatch(/connected|ok/i);
  });
});

test.describe('API Endpoints Availability', () => {
  const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';
  const apiBase = `${backendBase}/api`;

  test('Analytics AI endpoints should be accessible', async ({ request }) => {
    // Test summary endpoint
    const summaryResponse = await request.get(`${apiBase}/analytics/ai/summary`);
    expect([200, 401, 403]).toContain(summaryResponse.status()); // Allow auth errors

    // Test budget alerts endpoint
    const budgetResponse = await request.get(`${apiBase}/analytics/ai/budget-alerts`);
    expect([200, 401, 403]).toContain(budgetResponse.status());
  });

  test('AI agent endpoints should be accessible', async ({ request }) => {
    const response = await request.post(`${apiBase}/ai-agent/diff`, {
      data: { original: 'Write-Host \"Hello\"', improved: 'Write-Host \"Hello world\"' }
    });
    expect([200, 400]).toContain(response.status());
  });
});
