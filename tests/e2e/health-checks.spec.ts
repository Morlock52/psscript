import { test, expect } from '@playwright/test';

/**
 * Health Check Tests for PSScript Platform
 * Verifies all services are running and responding correctly
 */

test.describe('Service Health Checks', () => {
  test('Frontend should be accessible', async ({ page }) => {
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
    const response = await request.get('https://127.0.0.1:4000/api/health');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
  });

  test('AI Service health endpoint should return OK', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:8000/health');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('Database connection should be healthy', async ({ request }) => {
    const response = await request.get('https://127.0.0.1:4000/api/health');
    const data = await response.json();

    // Health endpoint should include database status
    expect(data).toHaveProperty('database');
    expect(data.database).toMatch(/connected|ok/i);
  });

  test('Redis connection should be healthy', async ({ request }) => {
    const response = await request.get('https://127.0.0.1:4000/api/health');
    const data = await response.json();

    // Health endpoint should include Redis status
    expect(data).toHaveProperty('redis');
    expect(data.redis).toMatch(/connected|ok/i);
  });
});

test.describe('API Endpoints Availability', () => {
  test('Analytics AI endpoints should be accessible', async ({ request }) => {
    // Test summary endpoint
    const summaryResponse = await request.get('https://127.0.0.1:4000/api/analytics/ai/summary');
    expect([200, 401, 403]).toContain(summaryResponse.status());

    // Test budget alerts endpoint
    const budgetResponse = await request.get('https://127.0.0.1:4000/api/analytics/ai/budget-alerts');
    expect([200, 401, 403]).toContain(budgetResponse.status());
  });

  test('AI agent endpoints should be accessible', async ({ request }) => {
    // Minimal smoke: create agent route exists (may require auth, allow 401/403).
    const response = await request.post('https://127.0.0.1:4000/api/agents', {
      data: { name: `Smoke Agent ${Date.now()}` }
    });
    expect([201, 400, 401, 403]).toContain(response.status());
  });
});
