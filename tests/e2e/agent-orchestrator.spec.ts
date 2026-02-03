import { test, expect } from '@playwright/test';

/**
 * Agent Orchestrator API (Backend)
 * These endpoints back the frontend AgentChat component at:
 *   /api/agents/*
 */

const backendBase = process.env.PW_BACKEND_URL || process.env.BACKEND_URL || 'http://127.0.0.1:4000';
const apiBase = `${backendBase}/api/agents`;

test.describe('Agent Orchestrator API', () => {
  test.setTimeout(120_000);

  test('Can create agent, thread, messages, and complete a run', async ({ request }) => {
    const agentResp = await request.post(apiBase, {
      data: {
        name: 'E2E Test Agent',
        description: 'Agent orchestrator smoke test',
        capabilities: ['script_generation', 'script_analysis'],
        // Keep cost/latency low during tests.
        model: process.env.PW_AGENT_TEST_MODEL || process.env.OPENAI_FAST_MODEL || 'gpt-5-mini',
      },
    });
    expect(agentResp.status()).toBe(201);
    const agent = await agentResp.json();
    expect(agent).toHaveProperty('id');

    const threadResp = await request.post(`${apiBase}/threads`, { data: { agentId: agent.id } });
    expect(threadResp.status()).toBe(201);
    const thread = await threadResp.json();
    expect(thread).toHaveProperty('id');

    const msgResp = await request.post(`${apiBase}/threads/${thread.id}/messages`, {
      data: { content: 'Hello from tests', role: 'user' },
    });
    expect(msgResp.status()).toBe(201);

    const runResp = await request.post(`${apiBase}/threads/${thread.id}/runs`, { data: {} });
    expect(runResp.status()).toBe(201);
    let run = await runResp.json();
    expect(run).toHaveProperty('id');

    // Poll until completion (agent processing is async).
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const r = await request.get(`${apiBase}/runs/${run.id}`);
      expect(r.status()).toBe(200);
      run = await r.json();

      if (['completed', 'failed', 'cancelled'].includes(run.status)) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    expect(['completed', 'failed']).toContain(run.status);

    const messagesResp = await request.get(`${apiBase}/threads/${thread.id}/messages`);
    expect(messagesResp.status()).toBe(200);
    const messages = await messagesResp.json();

    // Even on failure, the backend should add an assistant message explaining the error.
    expect(messages.some((m: any) => m.role === 'assistant')).toBeTruthy();
  });
});
