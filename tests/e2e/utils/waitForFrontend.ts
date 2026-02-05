import type { APIRequestContext } from '@playwright/test';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForFrontend = async (request: APIRequestContext, baseURL: string) => {
  const maxAttempts = 10;
  const attemptDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await request.get(baseURL, { timeout: 5000 });
      if (response.ok()) {
        return;
      }
    } catch {
      // ignore and retry
    }
    await delay(attemptDelayMs);
  }

  throw new Error(`Frontend did not become reachable at ${baseURL} after ${maxAttempts} attempts`);
};

export default waitForFrontend;
