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
    expect(netlifyApi).toContain("route.url.searchParams.get('category_id')");
    expect(netlifyApi).toContain("route.url.searchParams.get('tags')");
    expect(netlifyApi).toContain("route.url.searchParams.get('mine') === 'true'");
    expect(netlifyApi).toContain('lower(t.name) = ANY');
    expect(netlifyApi).toContain('sa.quality_score DESC NULLS LAST');
    expect(netlifyApi).toContain('COUNT(*) OVER() AS total_count');
    expect(netlifyApi).toContain("total: Number(result.rows[0]?.total_count || 0)");
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

  it('mounts hosted search and category discovery routes used by the sidebar', () => {
    const app = readWorkspaceFile('src/frontend/src/App.tsx');
    const sidebar = readWorkspaceFile('src/frontend/src/components/layouts/Sidebar.tsx');
    const searchPage = readWorkspaceFile('src/frontend/src/pages/Search.tsx');
    const categoriesPage = readWorkspaceFile('src/frontend/src/pages/Categories.tsx');

    expect(sidebar).toContain("to: '/search'");
    expect(sidebar).toContain("to: '/categories'");

    expect(app).toContain("import('./pages/Search')");
    expect(app).toContain("import('./pages/Categories')");
    expect(app).toContain('path="/search"');
    expect(app).toContain('path="/categories"');
    expect(app).toContain('path="/categories/:id"');

    expect(searchPage).toContain('useSearchParams');
    expect(searchPage).toContain("params.set('q'");
    expect(searchPage).toContain("params.set('category_id'");
    expect(searchPage).toContain("params.set('tags'");
    expect(searchPage).toContain("params.set('mine', 'true')");

    expect(categoriesPage).toContain('useNavigate');
    expect(categoriesPage).toContain('navigate(`/categories/${category.id}`)');
    expect(categoriesPage).toContain('Category not found.');
    expect(categoriesPage).toContain('scriptCount');
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

  it('guards manual documentation writes behind admin auth', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(netlifyApi).toMatch(/route\.path === '\/documentation' && req\.method === 'POST'[\s\S]*?await requireAdmin\(req\)/);
    expect(netlifyApi).toMatch(/route\.segments\[1\] && req\.method === 'PUT'[\s\S]*?await requireAdmin\(req\)/);
    expect(netlifyApi).toMatch(/route\.segments\[1\] && req\.method === 'DELETE'[\s\S]*?await requireAdmin\(req\)/);
    expect(netlifyApi).toContain('function parseDocumentationBody');
    expect(netlifyApi).toContain('UPDATE documentation_items');
    expect(netlifyApi).toContain('RETURNING *');
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

  it('keeps hosted analysis resilient to structured output provider failures', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    for (const field of [
      'beginner_explanation',
      'management_summary',
      'command_details',
      'execution_summary',
    ]) {
      expect(netlifyApi).toContain(`'${field}',`);
    }

    expect(netlifyApi).toContain('function shouldUseStaticAnalysisFallback');
    expect(netlifyApi).toContain('json_schema');
    expect(netlifyApi).toContain('response_format');
    expect(netlifyApi).toContain('buildStaticPowerShellAnalysis(content, title)');
  });

  it('falls back from SSE analysis to authenticated hosted analysis', () => {
    const langgraphService = readWorkspaceFile('src/frontend/src/services/langgraphService.ts');

    expect(langgraphService).toContain('fallbackStarted');
    expect(langgraphService).toContain('Streaming unavailable; continuing with hosted analysis.');
    expect(langgraphService).toContain('const result = await analyzeLangGraph(scriptId, options);');
    expect(langgraphService).toContain('fallbackError?.message');
  });

  it('keeps analysis streaming bearer tokens out of URLs', () => {
    const langgraphService = readWorkspaceFile('src/frontend/src/services/langgraphService.ts');

    expect(langgraphService).toContain("fetch(url, {");
    expect(langgraphService).toContain('Authorization: `Bearer ${token}`');
    expect(langgraphService).toContain("credentials: 'include'");
    expect(langgraphService).not.toContain('new EventSource');
    expect(langgraphService).not.toContain("params.append('auth_token'");
    expect(langgraphService).not.toContain('params.append("auth_token"');
    expect(langgraphService).not.toContain('auth_token=');
  });

  it('keeps stylesheet imports before Tailwind directives', () => {
    const indexCss = readWorkspaceFile('src/frontend/src/index.css');
    const importIndex = indexCss.indexOf("@import './styles/tokens.css';");
    const motionImportIndex = indexCss.indexOf("@import './styles/motion.css';");
    const tailwindBaseIndex = indexCss.indexOf('@tailwind base;');

    expect(importIndex).toBeGreaterThanOrEqual(0);
    expect(motionImportIndex).toBeGreaterThan(importIndex);
    expect(tailwindBaseIndex).toBeGreaterThan(motionImportIndex);
  });

  it('surfaces script version history and honest data protection status', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const scriptDetail = readWorkspaceFile('src/frontend/src/pages/ScriptDetail.tsx');

    expect(netlifyApi).toContain('INSERT INTO script_versions');
    expect(netlifyApi).toContain('contentChanged');
    expect(scriptDetail).toContain("queryKey: ['scriptVersions', id]");
    expect(scriptDetail).toContain('Version History');
    expect(scriptDetail).toContain('Data Protection');
    expect(scriptDetail).toContain('Per-script client-side encryption is not enabled in this build.');
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

  it('keeps hosted upload and delete contracts aligned with Netlify and Supabase constraints', () => {
    const uploadPage = readWorkspaceFile('src/frontend/src/pages/ScriptUpload.tsx');
    const apiService = readWorkspaceFile('src/frontend/src/services/api.ts');
    const manageFiles = readWorkspaceFile('src/frontend/src/pages/ManageFiles.tsx');
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(uploadPage).toContain('prepareUploadPayload');
    expect(uploadPage).not.toContain('formData.append');
    expect(uploadPage).toContain('MAX_HOSTED_UPLOAD_MB = 4');

    expect(apiService).toContain(': "/scripts/upload";');
    expect(apiService).toContain('Maximum hosted upload size is 4MB');

    expect(netlifyApi).toContain('HOSTED_SCRIPT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024');
    expect(netlifyApi).toContain('parseScriptUploadRequest');
    expect(netlifyApi).toContain('upload_too_large');
    expect(netlifyApi).toContain('script_not_found_or_not_deletable');
    expect(netlifyApi).toContain('deletedIds');
    expect(netlifyApi).toContain('notDeletedIds');

    expect(manageFiles).toContain('canDeleteScript');
    expect(manageFiles).toContain('Only the owner or an admin can delete this script');
    expect(manageFiles).not.toContain('Remove from UI immediately');
  });
});
