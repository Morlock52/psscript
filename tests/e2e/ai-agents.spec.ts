import { test, expect } from '@playwright/test';

/**
 * AI Agent API Tests (Backend)
 * These target the consolidated Express routes at:
 *   http://localhost:4000/api/ai-agent/*
 *
 * Notes:
 * - Most tests avoid calling OpenAI to keep the suite fast/cheap and deterministic.
 * - Set PW_LIVE_AI=true to run the live OpenAI call test.
 */

const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';
const apiBase = `${backendBase}/api/ai-agent`;

test.describe('AI Agent API', () => {
  test('Route endpoint should return a model decision', async ({ request }) => {
    const response = await request.post(`${apiBase}/route`, { data: {} });
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('model');
    expect(data).toHaveProperty('reason');
  });

  test('Diff endpoint should summarize changes', async ({ request }) => {
    const response = await request.post(`${apiBase}/diff`, {
      data: {
        original: 'Write-Host \"Hello\"',
        improved: 'Write-Host \"Hello world\"'
      }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('similarity_ratio');
    expect(data).toHaveProperty('lines_added');
    expect(data).toHaveProperty('lines_removed');
  });

  test('Execute endpoint should return 400 without content', async ({ request }) => {
    const response = await request.post(`${apiBase}/execute`, { data: {} });
    expect(response.status()).toBe(400);
  });

  test('Execute endpoint should simulate execution', async ({ request }) => {
    const response = await request.post(`${apiBase}/execute`, {
      data: { content: 'Write-Host \"Hello\"' }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('status', 'success');
    expect(data).toHaveProperty('stdout');
  });

  test('Assistant analysis endpoint should return 400 without content', async ({ request }) => {
    const response = await request.post(`${apiBase}/analyze/assistant`, { data: {} });
    expect(response.status()).toBe(400);
  });

  test('Live assistant analysis (optional)', async ({ request }) => {
    test.skip(process.env.PW_LIVE_AI !== 'true', 'Set PW_LIVE_AI=true to run live OpenAI test');

    const response = await request.post(`${apiBase}/analyze/assistant`, {
      data: {
        filename: 'test.ps1',
        content: 'Get-Process | Select-Object -First 1'
      }
    });

    expect([200, 201]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('analysis');
    expect(data).toHaveProperty('metadata');
  });
});
