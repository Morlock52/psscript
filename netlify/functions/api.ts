import type { Config, Context } from '@netlify/functions';
import OpenAI, { toFile } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { query } from './_shared/db';
import { getEnv, requireEnv } from './_shared/env';
import { requireAdmin, requireUser } from './_shared/auth';
import { json, methodNotAllowed, notFound } from './_shared/http';

export const config: Config = {
  path: ['/api', '/api/*'],
};

type RouteParams = { path: string; segments: string[]; url: URL };
type RequestContext = Pick<Context, 'requestId'>;
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const OPENAI_TEXT_MODEL = 'gpt-5.4-mini';
const OPENAI_ANALYSIS_MODEL = 'gpt-5.4-mini';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const OPENAI_STT_MODEL = 'gpt-4o-mini-transcribe';
const ANTHROPIC_TEXT_MODEL = 'claude-sonnet-4-5-20250929';

const openAiVoices = [
  { id: 'marin', name: 'Marin', provider: 'openai' },
  { id: 'cedar', name: 'Cedar', provider: 'openai' },
  { id: 'alloy', name: 'Alloy', provider: 'openai' },
  { id: 'ash', name: 'Ash', provider: 'openai' },
  { id: 'ballad', name: 'Ballad', provider: 'openai' },
  { id: 'coral', name: 'Coral', provider: 'openai' },
  { id: 'echo', name: 'Echo', provider: 'openai' },
  { id: 'fable', name: 'Fable', provider: 'openai' },
  { id: 'nova', name: 'Nova', provider: 'openai' },
  { id: 'onyx', name: 'Onyx', provider: 'openai' },
  { id: 'sage', name: 'Sage', provider: 'openai' },
  { id: 'shimmer', name: 'Shimmer', provider: 'openai' },
  { id: 'verse', name: 'Verse', provider: 'openai' },
];

const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'purpose',
    'security_score',
    'quality_score',
    'risk_score',
    'suggestions',
    'security_issues',
    'best_practice_violations',
    'performance_insights',
  ],
  properties: {
    purpose: { type: 'string' },
    beginner_explanation: { type: 'string' },
    management_summary: { type: 'string' },
    security_score: { type: 'number', minimum: 0, maximum: 10 },
    quality_score: { type: 'number', minimum: 0, maximum: 10 },
    risk_score: { type: 'number', minimum: 0, maximum: 10 },
    suggestions: { type: 'array', items: { type: 'string' } },
    command_details: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'purpose', 'beginner_explanation', 'management_impact', 'example', 'parameters'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          purpose: { type: 'string' },
          beginner_explanation: { type: 'string' },
          management_impact: { type: 'string' },
          example: { type: 'string' },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'description'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    },
    security_issues: { type: 'array', items: { type: 'string' } },
    best_practice_violations: { type: 'array', items: { type: 'string' } },
    performance_insights: { type: 'array', items: { type: 'string' } },
    execution_summary: {
      type: 'object',
      additionalProperties: false,
      required: ['what_it_does', 'business_value', 'key_actions', 'operational_risk'],
      properties: {
        what_it_does: { type: 'string' },
        business_value: { type: 'string' },
        key_actions: { type: 'array', items: { type: 'string' } },
        operational_risk: { type: 'string' },
      },
    },
  },
};

const scriptSelect = `
  SELECT s.id, s.title, s.description, s.content, s.user_id, s.category_id, s.version,
         s.is_public, s.execution_count, s.file_hash, s.created_at, s.updated_at,
         c.name AS category_name,
         p.username AS author_username
  FROM scripts s
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN app_profiles p ON p.id = s.user_id
`;

export default async function handleRequest(req: Request, context: Context): Promise<Response> {
  try {
    const route = getRoute(req);

    if (route.path === '/health') return await handleHealth();
    if (route.segments[0] === 'voice') return await handleVoice(req, route);
    if (route.path === '/auth/default-user') return await handleDefaultUser(req);
    if (route.path === '/auth/me') return await handleAuthMe(req);
    if (route.path === '/auth/user') return await handleAuthUser(req);
    if (route.path === '/users') return await handleUsers(req);
    if (route.segments[0] === 'users' && route.segments[1]) return await handleUserById(req, route);
    if (route.path === '/categories') return await handleCategories(req);
    if (route.path === '/tags') return await handleTags(req);
    if (route.path === '/scripts') return await handleScripts(req, route);
    if (route.path === '/scripts/search') return await handleScriptSearch(req, route);
    if (route.path === '/scripts/upload' || route.path === '/scripts/upload/large') return await handleScriptUpload(req);
    if (route.path === '/scripts/analyze') return await handleAdhocAnalysis(req);
    if (route.path === '/chat/stream') return await handleChatStream(req);
    if (route.path === '/chat' || route.path === '/chat/message') return await handleChat(req);
    if (route.path === '/analytics/summary') return await handleAnalyticsSummary(req);
    if (route.path === '/analytics/security') return await handleAnalyticsSecurity(req);
    if (route.path === '/analytics/categories') return await handleAnalyticsCategories(req);
    if (route.path === '/analytics/usage') return await handleAnalyticsUsage(req);
    if (route.segments[0] === 'categories' && route.segments[1]) return await handleCategoryById(req, route);
    if (route.segments[0] === 'documentation') return await handleDocumentation(req, route);

    if (route.segments[0] === 'scripts' && route.segments[1]) {
      return await handleScriptById(req, route);
    }

    return notFound(route.path);
  } catch (error) {
    const err = error as Error & { status?: number; code?: string; existingScriptId?: number | string };
    console.error('[netlify-api]', context.requestId, err);
    return json({
      success: false,
      error: err.code || 'hosted_api_error',
      message: err.message || 'Hosted API error',
      ...(err.existingScriptId ? { existingScriptId: err.existingScriptId } : {}),
      requestId: context.requestId,
    }, { status: err.status || 500 });
  }
}

function getRoute(req: Request): RouteParams {
  const url = new URL(req.url);
  let path = url.pathname;
  path = path.replace(/^\/\.netlify\/functions\/api/, '');
  path = path.replace(/^\/api/, '');
  if (!path) path = '/';
  path = path.replace(/\/+$/, '') || '/';
  return { path, segments: path.split('/').filter(Boolean), url };
}

async function requireUserWithQueryToken(req: Request, route: RouteParams) {
  const token = route.url.searchParams.get('token');
  if (!token) {
    return await requireUser(req);
  }

  const headers = new Headers(req.headers);
  headers.set('authorization', `Bearer ${token}`);
  return await requireUser(new Request(req, { headers }));
}

async function handleHealth(): Promise<Response> {
  const env = {
    database: Boolean(getEnv('DATABASE_URL')),
    supabaseUrl: Boolean(getEnv('SUPABASE_URL')),
    supabaseAnonKey: Boolean(getEnv('SUPABASE_ANON_KEY')),
    supabaseServiceRoleKey: Boolean(getEnv('SUPABASE_SERVICE_ROLE_KEY')),
    openai: Boolean(getEnv('OPENAI_API_KEY')),
    anthropic: Boolean(getEnv('ANTHROPIC_API_KEY')),
  };
  let database = env.database ? 'configured' : 'missing';

  if (env.database) {
    try {
      const db = await query('SELECT 1 AS ok');
      database = db.rows[0]?.ok === 1 ? 'connected' : 'unknown';
    } catch (error) {
      console.error('[netlify-api] health database check failed', error);
      database = 'unreachable';
    }
  }

  return json({
    status: database === 'connected' ? 'healthy' : 'degraded',
    runtime: 'netlify-functions',
    database,
    env,
  });
}

async function handleAuthMe(req: Request): Promise<Response> {
  const user = await requireUser(req);
  return json({ success: true, user: toFrontendUser(user) });
}

