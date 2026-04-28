import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkspaceFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), '..', '..', ...parts), 'utf8');
}

describe('hosted AI client routing', () => {
  it('keeps active browser AI clients from handling provider keys', () => {
    const activeClientFiles = [
      'src/frontend/src/api/aiAgent.ts',
      'src/frontend/src/pages/AgenticAIPage.tsx',
      'src/frontend/src/services/api.ts',
      'src/frontend/src/utils/aiAgentUtils.ts',
    ].map(file => readWorkspaceFile(file));

    for (const source of activeClientFiles) {
      expect(source).not.toContain('VITE_OPENAI_API_KEY');
      expect(source).not.toContain('openai_api_key');
      expect(source).not.toContain('x-openai-api-key');
      expect(source).not.toContain('X-API-Key');
    }
  });

  it('keeps the production agent UI off the legacy agents backend', () => {
    const activeAgentUi = [
      'src/frontend/src/components/Agentic/AgentChat.tsx',
      'src/frontend/src/pages/AgentOrchestrationPage.tsx',
    ].map(file => readWorkspaceFile(file)).join('\n');

    expect(activeAgentUi).not.toContain('/api/agents');
    expect(activeAgentUi).not.toContain('createThread(');
    expect(activeAgentUi).not.toContain('createRun(');
    expect(activeAgentUi).not.toContain('waitForRun(');
  });

  it('exposes hosted Netlify AI route parity', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const expectedRoutes = [
      '/scripts/please',
      '/ai-agent/please',
      '/scripts/generate',
      '/ai-agent/generate',
      '/scripts/explain',
      '/ai-agent/explain',
      '/scripts/analyze/assistant',
      '/ai-agent/analyze/assistant',
      '/scripts/examples',
      '/ai-agent/examples',
      '/analytics/ai',
    ];

    for (const route of expectedRoutes) {
      expect(netlifyApi).toContain(route);
    }
  });

  it('keeps hosted search and similarity backed by indexed database paths', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const migration = readWorkspaceFile('supabase/migrations/20260427_hosted_search_similarity_rls_fixes.sql');

    expect(netlifyApi).toContain("websearch_to_tsquery('simple'");
    expect(netlifyApi).toContain('s.search_vector @@ search_query.tsq');
    expect(netlifyApi).toContain('search_vector @@ search_query.tsq');
    expect(netlifyApi).toContain('WITH target AS (');
    expect(netlifyApi).toContain('JOIN script_embeddings se');
    expect(netlifyApi).toContain('ON CONFLICT (script_id) DO UPDATE');
    expect(netlifyApi).not.toContain('return json({ similar_scripts: [] });');

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(migration).toContain('idx_scripts_search_vector');
    expect(migration).toContain('idx_documentation_items_search_vector');
    expect(migration).toContain('idx_script_embeddings_hnsw');
    expect(migration).toContain('current_app_profile_is_admin');
    expect(migration).toContain('TO authenticated');
  });

  it('guards hosted AI data access and documentation imports', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(netlifyApi).toContain("if (route.segments[2] === 'analysis')");
    expect(netlifyApi).toContain('await fetchScriptForUser(id, user.id);');
    expect(netlifyApi).toContain("redirect: 'manual'");
    expect(netlifyApi).toContain('lookup(hostname');
    expect(netlifyApi).toContain('isUnsafeIpAddress');
    expect(netlifyApi).toContain("code: 'private_import_url'");
  });

  it('keeps voice and streaming AI calls observable through hosted metrics', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(netlifyApi).toContain('streamText(messages');
    expect(netlifyApi).toContain("event.type === 'response.output_text.delta'");
    expect(netlifyApi).toContain("endpoint: '/chat/stream'");
    expect(netlifyApi).toContain("endpoint: route.path");
    expect(netlifyApi).toContain('synthesizeSpeech({');
    expect(netlifyApi).toContain('recognizeSpeech({');
    expect(netlifyApi).toContain("endpoint: '/documentation/crawl/ai'");
  });

  it('routes active chat and assistant follow-ups through hosted API paths', () => {
    const simpleChatApi = readWorkspaceFile('src/frontend/src/services/api-simple.ts');
    const agentPage = readWorkspaceFile('src/frontend/src/pages/AgenticAIPage.tsx');
    const pleaseAgent = readWorkspaceFile('src/frontend/src/components/Agentic/PleaseMethodAgent.tsx');
    const aiAgent = readWorkspaceFile('src/frontend/src/api/aiAgent.ts');

    expect(simpleChatApi).toContain('axios.post(`${apiUrl}/scripts`');
    expect(agentPage).toContain('pendingAssistantQuestion');
    expect(pleaseAgent).toContain('pendingQuestionId');
    expect(pleaseAgent).toContain('extractGeneratedScript');
    expect(pleaseAgent).toContain('isScriptGenerationPrompt');
    expect(aiAgent).toContain('Please sign in again');
    expect(aiAgent).toContain("serviceError.code = 'RATE_LIMIT'");
  });
});
