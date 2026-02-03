import { test, expect } from '@playwright/test';

/**
 * Chat API (Backend)
 * Verifies that /api/chat is wired to OpenAI and returns a response.
 */

const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';

test.describe('Chat API', () => {
  test.setTimeout(120_000);

  test('POST /api/chat returns a response', async ({ request }) => {
    const resp = await request.post(`${backendBase}/api/chat`, {
      data: {
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
      },
    });

    expect(resp.status()).toBe(200);
    const json = await resp.json();

    expect(typeof json.response).toBe('string');
    expect(json.response.length).toBeGreaterThan(0);
    expect(typeof json.model).toBe('string');
  });
});