async function handleAuthUser(req: Request): Promise<Response> {
  if (req.method !== 'PUT') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const result = await query(
    `
      UPDATE app_profiles
      SET username = COALESCE($2, username),
          first_name = COALESCE($3, first_name),
          last_name = COALESCE($4, last_name),
          job_title = COALESCE($5, job_title),
          company = COALESCE($6, company),
          bio = COALESCE($7, bio),
          updated_at = now()
      WHERE id = $1
      RETURNING id, email, username, role, first_name, last_name, job_title, company, bio, created_at
    `,
    [user.id, body.username, body.firstName, body.lastName, body.jobTitle, body.company, body.bio]
  );
  return json({ success: true, user: toFrontendUser(result.rows[0]) });
}

async function handleDefaultUser(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();

  const email = getEnv('DEFAULT_ADMIN_EMAIL', 'admin@example.com');
  const password = getEnv('DEFAULT_ADMIN_PASSWORD', 'admin123');
  const supabase = getSupabaseAdminClient();

  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) {
    throw Object.assign(new Error(list.error.message), { status: 500, code: 'default_user_lookup_failed' });
  }

  const existing = list.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  const metadata = { username: 'admin', role: 'admin' };
  const authResult = existing
    ? await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          ...metadata,
        },
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

  if (authResult.error || !authResult.data.user) {
    throw Object.assign(
      new Error(authResult.error?.message || 'Unable to create default user'),
      { status: 500, code: 'default_user_upsert_failed' }
    );
  }

  const user = authResult.data.user;
  await query(
    `
      INSERT INTO app_profiles (id, email, username, role)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          username = EXCLUDED.username,
          role = 'admin',
          updated_at = now()
    `,
    [user.id, email, 'admin']
  );

  return json({ success: true, email });
}

async function handleUsers(req: Request): Promise<Response> {
  await requireAdmin(req);
  const supabase = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const [profilesResult, authUsersResult] = await Promise.all([
      query(
        `
          SELECT id, email, username, role, created_at, updated_at
          FROM app_profiles
          ORDER BY created_at DESC
        `
      ),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (authUsersResult.error) {
      throw Object.assign(new Error(authUsersResult.error.message), { status: 500, code: 'user_auth_lookup_failed' });
    }

    const authUsersById = new Map(authUsersResult.data.users.map(user => [user.id, user]));
    return json(profilesResult.rows.map(profile => toFrontendManagedUser(profile, authUsersById.get(profile.id))));
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const email = normalizeRequiredString(body.email, 'Email');
    const username = normalizeRequiredString(body.username, 'Username');
    const password = normalizePassword(body.password);
    const role = normalizeManagedRole(body.role);

    const authResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, role },
    });

    if (authResult.error || !authResult.data.user) {
      throw Object.assign(new Error(authResult.error?.message || 'Unable to create user'), { status: 400, code: 'user_create_failed' });
    }

    const result = await query(
      `
        INSERT INTO app_profiles (id, email, username, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            username = EXCLUDED.username,
            role = EXCLUDED.role,
            updated_at = now()
        RETURNING id, email, username, role, created_at, updated_at
      `,
      [authResult.data.user.id, email, username, role]
    );

    return json({ success: true, user: toFrontendManagedUser(result.rows[0], authResult.data.user) }, { status: 201 });
  }

  return methodNotAllowed();
}

async function handleUserById(req: Request, route: RouteParams): Promise<Response> {
  const admin = await requireAdmin(req);
  const id = route.segments[1];
  if (!isUuid(id)) return json({ success: false, error: 'invalid_user_id', message: 'Invalid user id' }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  if (route.segments[2] === 'reset-password') {
    if (req.method !== 'POST') return methodNotAllowed();
    const body = await req.json().catch(() => ({}));
    const password = normalizePassword(body.password);
    const authResult = await supabase.auth.admin.updateUserById(id, { password });
    if (authResult.error) {
      throw Object.assign(new Error(authResult.error.message), { status: 400, code: 'user_password_reset_failed' });
    }
    return json({ success: true });
  }

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    const email = normalizeRequiredString(body.email, 'Email');
    const username = normalizeRequiredString(body.username, 'Username');
    let role = normalizeManagedRole(body.role);

    if (admin.id === id && role !== 'admin') {
      role = 'admin';
    }

    const authUpdate: Record<string, unknown> = {
      email,
      user_metadata: { username, role },
    };
    if (typeof body.password === 'string' && body.password.trim()) {
      authUpdate.password = normalizePassword(body.password);
    }

    const authResult = await supabase.auth.admin.updateUserById(id, authUpdate as any);
    if (authResult.error || !authResult.data.user) {
      throw Object.assign(new Error(authResult.error?.message || 'Unable to update user'), { status: 400, code: 'user_update_failed' });
    }

    const result = await query(
      `
        UPDATE app_profiles
        SET email = $2,
            username = $3,
            role = $4,
            updated_at = now()
        WHERE id = $1
        RETURNING id, email, username, role, created_at, updated_at
      `,
      [id, email, username, role]
    );
    if (!result.rows[0]) return json({ success: false, error: 'user_not_found', message: 'User not found' }, { status: 404 });

    return json({ success: true, user: toFrontendManagedUser(result.rows[0], authResult.data.user) });
  }

  if (req.method === 'DELETE') {
    if (admin.id === id) {
      return json({ success: false, error: 'cannot_delete_self', message: 'You cannot delete your own admin account' }, { status: 400 });
    }

    const authResult = await supabase.auth.admin.deleteUser(id);
    if (authResult.error) {
      throw Object.assign(new Error(authResult.error.message), { status: 400, code: 'user_delete_failed' });
    }
    await query('DELETE FROM app_profiles WHERE id = $1', [id]);
    return json({ success: true, deleted: 1 });
  }

  return methodNotAllowed();
}

async function handleCategories(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    const result = await query('SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name');
    return json({ categories: result.rows });
  }

  const admin = await requireAdmin(req);
  const body = await req.json().catch(() => ({}));

  if (req.method === 'POST') {
    const result = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [body.name, body.description || null]
    );
    return json({ success: true, category: result.rows[0], user: admin.id }, { status: 201 });
  }

  return methodNotAllowed();
}

async function handleCategoryById(req: Request, route: RouteParams): Promise<Response> {
  const admin = await requireAdmin(req);
  const id = Number(route.segments[1]);
  if (!Number.isFinite(id)) return json({ error: 'invalid_category_id', message: 'Invalid category id' }, { status: 400 });
  const body = req.method === 'PUT' ? await req.json().catch(() => ({})) : {};

  if (req.method === 'PUT') {
    const result = await query(
      'UPDATE categories SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = now() WHERE id = $1 RETURNING *',
      [id, body.name, body.description]
    );
    return json({ success: true, category: result.rows[0], user: admin.id });
  }

  if (req.method === 'DELETE') {
    if (route.url.searchParams.get('mode') === 'uncategorize') {
      await query('UPDATE scripts SET category_id = NULL WHERE category_id = $1', [id]);
    }
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    return json({ success: true, deleted: result.rowCount || 0, user: admin.id });
  }

  return methodNotAllowed();
}

async function handleTags(req: Request): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const result = await query('SELECT id, name, created_at FROM tags ORDER BY name');
  return json({ tags: result.rows });
}

async function handleScripts(req: Request, route: RouteParams): Promise<Response> {
  const user = await requireUser(req);

  if (req.method === 'GET') {
    const limit = Math.min(Number(route.url.searchParams.get('limit') || '50'), 100);
    const result = await query(
      `${scriptSelect}
       WHERE s.user_id = $1 OR s.is_public = true
       ORDER BY s.updated_at DESC
       LIMIT $2`,
      [user.id, limit]
    );
    const scripts = result.rows.map(toFrontendScript);
    return json({ scripts, total: scripts.length });
  }

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const script = await createScript(user.id, {
      title: body.title,
      description: body.description,
      content: body.content,
      categoryId: body.category_id ?? body.categoryId,
      isPublic: body.is_public ?? body.isPublic,
      tags: body.tags,
    });
    return json({ success: true, script }, { status: 201 });
  }

  return methodNotAllowed();
}

