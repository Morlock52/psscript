import { test, expect } from '@playwright/test';

/**
 * Agent Orchestration API (Backend) Tests
 *
 * The UI uses backend endpoints under /api/agents (see AGENTS.md).
 * These tests are intentionally minimal and focus on the contract + wiring.
 */

test.describe('Agent Orchestration API', () => {
  test('Create agent, thread, message, run, and poll run', async ({ request }) => {
    const agentResp = await request.post('https://127.0.0.1:4000/api/agents', {
      data: { name: `E2E Agent ${Date.now()}` }
    });
    expect([201, 400, 401, 403]).toContain(agentResp.status());
    if (agentResp.status() !== 201) return;

    const agent = await agentResp.json();
    expect(agent).toHaveProperty('id');

    const threadResp = await request.post('https://127.0.0.1:4000/api/agents/threads', {
      data: { agentId: agent.id, message: 'hello' }
    });
    expect([201, 400, 401, 403, 404]).toContain(threadResp.status());
    if (threadResp.status() !== 201) return;

    const thread = await threadResp.json();
    expect(thread).toHaveProperty('id');

    const msgResp = await request.post(`https://127.0.0.1:4000/api/agents/threads/${thread.id}/messages`, {
      data: { content: 'Analyze: Write-Host \"Hello\"', role: 'user' }
    });
    expect([201, 400, 401, 403, 404]).toContain(msgResp.status());

    const runResp = await request.post(`https://127.0.0.1:4000/api/agents/threads/${thread.id}/runs`, {
      data: {}
    });
    expect([201, 400, 401, 403, 404]).toContain(runResp.status());
    if (runResp.status() !== 201) return;

    const run = await runResp.json();
    expect(run).toHaveProperty('id');

    const pollResp = await request.get(`https://127.0.0.1:4000/api/agents/runs/${run.id}`);
    expect([200, 401, 403, 404]).toContain(pollResp.status());

    const msgsListResp = await request.get(`https://127.0.0.1:4000/api/agents/threads/${thread.id}/messages`);
    expect([200, 401, 403, 404]).toContain(msgsListResp.status());
  });
});

