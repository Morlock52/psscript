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
    const voiceDock = readWorkspaceFile('src/frontend/src/components/VoiceAssistantDock.tsx');
    const voiceRunner = readWorkspaceFile('scripts/voice-tests-1-8.mjs');

    expect(netlifyApi).toContain('streamText(messages');
    expect(netlifyApi).toContain("event.type === 'response.output_text.delta'");
    expect(netlifyApi).toContain("endpoint: '/chat/stream'");
    expect(netlifyApi).toContain("endpoint: route.path");
    expect(netlifyApi).toContain('synthesizeSpeech({');
    expect(netlifyApi).toContain('recognizeSpeech({');
    expect(netlifyApi).toContain('VOICE_TTS_CACHE_MAX_ENTRIES');
    expect(netlifyApi).toContain('isValidBase64AudioPayload');
    expect(voiceDock).toContain('const { user } = useAuth();');
    expect(voiceDock).toContain('return null;');
    expect(voiceDock).toContain('Audio output is AI-generated');
    expect(voiceRunner).toContain('client_provider_key_ignored');
    expect(netlifyApi).toContain("endpoint: '/documentation/crawl/ai'");
  });

  it('keeps hosted analysis resilient to structured output provider failures', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const scriptAnalysis = readWorkspaceFile('src/frontend/src/pages/ScriptAnalysis.tsx');

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
    expect(netlifyApi).toContain('## Executive Summary');
    expect(netlifyApi).toContain('**Quality:**');
    expect(netlifyApi).toContain('/BaseFont /Helvetica-Bold');
    expect(netlifyApi).toContain('function stylePdfLine');
    expect(scriptAnalysis).toContain('Complete Report');
    expect(scriptAnalysis).toContain('Formatted AI Analysis Package');
    expect(scriptAnalysis).toContain('Score Categories');
    expect(scriptAnalysis).toContain('ReactMarkdown');
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

  it('routes script detail AI analysis requests to the model-selection screen first', () => {
    const scriptDetail = readWorkspaceFile('src/frontend/src/pages/ScriptDetail.tsx');
    const scriptAnalysis = readWorkspaceFile('src/frontend/src/pages/ScriptAnalysis.tsx');

    const analyzeHandler = scriptDetail.slice(
      scriptDetail.indexOf('const handleAnalyzeScript = () => {'),
      scriptDetail.indexOf('const handleDeleteScript = () => {')
    );

    expect(analyzeHandler).toContain('navigate(`/scripts/${id}/analysis`);');
    expect(analyzeHandler).not.toContain('analyzeScriptAndSave');
    expect(analyzeHandler).not.toContain('.mutate(');
    expect(scriptDetail).toContain('Choose AI Model');
    expect(scriptDetail).toContain('Open the analysis screen to choose an AI model and generate scores.');
    expect(scriptAnalysis).toContain('id="model-select"');
    expect(scriptAnalysis).toContain('onChange={(e) => setSelectedModel(e.target.value)}');
    expect(scriptAnalysis).toContain('onClick={handleLangGraphAnalysis}');
  });

  it('normalizes hosted analysis fields before rendering the top report summary', () => {
    const scriptAnalysis = readWorkspaceFile('src/frontend/src/pages/ScriptAnalysis.tsx');
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(scriptAnalysis).toContain('const normalizeScoreValue = (...values: unknown[]): number | null => {');
    expect(scriptAnalysis).toContain('analysis.qualityScore');
    expect(scriptAnalysis).toContain('analysis.quality_score');
    expect(scriptAnalysis).toContain('analysis.codeQualityScore');
    expect(scriptAnalysis).toContain('analysis.code_quality_score');
    expect(scriptAnalysis).toContain('const reportPurpose = firstText(');
    expect(scriptAnalysis).toContain('analysis.executionSummary?.what_it_does');
    expect(scriptAnalysis).toContain('const securityIssues = firstArray(');
    expect(scriptAnalysis).toContain('analysis.securityIssues');
    expect(scriptAnalysis).toContain('analysis.security_issues');
    expect(scriptAnalysis).toContain('const displayScore = (value: number | null)');
    expect(scriptAnalysis).toContain('Analysis data incomplete');
    expect(scriptAnalysis).toContain('Risk score was not returned by the analyzer.');
    expect(scriptAnalysis).toContain('Analysis Coverage');
    expect(scriptAnalysis).toContain('What the analyzer actually inspected and understood from the script.');
    expect(scriptAnalysis).toContain('staticSignals.has_should_process');
    expect(scriptAnalysis).toContain('coverageStats.map');
    expect(netlifyApi).toContain('function collectPowerShellStaticSignals(content: string)');
    expect(netlifyApi).toContain('data_collection_summary');
    expect(netlifyApi).toContain('static_signals');
    expect(netlifyApi).toContain('Use the supplied deterministic static scan signals as evidence.');
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

  it('keeps hosted Supabase connections conservative for serverless bursts', () => {
    const db = readWorkspaceFile('netlify/functions/_shared/db.ts');

    expect(db).toContain("getEnv('DATABASE_POOLER_URL') || requireEnv('DATABASE_URL')");
    expect(db).toContain("getEnv('DB_POOL_MAX', '1')");
    expect(db).toContain('DB_POOL_ALLOW_HIGH_CONCURRENCY');
    expect(db).toContain('connectionTimeoutMillis');
    expect(db).toContain('idleTimeoutMillis');
    expect(db).toContain('maxLifetimeSeconds');
    expect(db).toContain('EMAXCONNSESSION');
    expect(db).toContain('DB_QUERY_RETRY_ATTEMPTS');
  });

  it('keeps script editing honest about VS Code local file launch limits', () => {
    const scriptEditor = readWorkspaceFile('src/frontend/src/pages/ScriptEditor.tsx');
    const app = readWorkspaceFile('src/frontend/src/App.tsx');
    const scriptDetail = readWorkspaceFile('src/frontend/src/pages/ScriptDetail.tsx');
    const scriptAnalysis = readWorkspaceFile('src/frontend/src/pages/ScriptAnalysis.tsx');
    const scriptManagement = readWorkspaceFile('src/frontend/src/pages/ScriptManagement.tsx');
    const manageFiles = readWorkspaceFile('src/frontend/src/pages/ManageFiles.tsx');
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');

    expect(scriptEditor).toContain('vscode://file/');
    expect(scriptEditor).toContain('const canOpenInVSCode = canLaunchVSCodeProtocol(localScriptPath);');
    expect(scriptEditor).toContain('Android|iPhone|iPad|iPod|Mobile');
    expect(scriptEditor).toContain('Open in VS Code');
    expect(scriptEditor).toContain('Download .ps1');
    expect(scriptEditor).toContain('{canOpenInVSCode && (');
    expect(scriptEditor).toContain('if (!localScriptPath)');

    const openHandler = scriptEditor.slice(
      scriptEditor.indexOf('const handleOpenInVSCode = () => {'),
      scriptEditor.indexOf('if (isLoading) {')
    );
    expect(openHandler).toContain('window.location.href = vscodeUrl;');
    expect(openHandler).not.toContain('link.click()');
    expect(openHandler).not.toContain('download');

    expect(app).toContain('path="/scripts/:id/edit" element={<ProtectedRoute requiredRole="admin"><ScriptEditor /></ProtectedRoute>}');
    expect(scriptDetail).toContain("const isAdmin = user?.role === 'admin';");
    expect(scriptDetail).toContain('Only admins can edit script details.');
    expect(scriptDetail).toContain('Edit Details');
    expect(scriptDetail).toContain('categoryService.getCategories');
    expect(scriptDetail).toContain('tags: parseTagsInput');
    expect(scriptDetail).toContain('{isAdmin && (');
    expect(scriptAnalysis).toContain("const isAdmin = user?.role === 'admin';");
    expect(scriptManagement).toContain("const isAdmin = user?.role === 'admin';");
    expect(manageFiles).toContain("const canEditScript = () => user?.role === 'admin';");
    expect(netlifyApi).toContain("error: 'admin_required'");
    expect(netlifyApi).toContain('Only admins can edit script details.');
    expect(netlifyApi).toContain('DELETE FROM script_tags WHERE script_id = $1');
    expect(netlifyApi).toContain('is_public = $7');
    expect(netlifyApi).toContain('const contentChanged = nextContent !== undefined && nextContent !== current.content;');
    expect(netlifyApi).toContain('INSERT INTO script_versions');
  });
});