async function handleScriptSearch(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const user = await requireUser(req);
  const search = `%${route.url.searchParams.get('q') || ''}%`;
  const result = await query(
    `${scriptSelect}
     WHERE (s.user_id = $1 OR s.is_public = true)
       AND ($2 = '%%' OR s.title ILIKE $2 OR s.description ILIKE $2 OR s.content ILIKE $2)
     ORDER BY s.updated_at DESC
     LIMIT 50`,
    [user.id, search]
  );
  const scripts = result.rows.map(toFrontendScript);
  return json({ scripts, total: scripts.length });
}

async function handleScriptById(req: Request, route: RouteParams): Promise<Response> {
  const user = await requireUser(req);
  const id = Number(route.segments[1]);
  if (!Number.isFinite(id)) return json({ error: 'invalid_script_id', message: 'Invalid script id' }, { status: 400 });

  if (route.segments[2] === 'execute') {
    return json({
      success: false,
      error: 'hosted_execution_unavailable',
      message: 'Hosted PSScript supports static analysis only. Download the script to execute it locally.',
    }, { status: 501 });
  }

  if (route.segments[2] === 'analysis') {
    if (req.method !== 'GET') return methodNotAllowed();
    const result = await query('SELECT * FROM script_analysis WHERE script_id = $1', [id]);
    return json(result.rows[0] ? toFrontendAnalysis(result.rows[0]) : null);
  }

  if (route.segments[2] === 'analysis-stream') {
    return await handleHostedAnalysisStream(req, route, id);
  }

  if (route.segments[2] === 'similar') {
    if (req.method !== 'GET') return methodNotAllowed();
    return json({ similar_scripts: [] });
  }

  if (route.segments[2] === 'execution-history') {
    if (req.method !== 'GET') return methodNotAllowed();
    return json({ executions: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } });
  }

  if (route.segments[2] === 'versions') {
    if (req.method !== 'GET') return methodNotAllowed();
    const result = await query(
      'SELECT id, script_id, version, commit_message, created_at FROM script_versions WHERE script_id = $1 ORDER BY version DESC',
      [id]
    );
    return json({ versions: result.rows });
  }

  if (route.segments[2] === 'analyze') {
    if (req.method !== 'POST') return methodNotAllowed();
    const script = await fetchScriptForUser(id, user.id);
    const analysis = await analyzePowerShell(script.content, script.title);
    const saved = await saveAnalysis(id, analysis);
    return json({ success: true, analysis: toFrontendAnalysis(saved) });
  }

  if (route.segments[2] === 'analyze-langgraph') {
    if (req.method !== 'POST') return methodNotAllowed();
    const script = await fetchScriptForUser(id, user.id);
    const startedAt = new Date().toISOString();
    const workflowId = `hosted-${id}-${Date.now()}`;
    const analysis = await analyzePowerShell(script.content, script.title);
    const saved = await saveAnalysis(id, analysis);
    const frontendAnalysis = toFrontendAnalysis(saved);
    const completedAt = new Date().toISOString();
    return json({
      workflow_id: workflowId,
      thread_id: workflowId,
      status: 'completed',
      current_stage: 'completed',
      final_response: 'Hosted analysis completed successfully.',
      analysis_results: {
        analyze_powershell_script: JSON.stringify(frontendAnalysis),
        security_scan: JSON.stringify({
          security_score: frontendAnalysis.securityScore,
          findings: frontendAnalysis.securityIssues || [],
        }),
        quality_analysis: JSON.stringify({
          quality_score: frontendAnalysis.qualityScore,
          suggestions: frontendAnalysis.suggestions || [],
        }),
        generate_optimizations: JSON.stringify(frontendAnalysis.performanceInsights || []),
      },
      security_findings: (frontendAnalysis.securityIssues || []).map((issue: string) => ({
        category: 'security',
        severity: frontendAnalysis.riskScore || 0,
        pattern: issue,
        description: issue,
      })),
      quality_metrics: {
        quality_score: frontendAnalysis.qualityScore,
        metrics: {
          total_lines: script.content.split(/\r?\n/).length,
          code_lines: script.content.split(/\r?\n/).filter(line => line.trim()).length,
        },
        issues: frontendAnalysis.bestPracticeViolations || [],
        recommendations: frontendAnalysis.suggestions || [],
      },
      optimizations: (frontendAnalysis.performanceInsights || []).map((recommendation: string) => ({
        category: 'performance',
        priority: frontendAnalysis.riskScore > 6 ? 'high' : 'medium',
        recommendation,
        impact: 'Improves maintainability or runtime efficiency.',
      })),
      requires_human_review: false,
      started_at: startedAt,
      completed_at: completedAt,
    });
  }

  if (route.segments[2] === 'export-analysis') {
    if (req.method !== 'GET') return methodNotAllowed();
    const script = await fetchScriptForUser(id, user.id);
    const result = await query('SELECT * FROM script_analysis WHERE script_id = $1', [id]);
    if (!result.rows[0]) {
      return json({ success: false, error: 'analysis_not_found', message: 'Analysis not found for this script' }, { status: 404 });
    }
    return exportAnalysisMarkdown(script, toFrontendAnalysis(result.rows[0]));
  }

  if (req.method === 'GET') {
    const script = await fetchScriptForUser(id, user.id);
    return json(toFrontendScript(script));
  }

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    const result = await query(
      `
        UPDATE scripts
        SET title = COALESCE($3, title),
            description = COALESCE($4, description),
            content = COALESCE($5, content),
            category_id = COALESCE($6, category_id),
            updated_at = now()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `,
      [id, user.id, body.title, body.description, body.content, body.category_id ?? body.categoryId]
    );
    if (!result.rows[0]) return json({ error: 'script_not_found', message: 'Script not found' }, { status: 404 });
    return json({ success: true, script: toFrontendScript(result.rows[0]) });
  }

  if (req.method === 'DELETE') {
    const result = await query('DELETE FROM scripts WHERE id = $1 AND user_id = $2 RETURNING id', [id, user.id]);
    return json({ success: true, deleted: result.rowCount || 0 });
  }

  return methodNotAllowed();
}

async function handleDocumentation(req: Request, route: RouteParams): Promise<Response> {
  if (route.path === '/documentation/crawl/ai' && req.method === 'POST') {
    return await handleHostedDocumentationImport(req);
  }

  if (route.path === '/documentation/search') {
    const search = `%${route.url.searchParams.get('query') || route.url.searchParams.get('q') || ''}%`;
    const result = await query(
      `
        SELECT id, title, url, content, source, tags, created_at, updated_at
        FROM documentation_items
        WHERE $1 = '%%' OR title ILIKE $1 OR content ILIKE $1
        ORDER BY updated_at DESC
        LIMIT 50
      `,
      [search]
    );
    const limit = Math.min(Number(route.url.searchParams.get('limit') || '20'), 100);
    const offset = Number(route.url.searchParams.get('offset') || '0');
    return json({ success: true, data: result.rows, results: result.rows, total: result.rows.length, limit, offset });
  }

  if (route.path === '/documentation/stats') {
    const result = await query('SELECT COUNT(*)::int AS total FROM documentation_items');
    return json({ success: true, data: { total: result.rows[0]?.total || 0, sources: {}, tagsCount: 0, lastCrawled: null } });
  }

  if (route.path === '/documentation/sources') {
    const result = await query('SELECT DISTINCT source FROM documentation_items WHERE source IS NOT NULL ORDER BY source');
    return json({ success: true, data: result.rows.map(row => row.source), sources: result.rows.map(row => row.source) });
  }

  if (route.path === '/documentation/tags') {
    const result = await query('SELECT DISTINCT unnest(tags) AS tag FROM documentation_items ORDER BY tag');
    return json({ success: true, data: result.rows.map(row => row.tag), tags: result.rows.map(row => row.tag) });
  }

  if (route.path === '/documentation' && req.method === 'GET') {
    const limit = Math.min(Number(route.url.searchParams.get('limit') || '20'), 100);
    const result = await query(
      'SELECT id, title, url, content, source, tags, created_at, updated_at FROM documentation_items ORDER BY updated_at DESC LIMIT $1',
      [limit]
    );
    return json({ success: true, data: result.rows, documents: result.rows, total: result.rows.length });
  }

  if (route.path === '/documentation' && req.method === 'POST') {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const result = await query(
      `
        INSERT INTO documentation_items (title, url, content, source, tags)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [body.title, body.url || null, body.content || '', body.source || 'manual', body.tags || []]
    );
    return json({ success: true, data: result.rows[0], document: result.rows[0] }, { status: 201 });
  }

  if (route.path === '/documentation/bulk' && req.method === 'POST') {
    await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const documents = Array.isArray(body.documents) ? body.documents : [];
    let imported = 0;
    for (const doc of documents) {
      if (!doc?.title || !doc?.content) continue;
      await query(
        'INSERT INTO documentation_items (title, url, content, source, tags) VALUES ($1, $2, $3, $4, $5)',
        [doc.title, doc.url || null, doc.content, doc.source || 'bulk', doc.tags || []]
      );
      imported += 1;
    }
    return json({ success: true, imported, errors: documents.length - imported });
  }

  if (route.path.startsWith('/documentation/crawl')) {
    return json({
      success: false,
      error: 'hosted_crawl_unavailable',
      message: 'Hosted background crawling is not available in the Netlify v1 API. Use AI import or the bulk endpoint.',
    }, { status: 501 });
  }

  if (route.segments[1] && req.method === 'GET') {
    const id = Number(route.segments[1]);
    const result = await query('SELECT * FROM documentation_items WHERE id = $1', [id]);
    if (!result.rows[0]) return json({ error: 'documentation_not_found', message: 'Documentation item not found' }, { status: 404 });
    return json({ success: true, data: result.rows[0] });
  }

  if (route.segments[1] && req.method === 'DELETE') {
    await requireUser(req);
    const id = Number(route.segments[1]);
    const result = await query('DELETE FROM documentation_items WHERE id = $1 RETURNING id', [id]);
    return json({ success: true, deleted: result.rowCount || 0 });
  }

  return notFound(route.path);
}

async function handleHostedDocumentationImport(req: Request): Promise<Response> {
  await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const startUrl = normalizePublicImportUrl(body.url);
  const maxPages = Math.min(Math.max(Number(body.maxPages || 5), 1), 10);
  const maxDepth = Math.min(Math.max(Number(body.depth || 1), 0), 2);
  const pages = await collectDocumentationPages(startUrl, maxPages, maxDepth);

  let imported = 0;
  let errors = 0;
  const data: Array<{ url: string; doc: any }> = [];

  for (const page of pages) {
    try {
      const doc = await buildDocumentationItem(page);
      if (!doc.content.trim()) {
        errors += 1;
        continue;
      }

      const result = await query(
        `
          INSERT INTO documentation_items (title, url, content, source, tags)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, title, url, content, source, tags, created_at, updated_at
        `,
        [doc.title, doc.url, doc.content, doc.source, doc.tags]
      );
      imported += 1;
      data.push({ url: doc.url, doc: toFrontendDocumentationItem(result.rows[0]) });
    } catch (error) {
      errors += 1;
      console.warn('[netlify-api] hosted documentation import skipped page', page.url, error);
    }
  }

  return json({
    success: imported > 0,
    total: pages.length,
    imported,
    errors,
    message: imported > 0
      ? `AI import complete. ${imported} documentation pages saved.`
      : 'No importable documentation content was found.',
    data,
  }, { status: imported > 0 ? 200 : 422 });
}

async function handleScriptUpload(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const form = await req.formData();
  const file = form.get('script_file');
  const contentField = form.get('content');
  let content = typeof contentField === 'string' ? contentField : '';
  let fileName = 'script.ps1';

  if (file instanceof File) {
    fileName = file.name || fileName;
    content = await file.text();
  }

  if (!content.trim()) {
    return json({ error: 'missing_file', message: 'No script file or content was provided' }, { status: 400 });
  }

  const script = await createScript(user.id, {
    title: String(form.get('title') || fileName),
    description: String(form.get('description') || 'No description provided'),
    content,
    categoryId: form.get('category_id') ? Number(form.get('category_id')) : null,
    isPublic: form.get('is_public') === 'true',
    tags: safeJsonArray(form.get('tags')),
  });

  let analysis: any = null;
  let analysisError: string | null = null;
  if (form.get('analyze_with_ai') === 'true') {
    try {
      analysis = toFrontendAnalysis(await saveAnalysis(Number(script.id), await analyzePowerShell(content, script.title)));
    } catch (error) {
      const err = error as Error;
      analysisError = err.message || 'AI analysis failed after upload';
      console.error('[netlify-api] upload analysis failed after script creation', {
        scriptId: script.id,
        message: analysisError,
      });
    }
  }

  return json({
    success: true,
    script,
    analysis,
    analysisError,
    message: analysis
      ? 'Script uploaded and analyzed successfully'
      : analysisError
        ? 'Script uploaded successfully, but AI analysis failed.'
        : 'Script uploaded and saved successfully',
  }, { status: 201 });
}

async function handleAdhocAnalysis(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '');
  if (!content.trim()) return json({ error: 'missing_content', message: 'Script content is required for analysis' }, { status: 400 });
  const analysis = await analyzePowerShell(content, body.title || 'Ad hoc script');
  return json({ success: true, analysis });
}

async function handleHostedAnalysisStream(req: Request, route: RouteParams, scriptId: number): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();

  const user = await requireUserWithQueryToken(req, route);
  const script = await fetchScriptForUser(scriptId, user.id);
  const startedAt = new Date().toISOString();
  const workflowId = `hosted-${scriptId}-${Date.now()}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        send({
          type: 'connected',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          data: { workflow_id: workflowId, current_stage: 'analysis' },
        });
        send({
          type: 'workflow_event',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          message: 'Hosted analysis started',
          data: { workflow_id: workflowId, node: 'analyze', current_stage: 'analysis' },
        });
        send({
          type: 'tool_started',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          message: 'Running hosted PowerShell analysis',
          data: { workflow_id: workflowId, tool_name: 'analyze_powershell_script' },
        });

        const analysis = await analyzePowerShell(script.content, script.title);
        const saved = await saveAnalysis(scriptId, analysis);
        const frontendAnalysis = toFrontendAnalysis(saved);

        send({
          type: 'tool_completed',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          message: 'Hosted PowerShell analysis completed',
          data: {
            workflow_id: workflowId,
            tool_name: 'analyze_powershell_script',
            result: frontendAnalysis,
          },
        });
        send({
          type: 'workflow_event',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          message: 'Analysis complete',
          data: {
            workflow_id: workflowId,
            node: 'complete',
            current_stage: 'completed',
            final_response: 'Hosted analysis completed successfully.',
            started_at: startedAt,
            completed_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        const err = error as Error;
        send({
          type: 'error',
          script_id: String(scriptId),
          timestamp: new Date().toISOString(),
          message: err.message || 'Hosted analysis failed',
          data: { workflow_id: workflowId },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function handleChat(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const messages = normalizeChatMessages([
    body.system_prompt ? { role: 'system', content: String(body.system_prompt) } : null,
    ...(Array.isArray(body.messages) ? body.messages : []),
  ]);
  if (!messages.some(message => message.role === 'user')) {
    return json({ error: 'missing_user_message', message: 'At least one user message is required' }, { status: 400 });
  }

  const response = await completeText(messages);
  return json({
    response: response.text,
    provider: response.provider,
    model: response.model,
  });
}

async function handleChatStream(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const messages = normalizeChatMessages([
    body.system_prompt ? { role: 'system', content: String(body.system_prompt) } : null,
    ...(Array.isArray(body.messages) ? body.messages : []),
  ]);
  if (!messages.some(message => message.role === 'user')) {
    return json({ error: 'missing_user_message', message: 'At least one user message is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await completeText(messages);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: response.text })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', provider: response.provider, model: response.model })}\n\n`));
      } catch (error) {
        const err = error as Error & { code?: string };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: err.message, code: err.code || 'ai_stream_error' })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function handleVoice(req: Request, route: RouteParams): Promise<Response> {
  const user = await requireUser(req);

  if (route.path === '/voice/voices') {
    if (req.method !== 'GET') return methodNotAllowed();
    return json({ voices: openAiVoices });
  }

  if (route.path === '/voice/settings') {
    if (req.method === 'GET') {
      return json({
        voiceId: getEnv('VOICE_TTS_VOICE', 'marin'),
        autoPlay: true,
        volume: 0.9,
        speed: 1,
        userId: user.id,
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json().catch(() => ({}));
      return json({
        voiceId: normalizeVoiceId(body.voiceId || getEnv('VOICE_TTS_VOICE', 'marin')),
        autoPlay: body.autoPlay !== false,
        volume: clampNumber(body.volume, 0, 1, 0.9),
        speed: clampNumber(body.speed, 0.25, 4, 1),
      });
    }
  }

  if (route.path === '/voice/synthesize') {
    if (req.method !== 'POST') return methodNotAllowed();
    const body = await req.json().catch(() => ({}));
    const result = await synthesizeSpeech({
      text: String(body.text || ''),
      voiceId: normalizeVoiceId(body.voiceId || body.voice_id || getEnv('VOICE_TTS_VOICE', 'marin')),
      outputFormat: String(body.outputFormat || body.output_format || 'mp3'),
      speed: clampNumber(body.speed, 0.25, 4, 1),
      voiceInstructions: body.voiceInstructions || body.voice_instructions,
    });
    return json(result);
  }

  if (route.path === '/voice/recognize') {
    if (req.method !== 'POST') return methodNotAllowed();
    const body = await req.json().catch(() => ({}));
    const result = await recognizeSpeech({
      audioData: String(body.audioData || body.audio_data || ''),
      audioFormat: String(body.audioFormat || body.audio_format || 'webm'),
      language: body.language ? String(body.language) : undefined,
      prompt: body.prompt ? String(body.prompt) : undefined,
      transcriptionMode: body.transcriptionMode || body.transcription_mode,
    });
    return json(result);
  }

  return notFound(route.path);
}

async function handleAnalyticsSummary(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const result = await query(
    `
      SELECT
        COUNT(*)::int AS total_scripts,
        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS recent_scripts,
        COALESCE(AVG(sa.security_score), 0)::float AS average_security_score
      FROM scripts s
      LEFT JOIN script_analysis sa ON sa.script_id = s.id
      WHERE s.user_id = $1 OR s.is_public = true
    `,
    [user.id]
  );
  return json(result.rows[0]);
}

async function handleAnalyticsSecurity(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const result = await query(
    `
      SELECT
        COALESCE(AVG(security_score), 0)::float AS average,
        COUNT(*) FILTER (WHERE security_score >= 8)::int AS high,
        COUNT(*) FILTER (WHERE security_score >= 5 AND security_score < 8)::int AS medium,
        COUNT(*) FILTER (WHERE security_score < 5)::int AS low
      FROM script_analysis sa
      JOIN scripts s ON s.id = sa.script_id
      WHERE s.user_id = $1 OR s.is_public = true
    `,
    [user.id]
  );
  return json(result.rows[0]);
}

async function handleAnalyticsCategories(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const result = await query(
    `
      SELECT COALESCE(c.name, 'Uncategorized') AS name, COUNT(*)::int AS count
      FROM scripts s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE s.user_id = $1 OR s.is_public = true
      GROUP BY c.name
      ORDER BY count DESC
    `,
    [user.id]
  );
  return json(result.rows);
}

async function handleAnalyticsUsage(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const result = await query(
    `
      SELECT date_trunc('day', created_at)::date AS date, COUNT(*)::int AS scripts
      FROM scripts
      WHERE user_id = $1 OR is_public = true
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 30
    `,
    [user.id]
  );
  return json(result.rows);
}

async function createScript(userId: string, input: any) {
  const content = String(input.content || '');
  if (!content.trim()) {
    throw Object.assign(new Error('Script content is required'), { status: 400, code: 'missing_content' });
  }

  const fileHash = await sha256(content);
  const existing = await query(
    `${scriptSelect} WHERE s.file_hash = $1 AND (s.user_id = $2 OR s.is_public = true) LIMIT 1`,
    [fileHash, userId]
  );
  if (existing.rows[0]) {
    throw Object.assign(new Error('This script has already been uploaded.'), {
      status: 409,
      code: 'duplicate_script',
      existingScriptId: existing.rows[0].id,
    });
  }

  let result;
  try {
    result = await query(
      `
        INSERT INTO scripts (title, description, content, user_id, category_id, is_public, file_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        input.title || 'Untitled Script',
        input.description || 'No description provided',
        content,
        userId,
        input.categoryId || null,
        Boolean(input.isPublic),
        fileHash,
      ]
    );
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === '23505') {
      const duplicate = await query(
        `${scriptSelect} WHERE s.file_hash = $1 AND (s.user_id = $2 OR s.is_public = true) LIMIT 1`,
        [fileHash, userId]
      );
      throw Object.assign(new Error('This script has already been uploaded.'), {
        status: 409,
        code: 'duplicate_script',
        existingScriptId: duplicate.rows[0]?.id,
      });
    }
    throw error;
  }

  const script = result.rows[0];
  await query(
    'INSERT INTO script_versions (script_id, content, version, user_id, commit_message) VALUES ($1, $2, 1, $3, $4)',
    [script.id, content, userId, 'Initial upload']
  );

  const tags = Array.isArray(input.tags) ? input.tags : [];
  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag.trim()) continue;
    const tagResult = await query(
      'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [tag.trim().toLowerCase()]
    );
    await query(
      'INSERT INTO script_tags (script_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [script.id, tagResult.rows[0].id]
    );
  }

  await saveScriptEmbedding(script.id, [script.title, script.description, content].join('\n\n'));

  return toFrontendScript(script);
}

async function fetchScriptForUser(id: number, userId: string) {
  const result = await query(
    `${scriptSelect} WHERE s.id = $1 AND (s.user_id = $2 OR s.is_public = true)`,
    [id, userId]
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Script not found'), { status: 404, code: 'script_not_found' });
  }
  return result.rows[0];
}

async function analyzePowerShell(content: string, title: string) {
  if (!content.trim()) {
    throw Object.assign(new Error('Script content is required for analysis'), { status: 400, code: 'missing_content' });
  }

  const parsed = await completeJson(
    [
      {
        role: 'system',
        content: [
          'You are a senior PowerShell security reviewer and PowerShell teacher.',
          'Return only the requested analysis fields for the supplied script.',
          'Explain the whole script for both beginners and management.',
          'For command_details, include the key PowerShell commands that materially affect behavior, what each command does in plain English, and any important parameters used.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Analyze this PowerShell script.\n\nTitle: ${title}\n\n${content}`,
      },
    ],
    analysisJsonSchema,
    'powershell_script_analysis'
  );
  return {
    purpose: parsed.purpose || 'PowerShell script analysis generated by hosted PSScript.',
    beginner_explanation:
      parsed.beginner_explanation ||
      parsed.beginnerExplanation ||
      parsed.purpose ||
      'This script automates one or more PowerShell tasks. Review the command breakdown below for the main steps.',
    management_summary:
      parsed.management_summary ||
      parsed.managementSummary ||
      parsed.purpose ||
      'This script automates operational work in PowerShell and should be reviewed for security, reliability, and business impact before production use.',
    security_score: Number(parsed.security_score ?? parsed.securityScore ?? 7),
    quality_score: Number(parsed.quality_score ?? parsed.qualityScore ?? 7),
    risk_score: Number(parsed.risk_score ?? parsed.riskScore ?? 3),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    command_details: Array.isArray(parsed.command_details) ? parsed.command_details : [],
    security_issues: Array.isArray(parsed.security_issues) ? parsed.security_issues : [],
    best_practice_violations: Array.isArray(parsed.best_practice_violations) ? parsed.best_practice_violations : [],
    performance_insights: Array.isArray(parsed.performance_insights) ? parsed.performance_insights : [],
    execution_summary: parsed.execution_summary && typeof parsed.execution_summary === 'object'
      ? parsed.execution_summary
      : {
          what_it_does: parsed.purpose || 'Automates PowerShell tasks defined in the script.',
          business_value: 'Reduces manual administration by packaging repeatable steps into a script.',
          key_actions: [],
          operational_risk: 'Review permissions, system impact, and target scope before running in production.',
        },
  };
}

async function saveAnalysis(scriptId: number, analysis: any) {
  const result = await query(
    `
      INSERT INTO script_analysis (
        script_id, purpose, security_score, quality_score, risk_score,
        suggestions, command_details, security_issues, best_practice_violations,
        performance_insights, execution_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
      ON CONFLICT (script_id) DO UPDATE
      SET purpose = EXCLUDED.purpose,
          security_score = EXCLUDED.security_score,
          quality_score = EXCLUDED.quality_score,
          risk_score = EXCLUDED.risk_score,
          suggestions = EXCLUDED.suggestions,
          command_details = EXCLUDED.command_details,
          security_issues = EXCLUDED.security_issues,
          best_practice_violations = EXCLUDED.best_practice_violations,
          performance_insights = EXCLUDED.performance_insights,
          execution_summary = EXCLUDED.execution_summary,
          updated_at = now()
      RETURNING *
    `,
    [
      scriptId,
      analysis.purpose,
      analysis.security_score,
      analysis.quality_score,
      analysis.risk_score,
      JSON.stringify(analysis.suggestions || []),
      JSON.stringify(analysis.command_details || []),
      JSON.stringify(analysis.security_issues || []),
      JSON.stringify(analysis.best_practice_violations || []),
      JSON.stringify(analysis.performance_insights || []),
      JSON.stringify({
        ...(analysis.execution_summary || {}),
        beginner_explanation: analysis.beginner_explanation || '',
        management_summary: analysis.management_summary || '',
      }),
    ]
  );
  return result.rows[0];
}

async function completeText(messages: ChatMessage[]): Promise<{ text: string; provider: string; model: string }> {
  const openaiKey = getEnv('OPENAI_API_KEY');
  let openaiError: unknown = null;
  if (openaiKey) {
    try {
      const model = getEnv('OPENAI_MODEL', OPENAI_TEXT_MODEL);
      const openai = new OpenAI({ apiKey: openaiKey });
      const { instructions, input } = toOpenAIResponseInput(messages);
      const response = await openai.responses.create({
        model,
        instructions,
        input,
        store: false,
        max_output_tokens: Number(getEnv('OPENAI_MAX_OUTPUT_TOKENS', '1600')),
      });
      const text = extractResponseText(response);
      if (!text) throw Object.assign(new Error('OpenAI returned an empty text response'), { status: 502, code: 'empty_ai_text_response' });
      return { text, provider: 'openai', model };
    } catch (error) {
      openaiError = error;
      console.error('[netlify-api] OpenAI text completion failed; trying fallback provider if configured', error);
    }
  }

  const anthropicText = await completeTextWithAnthropic(messages);
  if (anthropicText.text) return anthropicText;

  if (openaiError) {
    throw Object.assign(new Error('AI text provider failed and no fallback provider returned a response'), {
      status: 502,
      code: 'ai_provider_failed',
    });
  }

  throw Object.assign(new Error('No AI text provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.'), {
    status: 503,
    code: 'ai_provider_unconfigured',
  });
}

async function completeJson(messages: ChatMessage[], schema: any, name: string): Promise<Record<string, any>> {
  const openaiKey = getEnv('OPENAI_API_KEY');
  let openaiError: unknown = null;
  if (openaiKey) {
    try {
      const model = getEnv('OPENAI_ANALYSIS_MODEL', getEnv('OPENAI_MODEL', OPENAI_ANALYSIS_MODEL));
      const openai = new OpenAI({ apiKey: openaiKey });
      const { instructions, input } = toOpenAIResponseInput(messages);
      const response = await openai.responses.create({
        model,
        instructions,
        input,
        store: false,
        max_output_tokens: Number(getEnv('OPENAI_ANALYSIS_MAX_OUTPUT_TOKENS', '3000')),
        text: {
          format: {
            type: 'json_schema',
            name,
            strict: true,
            schema,
          },
        },
      });
      const parsed = parseJsonObject(extractResponseText(response));
      if (!Object.keys(parsed).length) {
        throw Object.assign(new Error('OpenAI returned invalid structured analysis JSON'), {
          status: 502,
          code: 'invalid_ai_analysis_response',
        });
      }
      return parsed;
    } catch (error) {
      openaiError = error;
      console.error('[netlify-api] OpenAI structured analysis failed; trying Anthropic fallback if configured', error);
    }
  }

  const fallback = await completeTextWithAnthropic([
    ...messages,
    {
      role: 'user',
      content: `Return valid JSON matching this JSON Schema. Do not include Markdown fences.\n\n${JSON.stringify(schema)}`,
    },
  ]);
  if (!fallback.text) {
    if (openaiError) {
      throw Object.assign(new Error('AI analysis provider failed and no fallback provider returned a response'), {
        status: 502,
        code: 'ai_provider_failed',
      });
    }
    throw Object.assign(new Error('No AI analysis provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.'), {
      status: 503,
      code: 'ai_provider_unconfigured',
    });
  }
  const parsed = parseJsonObject(fallback.text);
  if (!Object.keys(parsed).length) {
    throw Object.assign(new Error('AI analysis provider returned invalid JSON'), {
      status: 502,
      code: 'invalid_ai_analysis_response',
    });
  }
  return parsed;
}

async function completeTextWithAnthropic(messages: ChatMessage[]): Promise<{ text: string; provider: string; model: string }> {
  const anthropicKey = getEnv('ANTHROPIC_API_KEY');
  if (!anthropicKey) return { text: '', provider: 'none', model: 'none' };

  const model = getEnv('ANTHROPIC_MODEL', ANTHROPIC_TEXT_MODEL);
  const anthropic = new Anthropic({
    apiKey: anthropicKey,
    baseURL: getEnv('ANTHROPIC_BASE_URL') || undefined,
  });
  const system = messages.find(message => message.role === 'system')?.content;
  const userMessages = messages.filter(message => message.role !== 'system');
  const response = await anthropic.messages.create({
    model,
    max_tokens: Number(getEnv('ANTHROPIC_MAX_TOKENS', '1600')),
    system,
    messages: userMessages.map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
    })),
  });
  return {
    text: response.content.map((part: any) => part.type === 'text' ? part.text : '').join('\n').trim(),
    provider: getEnv('ANTHROPIC_BASE_URL') ? 'anthropic-compatible' : 'anthropic',
    model,
  };
}

function toOpenAIResponseInput(messages: ChatMessage[]) {
  const instructions = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n') || undefined;
  const input = messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: String(message.content || ''),
    }));
  return { instructions, input };
}

function normalizeChatMessages(rawMessages: unknown[]): ChatMessage[] {
  return rawMessages
    .filter(Boolean)
    .map((message: any) => ({
      role: ['system', 'user', 'assistant'].includes(message?.role) ? message.role : 'user',
      content: String(message?.content || '').trim().slice(0, 20000),
    }))
    .filter(message => message.content)
    .slice(-50);
}

async function collectDocumentationPages(startUrl: URL, maxPages: number, maxDepth: number) {
  const seen = new Set<string>();
  const queue: Array<{ url: URL; depth: number }> = [{ url: startUrl, depth: 0 }];
  const pages: Array<{ url: string; title: string; text: string; codeBlocks: string[] }> = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift();
    if (!next) break;

    const normalized = normalizeUrlForCrawl(next.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const response = await fetch(normalized, {
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
        'User-Agent': 'PSScript-Knowledge-Importer/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) continue;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) continue;

    const html = (await response.text()).slice(0, 750000);
    const page = extractDocumentationPage(normalized, html);
    if (page.text.length >= 200 || page.codeBlocks.length > 0) {
      pages.push(page);
    }

    if (next.depth >= maxDepth || pages.length >= maxPages || !contentType.includes('text/html')) continue;

    for (const link of extractSameSiteLinks(startUrl, normalized, html)) {
      if (!seen.has(link) && queue.length < maxPages * 8) {
        queue.push({ url: new URL(link), depth: next.depth + 1 });
      }
    }
  }

  return pages;
}

async function buildDocumentationItem(page: { url: string; title: string; text: string; codeBlocks: string[] }) {
  const commands = extractPowerShellSignals(`${page.title}\n${page.text}\n${page.codeBlocks.join('\n')}`);
  const aiSummary = await summarizeDocumentationPage(page, commands).catch(() => null);
  const title = aiSummary?.title || page.title || titleFromUrl(page.url);
  const summary = aiSummary?.summary || page.text.slice(0, 500);
  const tags = Array.from(new Set([
    'documentation',
    'powershell',
    ...commands.slice(0, 8).map(command => command.toLowerCase()),
    ...(aiSummary?.tags || []),
  ])).slice(0, 12);

  return {
    title: title.slice(0, 240),
    url: page.url,
    source: new URL(page.url).hostname,
    tags,
    content: [
      `# ${title}`,
      '',
      summary,
      '',
      page.text.slice(0, 20000),
      page.codeBlocks.length ? '\n## PowerShell snippets\n' : '',
      ...page.codeBlocks.slice(0, 12).map(block => `\`\`\`powershell\n${block.slice(0, 4000)}\n\`\`\``),
    ].filter(Boolean).join('\n').slice(0, 50000),
  };
}

async function summarizeDocumentationPage(
  page: { url: string; title: string; text: string; codeBlocks: string[] },
  commands: string[]
): Promise<{ title: string; summary: string; tags: string[] } | null> {
  if (!getEnv('OPENAI_API_KEY') && !getEnv('ANTHROPIC_API_KEY')) return null;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary', 'tags'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
  };

  const parsed = await completeJson(
    [
      {
        role: 'system',
        content: 'Create concise knowledge-base metadata for a PowerShell documentation page. Return only the requested JSON fields.',
      },
      {
        role: 'user',
        content: [
          `URL: ${page.url}`,
          `Current title: ${page.title}`,
          `Detected PowerShell terms: ${commands.join(', ') || 'none'}`,
          '',
          page.text.slice(0, 8000),
          '',
          page.codeBlocks.slice(0, 3).join('\n\n').slice(0, 4000),
        ].join('\n'),
      },
    ],
    schema,
    'documentation_import_metadata'
  );

  return {
    title: String(parsed.title || page.title || titleFromUrl(page.url)).trim(),
    summary: String(parsed.summary || '').trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag: unknown) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 8)
      : [],
  };
}

function normalizePublicImportUrl(value: unknown): URL {
  const raw = typeof value === 'string' ? value.trim() : '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error('A valid HTTP or HTTPS URL is required'), { status: 400, code: 'invalid_import_url' });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('Only HTTP and HTTPS URLs can be imported'), { status: 400, code: 'invalid_import_url' });
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    throw Object.assign(new Error('Private and localhost URLs cannot be imported'), { status: 400, code: 'private_import_url' });
  }

  url.hash = '';
  return url;
}

function extractDocumentationPage(url: string, html: string) {
  const codeBlocks = Array.from(html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi))
    .map(match => htmlToText(match[1]))
    .filter(block => /(?:\b[A-Z][a-z]+-[A-Z][A-Za-z]+\b|\$\w+|param\s*\()/i.test(block))
    .slice(0, 20);

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = htmlToText(titleMatch?.[1] || titleFromUrl(url));
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const body = mainMatch?.[1] || html;
  const text = htmlToText(
    body
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
  ).slice(0, 30000);

  return { url, title, text, codeBlocks };
}

function extractSameSiteLinks(startUrl: URL, currentUrl: string, html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const url = new URL(href, currentUrl);
      if (url.origin !== startUrl.origin) continue;
      if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|gz|mp4|mp3|css|js)$/i.test(url.pathname)) continue;
      url.hash = '';
      links.add(normalizeUrlForCrawl(url));
    } catch {
      // Ignore malformed links from upstream pages.
    }
  }
  return [...links];
}

function normalizeUrlForCrawl(url: URL): string {
  url.hash = '';
  url.searchParams.sort();
  return url.toString();
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|pre|code)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractPowerShellSignals(text: string): string[] {
  const commands = new Set<string>();
  for (const match of text.matchAll(/\b[A-Z][a-z]+-[A-Z][A-Za-z0-9]+\b/g)) {
    commands.add(match[0]);
  }
  return [...commands].slice(0, 20);
}

function titleFromUrl(value: string): string {
  const url = new URL(value);
  const segment = url.pathname.split('/').filter(Boolean).pop() || url.hostname;
  return segment
    .replace(/\.(html?|md)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = getEnv('OPENAI_API_KEY');
  if (!openaiKey) return [];

  const openai = new OpenAI({ apiKey: openaiKey });
  const response = await openai.embeddings.create({
    model: getEnv('OPENAI_EMBEDDING_MODEL', OPENAI_EMBEDDING_MODEL),
    input: text.slice(0, 16000),
    dimensions: 1536,
  });
  return response.data[0]?.embedding || [];
}

async function saveScriptEmbedding(scriptId: number, text: string): Promise<void> {
  try {
    const embedding = await generateEmbedding(text);
    if (!embedding.length) return;
    await query(
      'INSERT INTO script_embeddings (script_id, embedding, embedding_model) VALUES ($1, $2::vector, $3)',
      [scriptId, `[${embedding.join(',')}]`, getEnv('OPENAI_EMBEDDING_MODEL', OPENAI_EMBEDDING_MODEL)]
    );
  } catch (error) {
    console.warn('[netlify-api] embedding generation skipped', error);
  }
}

async function synthesizeSpeech(input: {
  text: string;
  voiceId: string;
  outputFormat: string;
  speed: number;
  voiceInstructions?: string;
}) {
  const text = input.text.trim();
  if (!text) throw Object.assign(new Error('Text is required for speech synthesis'), { status: 400, code: 'missing_text' });
  if (text.length > 4096) throw Object.assign(new Error('Speech text is limited to 4096 characters'), { status: 413, code: 'text_too_large' });

  const openaiKey = getEnv('OPENAI_API_KEY');
  if (!openaiKey) throw Object.assign(new Error('OPENAI_API_KEY is required for hosted voice synthesis'), { status: 503, code: 'voice_provider_unconfigured' });

  const format = normalizeAudioFormat(input.outputFormat, ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'], 'mp3');
  const openai = new OpenAI({ apiKey: openaiKey });
  const response = await openai.audio.speech.create({
    model: getEnv('VOICE_TTS_MODEL', OPENAI_TTS_MODEL),
    voice: normalizeVoiceId(input.voiceId) as any,
    input: text,
    response_format: format as any,
    speed: input.speed,
    instructions: input.voiceInstructions ? String(input.voiceInstructions).slice(0, 512) : undefined,
  });
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return {
    audio_data: audioBuffer.toString('base64'),
    format,
    duration: 0,
    text,
    model: getEnv('VOICE_TTS_MODEL', OPENAI_TTS_MODEL),
    voice: normalizeVoiceId(input.voiceId),
  };
}

async function recognizeSpeech(input: {
  audioData: string;
  audioFormat: string;
  language?: string;
  prompt?: string;
  transcriptionMode?: string;
}) {
  const base64 = input.audioData.replace(/^data:audio\/[^;]+;base64,/, '');
  if (!base64) throw Object.assign(new Error('Audio data is required for speech recognition'), { status: 400, code: 'missing_audio' });
  if (base64.length > Number(getEnv('VOICE_MAX_BASE64_CHARS', '16000000'))) {
    throw Object.assign(new Error('Audio payload is too large'), { status: 413, code: 'audio_too_large' });
  }

  const openaiKey = getEnv('OPENAI_API_KEY');
  if (!openaiKey) throw Object.assign(new Error('OPENAI_API_KEY is required for hosted speech recognition'), { status: 503, code: 'voice_provider_unconfigured' });

  const format = normalizeAudioFormat(input.audioFormat, ['webm', 'ogg', 'mp3', 'mp4', 'm4a', 'wav', 'flac'], 'webm');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.byteLength) throw Object.assign(new Error('Audio data is empty or invalid'), { status: 400, code: 'invalid_audio' });
  const file = await toFile(buffer, `recording.${format}`, { type: mimeTypeForAudioFormat(format) });
  const model = input.transcriptionMode === 'diarize'
    ? getEnv('VOICE_STT_DIARIZE_MODEL', 'gpt-4o-transcribe-diarize')
    : getEnv('VOICE_STT_MODEL', OPENAI_STT_MODEL);
  const diarize = model === 'gpt-4o-transcribe-diarize';

  const openai = new OpenAI({ apiKey: openaiKey });
  const transcription = await openai.audio.transcriptions.create({
    file,
    model,
    language: input.language?.split('-')[0],
    prompt: diarize ? undefined : input.prompt?.slice(0, 512),
    response_format: diarize ? 'diarized_json' : 'json',
    chunking_strategy: diarize ? 'auto' : undefined,
  } as any);

  return {
    text: (transcription as any).text || '',
    segments: (transcription as any).segments,
    confidence: undefined,
    language: input.language || 'auto',
    duration: undefined,
    model,
    mode: input.transcriptionMode || 'standard',
  };
}

function normalizeVoiceId(voiceId: string): string {
  return openAiVoices.some(voice => voice.id === voiceId) ? voiceId : 'marin';
}

function normalizeAudioFormat(format: string, allowed: string[], fallback: string): string {
  const normalized = format.toLowerCase().replace(/^audio\//, '').replace('mpeg', 'mp3');
  return allowed.includes(normalized) ? normalized : fallback;
}

function getSupabaseAdminClient() {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function normalizeRequiredString(value: unknown, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw Object.assign(new Error(`${label} is required`), { status: 400, code: 'missing_required_field' });
  }
  return normalized;
}

function normalizePassword(value: unknown): string {
  const password = normalizeRequiredString(value, 'Password');
  if (password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400, code: 'password_too_short' });
  }
  return password;
}

function normalizeManagedRole(value: unknown): 'admin' | 'user' {
  return value === 'admin' ? 'admin' : 'user';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mimeTypeForAudioFormat(format: string): string {
  switch (format) {
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'mp4':
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'pcm':
      return 'audio/pcm';
    case 'webm':
    default:
      return 'audio/webm';
  }
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const parts: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content.text) parts.push(content.text);
      if (content?.type === 'refusal' && content.refusal) {
        throw Object.assign(new Error(`OpenAI refused the analysis request: ${content.refusal}`), {
          status: 422,
          code: 'analysis_refused',
        });
      }
    }
  }

  return parts.join('\n').trim();
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function toFrontendUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at || new Date().toISOString(),
    firstName: user.first_name,
    lastName: user.last_name,
    jobTitle: user.job_title,
    company: user.company,
    bio: user.bio,
  };
}

function toFrontendManagedUser(profile: any, authUser?: any) {
  return {
    id: profile.id,
    username: profile.username || authUser?.user_metadata?.username || profile.email?.split('@')[0] || 'user',
    email: profile.email || authUser?.email || '',
    role: profile.role || 'user',
    lastLoginAt: authUser?.last_sign_in_at || null,
    createdAt: profile.created_at || authUser?.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at,
  };
}

function toFrontendScript(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    content: row.content,
    userId: row.user_id,
    categoryId: row.category_id,
    version: row.version,
    isPublic: row.is_public,
    executionCount: row.execution_count,
    fileHash: row.file_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: row.category_name ? { id: row.category_id, name: row.category_name } : null,
    user: row.author_username ? { id: row.user_id, username: row.author_username } : null,
  };
}

function toFrontendAnalysis(row: any) {
  const executionSummary = row.execution_summary || {};
  return {
    ...row,
    scriptId: row.script_id,
    securityScore: row.security_score,
    qualityScore: row.quality_score,
    codeQualityScore: row.quality_score,
    riskScore: row.risk_score,
    parameterDocs: row.parameter_docs,
    commandDetails: row.command_details,
    msDocsReferences: row.ms_docs_references,
    securityIssues: row.security_issues,
    securityConcerns: row.security_issues,
    bestPracticeViolations: row.best_practice_violations,
    bestPractices: row.best_practice_violations,
    performanceInsights: row.performance_insights,
    performanceSuggestions: row.performance_insights,
    potentialRisks: row.potential_risks,
    codeComplexityMetrics: row.code_complexity_metrics,
    compatibilityNotes: row.compatibility_notes,
    executionSummary,
    beginnerExplanation: executionSummary.beginner_explanation || '',
    managementSummary: executionSummary.management_summary || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFrontendDocumentationItem(row: any) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    content: row.content,
    source: row.source,
    tags: row.tags || [],
    crawledAt: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function exportAnalysisMarkdown(script: any, analysis: any): Response {
  const lines = [
    `# ${script.title} Analysis`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    analysis.purpose || 'No summary available.',
    '',
    '## Scores',
    '',
    `- Quality: ${analysis.qualityScore ?? analysis.codeQualityScore ?? 'N/A'}/10`,
    `- Security: ${analysis.securityScore ?? 'N/A'}/10`,
    `- Risk: ${analysis.riskScore ?? 'N/A'}/10`,
    '',
    '## Beginner Breakdown',
    '',
    analysis.beginnerExplanation || analysis.executionSummary?.beginner_explanation || 'No beginner breakdown available.',
    '',
    '## Management Summary',
    '',
    analysis.managementSummary || analysis.executionSummary?.management_summary || 'No management summary available.',
    '',
    '## What The Script Does',
    '',
    ...((analysis.executionSummary?.key_actions || []).length
      ? analysis.executionSummary.key_actions.map((action: string) => `- ${action}`)
      : ['- No key actions were provided.']),
    '',
    '## Suggestions',
    '',
    ...((analysis.suggestions || []).length
      ? analysis.suggestions.map((item: string) => `- ${item}`)
      : ['- No suggestions were provided.']),
    '',
    '## Security Issues',
    '',
    ...((analysis.securityIssues || analysis.security_issues || []).length
      ? (analysis.securityIssues || analysis.security_issues).map((item: string) => `- ${item}`)
      : ['- No security issues were identified.']),
    '',
    '## Best Practice Violations',
    '',
    ...((analysis.bestPracticeViolations || analysis.best_practice_violations || []).length
      ? (analysis.bestPracticeViolations || analysis.best_practice_violations).map((item: string) => `- ${item}`)
      : ['- No best practice violations were identified.']),
    '',
    '## Performance Insights',
    '',
    ...((analysis.performanceInsights || analysis.performance_insights || []).length
      ? (analysis.performanceInsights || analysis.performance_insights).map((item: string) => `- ${item}`)
      : ['- No performance insights were identified.']),
    '',
    '## Key Commands',
    '',
    ...((analysis.commandDetails || analysis.command_details || []).length
      ? (analysis.commandDetails || analysis.command_details).flatMap((command: any) => [
          `### ${command.name || 'Command'}`,
          '',
          command.description || command.purpose || 'No description provided.',
          '',
          `- Purpose: ${command.purpose || 'N/A'}`,
          `- Beginner explanation: ${command.beginner_explanation || command.beginnerExplanation || 'N/A'}`,
          `- Management impact: ${command.management_impact || command.managementImpact || 'N/A'}`,
          `- Example: ${command.example || 'N/A'}`,
          '',
        ])
      : ['No key command breakdown was provided.', '']),
  ];

  const fileName = `${String(script.title || 'script-analysis').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'script-analysis'}.md`;
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}

function parseJsonObject(text: string): Record<string, any> {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function safeJsonArray(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
