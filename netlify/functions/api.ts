import type { Config, Context } from '@netlify/functions';
import OpenAI, { toFile } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { query } from './_shared/db';
import { getEnv, requireEnv } from './_shared/env';
import { requireAdmin, requireUser, requireUserAllowingDisabled, type HostedUser } from './_shared/auth';
import { handleAnalyticsDashboard } from './_shared/dashboard';
import { json, methodNotAllowed, notFound } from './_shared/http';

export const config: Config = {
  path: ['/api', '/api/*'],
};

type RouteParams = { path: string; segments: string[]; url: URL };
type RequestContext = Pick<Context, 'requestId'>;
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type AiUsage = { promptTokens: number; completionTokens: number; totalTokens: number };
type AiMetricContext = { userId?: string; endpoint: string };
type AiCompletion = { text: string; provider: string; model: string; usage?: AiUsage };
type AiMetricDetails = {
  provider: string;
  model: string;
  usage?: AiUsage;
  latency: number;
  success: boolean;
  errorMessage?: string;
};
type ScriptDeleteMode = 'archive' | 'delete';
type ApiKeyProvider = 'openai' | 'anthropic';

const OPENAI_TEXT_MODEL = 'gpt-5.5';
const OPENAI_ANALYSIS_MODEL = 'gpt-5.4-mini';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const OPENAI_STT_MODEL = 'gpt-4o-mini-transcribe';
const ANTHROPIC_TEXT_MODEL = 'claude-sonnet-4-6';
const SCRIPT_EMBEDDING_TIMEOUT_MS = 3000;
const UPLOAD_ANALYSIS_TIMEOUT_MS = 12000;
const HOSTED_SCRIPT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const POWERSHELL_UPLOAD_EXTENSIONS = new Set(['.ps1', '.psm1', '.psd1', '.ps1xml']);
const API_KEY_PROVIDERS: Record<ApiKeyProvider, { label: string; envName: string; prefixes: string[] }> = {
  openai: { label: 'OpenAI', envName: 'OPENAI_API_KEY', prefixes: ['sk-'] },
  anthropic: { label: 'Anthropic', envName: 'ANTHROPIC_API_KEY', prefixes: ['sk-ant-'] },
};

const AI_MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  'gpt-5.5': { prompt: 5.00, completion: 30.00 },
  'gpt-5.4-mini': { prompt: 0.75, completion: 4.50 },
  'gpt-5.4-nano': { prompt: 0.20, completion: 1.25 },
  'gpt-4.1': { prompt: 2.00, completion: 8.00 },
  'gpt-4.1-mini': { prompt: 0.40, completion: 1.60 },
  'gpt-4.1-nano': { prompt: 0.10, completion: 0.40 },
  o3: { prompt: 2.00, completion: 8.00 },
  'o3-pro': { prompt: 20.00, completion: 80.00 },
  'o4-mini': { prompt: 1.10, completion: 4.40 },
  'text-embedding-3-small': { prompt: 0.02, completion: 0 },
  'text-embedding-3-large': { prompt: 0.13, completion: 0 },
  'claude-opus-4-7': { prompt: 5.00, completion: 25.00 },
  'claude-sonnet-4-6': { prompt: 3.00, completion: 15.00 },
  'claude-haiku-4-5-20251001': { prompt: 1.00, completion: 5.00 },
};

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
const VOICE_TTS_CACHE_MAX_ENTRIES = 24;
const voiceTtsCache = new Map<string, any>();

const ANALYSIS_CRITERIA_VERSION = '2026-04-26';
const SCRIPT_CHILD_DELETE_TABLES = [
  'script_embeddings',
  'script_analysis',
  'script_versions',
  'script_tags',
  'script_metrics',
  'script_executions',
  'script_dependencies',
  'script_ratings',
  'script_usage_stats',
];
let scriptLifecycleSchemaPromise: Promise<void> | null = null;
let providerApiKeysSchemaPromise: Promise<void> | null = null;
const DB_BACKUP_TABLE = 'admin_db_backups';
const DB_MAINTENANCE_TABLES = [
  'categories',
  'tags',
  'scripts',
  'script_versions',
  'script_tags',
  'script_analysis',
  'script_embeddings',
  'documentation_items',
];
const DB_CLEAR_DEFAULT_TABLES = [
  'script_embeddings',
  'script_analysis',
  'script_versions',
  'script_tags',
  'scripts',
  'documentation_items',
];
const DB_DELETE_ORDER = [
  'script_embeddings',
  'script_analysis',
  'script_versions',
  'script_tags',
  'script_metrics',
  'script_executions',
  'script_dependencies',
  'script_ratings',
  'script_usage_stats',
  'documentation_items',
  'scripts',
  'tags',
  'categories',
];
const DB_INSERT_ORDER = [...DB_DELETE_ORDER].reverse();
const ANALYSIS_CRITERIA = [
  {
    name: 'Security',
    weight: 35,
    summary: 'Secrets, injection, dynamic execution, remote content, privilege boundaries, remoting, and least-privilege handling.',
  },
  {
    name: 'Operational safety',
    weight: 20,
    summary: 'Destructive or system-changing actions, target scope, rollback expectations, idempotency, and ShouldProcess/WhatIf/Confirm support.',
  },
  {
    name: 'Reliability',
    weight: 15,
    summary: 'Strict mode, parameter validation, terminating errors, try/catch behavior, retries, timeouts, and observable failure modes.',
  },
  {
    name: 'Maintainability',
    weight: 15,
    summary: 'Verb-Noun naming, approved verbs, advanced functions, comment-based help, readable parameters, comments, and module hygiene.',
  },
  {
    name: 'Compatibility',
    weight: 10,
    summary: 'PowerShell 5.1 versus 7+ compatibility, platform dependencies, deprecated cmdlets, required modules, and environmental assumptions.',
  },
  {
    name: 'Performance',
    weight: 5,
    summary: 'Pipeline streaming, filtering strategy, collection materialization, remote fan-out, throttling, and expensive loops.',
  },
];

const analysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'criteria_version',
    'purpose',
    'beginner_explanation',
    'management_summary',
    'security_score',
    'quality_score',
    'risk_score',
    'suggestions',
    'command_details',
    'security_issues',
    'best_practice_violations',
    'performance_insights',
    'analysis_criteria',
    'prioritized_findings',
    'remediation_plan',
    'test_recommendations',
    'confidence',
    'execution_summary',
  ],
  properties: {
    criteria_version: { type: 'string' },
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
    analysis_criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'weight', 'score', 'summary'],
        properties: {
          name: { type: 'string' },
          weight: { type: 'number', minimum: 0, maximum: 100 },
          score: { type: 'number', minimum: 0, maximum: 10 },
          summary: { type: 'string' },
        },
      },
    },
    prioritized_findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'severity', 'category', 'title', 'evidence', 'impact', 'recommendation'],
        properties: {
          id: { type: 'string' },
          severity: { type: 'string' },
          category: { type: 'string' },
          title: { type: 'string' },
          evidence: { type: 'string' },
          impact: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
    remediation_plan: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['priority', 'action', 'rationale', 'effort'],
        properties: {
          priority: { type: 'string' },
          action: { type: 'string' },
          rationale: { type: 'string' },
          effort: { type: 'string' },
        },
      },
    },
    test_recommendations: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    execution_summary: {
      type: 'object',
      additionalProperties: false,
      required: ['what_it_does', 'business_value', 'key_actions', 'operational_risk'],
      properties: {
        what_it_does: { type: 'string' },
        business_value: { type: 'string' },
        key_actions: { type: 'array', items: { type: 'string' } },
        operational_risk: { type: 'string' },
        data_collection_summary: {
          type: 'object',
          additionalProperties: false,
          properties: {
            script_lines_reviewed: { type: 'number' },
            non_empty_lines_reviewed: { type: 'number' },
            commands_identified: { type: 'number' },
            functions_identified: { type: 'number' },
            parameters_identified: { type: 'number' },
            modules_identified: { type: 'number' },
            review_inputs: { type: 'array', items: { type: 'string' } },
          },
        },
        static_signals: {
          type: 'object',
          additionalProperties: false,
          properties: {
            line_count: { type: 'number' },
            non_empty_line_count: { type: 'number' },
            command_count: { type: 'number' },
            function_count: { type: 'number' },
            parameter_count: { type: 'number' },
            has_comment_help: { type: 'boolean' },
            has_cmdlet_binding: { type: 'boolean' },
            has_should_process: { type: 'boolean' },
            has_try_catch: { type: 'boolean' },
            mutates_state: { type: 'boolean' },
            uses_remoting: { type: 'boolean' },
            uses_remote_content: { type: 'boolean' },
            uses_dynamic_execution: { type: 'boolean' },
            possible_secret_count: { type: 'number' },
            requires: { type: 'array', items: { type: 'string' } },
            modules: { type: 'array', items: { type: 'string' } },
            functions: { type: 'array', items: { type: 'string' } },
            parameters: { type: 'array', items: { type: 'string' } },
            commands: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};

const scriptSelect = `
  SELECT s.id, s.title, s.description, s.content, s.user_id, s.category_id, s.version,
         s.is_public, s.execution_count, s.file_hash, s.created_at, s.updated_at,
         s.archived_at, s.archived_by, s.archive_reason, s.review_status, s.is_test_data,
         s.deleted_at, s.deleted_by,
         c.name AS category_name,
         COALESCE((
           SELECT array_agg(t.name ORDER BY t.name)
           FROM script_tags st
           JOIN tags t ON t.id = st.tag_id
           WHERE st.script_id = s.id
         ), ARRAY[]::text[]) AS tags,
         p.username AS author_username,
         sa.quality_score AS analysis_quality_score,
         sa.security_score AS analysis_security_score,
         sa.risk_score AS analysis_risk_score
  FROM scripts s
  LEFT JOIN categories c ON c.id = s.category_id
  LEFT JOIN app_profiles p ON p.id = s.user_id
  LEFT JOIN script_analysis sa ON sa.script_id = s.id
`;

export default async function handleRequest(req: Request, context: Context): Promise<Response> {
  try {
    const route = getRoute(req);

    if (route.path === '/health') return await handleHealth();
    if (route.path === '/route-health') return await handleRouteHealth();
    await ensureScriptLifecycleSchema();
    if (route.segments[0] === 'voice') return await handleVoice(req, route);
    if (route.path === '/auth/default-user') return await handleDefaultUser(req);
    if (route.path === '/auth/me') return await handleAuthMe(req);
    if (route.path === '/auth/user') return await handleAuthUser(req);
    if (route.path === '/users') return await handleUsers(req);
    if (route.segments[0] === 'users' && route.segments[1]) return await handleUserById(req, route);
    if (route.segments[0] === 'admin' && route.segments[1] === 'api-keys') return await handleAdminApiKeys(req, route);
    if (route.segments[0] === 'admin' && route.segments[1] === 'db') return await handleHostedDbAdmin(req, route);
    if (route.path === '/categories') return await handleCategories(req);
    if (route.path === '/tags') return await handleTags(req);
    if (route.path === '/scripts') return await handleScripts(req, route);
    if (route.path === '/scripts/search') return await handleScriptSearch(req, route);
    if (route.path === '/scripts/upload' || route.path === '/scripts/upload/large') return await handleScriptUpload(req);
    if (route.path === '/scripts/delete') return await handleBulkScriptDelete(req);
    if (route.path === '/scripts/analyze') return await handleAdhocAnalysis(req);
    if (route.path === '/scripts/analyze/assistant' || route.path === '/ai-agent/analyze/assistant') return await handleHostedAgentAnalysis(req, route);
    if (route.path === '/scripts/please' || route.path === '/ai-agent/please') return await handleHostedAgentQuestion(req, route);
    if (route.path === '/scripts/generate' || route.path === '/ai-agent/generate') return await handleHostedScriptGeneration(req, route);
    if (route.path === '/scripts/explain' || route.path === '/ai-agent/explain') return await handleHostedScriptExplanation(req, route);
    if (route.path === '/scripts/examples' || route.path === '/ai-agent/examples') return await handleHostedScriptExamples(req, route);
    if (route.path === '/chat/stream') return await handleChatStream(req);
    if (route.path === '/chat' || route.path === '/chat/message') return await handleChat(req);
    if (route.path === '/analytics/ai' || route.path.startsWith('/analytics/ai/')) return await handleHostedAiAnalytics(req, route);
    if (route.path === '/analytics/summary') return await handleAnalyticsSummary(req);
    if (route.path === '/analytics/security') return await handleAnalyticsSecurity(req);
    if (route.path === '/analytics/categories') return await handleAnalyticsCategories(req);
    if (route.path === '/analytics/usage') return await handleAnalyticsUsage(req);
    if (route.path === '/analytics/dashboard') return await handleAnalyticsDashboard(req);
    if (route.path === '/activity/recent') return await handleRecentActivity(req, route);
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

async function handleRouteHealth(): Promise<Response> {
  const routes = [
    '/',
    '/login',
    '/dashboard',
    '/scripts',
    '/search',
    '/categories',
    '/scripts/upload',
  ];
  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    deployId: getEnv('DEPLOY_ID', getEnv('COMMIT_REF', 'local')),
    routes: routes.map(path => ({ path, expected: 'spa' })),
  });
}

async function handleAuthMe(req: Request): Promise<Response> {
  const user = await requireUserAllowingDisabled(req);
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

  const bootstrapToken = getEnv('DEFAULT_ADMIN_BOOTSTRAP_TOKEN');
  if (!bootstrapToken || req.headers.get('x-bootstrap-token') !== bootstrapToken) {
    throw Object.assign(new Error('Admin bootstrap token required'), { status: 401, code: 'bootstrap_token_required' });
  }

  const email = requireEnv('DEFAULT_ADMIN_EMAIL');
  const password = requireEnv('DEFAULT_ADMIN_PASSWORD');
  const supabase = getSupabaseAdminClient();

  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) {
    throw Object.assign(new Error(list.error.message), { status: 500, code: 'default_user_lookup_failed' });
  }

  const users = list.data.users as Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }>;
  const existing = users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
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
      INSERT INTO app_profiles (id, email, username, role, is_enabled, auth_provider, approved_at)
      VALUES ($1, $2, $3, 'admin', true, 'password', now())
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          username = EXCLUDED.username,
          role = 'admin',
          is_enabled = true,
          auth_provider = COALESCE(NULLIF(app_profiles.auth_provider, ''), 'password'),
          approved_at = COALESCE(app_profiles.approved_at, now()),
          updated_at = now()
    `,
    [user.id, email, 'admin']
  );

  return json({ success: true, email });
}

async function handleUsers(req: Request): Promise<Response> {
  const admin = await requireAdmin(req);
  const supabase = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const [profilesResult, authUsersResult] = await Promise.all([
      query(
        `
          SELECT id, email, username, role, is_enabled, auth_provider, approved_at, approved_by, created_at, updated_at
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
        INSERT INTO app_profiles (id, email, username, role, is_enabled, auth_provider, approved_at, approved_by)
        VALUES ($1, $2, $3, $4, true, 'password', now(), $5)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            username = EXCLUDED.username,
            role = EXCLUDED.role,
            is_enabled = true,
            auth_provider = COALESCE(NULLIF(app_profiles.auth_provider, ''), 'password'),
            approved_at = COALESCE(app_profiles.approved_at, now()),
            approved_by = COALESCE(app_profiles.approved_by, EXCLUDED.approved_by),
            updated_at = now()
        RETURNING id, email, username, role, is_enabled, auth_provider, approved_at, approved_by, created_at, updated_at
      `,
      [authResult.data.user.id, email, username, role, admin.id]
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
    const isEnabled = typeof body.isEnabled === 'boolean'
      ? body.isEnabled
      : typeof body.is_enabled === 'boolean'
        ? body.is_enabled
        : undefined;

    if (admin.id === id && isEnabled === false) {
      return json({ success: false, error: 'cannot_disable_self', message: 'You cannot disable your own admin account' }, { status: 400 });
    }

    if (admin.id === id && role !== 'admin') {
      role = 'admin';
    }

    await assertCanChangeAdminAccess(id, role, isEnabled);

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
            is_enabled = COALESCE($5, is_enabled),
            approved_at = CASE
              WHEN COALESCE($5, is_enabled) = true AND approved_at IS NULL THEN now()
              ELSE approved_at
            END,
            approved_by = CASE
              WHEN COALESCE($5, is_enabled) = true AND approved_by IS NULL THEN $6
              ELSE approved_by
            END,
            updated_at = now()
        WHERE id = $1
        RETURNING id, email, username, role, is_enabled, auth_provider, approved_at, approved_by, created_at, updated_at
      `,
      [id, email, username, role, isEnabled, admin.id]
    );
    if (!result.rows[0]) return json({ success: false, error: 'user_not_found', message: 'User not found' }, { status: 404 });

    return json({ success: true, user: toFrontendManagedUser(result.rows[0], authResult.data.user) });
  }

  if (req.method === 'DELETE') {
    if (admin.id === id) {
      return json({ success: false, error: 'cannot_delete_self', message: 'You cannot delete your own admin account' }, { status: 400 });
    }

    await assertCanDeleteUser(id);

    const authResult = await supabase.auth.admin.deleteUser(id);
    if (authResult.error) {
      throw Object.assign(new Error(authResult.error.message), { status: 400, code: 'user_delete_failed' });
    }
    await query('DELETE FROM app_profiles WHERE id = $1', [id]);
    return json({ success: true, deleted: 1 });
  }

  return methodNotAllowed();
}

async function handleAdminApiKeys(req: Request, route: RouteParams): Promise<Response> {
  const admin = await requireAdmin(req);
  await ensureProviderApiKeysSchema();

  if (route.path === '/admin/api-keys') {
    if (req.method !== 'GET') return methodNotAllowed();

    const result = await query<{
      provider: ApiKeyProvider;
      key_hint: string;
      updated_at: string;
    }>(
      `
        SELECT provider, key_hint, updated_at
        FROM provider_api_keys
        WHERE provider = ANY($1::text[])
      `,
      [Object.keys(API_KEY_PROVIDERS)]
    );
    const overrides = new Map<ApiKeyProvider, { provider: ApiKeyProvider; key_hint: string; updated_at: string }>(
      result.rows.map(row => [row.provider, row])
    );

    return json({
      providers: (Object.keys(API_KEY_PROVIDERS) as ApiKeyProvider[]).map(provider => {
        const override = overrides.get(provider);
        const config = API_KEY_PROVIDERS[provider];
        const envValue = getEnv(config.envName);
        return {
          provider,
          label: config.label,
          configured: Boolean(override || envValue),
          source: override ? 'database' : (envValue ? 'environment' : 'missing'),
          keyHint: override?.key_hint || (envValue ? keyHint(envValue) : ''),
          updatedAt: override?.updated_at || null,
        };
      }),
    });
  }

  const provider = normalizeApiKeyProvider(route.segments[2]);
  if (!provider) return notFound(route.path);

  if (route.segments[3] === 'test') {
    if (req.method !== 'POST') return methodNotAllowed();
    const result = await testProviderApiKey(provider);
    return json(result, { status: result.ok ? 200 : 502 });
  }

  if (req.method === 'PUT') {
    const body = await req.json().catch(() => ({}));
    const apiKey = normalizeProviderApiKey(provider, body.apiKey);
    await query(
      `
        INSERT INTO provider_api_keys (provider, encrypted_api_key, key_hint, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (provider) DO UPDATE
        SET encrypted_api_key = EXCLUDED.encrypted_api_key,
            key_hint = EXCLUDED.key_hint,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
      `,
      [provider, encryptSecret(apiKey), keyHint(apiKey), admin.id]
    );
    return json({
      success: true,
      provider,
      configured: true,
      source: 'database',
      keyHint: keyHint(apiKey),
    });
  }

  if (req.method === 'DELETE') {
    await query('DELETE FROM provider_api_keys WHERE provider = $1', [provider]);
    const config = API_KEY_PROVIDERS[provider];
    const envValue = getEnv(config.envName);
    return json({
      success: true,
      provider,
      configured: Boolean(envValue),
      source: envValue ? 'environment' : 'missing',
      keyHint: envValue ? keyHint(envValue) : '',
    });
  }

  return methodNotAllowed();
}

async function handleCategories(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    const result = await query(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.created_at,
        c.updated_at,
        COUNT(s.id)::int AS "scriptCount"
      FROM categories c
      LEFT JOIN scripts s ON s.category_id = c.id
        AND s.deleted_at IS NULL
        AND s.archived_at IS NULL
        AND s.is_test_data = false
      GROUP BY c.id, c.name, c.description, c.created_at, c.updated_at
      ORDER BY c.name
    `);
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
  const includeSystem = new URL(req.url).searchParams.get('includeSystem') === 'true';
  const result = await query(
    includeSystem
      ? 'SELECT id, name, created_at FROM tags ORDER BY name'
      : `
          SELECT id, name, created_at
          FROM tags
          WHERE lower(name) NOT IN ('codex-smoke', 'delete-test', 'readme-screenshot', 'e2e', 'e2e-test', 'test-data')
          ORDER BY name
        `
  );
  return json({ tags: result.rows });
}

async function handleScripts(req: Request, route: RouteParams): Promise<Response> {
  const user = await requireUser(req);

  if (req.method === 'GET') {
    const limit = Math.min(Number(route.url.searchParams.get('limit') || '50'), 100);
    const includeArchived = route.url.searchParams.get('includeArchived') === 'true';
    const includeTestData = route.url.searchParams.get('includeTestData') === 'true';
    const result = await query(
      `${scriptSelect}
       WHERE (s.user_id = $1 OR s.is_public = true)
         AND s.deleted_at IS NULL
         AND ($3::boolean OR s.archived_at IS NULL)
         AND ($4::boolean OR s.is_test_data = false)
       ORDER BY s.updated_at DESC
       LIMIT $2`,
      [user.id, limit, includeArchived, includeTestData]
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
    await recordAuditEvent({ eventType: 'create', scriptId: script.id, scriptTitle: script.title, user, details: { source: 'api' } });
    return json({ success: true, script }, { status: 201 });
  }

  return methodNotAllowed();
}

async function handleScriptSearch(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const user = await requireUser(req);
  const queryText = (route.url.searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(route.url.searchParams.get('limit') || '50'), 1), 100);
  const offset = Math.max(Number(route.url.searchParams.get('offset') || '0'), 0);
  const rawCategory = route.url.searchParams.get('category_id') || route.url.searchParams.get('categoryId') || route.url.searchParams.get('category');
  const categoryId = rawCategory ? Number(rawCategory) : null;
  const tags = (route.url.searchParams.get('tags') || '')
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean);
  const onlyMine = route.url.searchParams.get('mine') === 'true';
  const includeArchived = route.url.searchParams.get('includeArchived') === 'true';
  const includeTestData = route.url.searchParams.get('includeTestData') === 'true';
  const requestedSort = (route.url.searchParams.get('sort') || '').toLowerCase();
  const sort = ['relevance', 'updated', 'created', 'name', 'quality', 'executions'].includes(requestedSort)
    ? requestedSort
    : queryText
      ? 'relevance'
      : 'updated';

  if (categoryId !== null && !Number.isFinite(categoryId)) {
    return json({ error: 'invalid_category_id', message: 'Invalid category id' }, { status: 400 });
  }

  const params: any[] = [user.id];
  const where: string[] = [
    onlyMine ? 's.user_id = $1' : '(s.user_id = $1 OR s.is_public = true)',
    's.deleted_at IS NULL',
  ];
  if (!includeArchived) where.push('s.archived_at IS NULL');
  if (!includeTestData) where.push('s.is_test_data = false');
  let searchQueryIndex: number | null = null;
  let likeSearchIndex: number | null = null;

  if (categoryId !== null) {
    params.push(categoryId);
    where.push(`s.category_id = $${params.length}`);
  }

  if (tags.length > 0) {
    params.push(tags);
    where.push(`EXISTS (
      SELECT 1
      FROM script_tags st
      JOIN tags t ON t.id = st.tag_id
      WHERE st.script_id = s.id
        AND lower(t.name) = ANY($${params.length}::text[])
    )`);
  }

  if (queryText) {
    params.push(queryText);
    searchQueryIndex = params.length;
    params.push(`%${queryText}%`);
    likeSearchIndex = params.length;
    where.push(`(
      s.search_vector @@ search_query.tsq
      OR s.title ILIKE $${likeSearchIndex}
      OR s.description ILIKE $${likeSearchIndex}
      OR s.content ILIKE $${likeSearchIndex}
      OR c.name ILIKE $${likeSearchIndex}
    )`);
  }

  const orderBy = (() => {
    if (queryText && sort === 'relevance') {
      return `
        CASE WHEN s.search_vector @@ search_query.tsq THEN 0 ELSE 1 END,
        ts_rank_cd(s.search_vector, search_query.tsq) DESC,
        s.updated_at DESC
      `;
    }
    if (sort === 'created') return 's.created_at DESC';
    if (sort === 'name') return 'lower(s.title) ASC, s.updated_at DESC';
    if (sort === 'quality') return 'sa.quality_score DESC NULLS LAST, s.updated_at DESC';
    if (sort === 'executions') return 's.execution_count DESC NULLS LAST, s.updated_at DESC';
    return 's.updated_at DESC';
  })();

  params.push(limit);
  const limitIndex = params.length;
  params.push(offset);
  const offsetIndex = params.length;

  const scriptSearchSelect = scriptSelect.replace('SELECT s.id', 'SELECT COUNT(*) OVER() AS total_count, s.id');
  const fromClause = queryText && searchQueryIndex
    ? `${scriptSearchSelect} CROSS JOIN (SELECT websearch_to_tsquery('simple', $${searchQueryIndex}) AS tsq) search_query`
    : scriptSearchSelect;

  let result;
  try {
    result = await query(
      `${fromClause}
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      params
    );
  } catch (error) {
    if ((error as { code?: string }).code !== '42703') throw error;
    console.warn('[netlify-api] search_vector missing, falling back to ILIKE search');
    const fallbackParams: any[] = [user.id];
    const fallbackWhere: string[] = [
      onlyMine ? 's.user_id = $1' : '(s.user_id = $1 OR s.is_public = true)',
      's.deleted_at IS NULL',
    ];
    if (!includeArchived) fallbackWhere.push('s.archived_at IS NULL');
    if (!includeTestData) fallbackWhere.push('s.is_test_data = false');

    if (categoryId !== null) {
      fallbackParams.push(categoryId);
      fallbackWhere.push(`s.category_id = $${fallbackParams.length}`);
    }

    if (tags.length > 0) {
      fallbackParams.push(tags);
      fallbackWhere.push(`EXISTS (
        SELECT 1
        FROM script_tags st
        JOIN tags t ON t.id = st.tag_id
        WHERE st.script_id = s.id
          AND lower(t.name) = ANY($${fallbackParams.length}::text[])
      )`);
    }

    if (queryText) {
      fallbackParams.push(`%${queryText}%`);
      const fallbackLikeIndex = fallbackParams.length;
      fallbackWhere.push(`(
        s.title ILIKE $${fallbackLikeIndex}
        OR s.description ILIKE $${fallbackLikeIndex}
        OR s.content ILIKE $${fallbackLikeIndex}
        OR c.name ILIKE $${fallbackLikeIndex}
      )`);
    }

    fallbackParams.push(limit);
    const fallbackLimitIndex = fallbackParams.length;
    fallbackParams.push(offset);
    const fallbackOffsetIndex = fallbackParams.length;

    result = await query(
      `${scriptSearchSelect}
       WHERE ${fallbackWhere.join(' AND ')}
       ORDER BY ${orderBy.includes('search_query') ? 's.updated_at DESC' : orderBy}
       LIMIT $${fallbackLimitIndex}
       OFFSET $${fallbackOffsetIndex}`,
      fallbackParams
    );
  }

  const scripts = result.rows.map(toFrontendScript);
  return json({
    scripts,
    total: Number(result.rows[0]?.total_count || 0),
    filters: {
      q: queryText,
      category_id: categoryId,
      tags,
      mine: onlyMine,
      includeArchived,
      includeTestData,
      sort,
      limit,
      offset,
    },
  });
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
    const script = await fetchScriptForUser(id, user.id);
    const result = await query('SELECT * FROM script_analysis WHERE script_id = $1', [id]);
    const analysis = result.rows[0] ? toFrontendAnalysis(result.rows[0]) : null;
    return json(analysis ? {
      ...analysis,
      isCurrent: Number(analysis.scriptVersion || 0) === Number(script.version || 0) || analysis.fileHash === script.file_hash,
    } : null);
  }

  if (route.segments[2] === 'analysis-stream') {
    return await handleHostedAnalysisStream(req, route, id);
  }

  if (route.segments[2] === 'similar') {
    if (req.method !== 'GET') return methodNotAllowed();
    return await handleSimilarScripts(id, user.id, route);
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
    const analysis = await analyzePowerShell(script.content, script.title, { userId: user.id, endpoint: '/scripts/:id/analyze' });
    const saved = await saveAnalysis(id, analysis);
    await recordAuditEvent({ eventType: 'analyze', scriptId: id, scriptTitle: script.title, user, details: { criteriaVersion: ANALYSIS_CRITERIA_VERSION } });
    return json({ success: true, analysis: toFrontendAnalysis(saved) });
  }

  if (route.segments[2] === 'archive') {
    if (req.method !== 'POST') return methodNotAllowed();
    const body = await req.json().catch(() => ({}));
    const result = await archiveScriptsForUser([id], user, String(body.reason || 'Archived from script detail'));
    if (result.archived === 0) {
      return json({ success: false, error: 'script_not_found_or_not_archivable', message: 'Script not found or you do not have permission to archive it.', ...result }, { status: 404 });
    }
    return json({ success: true, ...result });
  }

  if (route.segments[2] === 'restore') {
    if (req.method !== 'POST') return methodNotAllowed();
    const result = await restoreScriptsForUser([id], user);
    if (result.restored === 0) {
      return json({ success: false, error: 'script_not_found_or_not_restorable', message: 'Script not found or you do not have permission to restore it.', ...result }, { status: 404 });
    }
    return json({ success: true, ...result });
  }

  if (route.segments[2] === 'analyze-langgraph') {
    if (req.method !== 'POST') return methodNotAllowed();
    const script = await fetchScriptForUser(id, user.id);
    const startedAt = new Date().toISOString();
    const workflowId = `hosted-${id}-${Date.now()}`;
    const analysis = await analyzePowerShell(script.content, script.title, { userId: user.id, endpoint: '/scripts/:id/analyze-langgraph' });
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
    return exportAnalysisPdf(script, toFrontendAnalysis(result.rows[0]));
  }

  if (req.method === 'GET') {
    const script = await fetchScriptForUser(id, user.id);
    return json(toFrontendScript(script));
  }

  if (req.method === 'PUT') {
    if (user.role !== 'admin') {
      return json({
        success: false,
        error: 'admin_required',
        message: 'Only admins can edit script details.',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const currentResult = await query(`${scriptSelect} WHERE s.id = $1 AND s.deleted_at IS NULL`, [id]);
    const current = currentResult.rows[0];
    if (!current) return json({ error: 'script_not_found', message: 'Script not found' }, { status: 404 });
    const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    const hasCategory = Object.prototype.hasOwnProperty.call(body, 'category_id') || Object.prototype.hasOwnProperty.call(body, 'categoryId');
    const hasVisibility = Object.prototype.hasOwnProperty.call(body, 'is_public') || Object.prototype.hasOwnProperty.call(body, 'isPublic');
    const hasTags = Object.prototype.hasOwnProperty.call(body, 'tags');
    const nextTitle = hasTitle ? String(body.title || '').trim() : current.title;
    const nextDescription = hasDescription ? String(body.description || '').trim() : current.description;
    const nextContent = typeof body.content === 'string' ? body.content : undefined;
    if (hasTitle && !nextTitle) return json({ error: 'missing_title', message: 'Script title is required' }, { status: 400 });
    if (nextContent !== undefined && !nextContent.trim()) return json({ error: 'missing_content', message: 'Script content is required' }, { status: 400 });

    let nextCategoryId = current.category_id;
    if (hasCategory) {
      const rawCategoryId = Object.prototype.hasOwnProperty.call(body, 'category_id') ? body.category_id : body.categoryId;
      nextCategoryId = rawCategoryId === null || rawCategoryId === '' ? null : Number(rawCategoryId);
      if (nextCategoryId !== null && !Number.isFinite(nextCategoryId)) {
        return json({ error: 'invalid_category_id', message: 'Invalid category id' }, { status: 400 });
      }
      if (nextCategoryId !== null) {
        const categoryResult = await query('SELECT id FROM categories WHERE id = $1', [nextCategoryId]);
        if (!categoryResult.rows[0]) {
          return json({ error: 'invalid_category_id', message: 'Category not found' }, { status: 400 });
        }
      }
    }

    let nextIsPublic = current.is_public;
    if (hasVisibility) {
      const rawVisibility = body.is_public ?? body.isPublic;
      if (typeof rawVisibility === 'boolean') {
        nextIsPublic = rawVisibility;
      } else if (rawVisibility === 'true' || rawVisibility === 'false') {
        nextIsPublic = rawVisibility === 'true';
      } else {
        return json({ error: 'invalid_visibility', message: 'Visibility must be true or false' }, { status: 400 });
      }
    }

    const nextTags = hasTags ? normalizeScriptTags(body.tags) : null;
    const contentChanged = nextContent !== undefined && nextContent !== current.content;
    const nextVersion = contentChanged ? Number(current.version || 1) + 1 : Number(current.version || 1);
    const nextFileHash = contentChanged ? await sha256(nextContent) : current.file_hash;

    const result = await query(
      `
        UPDATE scripts
        SET title = $2,
            description = $3,
            content = CASE WHEN $4::boolean THEN $5 ELSE content END,
            category_id = $6,
            is_public = $7,
            file_hash = $8,
            version = $9,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, nextTitle, nextDescription, contentChanged, nextContent, nextCategoryId, nextIsPublic, nextFileHash, nextVersion]
    );
    if (!result.rows[0]) return json({ error: 'script_not_found', message: 'Script not found' }, { status: 404 });

    if (contentChanged) {
      await query(
        `
          INSERT INTO script_versions (script_id, content, version, user_id, commit_message)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (script_id, version) DO NOTHING
        `,
        [id, nextContent, nextVersion, user.id, body.commit_message || body.commitMessage || 'Script updated']
      );
    }
    if (nextTags) await replaceScriptTags(id, nextTags);
    await recordAuditEvent({
      eventType: 'update',
      scriptId: id,
      scriptTitle: result.rows[0].title,
      user,
      details: { contentChanged, version: nextVersion, tagsChanged: Boolean(nextTags), metadataChanged: !contentChanged },
    });

    const updatedResult = await query(`${scriptSelect} WHERE s.id = $1 AND s.deleted_at IS NULL`, [id]);
    return json({ success: true, script: toFrontendScript(updatedResult.rows[0] || result.rows[0]) });
  }

  if (req.method === 'DELETE') {
    const mode = route.url.searchParams.get('mode') === 'delete' ? 'delete' : 'archive';
    const deleteResult = mode === 'delete'
      ? await deleteScriptsForUser([id], user, mode)
      : await archiveScriptsForUser([id], user, 'Archived through delete flow');
    if (deleteResult.deleted === 0) {
      return json({
        success: false,
        error: mode === 'delete' ? 'script_not_found_or_not_deletable' : 'script_not_found_or_not_archivable',
        message: mode === 'delete'
          ? 'Script not found or you do not have permission to delete it.'
          : 'Script not found or you do not have permission to archive it.',
        ...deleteResult,
      }, { status: 404 });
    }
    return json({ success: true, ...deleteResult });
  }

  return methodNotAllowed();
}

async function handleBulkScriptDelete(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();

  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
    : [];
  const mode: ScriptDeleteMode = body.mode === 'delete' ? 'delete' : 'archive';

  if (ids.length === 0) {
    return json({ success: false, error: 'missing_script_ids', message: 'At least one script id is required' }, { status: 400 });
  }

  const deleteResult = mode === 'delete'
    ? await deleteScriptsForUser(ids, user, mode)
    : await archiveScriptsForUser(ids, user, String(body.reason || 'Bulk archived from script management'));
  if (deleteResult.deleted === 0) {
    return json({
      success: false,
      error: mode === 'delete' ? 'script_not_found_or_not_deletable' : 'script_not_found_or_not_archivable',
      message: mode === 'delete'
        ? 'No requested scripts were found or available to delete.'
        : 'No requested scripts were found or available to archive.',
      ...deleteResult,
      deletedCount: deleteResult.deleted,
    }, { status: 404 });
  }
  return json({ success: true, ...deleteResult, deletedCount: deleteResult.deleted });
}

async function archiveScriptsForUser(ids: number[], user: HostedUser, reason: string): Promise<{
  requested: number;
  deleted: number;
  archived: number;
  deletedIds: number[];
  archivedIds: number[];
  notDeletedIds: number[];
  notArchivedIds: number[];
}> {
  const uniqueIds = Array.from(new Set(ids));
  const isAdmin = user.role === 'admin';
  const result = await query<{ id: number; title: string }>(
    `
      UPDATE scripts
      SET archived_at = now(),
          archived_by = $3,
          archive_reason = $4,
          updated_at = now()
      WHERE id = ANY($1::bigint[])
        AND deleted_at IS NULL
        AND archived_at IS NULL
        AND ($2::boolean OR user_id = $3)
      RETURNING id, title
    `,
    [uniqueIds, isAdmin, user.id, reason]
  );
  const archivedIds = result.rows.map(row => Number(row.id));
  for (const row of result.rows) {
    await recordAuditEvent({ eventType: 'archive', scriptId: row.id, scriptTitle: row.title, user, details: { reason } });
  }
  return {
    requested: uniqueIds.length,
    deleted: archivedIds.length,
    archived: archivedIds.length,
    deletedIds: archivedIds,
    archivedIds,
    notDeletedIds: uniqueIds.filter(id => !archivedIds.includes(id)),
    notArchivedIds: uniqueIds.filter(id => !archivedIds.includes(id)),
  };
}

async function restoreScriptsForUser(ids: number[], user: HostedUser): Promise<{
  requested: number;
  restored: number;
  restoredIds: number[];
  notRestoredIds: number[];
}> {
  const uniqueIds = Array.from(new Set(ids));
  const isAdmin = user.role === 'admin';
  const result = await query<{ id: number; title: string }>(
    `
      UPDATE scripts
      SET archived_at = NULL,
          archived_by = NULL,
          archive_reason = NULL,
          updated_at = now()
      WHERE id = ANY($1::bigint[])
        AND deleted_at IS NULL
        AND archived_at IS NOT NULL
        AND ($2::boolean OR user_id = $3)
      RETURNING id, title
    `,
    [uniqueIds, isAdmin, user.id]
  );
  const restoredIds = result.rows.map(row => Number(row.id));
  for (const row of result.rows) {
    await recordAuditEvent({ eventType: 'restore', scriptId: row.id, scriptTitle: row.title, user });
  }
  return {
    requested: uniqueIds.length,
    restored: restoredIds.length,
    restoredIds,
    notRestoredIds: uniqueIds.filter(id => !restoredIds.includes(id)),
  };
}

async function deleteScriptsForUser(ids: number[], user: HostedUser, mode: ScriptDeleteMode = 'delete'): Promise<{
  requested: number;
  deleted: number;
  deletedIds: number[];
  notDeletedIds: number[];
}> {
  const uniqueIds = Array.from(new Set(ids));
  const isAdmin = user.role === 'admin';
  const owned = await query<{ id: number }>(
    'SELECT id FROM scripts WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL AND ($2::boolean OR user_id = $3)',
    [uniqueIds, isAdmin, user.id]
  );
  const deletableIds = owned.rows.map(row => Number(row.id));

  if (deletableIds.length === 0) {
    return {
      requested: uniqueIds.length,
      deleted: 0,
      deletedIds: [],
      notDeletedIds: uniqueIds,
    };
  }

  if (mode === 'delete') {
    for (const table of SCRIPT_CHILD_DELETE_TABLES) {
      if (await tableExists(table)) {
        await query(`DELETE FROM ${quoteIdentifier(table)} WHERE script_id = ANY($1::bigint[])`, [deletableIds]);
      }
    }
  }

  const result = await query<{ id: number; title: string }>(
    'UPDATE scripts SET deleted_at = now(), deleted_by = $3, updated_at = now() WHERE id = ANY($1::bigint[]) AND ($2::boolean OR user_id = $3) RETURNING id, title',
    [deletableIds, isAdmin, user.id]
  );
  const deletedIds = result.rows.map(row => Number(row.id));
  for (const row of result.rows) {
    await recordAuditEvent({ eventType: 'delete', scriptId: row.id, scriptTitle: row.title, user, details: { mode } });
  }
  return {
    requested: uniqueIds.length,
    deleted: deletedIds.length,
    deletedIds,
    notDeletedIds: uniqueIds.filter(id => !deletedIds.includes(id)),
  };
}

async function handleHostedDbAdmin(req: Request, route: RouteParams): Promise<Response> {
  const admin = await requireAdmin(req);
  const action = route.segments[2] || '';

  await ensureBackupStore();

  if (action === 'backups' && req.method === 'GET') {
    const result = await query(
      `
        SELECT name, size_bytes, created_at, updated_at
        FROM ${quoteIdentifier(DB_BACKUP_TABLE)}
        ORDER BY updated_at DESC
      `
    );

    return json({
      success: true,
      backups: result.rows.map(row => ({
        name: row.name,
        sizeBytes: Number(row.size_bytes || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  }

  if (action === 'backup' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const backup = await createHostedDbBackup(body.filename, admin.id);
    return json({ success: true, message: 'Backup created', backup });
  }

  if (action === 'restore' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body.confirmText !== 'RESTORE BACKUP') {
      return json({ success: false, error: 'confirmation_required', message: 'Type RESTORE BACKUP to restore a backup' }, { status: 400 });
    }

    const restored = await restoreHostedDbBackup(String(body.filename || ''));
    return json({ success: true, message: 'Restore completed', restoredFrom: restored.name, restoredTables: restored.tables });
  }

  if (action === 'clear-test-data' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body.confirmText !== 'CLEAR TEST DATA') {
      return json({ success: false, error: 'confirmation_required', message: 'Type CLEAR TEST DATA to clear test data' }, { status: 400 });
    }

    const requestedTables = Array.isArray(body.tables)
      ? body.tables.map((table: unknown) => String(table).trim()).filter(Boolean)
      : [];
    const selectedTables = requestedTables.length > 0 ? requestedTables : DB_CLEAR_DEFAULT_TABLES;
    const existingTables = await filterExistingMaintenanceTables(selectedTables);
    const filteredTables = existingTables.filter(table => DB_CLEAR_DEFAULT_TABLES.includes(table) || requestedTables.includes(table));
    const ignoredTables = selectedTables.filter(table => !filteredTables.includes(table));
    const backup = body.backupFirst === false ? null : await createHostedDbBackup(body.backupFilename, admin.id);
    const clearedTables = await clearHostedTables(filteredTables);

    return json({
      success: true,
      message: 'Test data cleared',
      backup,
      requestedTables,
      filteredTables,
      ignoredTables,
      clearedTables,
    });
  }

  return methodNotAllowed();
}

async function ensureBackupStore(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(DB_BACKUP_TABLE)} (
      name TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_by UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`ALTER TABLE ${quoteIdentifier(DB_BACKUP_TABLE)} ENABLE ROW LEVEL SECURITY`);
}

async function createHostedDbBackup(rawName: unknown, userId: string) {
  const name = normalizeBackupName(rawName);
  const payload = await captureHostedDbBackupPayload();
  const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

  await query(
    `
      INSERT INTO ${quoteIdentifier(DB_BACKUP_TABLE)} (name, payload, size_bytes, created_by, updated_at)
      VALUES ($1, $2::jsonb, $3, $4, now())
      ON CONFLICT (name)
      DO UPDATE SET payload = EXCLUDED.payload,
                    size_bytes = EXCLUDED.size_bytes,
                    created_by = EXCLUDED.created_by,
                    updated_at = now()
    `,
    [name, JSON.stringify(payload), sizeBytes, userId]
  );

  return {
    name,
    sizeBytes,
    createdAt: payload.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

async function captureHostedDbBackupPayload() {
  const tables: Record<string, any[]> = {};
  const existingTables = await filterExistingMaintenanceTables(DB_MAINTENANCE_TABLES);

  for (const table of existingTables) {
    const result = await query(`SELECT * FROM ${quoteIdentifier(table)} ORDER BY 1`);
    tables[table] = result.rows;
  }

  return {
    version: 1,
    runtime: 'netlify-supabase',
    createdAt: new Date().toISOString(),
    tables,
  };
}

async function restoreHostedDbBackup(filename: string): Promise<{ name: string; tables: string[] }> {
  const name = normalizeBackupName(filename);
  const backup = await query<{ payload: any }>(
    `SELECT payload FROM ${quoteIdentifier(DB_BACKUP_TABLE)} WHERE name = $1`,
    [name]
  );

  if (!backup.rows[0]) {
    throw Object.assign(new Error('Backup not found'), { status: 404, code: 'backup_not_found' });
  }

  const payload = typeof backup.rows[0].payload === 'string' ? JSON.parse(backup.rows[0].payload) : backup.rows[0].payload;
  const tables = payload?.tables && typeof payload.tables === 'object' ? payload.tables as Record<string, any[]> : {};
  const existingTables = await filterExistingMaintenanceTables(Object.keys(tables));
  const deleteTables = DB_DELETE_ORDER.filter(table => existingTables.includes(table));
  const insertTables = DB_INSERT_ORDER.filter(table => existingTables.includes(table));

  await clearHostedTables(deleteTables);

  for (const table of insertTables) {
    const rows = Array.isArray(tables[table]) ? tables[table] : [];
    for (const row of rows) {
      await insertBackupRow(table, row);
    }
  }

  return { name, tables: insertTables };
}

async function clearHostedTables(tables: string[]): Promise<string[]> {
  const clearedTables: string[] = [];
  const orderedTables = DB_DELETE_ORDER.filter(table => tables.includes(table));

  for (const table of orderedTables) {
    if (!(await tableExists(table))) continue;
    await query(`DELETE FROM ${quoteIdentifier(table)}`);
    clearedTables.push(table);
  }

  return clearedTables;
}

async function insertBackupRow(table: string, row: Record<string, any>): Promise<void> {
  if (!DB_MAINTENANCE_TABLES.includes(table) || !row || typeof row !== 'object') return;

  const columns = Object.keys(row);
  if (columns.length === 0) return;

  const columnSql = columns.map(quoteIdentifier).join(', ');
  const valueSql = columns.map((_, index) => `$${index + 1}`).join(', ');
  const values = columns.map(column => row[column]);
  await query(`INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${valueSql}) ON CONFLICT DO NOTHING`, values);
}

async function filterExistingMaintenanceTables(tables: string[]): Promise<string[]> {
  const uniqueTables = Array.from(new Set(tables.filter(table => DB_MAINTENANCE_TABLES.includes(table) || DB_CLEAR_DEFAULT_TABLES.includes(table))));
  const existing: string[] = [];

  for (const table of uniqueTables) {
    if (await tableExists(table)) existing.push(table);
  }

  return existing;
}

async function tableExists(table: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${table}`]);
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [table, column]
  );
  return Boolean(result.rows[0]?.exists);
}

async function ensureScriptLifecycleSchema(): Promise<void> {
  if (!scriptLifecycleSchemaPromise) {
    scriptLifecycleSchemaPromise = (async () => {
      await query(`
        ALTER TABLE scripts
          ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS archived_by UUID,
          ADD COLUMN IF NOT EXISTS archive_reason TEXT,
          ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft',
          ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS deleted_by UUID
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id BIGSERIAL PRIMARY KEY,
          event_type TEXT NOT NULL,
          script_id BIGINT,
          script_title TEXT,
          user_id UUID,
          username TEXT,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await query(`
        ALTER TABLE script_analysis
          ADD COLUMN IF NOT EXISTS script_version INTEGER,
          ADD COLUMN IF NOT EXISTS file_hash TEXT,
          ADD COLUMN IF NOT EXISTS analysis_source TEXT NOT NULL DEFAULT 'ai'
      `);
      await query('CREATE INDEX IF NOT EXISTS idx_scripts_visible_updated ON scripts (user_id, is_public, deleted_at, archived_at, updated_at DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_scripts_archive_state ON scripts (archived_at, deleted_at, updated_at DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_scripts_test_data ON scripts (is_test_data, updated_at DESC) WHERE is_test_data = true');
      await query('CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at DESC)');
      await query('CREATE INDEX IF NOT EXISTS idx_audit_events_script_id ON audit_events (script_id, created_at DESC) WHERE script_id IS NOT NULL');
      await query('CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events (user_id, created_at DESC) WHERE user_id IS NOT NULL');
      await query('ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY');
    })().catch(error => {
      scriptLifecycleSchemaPromise = null;
      throw error;
    });
  }
  return scriptLifecycleSchemaPromise;
}

async function ensureProviderApiKeysSchema(): Promise<void> {
  if (!providerApiKeysSchemaPromise) {
    providerApiKeysSchemaPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS provider_api_keys (
          provider TEXT PRIMARY KEY,
          encrypted_api_key TEXT NOT NULL,
          key_hint TEXT NOT NULL,
          updated_by UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await query('ALTER TABLE provider_api_keys ENABLE ROW LEVEL SECURITY');
      await query('REVOKE ALL ON TABLE provider_api_keys FROM anon, authenticated');
    })().catch(error => {
      providerApiKeysSchemaPromise = null;
      throw error;
    });
  }
  return providerApiKeysSchemaPromise;
}

async function recordAuditEvent(input: {
  eventType: string;
  scriptId?: number | string | null;
  scriptTitle?: string | null;
  user?: HostedUser | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!(await tableExists('audit_events'))) return;
    await query(
      `
        INSERT INTO audit_events (event_type, script_id, script_title, user_id, username, details)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        input.eventType,
        input.scriptId ? Number(input.scriptId) : null,
        input.scriptTitle || null,
        input.user?.id || null,
        input.user?.username || input.user?.email || null,
        JSON.stringify(input.details || {}),
      ]
    );
  } catch (error) {
    console.warn('[netlify-api] audit event skipped', error);
  }
}

function normalizeBackupName(rawName: unknown): string {
  const base = String(rawName || `backup-${new Date().toISOString()}`)
    .trim()
    .replace(/\.json$/i, '')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'backup';
  return `${base}.json`;
}

function normalizeDocumentationTags(rawTags: unknown): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags
      .map(tag => String(tag || '').trim())
      .filter(Boolean)
      .slice(0, 24);
  }

  if (typeof rawTags === 'string') {
    return rawTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 24);
  }

  return [];
}

function parseDocumentationBody(body: Record<string, unknown>) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const url = String(body.url || '').trim() || null;
  const source = String(body.source || 'manual').trim() || 'manual';
  const tags = normalizeDocumentationTags(body.tags);

  if (title.length < 2) {
    throw Object.assign(new Error('Documentation title is required'), { status: 400, code: 'title_required' });
  }

  if (title.length > 500) {
    throw Object.assign(new Error('Documentation title must be 500 characters or less'), { status: 400, code: 'title_too_long' });
  }

  if (content.length < 1) {
    throw Object.assign(new Error('Documentation content is required'), { status: 400, code: 'content_required' });
  }

  if (content.length > 500000) {
    throw Object.assign(new Error('Documentation content is too large'), { status: 400, code: 'content_too_large' });
  }

  return { title, url, content, source, tags };
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function handleDocumentation(req: Request, route: RouteParams): Promise<Response> {
  if (route.path === '/documentation/crawl/ai' && req.method === 'POST') {
    return await handleHostedDocumentationImport(req);
  }

  if (route.path === '/documentation/search') {
    const queryText = (route.url.searchParams.get('query') || route.url.searchParams.get('q') || '').trim();
    const limit = Math.min(Number(route.url.searchParams.get('limit') || '20'), 100);
    const offset = Number(route.url.searchParams.get('offset') || '0');
    let result;

    if (!queryText) {
      result = await query(
        `
          SELECT id, title, url, content, source, tags, created_at, updated_at
          FROM documentation_items
          ORDER BY updated_at DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      );
    } else {
      const likeSearch = `%${queryText}%`;
      try {
        result = await query(
          `
            WITH search_query AS (
              SELECT websearch_to_tsquery('simple', $1) AS tsq
            )
            SELECT id, title, url, content, source, tags, created_at, updated_at
            FROM documentation_items
            CROSS JOIN search_query
            WHERE search_vector @@ search_query.tsq
               OR title ILIKE $2
               OR content ILIKE $2
            ORDER BY
              CASE WHEN search_vector @@ search_query.tsq THEN 0 ELSE 1 END,
              ts_rank_cd(search_vector, search_query.tsq) DESC,
              updated_at DESC
            LIMIT $3 OFFSET $4
          `,
          [queryText, likeSearch, limit, offset]
        );
      } catch (error) {
        if ((error as { code?: string }).code !== '42703') throw error;
        console.warn('[netlify-api] documentation search_vector missing, falling back to ILIKE search');
        result = await query(
          `
            SELECT id, title, url, content, source, tags, created_at, updated_at
            FROM documentation_items
            WHERE title ILIKE $1 OR content ILIKE $1
            ORDER BY updated_at DESC
            LIMIT $2 OFFSET $3
          `,
          [likeSearch, limit, offset]
        );
      }
    }

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
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const doc = parseDocumentationBody(body);
    const result = await query(
      `
        INSERT INTO documentation_items (title, url, content, source, tags)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [doc.title, doc.url, doc.content, doc.source, doc.tags]
    );
    return json({ success: true, data: result.rows[0], document: result.rows[0] }, { status: 201 });
  }

  if (route.path === '/documentation/bulk' && req.method === 'POST') {
    await requireAdmin(req);
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

  if (route.segments[1] && req.method === 'PUT') {
    await requireAdmin(req);
    const id = Number(route.segments[1]);
    if (!Number.isFinite(id)) {
      return json({ success: false, error: 'invalid_documentation_id', message: 'Invalid documentation item id' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const doc = parseDocumentationBody(body);
    const result = await query(
      `
        UPDATE documentation_items
        SET title = $2,
            url = $3,
            content = $4,
            source = $5,
            tags = $6,
            updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [id, doc.title, doc.url, doc.content, doc.source, doc.tags]
    );
    if (!result.rows[0]) return json({ error: 'documentation_not_found', message: 'Documentation item not found' }, { status: 404 });
    return json({ success: true, data: result.rows[0], document: result.rows[0] });
  }

  if (route.segments[1] && req.method === 'DELETE') {
    await requireAdmin(req);
    const id = Number(route.segments[1]);
    const result = await query('DELETE FROM documentation_items WHERE id = $1 RETURNING id', [id]);
    return json({ success: true, deleted: result.rowCount || 0 });
  }

  return notFound(route.path);
}

async function handleHostedDocumentationImport(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const startUrl = await normalizePublicImportUrl(body.url);
  const maxPages = Math.min(Math.max(Number(body.maxPages || 5), 1), 10);
  const maxDepth = Math.min(Math.max(Number(body.depth || 1), 0), 2);
  const pages = await collectDocumentationPages(startUrl, maxPages, maxDepth);

  let imported = 0;
  let errors = 0;
  const data: Array<{ url: string; doc: any }> = [];

  for (const page of pages) {
    try {
      const doc = await buildDocumentationItem(page, { userId: user.id, endpoint: '/documentation/crawl/ai' });
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
  const upload = await parseScriptUploadRequest(req);
  const uploadError = validateHostedScriptUpload(upload);
  if (uploadError) return uploadError;

  const script = await createScript(user.id, {
    title: upload.title,
    description: upload.description,
    content: upload.content,
    categoryId: upload.categoryId,
    isPublic: upload.isPublic,
    tags: upload.tags,
  });
  await recordAuditEvent({ eventType: 'create', scriptId: script.id, scriptTitle: script.title, user, details: { source: 'upload', analyzeWithAi: upload.analyzeWithAi } });

  let analysis: any = null;
  let analysisError: string | null = null;
  if (upload.analyzeWithAi) {
    try {
      analysis = toFrontendAnalysis(await withTimeout(
        (async () => saveAnalysis(Number(script.id), await analyzePowerShell(upload.content, script.title, { userId: user.id, endpoint: '/scripts/upload' })))(),
        UPLOAD_ANALYSIS_TIMEOUT_MS,
        'AI analysis is taking longer than expected. The script was uploaded; run analysis from the script detail page.'
      ));
      await recordAuditEvent({ eventType: 'analyze', scriptId: script.id, scriptTitle: script.title, user, details: { source: 'upload' } });
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

type ScriptUploadInput = {
  title: string;
  description: string;
  content: string;
  fileName: string;
  categoryId: number | null;
  isPublic: boolean;
  tags: string[];
  analyzeWithAi: boolean;
};

async function parseScriptUploadRequest(req: Request): Promise<ScriptUploadInput> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    const fileName = String(body.file_name || body.fileName || body.filename || 'script.ps1');
    return {
      title: String(body.title || fileName || 'Untitled Script'),
      description: String(body.description || 'No description provided'),
      content: String(body.content || ''),
      fileName,
      categoryId: body.category_id || body.categoryId ? Number(body.category_id ?? body.categoryId) : null,
      isPublic: parseUploadBoolean(body.is_public ?? body.isPublic, false),
      tags: normalizeUploadTags(body.tags),
      analyzeWithAi: parseUploadBoolean(body.analyze_with_ai ?? body.analyzeWithAi, false),
    };
  }

  const form = await req.formData();
  const file = form.get('script_file');
  const contentField = form.get('content');
  let content = typeof contentField === 'string' ? contentField : '';
  let fileName = String(form.get('file_name') || form.get('fileName') || 'script.ps1');

  if (file instanceof File) {
    fileName = file.name || fileName;
    content = await file.text();
  }

  return {
    title: String(form.get('title') || fileName || 'Untitled Script'),
    description: String(form.get('description') || 'No description provided'),
    content,
    fileName,
    categoryId: form.get('category_id') ? Number(form.get('category_id')) : null,
    isPublic: form.get('is_public') === 'true',
    tags: safeJsonArray(form.get('tags')).filter((tag): tag is string => typeof tag === 'string'),
    analyzeWithAi: form.get('analyze_with_ai') === 'true',
  };
}

function validateHostedScriptUpload(upload: ScriptUploadInput): Response | null {
  if (!upload.content.trim()) {
    return json({ error: 'missing_file', message: 'No script file or content was provided' }, { status: 400 });
  }

  const ext = getFileExtension(upload.fileName);
  if (ext && !POWERSHELL_UPLOAD_EXTENSIONS.has(ext)) {
    return json({
      error: 'unsupported_file_type',
      message: `Only PowerShell files (${Array.from(POWERSHELL_UPLOAD_EXTENSIONS).join(', ')}) are supported.`,
    }, { status: 400 });
  }

  const sizeBytes = Buffer.byteLength(upload.content, 'utf8');
  if (sizeBytes > HOSTED_SCRIPT_UPLOAD_MAX_BYTES) {
    return json({
      error: 'upload_too_large',
      message: 'The script is too large for hosted upload. Maximum hosted upload size is 4MB.',
      maxBytes: HOSTED_SCRIPT_UPLOAD_MAX_BYTES,
      receivedBytes: sizeBytes,
    }, { status: 413 });
  }

  return null;
}

function getFileExtension(fileName: string): string {
  const match = String(fileName || '').toLowerCase().match(/(\.[^.]+)$/);
  return match ? match[1] : '';
}

function parseUploadBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function normalizeUploadTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string');
  }
  if (typeof value === 'string') {
    return safeJsonArray(value).filter((tag): tag is string => typeof tag === 'string');
  }
  return [];
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function handleAdhocAnalysis(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '');
  if (!content.trim()) return json({ error: 'missing_content', message: 'Script content is required for analysis' }, { status: 400 });
  const analysis = await analyzePowerShell(content, body.title || 'Ad hoc script', { userId: user.id, endpoint: '/scripts/analyze' });
  return json({ success: true, analysis });
}

async function handleHostedAgentQuestion(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || body.message || '').trim();
  const context = String(body.context || '').trim();
  if (!question) return json({ error: 'missing_question', message: 'Question is required' }, { status: 400 });

  const response = await completeText([
    {
      role: 'system',
      content: [
        'You are PSScript AI, a pragmatic PowerShell assistant.',
        'Answer with accurate, actionable PowerShell guidance.',
        'Prefer safe commands and call out destructive operations before showing them.',
      ].join(' '),
    },
    ...(context ? [{ role: 'system' as const, content: `User-provided script context:\n${context.slice(0, 20000)}` }] : []),
    { role: 'user', content: question },
  ], { userId: user.id, endpoint: route.path });

  return json({
    response: response.text,
    source: response.provider,
    provider: response.provider,
    model: response.model,
  });
}

async function handleHostedScriptGeneration(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const description = String(body.description || body.prompt || '').trim();
  if (!description) return json({ error: 'missing_description', message: 'Description is required' }, { status: 400 });

  const response = await completeText([
    {
      role: 'system',
      content: [
        'You are a senior PowerShell engineer.',
        'Generate production-ready PowerShell scripts with parameter validation, comments for non-obvious logic, and conservative defaults.',
        'Return only the script content, without Markdown fences.',
      ].join(' '),
    },
    { role: 'user', content: `Generate a PowerShell script that: ${description}` },
  ], { userId: user.id, endpoint: route.path });

  return json({
    content: stripMarkdownCodeFence(response.text),
    source: response.provider,
    provider: response.provider,
    model: response.model,
  });
}

async function handleHostedScriptExplanation(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '').trim();
  const type = String(body.type || 'simple');
  if (!content) return json({ error: 'missing_content', message: 'Script content is required' }, { status: 400 });

  let systemPrompt = 'Explain this PowerShell clearly and concisely for an operator.';
  if (type === 'detailed') {
    systemPrompt = 'Explain this PowerShell in detail, including purpose, flow, important commands, and operational assumptions.';
  } else if (type === 'security') {
    systemPrompt = 'Review this PowerShell for security risk, unsafe patterns, permissions, remote calls, and safer alternatives.';
  }

  const response = await completeText([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Explain this PowerShell script:\n\n${content.slice(0, 30000)}` },
  ], { userId: user.id, endpoint: route.path });

  return json({
    explanation: response.text,
    response: response.text,
    source: response.provider,
    provider: response.provider,
    model: response.model,
  });
}

async function handleHostedAgentAnalysis(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || '').trim();
  if (!content) return json({ error: 'missing_content', message: 'Script content is required' }, { status: 400 });

  const started = Date.now();
  const title = String(body.filename || body.title || 'Agent analysis');
  const analysis = await analyzePowerShell(content, title, { userId: user.id, endpoint: route.path });

  return json({
    analysis: toAgentAnalysisResult(analysis),
    metadata: {
      processingTime: Date.now() - started,
      model: getEnv('OPENAI_ANALYSIS_MODEL', getEnv('OPENAI_MODEL', OPENAI_ANALYSIS_MODEL)),
      threadId: '',
      assistantId: 'hosted-netlify',
      requestId: `hosted-${Date.now()}`,
    },
  });
}

async function handleHostedScriptExamples(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const user = await requireUser(req);
  const description = String(route.url.searchParams.get('description') || '').trim();
  const limit = clampNumber(route.url.searchParams.get('limit'), 1, 10, 5);
  if (!description) return json({ error: 'missing_description', message: 'Description is required' }, { status: 400 });

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['examples'],
    properties: {
      examples: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'snippet', 'complexity'],
          properties: {
            title: { type: 'string' },
            snippet: { type: 'string' },
            complexity: { type: 'string' },
          },
        },
      },
    },
  };

  const parsed = await completeJson([
    {
      role: 'system',
      content: `Return ${limit} concise PowerShell examples as structured data. Each snippet should be useful and safe by default.`,
    },
    { role: 'user', content: `Examples related to: ${description}` },
  ], schema, 'powershell_script_examples', { userId: user.id, endpoint: route.path });

  const examples = Array.isArray(parsed.examples) ? parsed.examples.slice(0, limit) : [];
  return json({ examples });
}

async function handleHostedAnalysisStream(req: Request, route: RouteParams, scriptId: number): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();

  const user = await requireUser(req);
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

        const analysis = await analyzePowerShell(script.content, script.title, { userId: user.id, endpoint: '/scripts/analysis-stream' });
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
  const user = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const messages = normalizeChatMessages([
    body.system_prompt ? { role: 'system', content: String(body.system_prompt) } : null,
    ...(Array.isArray(body.messages) ? body.messages : []),
  ]);
  if (!messages.some(message => message.role === 'user')) {
    return json({ error: 'missing_user_message', message: 'At least one user message is required' }, { status: 400 });
  }

  const response = await completeText(messages, { userId: user.id, endpoint: '/chat' });
  return json({
    response: response.text,
    provider: response.provider,
    model: response.model,
  });
}

async function handleChatStream(req: Request): Promise<Response> {
  if (req.method !== 'POST') return methodNotAllowed();
  const user = await requireUser(req);
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
        const response = await streamText(messages, { userId: user.id, endpoint: '/chat/stream' }, (delta) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: delta })}\n\n`));
        });
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

async function handleHostedAiAnalytics(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const user = await requireUser(req);

  if (route.path === '/analytics/ai/budget-alerts') {
    const dailyBudget = clampNumber(route.url.searchParams.get('dailyBudget'), 0, Number.MAX_SAFE_INTEGER, 50);
    const monthlyBudget = clampNumber(route.url.searchParams.get('monthlyBudget'), 0, Number.MAX_SAFE_INTEGER, 1000);
    const alerts = await getHostedAiBudgetAlerts(user.id, dailyBudget, monthlyBudget);
    return json({ success: true, alerts, hasAlerts: alerts.length > 0 });
  }

  const now = new Date();
  const endDate = parseDateParam(route.url.searchParams.get('endDate'), now);
  const defaultStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = parseDateParam(route.url.searchParams.get('startDate'), defaultStart);
  const analytics = await getHostedAiAnalytics(user.id, startDate, endDate);

  if (route.path === '/analytics/ai/summary') {
    return json({
      success: true,
      data: {
        summary: analytics.summary,
        topModels: analytics.byModel.slice(0, 5),
        topEndpoints: analytics.byEndpoint.slice(0, 5),
      },
    });
  }

  if (route.path !== '/analytics/ai') return notFound(route.path);

  return json({ success: true, data: analytics });
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
    }, { userId: user.id, endpoint: route.path });
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
    }, { userId: user.id, endpoint: route.path });
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
      WHERE (s.user_id = $1 OR s.is_public = true)
        AND s.deleted_at IS NULL
        AND s.archived_at IS NULL
        AND s.is_test_data = false
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
      WHERE (s.user_id = $1 OR s.is_public = true)
        AND s.deleted_at IS NULL
        AND s.archived_at IS NULL
        AND s.is_test_data = false
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
      WHERE (s.user_id = $1 OR s.is_public = true)
        AND s.deleted_at IS NULL
        AND s.archived_at IS NULL
        AND s.is_test_data = false
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
      WHERE (user_id = $1 OR is_public = true)
        AND deleted_at IS NULL
        AND archived_at IS NULL
        AND is_test_data = false
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 30
    `,
    [user.id]
  );
  return json(result.rows);
}

async function handleRecentActivity(req: Request, route: RouteParams): Promise<Response> {
  if (req.method !== 'GET') return methodNotAllowed();
  const user = await requireUser(req);
  const limit = Math.min(Math.max(Number(route.url.searchParams.get('limit') || '10'), 1), 50);
  if (!(await tableExists('audit_events'))) return json({ activities: [] });
  const result = await query(
    `
      SELECT id, event_type, script_id, script_title, user_id, username, details, created_at
      FROM audit_events
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [user.id, limit]
  );
  return json({
    activities: result.rows.map(row => ({
      id: String(row.id),
      type: row.event_type,
      script_id: row.script_id ? String(row.script_id) : undefined,
      script_title: row.script_title,
      user_id: row.user_id,
      username: row.username || 'System',
      timestamp: row.created_at,
      details: row.details || {},
    })),
  });
}

async function createScript(userId: string, input: any) {
  const content = String(input.content || '');
  if (!content.trim()) {
    throw Object.assign(new Error('Script content is required'), { status: 400, code: 'missing_content' });
  }

  const fileHash = await sha256(content);
  const inputTags = normalizeScriptTags(input.tags);
  const isTestData = Boolean(input.isTestData || input.is_test_data) ||
    inputTags.some((tag: string) => ['codex-smoke', 'delete-test', 'readme-screenshot', 'e2e', 'e2e-test', 'test-data'].includes(tag)) ||
    /^(e2e script|smoke upload|codex lifecycle|test upload)/i.test(String(input.title || ''));
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
        INSERT INTO scripts (title, description, content, user_id, category_id, is_public, file_hash, is_test_data, review_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
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
        isTestData,
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

  await replaceScriptTags(script.id, inputTags);

  try {
    await withTimeout(
      saveScriptEmbedding(script.id, [script.title, script.description, content].join('\n\n')),
      SCRIPT_EMBEDDING_TIMEOUT_MS,
      'Script embedding generation timed out'
    );
  } catch (error) {
    console.warn('[netlify-api] script embedding skipped after upload', error);
  }

  return toFrontendScript(script);
}

function normalizeScriptTags(rawTags: unknown): string[] {
  const values = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string'
      ? rawTags.split(',')
      : [];
  return Array.from(new Set(
    values
      .map((tag: unknown) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
  )).slice(0, 10);
}

async function replaceScriptTags(scriptId: number, tags: string[]): Promise<void> {
  await query('DELETE FROM script_tags WHERE script_id = $1', [scriptId]);
  for (const tag of tags) {
    const tagResult = await query(
      'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [tag]
    );
    await query(
      'INSERT INTO script_tags (script_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [scriptId, tagResult.rows[0].id]
    );
  }
}

async function handleSimilarScripts(id: number, userId: string, route: RouteParams): Promise<Response> {
  const script = await fetchScriptForUser(id, userId);
  const limit = Math.min(Math.max(Number(route.url.searchParams.get('limit') || '5'), 1), 20);
  const threshold = Math.min(Math.max(Number(route.url.searchParams.get('threshold') || '0.55'), 0), 1);

  try {
    await withTimeout(
      saveScriptEmbedding(script.id, [script.title, script.description, script.content].join('\n\n')),
      SCRIPT_EMBEDDING_TIMEOUT_MS,
      'Script embedding generation timed out'
    );
  } catch (error) {
    console.warn('[netlify-api] target embedding unavailable for similar scripts', error);
  }

  const result = await query(
    `
      WITH target AS (
        SELECT embedding
        FROM script_embeddings
        WHERE script_id = $1 AND embedding IS NOT NULL
        LIMIT 1
      )
      SELECT
        s.id,
        s.title,
        s.description,
        s.category_id,
        c.name AS category_name,
        1 - (se.embedding <=> target.embedding) AS similarity
      FROM target
      JOIN script_embeddings se ON se.script_id <> $1 AND se.embedding IS NOT NULL
      JOIN scripts s ON s.id = se.script_id
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE (s.user_id = $2 OR s.is_public = true)
        AND 1 - (se.embedding <=> target.embedding) >= $3
      ORDER BY se.embedding <=> target.embedding
      LIMIT $4
    `,
    [id, userId, threshold, limit]
  );

  const similarScripts = result.rows.map(row => ({
    script_id: row.id,
    scriptId: row.id,
    title: row.title,
    description: row.description,
    category: row.category_name ? { id: row.category_id, name: row.category_name } : null,
    similarity: Number(row.similarity),
  }));

  return json({ success: true, similar_scripts: similarScripts, similarScripts, total: similarScripts.length });
}

async function fetchScriptForUser(id: number, userId: string) {
  const result = await query(
    `${scriptSelect} WHERE s.id = $1 AND (s.user_id = $2 OR s.is_public = true) AND s.deleted_at IS NULL`,
    [id, userId]
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error('Script not found'), { status: 404, code: 'script_not_found' });
  }
  return result.rows[0];
}

async function analyzePowerShell(content: string, title: string, metricContext?: AiMetricContext) {
  if (!content.trim()) {
    throw Object.assign(new Error('Script content is required for analysis'), { status: 400, code: 'missing_content' });
  }

  const staticSignals = collectPowerShellStaticSignals(content);

  let parsed: Record<string, any>;
  try {
    parsed = await completeJson(
      [
        {
          role: 'system',
          content: [
            'You are a senior PowerShell security reviewer and PowerShell teacher.',
            `Return only the requested analysis fields for the supplied script using criteria version ${ANALYSIS_CRITERIA_VERSION}.`,
            'Explain the whole script for both beginners and management.',
            'For command_details, include the key PowerShell commands that materially affect behavior, what each command does in plain English, and any important parameters used.',
            'Score analysis_criteria with this weighted rubric: Security 35%, Operational safety 20%, Reliability 15%, Maintainability 15%, Compatibility 10%, Performance 5%.',
            'Prioritize findings by concrete execution impact. Security findings must cover secrets, injection or dynamic execution, remote downloads, privilege changes, destructive operations, and remoting when present.',
            'Operational safety must call out whether destructive or changing actions use CmdletBinding SupportsShouldProcess, $PSCmdlet.ShouldProcess, -WhatIf, and -Confirm patterns.',
            'Use Microsoft PowerShell/PSScriptAnalyzer conventions, OWASP secure coding practices, and NIST SSDF review-and-test expectations.',
            'Use the supplied deterministic static scan signals as evidence. Do not invent modules, commands, paths, or execution results that are not in the script or static signals.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Analyze this PowerShell script.\n\nTitle: ${title}\n\nStatic scan signals:\n${JSON.stringify(staticSignals, null, 2)}\n\nScript content:\n${content}`,
        },
      ],
      analysisJsonSchema,
      'powershell_script_analysis',
      metricContext
    );
  } catch (error: any) {
    if (!shouldUseStaticAnalysisFallback(error)) throw error;
    console.warn('[netlify-api] AI analysis degraded to static fallback', error);
    parsed = buildStaticPowerShellAnalysis(content, title);
  }

  const executionSummary = parsed.execution_summary && typeof parsed.execution_summary === 'object'
      ? parsed.execution_summary
      : {
        what_it_does: parsed.purpose || 'Automates PowerShell tasks defined in the script.',
        business_value: 'Reduces manual administration by packaging repeatable steps into a script.',
        key_actions: [],
        operational_risk: 'Review permissions, system impact, and target scope before running in production.',
      };
  const dataCollectionSummary = normalizeDataCollectionSummary(executionSummary.data_collection_summary, staticSignals);
  const analysisCriteria = normalizeAnalysisCriteria(parsed.analysis_criteria, parsed);
  const prioritizedFindings = normalizeAnalysisArray(parsed.prioritized_findings);
  const remediationPlan = normalizeAnalysisArray(parsed.remediation_plan);
  const testRecommendations = normalizeStringArray(parsed.test_recommendations);
  const confidence = clampNumber(parsed.confidence, 0, 1, 0.75);

  return {
    criteria_version: parsed.criteria_version || ANALYSIS_CRITERIA_VERSION,
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
    analysis_criteria: analysisCriteria,
    prioritized_findings: prioritizedFindings,
    remediation_plan: remediationPlan,
    test_recommendations: testRecommendations,
    confidence,
    execution_summary: {
      ...executionSummary,
      data_collection_summary: dataCollectionSummary,
      static_signals: staticSignals,
      criteria_version: parsed.criteria_version || ANALYSIS_CRITERIA_VERSION,
      analysis_criteria: analysisCriteria,
      prioritized_findings: prioritizedFindings,
      remediation_plan: remediationPlan,
      test_recommendations: testRecommendations,
      confidence,
    },
  };
}

function shouldUseStaticAnalysisFallback(error: any): boolean {
  const status = Number(error?.status ?? error?.response?.status ?? 500);
  if (!Number.isFinite(status) || status >= 500) return true;

  const code = String(error?.code ?? error?.error?.code ?? '').toLowerCase();
  const message = String(error?.message ?? error?.error?.message ?? '').toLowerCase();
  const providerAnalysisFailures = [
    'schema',
    'json_schema',
    'structured',
    'response_format',
    'text.format',
    'invalid_ai_analysis_response',
    'ai_provider_failed',
  ];

  return status === 400 && providerAnalysisFailures.some(term => code.includes(term) || message.includes(term));
}

function normalizeStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean);
}

function normalizeAnalysisArray(value: any): any[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function normalizeAnalysisCriteria(value: any, parsed: Record<string, any>) {
  if (Array.isArray(value) && value.length) {
    return value.map(item => ({
      name: String(item?.name || 'Criterion'),
      weight: clampNumber(item?.weight, 0, 100, 0),
      score: clampNumber(item?.score, 0, 10, 5),
      summary: String(item?.summary || ''),
    }));
  }

  return ANALYSIS_CRITERIA.map(criterion => ({
    ...criterion,
    score: criterion.name === 'Security'
      ? clampNumber(parsed.security_score ?? parsed.securityScore, 0, 10, 7)
      : criterion.name === 'Performance'
        ? clampNumber(parsed.performance_score ?? parsed.quality_score ?? parsed.qualityScore, 0, 10, 7)
        : clampNumber(parsed.quality_score ?? parsed.qualityScore, 0, 10, 7),
  }));
}

function normalizeDataCollectionSummary(value: any, staticSignals: ReturnType<typeof collectPowerShellStaticSignals>) {
  const source = value && typeof value === 'object' ? value : {};
  const reviewInputs = Array.isArray(source.review_inputs)
    ? source.review_inputs.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : [
        'Full uploaded script content',
        'Deterministic PowerShell token and pattern scan',
        'Hosted AI structured analysis rubric',
        'PSScriptAnalyzer-aligned security, reliability, compatibility, and style checks',
      ];

  return {
    script_lines_reviewed: clampNumber(source.script_lines_reviewed, 0, 1000000, staticSignals.line_count),
    non_empty_lines_reviewed: clampNumber(source.non_empty_lines_reviewed, 0, 1000000, staticSignals.non_empty_line_count),
    commands_identified: clampNumber(source.commands_identified, 0, 1000000, staticSignals.command_count),
    functions_identified: clampNumber(source.functions_identified, 0, 1000000, staticSignals.function_count),
    parameters_identified: clampNumber(source.parameters_identified, 0, 1000000, staticSignals.parameter_count),
    modules_identified: clampNumber(source.modules_identified, 0, 1000000, staticSignals.modules.length),
    review_inputs: reviewInputs,
  };
}

function collectPowerShellStaticSignals(content: string) {
  const lines = content.split(/\r?\n/);
  const commandMatches = Array.from(new Set(content.match(/\b[A-Z][A-Za-z]+-[A-Za-z][A-Za-z0-9]+\b/g) || [])).slice(0, 40);
  const parameterMatches = Array.from(new Set(content.match(/(?<!\w)-[A-Za-z][A-Za-z0-9]+/g) || [])).slice(0, 40);
  const functionMatches = Array.from(content.matchAll(/\bfunction\s+([A-Za-z][A-Za-z0-9_-]*)/gi))
    .map(match => match[1])
    .filter(Boolean)
    .slice(0, 30);
  const requires = Array.from(content.matchAll(/#Requires\s+([^\r\n]+)/gi))
    .map(match => match[1].trim())
    .filter(Boolean)
    .slice(0, 20);
  const modules = new Set<string>();

  for (const match of content.matchAll(/#Requires\s+-Modules?\s+([^\r\n]+)/gi)) {
    String(match[1] || '').split(/[,;]/).forEach(moduleName => {
      const cleaned = moduleName.replace(/['"]/g, '').replace(/\s+-.*$/, '').trim();
      if (cleaned) modules.add(cleaned);
    });
  }

  for (const match of content.matchAll(/Import-Module\s+(?:-Name\s+)?['"]?([A-Za-z0-9_.-]+)/gi)) {
    if (match[1]) modules.add(match[1]);
  }

  const mutatesState = /\b(Set|New|Remove|Clear|Start|Stop|Restart|Enable|Disable|Install|Uninstall|Format|Move|Rename)-[A-Za-z][A-Za-z0-9]+\b/i.test(content);

  return {
    line_count: lines.length,
    non_empty_line_count: lines.filter(line => line.trim()).length,
    command_count: commandMatches.length,
    function_count: functionMatches.length,
    parameter_count: parameterMatches.length,
    has_comment_help: /<#[\s\S]*\.(SYNOPSIS|DESCRIPTION|PARAMETER|EXAMPLE)/i.test(content),
    has_cmdlet_binding: /\[CmdletBinding\b/i.test(content),
    has_should_process: /\bSupportsShouldProcess\b|\$PSCmdlet\.ShouldProcess\s*\(/i.test(content),
    has_try_catch: /\btry\s*\{[\s\S]*\bcatch\s*\{/i.test(content),
    mutates_state: mutatesState,
    uses_remoting: /\bInvoke-Command\b|\bEnter-PSSession\b|\bNew-PSSession\b/i.test(content),
    uses_remote_content: /\bInvoke-WebRequest\b|\bInvoke-RestMethod\b|\bDownloadString\b|\bDownloadFile\b/i.test(content),
    uses_dynamic_execution: /\bInvoke-Expression\b|\biex\b/i.test(content),
    possible_secret_count: (content.match(/\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*=/gi) || []).length,
    requires,
    modules: Array.from(modules).slice(0, 30),
    functions: functionMatches,
    parameters: parameterMatches,
    commands: commandMatches,
  };
}

function buildStaticPowerShellAnalysis(content: string, title: string) {
  const staticSignals = collectPowerShellStaticSignals(content);
  const commands = Array.from(new Set(content.match(/\b[A-Z][A-Za-z]+-[A-Za-z][A-Za-z0-9]+\b/g) || [])).slice(0, 12);
  const parameterNames = Array.from(new Set(content.match(/(?<!\w)-[A-Za-z][A-Za-z0-9]+/g) || [])).slice(0, 24);
  const riskPatterns = [
    {
      pattern: /\bInvoke-Expression\b|\biex\b/i,
      severity: 'critical',
      category: 'Security',
      title: 'Dynamic expression execution',
      issue: 'Uses dynamic expression execution. Validate inputs carefully because this can execute untrusted text as code.',
      recommendation: 'Replace Invoke-Expression with parameterized command invocation or explicit allow-listed operations.',
    },
    {
      pattern: /\b(ConvertTo-SecureString\b[^\n\r;]*-AsPlainText\b|\b(password|passwd|pwd|secret|token|api[_-]?key)\s*=)/i,
      severity: 'high',
      category: 'Security',
      title: 'Secret or plaintext credential handling',
      issue: 'May contain hardcoded secrets or plaintext credential conversion.',
      recommendation: 'Move secrets to a secure vault or environment-managed secret and avoid -AsPlainText except for controlled migration code.',
    },
    {
      pattern: /\bDownloadString\b|\bInvoke-WebRequest\b|\bInvoke-RestMethod\b/i,
      severity: 'high',
      category: 'Security',
      title: 'Remote content or API dependency',
      issue: 'Downloads or calls remote content. Verify the source, TLS requirements, and expected response before production use.',
      recommendation: 'Pin trusted endpoints, validate downloaded content, avoid piping remote content directly to execution, and document expected schemas.',
    },
    {
      pattern: /\bStart-Process\b/i,
      severity: 'medium',
      category: 'Operational safety',
      title: 'External process launch',
      issue: 'Starts another process. Confirm the executable path, arguments, and privilege requirements.',
      recommendation: 'Validate executable paths and arguments, avoid shell expansion, and capture exit codes and output.',
    },
    {
      pattern: /\bSet-ExecutionPolicy\b/i,
      severity: 'medium',
      category: 'Security',
      title: 'Execution policy change',
      issue: 'Changes PowerShell execution policy. Document why the change is required and scope it as narrowly as possible.',
      recommendation: 'Use the narrowest scope possible and prefer signed scripts and documented deployment policy.',
    },
    {
      pattern: /\b(Remove-Item|Clear-Content|Clear-Item|Stop-Service|Restart-Computer|Format-Volume)\b/i,
      severity: 'high',
      category: 'Operational safety',
      title: 'Destructive or system-changing command',
      issue: 'Runs destructive or system-changing commands. Confirm path filters, target scope, and recovery procedures before running.',
      recommendation: 'Wrap changing operations in SupportsShouldProcess and $PSCmdlet.ShouldProcess, and test -WhatIf and -Confirm behavior.',
    },
    {
      pattern: /\bInvoke-Command\b|\bEnter-PSSession\b|\bNew-PSSession\b/i,
      severity: 'medium',
      category: 'Security',
      title: 'PowerShell remoting',
      issue: 'Uses PowerShell remoting. Review authentication, endpoint restrictions, credential handling, and target inventory.',
      recommendation: 'Use least-privilege credentials, explicit target allow lists, and secure remoting configuration.',
    },
    {
      pattern: /\bGet-WmiObject\b/i,
      severity: 'low',
      category: 'Compatibility',
      title: 'Legacy WMI cmdlet',
      issue: 'Uses Get-WmiObject, which is Windows PowerShell-era behavior and is not available in PowerShell 7 on all platforms.',
      recommendation: 'Prefer Get-CimInstance when compatible with the target environment.',
    },
  ];
  const detectedFindings = riskPatterns.filter(({ pattern }) => pattern.test(content));
  const mutatesState = /\b(Set|New|Remove|Clear|Start|Stop|Restart|Enable|Disable|Install|Uninstall|Format)-[A-Za-z][A-Za-z0-9]+\b/i.test(content);
  const supportsShouldProcess = /\[CmdletBinding\([^\)]*SupportsShouldProcess/i.test(content) || /\$PSCmdlet\.ShouldProcess\s*\(/i.test(content);
  if (mutatesState && !supportsShouldProcess) {
    detectedFindings.push({
      pattern: /\b(Set|New|Remove|Clear|Start|Stop|Restart|Enable|Disable|Install|Uninstall|Format)-/i,
      severity: 'medium',
      category: 'Operational safety',
      title: 'Missing ShouldProcess protection',
      issue: 'State-changing commands were detected without clear SupportsShouldProcess or $PSCmdlet.ShouldProcess handling.',
      recommendation: 'Add [CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")] and guard changes with $PSCmdlet.ShouldProcess.',
    });
  }
  const securityIssues = detectedFindings
    .filter(({ category }) => category === 'Security')
    .map(({ issue }) => issue);
  const bestPracticeViolations = detectedFindings
    .filter(({ category }) => category !== 'Security')
    .map(({ issue }) => issue);
  const prioritizedFindings = detectedFindings.map((finding, index) => ({
    id: `PS-${String(index + 1).padStart(3, '0')}`,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    evidence: `Detected pattern: ${finding.pattern}`,
    impact: finding.issue,
    recommendation: finding.recommendation,
  }));
  const securityScore = clampNumber(8 - detectedFindings.filter(item => item.category === 'Security').length * 1.5, 0, 10, 7);
  const qualityScore = clampNumber(commands.length ? 7 - (supportsShouldProcess ? 0 : mutatesState ? 1 : 0) : 5, 0, 10, 7);
  const riskScore = clampNumber(3 + detectedFindings.length * 1.25, 0, 10, 3);
  const analysisCriteria = [
    { ...ANALYSIS_CRITERIA[0], score: securityScore },
    { ...ANALYSIS_CRITERIA[1], score: clampNumber(supportsShouldProcess || !mutatesState ? 8 : 4, 0, 10, 6) },
    { ...ANALYSIS_CRITERIA[2], score: clampNumber(/\btry\s*\{|\bcatch\s*\{|\$ErrorActionPreference|-ErrorAction\b/i.test(content) ? 7 : 5, 0, 10, 5) },
    { ...ANALYSIS_CRITERIA[3], score: clampNumber(commands.length ? 7 : 4, 0, 10, 6) },
    { ...ANALYSIS_CRITERIA[4], score: clampNumber(/\bGet-WmiObject\b/i.test(content) ? 5 : 7, 0, 10, 7) },
    { ...ANALYSIS_CRITERIA[5], score: clampNumber(/\bForEach-Object\b|\bWhere-Object\b|\bSelect-Object\b/i.test(content) ? 7 : 6, 0, 10, 6) },
  ];
  const commandDetails = commands.map(command => ({
    name: command,
    description: `${command} is one of the main PowerShell commands used by this script.`,
    purpose: `Supports the script workflow in ${title || 'this upload'}. Review its parameters and target scope before running.`,
    beginner_explanation: `PowerShell commands use Verb-Noun names. ${command} tells PowerShell to perform the "${command.split('-')[0]}" action against the "${command.split('-')[1] || 'target'}" area.`,
    management_impact: `${command} may affect systems, data, identity, or reporting depending on its parameters and target resources.`,
    example: command,
    parameters: parameterNames.map(parameter => ({
      name: parameter,
      description: `Parameter detected in the script. Confirm the value passed to ${parameter} is appropriate for the target environment.`,
    })),
  }));

  return {
    criteria_version: ANALYSIS_CRITERIA_VERSION,
    purpose: title
      ? `Static hosted analysis for "${title}". The script automates PowerShell actions and should be reviewed before production use.`
      : 'Static hosted analysis for an uploaded PowerShell script. The script automates PowerShell actions and should be reviewed before production use.',
    beginner_explanation:
      'This script is a set of PowerShell instructions. Read it from top to bottom: variables store values, commands perform actions, and parameters after each command control where and how those actions run.',
    management_summary:
      'The hosted AI provider did not return valid structured JSON, so PSScript saved a deterministic static review. Use it as a baseline operational summary, then rerun AI analysis when the provider is healthy for deeper recommendations.',
    security_score: securityScore,
    quality_score: qualityScore,
    risk_score: riskScore,
    suggestions: [
      'Review the detected commands and parameters against the intended target environment.',
      'Run in a non-production environment first and capture expected output.',
      'Add comments for business purpose, required permissions, and rollback steps if they are missing.',
    ],
    command_details: commandDetails,
    security_issues: securityIssues,
    best_practice_violations: commands.length
      ? bestPracticeViolations
      : ['No standard Verb-Noun PowerShell commands were detected. Confirm the upload contains the intended script content.'],
    performance_insights: ['Static analysis does not execute the script. Runtime performance should be validated with representative input and target systems.'],
    analysis_criteria: analysisCriteria,
    prioritized_findings: prioritizedFindings,
    remediation_plan: prioritizedFindings.map(finding => ({
      priority: finding.severity,
      action: finding.recommendation,
      rationale: finding.impact,
      effort: finding.severity === 'critical' || finding.severity === 'high' ? 'medium' : 'low',
    })),
    test_recommendations: [
      'Run PSScriptAnalyzer and review all Error and Warning findings.',
      'Execute the script in a non-production environment with representative parameters.',
      'For state-changing scripts, verify -WhatIf and -Confirm behavior before production execution.',
      'Validate failure paths, missing permissions, and invalid input handling.',
    ],
    confidence: 0.62,
    execution_summary: {
      what_it_does: commands.length
        ? `Runs PowerShell workflow steps using commands such as ${commands.slice(0, 4).join(', ')}.`
        : 'Runs PowerShell workflow steps defined in the uploaded content.',
      business_value: 'Packages repeatable administrative or operational work into a reusable script.',
      key_actions: commands,
      operational_risk: securityIssues.length
        ? 'Potentially sensitive commands were detected. Review permissions, remote content, deletion, execution policy, and process launch behavior before production use.'
        : 'No high-risk command pattern was detected by static fallback, but permissions and target scope still need review.',
      data_collection_summary: normalizeDataCollectionSummary(null, staticSignals),
      static_signals: staticSignals,
      criteria_version: ANALYSIS_CRITERIA_VERSION,
      analysis_criteria: analysisCriteria,
      prioritized_findings: prioritizedFindings,
      remediation_plan: prioritizedFindings.map(finding => ({
        priority: finding.severity,
        action: finding.recommendation,
        rationale: finding.impact,
        effort: finding.severity === 'critical' || finding.severity === 'high' ? 'medium' : 'low',
      })),
      test_recommendations: [
        'Run PSScriptAnalyzer and review all Error and Warning findings.',
        'Execute the script in a non-production environment with representative parameters.',
        'For state-changing scripts, verify -WhatIf and -Confirm behavior before production execution.',
        'Validate failure paths, missing permissions, and invalid input handling.',
      ],
      confidence: 0.62,
    },
  };
}

async function saveAnalysis(scriptId: number, analysis: any) {
  const scriptResult = await query<{ version: number; file_hash: string }>('SELECT version, file_hash FROM scripts WHERE id = $1', [scriptId]);
  const scriptVersion = Number(scriptResult.rows[0]?.version || 1);
  const fileHash = scriptResult.rows[0]?.file_hash || null;
  const result = await query(
    `
      INSERT INTO script_analysis (
        script_id, purpose, security_score, quality_score, risk_score,
        suggestions, command_details, security_issues, best_practice_violations,
        performance_insights, execution_summary, script_version, file_hash, analysis_source
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)
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
          script_version = EXCLUDED.script_version,
          file_hash = EXCLUDED.file_hash,
          analysis_source = EXCLUDED.analysis_source,
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
        criteria_version: analysis.criteria_version || analysis.execution_summary?.criteria_version || ANALYSIS_CRITERIA_VERSION,
        analysis_criteria: analysis.analysis_criteria || analysis.execution_summary?.analysis_criteria || [],
        prioritized_findings: analysis.prioritized_findings || analysis.execution_summary?.prioritized_findings || [],
        remediation_plan: analysis.remediation_plan || analysis.execution_summary?.remediation_plan || [],
        test_recommendations: analysis.test_recommendations || analysis.execution_summary?.test_recommendations || [],
        confidence: analysis.confidence ?? analysis.execution_summary?.confidence ?? null,
      }),
      scriptVersion,
      fileHash,
      analysis.analysis_source || 'ai',
    ]
  );
  return result.rows[0];
}

function zeroAiUsage(): AiUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function normalizeAiUsage(response: any): AiUsage {
  const usage = response?.usage || {};
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? usage.inputTokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

function calculateAiCost(model: string, promptTokens: number, completionTokens: number): number {
  let pricing = AI_MODEL_PRICING[model];
  if (!pricing) {
    const key = Object.keys(AI_MODEL_PRICING)
      .sort((a, b) => b.length - a.length)
      .find(candidate => model.includes(candidate));
    pricing = key ? AI_MODEL_PRICING[key] : AI_MODEL_PRICING['gpt-4.1-mini'];
  }
  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;
  return Number((promptCost + completionCost).toFixed(6));
}

async function recordAiMetric(context: AiMetricContext | undefined, details: AiMetricDetails): Promise<void> {
  if (!context) return;

  try {
    const usage = details.usage || zeroAiUsage();
    await query(
      `
      INSERT INTO ai_metrics (
        user_id, endpoint, model, prompt_tokens, completion_tokens, total_tokens,
        total_cost, latency, success, error_message, request_payload, response_payload
      )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
      `,
      [
        context.userId || null,
        context.endpoint,
        details.model,
        usage.promptTokens,
        usage.completionTokens,
        usage.totalTokens,
        calculateAiCost(details.model, usage.promptTokens, usage.completionTokens),
        details.latency,
        details.success,
        details.errorMessage || null,
        JSON.stringify({
          provider: details.provider,
          usageSource: usage.totalTokens > 0 ? 'provider_reported' : 'unavailable',
        }),
        JSON.stringify({
          hasUsage: usage.totalTokens > 0,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          estimatedCost: calculateAiCost(details.model, usage.promptTokens, usage.completionTokens),
        }),
      ]
    );
  } catch (error) {
    console.warn('[netlify-api] AI metric write skipped', error);
  }
}

function emptyAiAnalytics(startDate: Date, endDate: Date) {
  return {
    summary: {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatency: 0,
      p95Latency: 0,
      successRate: 0,
    },
    byModel: [],
    byEndpoint: [],
    costTrend: [],
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}

async function aiMetricsTableExists(): Promise<boolean> {
  try {
    const result = await query<{ exists: boolean }>("SELECT to_regclass('public.ai_metrics') IS NOT NULL AS exists");
    return result.rows[0]?.exists === true;
  } catch (error) {
    console.warn('[netlify-api] ai_metrics table existence check failed', error);
    return false;
  }
}

async function getHostedAiAnalytics(userId: string, startDate: Date, endDate: Date) {
  if (!(await aiMetricsTableExists())) return emptyAiAnalytics(startDate, endDate);

  try {
    const [summary, byModel, byEndpoint, byProvider, costTrend] = await Promise.all([
      query(
        `
          SELECT
            COUNT(*)::int AS "totalRequests",
            COUNT(*) FILTER (WHERE success = true)::int AS "successfulRequests",
            COUNT(*) FILTER (WHERE success = false)::int AS "failedRequests",
            COALESCE(SUM(prompt_tokens), 0)::int AS "promptTokens",
            COALESCE(SUM(completion_tokens), 0)::int AS "completionTokens",
            COALESCE(SUM(total_tokens), 0)::int AS "totalTokens",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(AVG(total_cost), 0)::float AS "avgCostPerRequest",
            COALESCE(AVG(latency), 0)::float AS "avgLatency",
            COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0)::float AS "p95Latency",
            COALESCE(AVG(CASE WHEN success = true THEN 1 ELSE 0 END), 0)::float AS "successRate",
            COALESCE(AVG(CASE WHEN success = false THEN 1 ELSE 0 END), 0)::float AS "errorRate"
          FROM ai_metrics
          WHERE created_at >= $1 AND created_at <= $2 AND (user_id = $3 OR user_id IS NULL)
        `,
        [startDate.toISOString(), endDate.toISOString(), userId]
      ),
      query(
        `
          SELECT
            model,
            COALESCE(request_payload->>'provider', 'unknown') AS provider,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE success = false)::int AS failures,
            COALESCE(SUM(prompt_tokens), 0)::int AS "promptTokens",
            COALESCE(SUM(completion_tokens), 0)::int AS "completionTokens",
            COALESCE(SUM(total_tokens), 0)::int AS "totalTokens",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(AVG(latency), 0)::float AS "avgLatency",
            COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0)::float AS "p95Latency",
            COALESCE(AVG(CASE WHEN success = true THEN 1 ELSE 0 END), 0)::float AS "successRate"
          FROM ai_metrics
          WHERE created_at >= $1 AND created_at <= $2 AND (user_id = $3 OR user_id IS NULL)
          GROUP BY model, COALESCE(request_payload->>'provider', 'unknown')
          ORDER BY COALESCE(SUM(total_cost), 0) DESC
        `,
        [startDate.toISOString(), endDate.toISOString(), userId]
      ),
      query(
        `
          SELECT
            endpoint,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE success = false)::int AS failures,
            COALESCE(SUM(prompt_tokens), 0)::int AS "promptTokens",
            COALESCE(SUM(completion_tokens), 0)::int AS "completionTokens",
            COALESCE(SUM(total_tokens), 0)::int AS "totalTokens",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(AVG(latency), 0)::float AS "avgLatency",
            COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0)::float AS "p95Latency",
            COALESCE(AVG(CASE WHEN success = true THEN 1 ELSE 0 END), 0)::float AS "successRate"
          FROM ai_metrics
          WHERE created_at >= $1 AND created_at <= $2 AND (user_id = $3 OR user_id IS NULL)
          GROUP BY endpoint
          ORDER BY COUNT(*) DESC
          LIMIT 10
        `,
        [startDate.toISOString(), endDate.toISOString(), userId]
      ),
      query(
        `
          SELECT
            COALESCE(request_payload->>'provider', 'unknown') AS provider,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE success = false)::int AS failures,
            COALESCE(SUM(prompt_tokens), 0)::int AS "promptTokens",
            COALESCE(SUM(completion_tokens), 0)::int AS "completionTokens",
            COALESCE(SUM(total_tokens), 0)::int AS "totalTokens",
            COALESCE(SUM(total_cost), 0)::float AS "totalCost",
            COALESCE(AVG(latency), 0)::float AS "avgLatency",
            COALESCE(AVG(CASE WHEN success = true THEN 1 ELSE 0 END), 0)::float AS "successRate"
          FROM ai_metrics
          WHERE created_at >= $1 AND created_at <= $2 AND (user_id = $3 OR user_id IS NULL)
          GROUP BY COALESCE(request_payload->>'provider', 'unknown')
          ORDER BY requests DESC
        `,
        [startDate.toISOString(), endDate.toISOString(), userId]
      ),
      query(
        `
          SELECT
            DATE(created_at)::text AS date,
            COALESCE(SUM(total_cost), 0)::float AS cost,
            COALESCE(SUM(total_tokens), 0)::int AS tokens,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE success = false)::int AS failures
          FROM ai_metrics
          WHERE created_at >= $1 AND created_at <= $2 AND (user_id = $3 OR user_id IS NULL)
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `,
        [startDate.toISOString(), endDate.toISOString(), userId]
      ),
    ]);

    return {
      summary: summary.rows[0] || emptyAiAnalytics(startDate, endDate).summary,
      byModel: byModel.rows,
      byEndpoint: byEndpoint.rows,
      byProvider: byProvider.rows,
      costTrend: costTrend.rows,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (error) {
    console.warn('[netlify-api] AI analytics query failed; returning empty summary', error);
    return emptyAiAnalytics(startDate, endDate);
  }
}

async function getHostedAiBudgetAlerts(userId: string, dailyBudget: number, monthlyBudget: number) {
  if (!(await aiMetricsTableExists())) return [];

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [dailyResult, monthlyResult] = await Promise.all([
      query(
        'SELECT COALESCE(SUM(total_cost), 0)::float AS cost FROM ai_metrics WHERE created_at >= $1 AND (user_id = $2 OR user_id IS NULL)',
        [today.toISOString(), userId]
      ),
      query(
        'SELECT COALESCE(SUM(total_cost), 0)::float AS cost FROM ai_metrics WHERE created_at >= $1 AND (user_id = $2 OR user_id IS NULL)',
        [monthStart.toISOString(), userId]
      ),
    ]);

    const dailyCost = Number(dailyResult.rows[0]?.cost || 0);
    const monthlyCost = Number(monthlyResult.rows[0]?.cost || 0);
    const alerts = [];

    if (dailyBudget > 0 && dailyCost > dailyBudget) {
      alerts.push({
        type: 'daily_budget_exceeded',
        threshold: dailyBudget,
        actual: dailyCost,
        percentage: ((dailyCost / dailyBudget) * 100).toFixed(1),
      });
    }

    if (monthlyBudget > 0 && monthlyCost > monthlyBudget) {
      alerts.push({
        type: 'monthly_budget_exceeded',
        threshold: monthlyBudget,
        actual: monthlyCost,
        percentage: ((monthlyCost / monthlyBudget) * 100).toFixed(1),
      });
    }

    return alerts;
  } catch (error) {
    console.warn('[netlify-api] AI budget alert query failed; returning no alerts', error);
    return [];
  }
}

async function completeText(messages: ChatMessage[], metricContext?: AiMetricContext): Promise<AiCompletion> {
  const openaiKey = await getProviderApiKey('openai');
  let openaiError: unknown = null;
  if (openaiKey) {
    const model = getEnv('OPENAI_MODEL', OPENAI_TEXT_MODEL);
    const started = Date.now();
    try {
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
      const usage = normalizeAiUsage(response);
      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage,
        latency: Date.now() - started,
        success: true,
      });
      return { text, provider: 'openai', model, usage };
    } catch (error) {
      openaiError = error;
      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage: zeroAiUsage(),
        latency: Date.now() - started,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      console.error('[netlify-api] OpenAI text completion failed; trying fallback provider if configured', error);
    }
  }

  const anthropicText = await completeTextWithAnthropic(messages, metricContext);
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

async function streamText(
  messages: ChatMessage[],
  metricContext: AiMetricContext | undefined,
  onDelta: (delta: string) => void
): Promise<AiCompletion> {
  const openaiKey = await getProviderApiKey('openai');
  let openaiError: unknown = null;

  if (openaiKey) {
    const model = getEnv('OPENAI_MODEL', OPENAI_TEXT_MODEL);
    const started = Date.now();
    let text = '';
    let usage = zeroAiUsage();

    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const { instructions, input } = toOpenAIResponseInput(messages);
      const stream = openai.responses.stream({
        model,
        instructions,
        input,
        store: false,
        max_output_tokens: Number(getEnv('OPENAI_MAX_OUTPUT_TOKENS', '1600')),
      } as any);

      for await (const event of stream as any) {
        if (event.type === 'response.output_text.delta' && event.delta) {
          text += event.delta;
          onDelta(event.delta);
        } else if (event.type === 'response.completed') {
          usage = normalizeAiUsage(event.response);
        } else if (event.type === 'response.failed' || event.type === 'error') {
          const message = event.error?.message || event.response?.error?.message || 'OpenAI streaming response failed';
          throw Object.assign(new Error(message), { status: 502, code: 'ai_stream_failed' });
        }
      }

      if (!text.trim()) {
        throw Object.assign(new Error('OpenAI returned an empty streaming text response'), { status: 502, code: 'empty_ai_text_response' });
      }

      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage,
        latency: Date.now() - started,
        success: true,
      });
      return { text, provider: 'openai', model, usage };
    } catch (error) {
      openaiError = error;
      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage: zeroAiUsage(),
        latency: Date.now() - started,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      console.error('[netlify-api] OpenAI text stream failed; trying fallback provider if configured', error);
    }
  }

  const fallback = await completeTextWithAnthropic(messages, metricContext);
  if (fallback.text) {
    onDelta(fallback.text);
    return fallback;
  }

  if (openaiError) {
    throw Object.assign(new Error('AI stream provider failed and no fallback provider returned a response'), {
      status: 502,
      code: 'ai_provider_failed',
    });
  }

  throw Object.assign(new Error('No AI text provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.'), {
    status: 503,
    code: 'ai_provider_unconfigured',
  });
}

async function completeJson(messages: ChatMessage[], schema: any, name: string, metricContext?: AiMetricContext): Promise<Record<string, any>> {
  const openaiKey = await getProviderApiKey('openai');
  let openaiError: unknown = null;
  if (openaiKey) {
    const model = getEnv('OPENAI_ANALYSIS_MODEL', getEnv('OPENAI_MODEL', OPENAI_ANALYSIS_MODEL));
    const started = Date.now();
    try {
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
            strict: false,
            schema,
          },
        },
      });
      const usage = normalizeAiUsage(response);
      const parsed = parseJsonObject(extractResponseText(response));
      if (!Object.keys(parsed).length) {
        throw Object.assign(new Error('OpenAI returned invalid structured analysis JSON'), {
          status: 502,
          code: 'invalid_ai_analysis_response',
        });
      }
      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage,
        latency: Date.now() - started,
        success: true,
      });
      return parsed;
    } catch (error) {
      openaiError = error;
      await recordAiMetric(metricContext, {
        provider: 'openai',
        model,
        usage: zeroAiUsage(),
        latency: Date.now() - started,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      console.error('[netlify-api] OpenAI structured analysis failed; trying Anthropic fallback if configured', error);
    }
  }

  const fallback = await completeTextWithAnthropic([
    ...messages,
    {
      role: 'user',
      content: `Return valid JSON matching this JSON Schema. Do not include Markdown fences.\n\n${JSON.stringify(schema)}`,
    },
  ], metricContext);
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

async function completeTextWithAnthropic(messages: ChatMessage[], metricContext?: AiMetricContext): Promise<AiCompletion> {
  const anthropicKey = await getProviderApiKey('anthropic');
  if (!anthropicKey) return { text: '', provider: 'none', model: 'none' };

  const model = getEnv('ANTHROPIC_MODEL', ANTHROPIC_TEXT_MODEL);
  const provider = getEnv('ANTHROPIC_BASE_URL') ? 'anthropic-compatible' : 'anthropic';
  const started = Date.now();
  const anthropic = new Anthropic({
    apiKey: anthropicKey,
    baseURL: getEnv('ANTHROPIC_BASE_URL') || undefined,
  });
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n') || undefined;
  const userMessages = messages.filter(message => message.role !== 'system');
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: Number(getEnv('ANTHROPIC_MAX_TOKENS', '1600')),
      system,
      messages: userMessages.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: String(message.content || ''),
      })),
    });
    const usage = normalizeAiUsage(response);
    const text = response.content.map((part: any) => part.type === 'text' ? part.text : '').join('\n').trim();
    await recordAiMetric(metricContext, {
      provider,
      model,
      usage,
      latency: Date.now() - started,
      success: true,
    });
    return { text, provider, model, usage };
  } catch (error) {
    await recordAiMetric(metricContext, {
      provider,
      model,
      usage: zeroAiUsage(),
      latency: Date.now() - started,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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

    const fetchUrl = await normalizePublicImportUrl(next.url.toString());
    const normalized = normalizeUrlForCrawl(fetchUrl);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const response = await fetchPublicDocumentationUrl(new URL(normalized), 3, {
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

async function buildDocumentationItem(page: { url: string; title: string; text: string; codeBlocks: string[] }, metricContext?: AiMetricContext) {
  const commands = extractPowerShellSignals(`${page.title}\n${page.text}\n${page.codeBlocks.join('\n')}`);
  const aiSummary = await summarizeDocumentationPage(page, commands, metricContext).catch(() => null);
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
  commands: string[],
  metricContext?: AiMetricContext
): Promise<{ title: string; summary: string; tags: string[] } | null> {
  const [openaiKey, anthropicKey] = await Promise.all([
    getProviderApiKey('openai'),
    getProviderApiKey('anthropic'),
  ]);
  if (!openaiKey && !anthropicKey) return null;

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
    'documentation_import_metadata',
    metricContext
  );

  return {
    title: String(parsed.title || page.title || titleFromUrl(page.url)).trim(),
    summary: String(parsed.summary || '').trim(),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((tag: unknown) => String(tag).trim().toLowerCase()).filter(Boolean).slice(0, 8)
      : [],
  };
}

async function normalizePublicImportUrl(value: unknown): Promise<URL> {
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

  if (await isPrivateImportDestination(url)) {
    throw Object.assign(new Error('Private and localhost URLs cannot be imported'), { status: 400, code: 'private_import_url' });
  }

  url.hash = '';
  return url;
}

async function fetchPublicDocumentationUrl(url: URL, redirectsRemaining: number, init: RequestInit): Promise<Response> {
  const safeUrl = await normalizePublicImportUrl(url.toString());
  const response = await fetch(safeUrl.toString(), {
    ...init,
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
    if (redirectsRemaining <= 0) {
      throw Object.assign(new Error('Too many redirects while importing documentation'), { status: 400, code: 'too_many_redirects' });
    }
    const redirectedUrl = new URL(response.headers.get('location') || '', safeUrl);
    return fetchPublicDocumentationUrl(redirectedUrl, redirectsRemaining - 1, init);
  }

  return response;
}

async function isPrivateImportDestination(url: URL): Promise<boolean> {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  const literalIp = net.isIP(hostname) ? hostname : '';
  if (literalIp) return isUnsafeIpAddress(literalIp);

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length === 0 || addresses.some(address => isUnsafeIpAddress(address.address));
  } catch {
    return true;
  }
}

function isUnsafeIpAddress(address: string): boolean {
  if (net.isIP(address) === 4) return isUnsafeIpv4(address);
  if (net.isIP(address) === 6) return isUnsafeIpv6(address);
  return true;
}

function isUnsafeIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fe90:') ||
    normalized.startsWith('fea0:') ||
    normalized.startsWith('feb0:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:') ||
    normalized.startsWith('2002:')
  ) {
    return true;
  }

  const ipv4Mapped = normalized.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return ipv4Mapped ? isUnsafeIpv4(ipv4Mapped[1]) : false;
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
  const openaiKey = await getProviderApiKey('openai');
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
      `
        INSERT INTO script_embeddings (script_id, embedding, embedding_model)
        VALUES ($1, $2::vector, $3)
        ON CONFLICT (script_id) DO UPDATE
        SET embedding = EXCLUDED.embedding,
            embedding_model = EXCLUDED.embedding_model,
            updated_at = now()
      `,
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
}, metricContext?: AiMetricContext) {
  const text = input.text.trim();
  if (!text) throw Object.assign(new Error('Text is required for speech synthesis'), { status: 400, code: 'missing_text' });
  if (text.length > 4096) throw Object.assign(new Error('Speech text is limited to 4096 characters'), { status: 413, code: 'text_too_large' });

  const openaiKey = await getProviderApiKey('openai');
  if (!openaiKey) throw Object.assign(new Error('OPENAI_API_KEY is required for hosted voice synthesis'), { status: 503, code: 'voice_provider_unconfigured' });

  const format = normalizeAudioFormat(input.outputFormat, ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'], 'mp3');
  const model = getEnv('VOICE_TTS_MODEL', OPENAI_TTS_MODEL);
  const voice = normalizeVoiceId(input.voiceId);
  const instructionText = input.voiceInstructions ? String(input.voiceInstructions).slice(0, 512) : undefined;
  const cacheKey = JSON.stringify({
    model,
    voice,
    format,
    speed: input.speed,
    instructions: instructionText || '',
    text,
  });
  const cached = voiceTtsCache.get(cacheKey);
  if (cached) {
    voiceTtsCache.delete(cacheKey);
    voiceTtsCache.set(cacheKey, cached);
    return { ...cached, cached: true };
  }

  const started = Date.now();
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
        Accept: mimeTypeForAudioFormat(format),
      },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: format,
        speed: input.speed,
        ...(instructionText ? { instructions: instructionText } : {}),
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null) as any;
      const providerError = errorPayload?.error || {};
      throw Object.assign(
        new Error(providerError.message || providerError.code || `OpenAI TTS failed (${response.status})`),
        { status: response.status, code: providerError.code || 'voice_provider_error' }
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await recordAiMetric(metricContext, {
      provider: 'openai',
      model,
      usage: zeroAiUsage(),
      latency: Date.now() - started,
      success: true,
    });
    const result = {
      audio_data: audioBuffer.toString('base64'),
      format,
      duration: 0,
      text,
      model,
      voice,
    };
    voiceTtsCache.set(cacheKey, result);
    while (voiceTtsCache.size > VOICE_TTS_CACHE_MAX_ENTRIES) {
      const oldestKey = voiceTtsCache.keys().next().value;
      if (!oldestKey) break;
      voiceTtsCache.delete(oldestKey);
    }
    return result;
  } catch (error) {
    await recordAiMetric(metricContext, {
      provider: 'openai',
      model,
      usage: zeroAiUsage(),
      latency: Date.now() - started,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function recognizeSpeech(input: {
  audioData: string;
  audioFormat: string;
  language?: string;
  prompt?: string;
  transcriptionMode?: string;
}, metricContext?: AiMetricContext) {
  const base64 = input.audioData.replace(/^data:audio\/[^;]+;base64,/, '').replace(/\s/g, '');
  if (!base64) throw Object.assign(new Error('Audio data is required for speech recognition'), { status: 400, code: 'missing_audio' });
  if (base64.length > Number(getEnv('VOICE_MAX_BASE64_CHARS', '16000000'))) {
    throw Object.assign(new Error('Audio payload is too large'), { status: 413, code: 'audio_too_large' });
  }
  if (!isValidBase64AudioPayload(base64)) {
    throw Object.assign(new Error('Audio data must be valid base64 audio'), { status: 400, code: 'invalid_audio' });
  }

  const openaiKey = await getProviderApiKey('openai');
  if (!openaiKey) throw Object.assign(new Error('OPENAI_API_KEY is required for hosted speech recognition'), { status: 503, code: 'voice_provider_unconfigured' });

  const format = normalizeAudioFormat(input.audioFormat, ['webm', 'ogg', 'mp3', 'mp4', 'm4a', 'wav', 'flac'], 'webm');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.byteLength) throw Object.assign(new Error('Audio data is empty or invalid'), { status: 400, code: 'invalid_audio' });
  const file = await toFile(buffer, `recording.${format}`, { type: mimeTypeForAudioFormat(format) });
  const model = input.transcriptionMode === 'diarize'
    ? getEnv('VOICE_STT_DIARIZE_MODEL', 'gpt-4o-transcribe-diarize')
    : getEnv('VOICE_STT_MODEL', OPENAI_STT_MODEL);
  const diarize = model === 'gpt-4o-transcribe-diarize';

  const started = Date.now();
  const openai = new OpenAI({ apiKey: openaiKey });
  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model,
      language: input.language?.split('-')[0],
      prompt: diarize ? undefined : input.prompt?.slice(0, 512),
      response_format: diarize ? 'diarized_json' : 'json',
      chunking_strategy: diarize ? 'auto' : undefined,
    } as any);
    await recordAiMetric(metricContext, {
      provider: 'openai',
      model,
      usage: zeroAiUsage(),
      latency: Date.now() - started,
      success: true,
    });
    return {
      text: (transcription as any).text || '',
      segments: (transcription as any).segments,
      confidence: undefined,
      language: input.language || 'auto',
      duration: undefined,
      model,
      mode: input.transcriptionMode || 'standard',
    };
  } catch (error) {
    await recordAiMetric(metricContext, {
      provider: 'openai',
      model,
      usage: zeroAiUsage(),
      latency: Date.now() - started,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function normalizeVoiceId(voiceId: string): string {
  return openAiVoices.some(voice => voice.id === voiceId) ? voiceId : 'marin';
}

function isValidBase64AudioPayload(base64: string): boolean {
  if (base64.length % 4 === 1) {
    return false;
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(base64);
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

function getApiKeyEncryptionKey(): Buffer {
  const secret = getEnv('API_KEY_ENCRYPTION_SECRET') || requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createHash('sha256').update(secret).digest();
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getApiKeyEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

function decryptSecret(value: string): string {
  const [version, iv, tag, encrypted] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw Object.assign(new Error('Stored provider key could not be read'), {
      status: 500,
      code: 'provider_key_decrypt_failed',
    });
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getApiKeyEncryptionKey(),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function keyHint(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return 'configured';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function normalizeApiKeyProvider(value: string | undefined): ApiKeyProvider | null {
  return value === 'openai' || value === 'anthropic' ? value : null;
}

function normalizeProviderApiKey(provider: ApiKeyProvider, value: unknown): string {
  const apiKey = typeof value === 'string' ? value.trim() : '';
  if (!apiKey) {
    throw Object.assign(new Error('API key is required'), { status: 400, code: 'missing_api_key' });
  }

  const config = API_KEY_PROVIDERS[provider];
  if (!config.prefixes.some(prefix => apiKey.startsWith(prefix))) {
    throw Object.assign(new Error(`${config.label} API key format is not recognized`), {
      status: 400,
      code: 'invalid_api_key_format',
    });
  }

  if (apiKey.length < 20) {
    throw Object.assign(new Error(`${config.label} API key is too short`), {
      status: 400,
      code: 'invalid_api_key_format',
    });
  }

  return apiKey;
}

async function getProviderApiKey(provider: ApiKeyProvider): Promise<string> {
  await ensureProviderApiKeysSchema();
  const result = await query<{ encrypted_api_key: string }>(
    'SELECT encrypted_api_key FROM provider_api_keys WHERE provider = $1',
    [provider]
  );
  if (result.rows[0]?.encrypted_api_key) {
    return decryptSecret(result.rows[0].encrypted_api_key);
  }

  return getEnv(API_KEY_PROVIDERS[provider].envName);
}

async function testProviderApiKey(provider: ApiKeyProvider): Promise<{
  ok: boolean;
  provider: ApiKeyProvider;
  source: 'database' | 'environment' | 'missing';
  message: string;
  error?: string;
}> {
  const result = await query<{ encrypted_api_key: string }>(
    'SELECT encrypted_api_key FROM provider_api_keys WHERE provider = $1',
    [provider]
  );
  const config = API_KEY_PROVIDERS[provider];
  const source = result.rows[0]?.encrypted_api_key
    ? 'database'
    : (getEnv(config.envName) ? 'environment' : 'missing');
  const apiKey = result.rows[0]?.encrypted_api_key
    ? decryptSecret(result.rows[0].encrypted_api_key)
    : getEnv(config.envName);

  if (!apiKey) {
    return {
      ok: false,
      provider,
      source,
      message: `${config.label} API key is not configured.`,
      error: 'missing_api_key',
    };
  }

  let response: Response;
  try {
    response = provider === 'openai'
      ? await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      : await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
  } catch (error: any) {
    return {
      ok: false,
      provider,
      source,
      message: `${config.label} API key validation could not reach the provider.`,
      error: error?.message || 'provider_unreachable',
    };
  }

  if (response.ok) {
    return {
      ok: true,
      provider,
      source,
      message: `${config.label} API key is valid.`,
    };
  }

  const responseText = await response.text().catch(() => '');
  const payload = responseText ? safeJsonParse(responseText) : {};
  const providerError = payload?.error || {};
  const errorCode = providerError.code || providerError.type || `provider_status_${response.status}`;
  return {
    ok: false,
    provider,
    source,
    message: providerError.message || responseText || `${config.label} API key validation failed with status ${response.status}.`,
    error: errorCode,
  };
}

function safeJsonParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
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

async function assertCanChangeAdminAccess(
  id: string,
  nextRole: 'admin' | 'user',
  nextIsEnabled?: boolean
): Promise<void> {
  const targetResult = await query<{ role: string; is_enabled: boolean }>(
    'SELECT role, is_enabled FROM app_profiles WHERE id = $1',
    [id]
  );
  const target = targetResult.rows[0];
  if (!target) return;

  const willBeEnabled = nextIsEnabled ?? target.is_enabled !== false;
  const removesEnabledAdmin = target.role === 'admin' && target.is_enabled !== false && (nextRole !== 'admin' || !willBeEnabled);
  if (!removesEnabledAdmin) return;

  const adminCount = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM app_profiles WHERE role = 'admin' AND is_enabled = true"
  );
  if (Number(adminCount.rows[0]?.count || 0) <= 1) {
    throw Object.assign(new Error('At least one enabled admin account is required'), {
      status: 400,
      code: 'last_enabled_admin_required',
    });
  }
}

async function assertCanDeleteUser(id: string): Promise<void> {
  const targetResult = await query<{ role: string; is_enabled: boolean }>(
    'SELECT role, is_enabled FROM app_profiles WHERE id = $1',
    [id]
  );
  const target = targetResult.rows[0];
  if (target?.role !== 'admin' || target.is_enabled === false) return;

  const adminCount = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM app_profiles WHERE role = 'admin' AND is_enabled = true"
  );
  if (Number(adminCount.rows[0]?.count || 0) <= 1) {
    throw Object.assign(new Error('At least one enabled admin account is required'), {
      status: 400,
      code: 'last_enabled_admin_required',
    });
  }
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

function stripMarkdownCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:powershell|ps1|pwsh)?\s*\n([\s\S]*?)\n```$/i);
  return (match ? match[1] : trimmed).trim();
}

function toAgentAnalysisResult(analysis: any) {
  const commandDetails = Array.isArray(analysis.command_details)
    ? analysis.command_details.reduce((acc: Record<string, any>, command: any) => {
        const name = String(command?.name || '').trim();
        if (!name) return acc;
        acc[name] = {
          description: String(command?.description || command?.purpose || ''),
          parameters: Array.isArray(command?.parameters) ? command.parameters : [],
        };
        return acc;
      }, {})
    : {};

  return {
    purpose: String(analysis.purpose || ''),
    securityScore: scoreToPercent(analysis.security_score ?? analysis.securityScore),
    codeQualityScore: scoreToPercent(analysis.quality_score ?? analysis.qualityScore),
    riskScore: scoreToPercent(analysis.risk_score ?? analysis.riskScore),
    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
    commandDetails,
    msDocsReferences: [],
    examples: [],
    rawAnalysis: JSON.stringify(analysis),
  };
}

function scoreToPercent(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  const percent = score <= 10 ? score * 10 : score;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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
    isEnabled: user.is_enabled !== false,
    authProvider: user.auth_provider || 'password',
    approvedAt: user.approved_at || null,
    approvedBy: user.approved_by || null,
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
    isEnabled: profile.is_enabled !== false,
    authProvider: profile.auth_provider || authUser?.app_metadata?.provider || 'password',
    approvedAt: profile.approved_at || null,
    approvedBy: profile.approved_by || null,
    lastLoginAt: authUser?.last_sign_in_at || null,
    createdAt: profile.created_at || authUser?.created_at || new Date().toISOString(),
    updatedAt: profile.updated_at,
  };
}

function toFrontendScript(row: any) {
  const isTestData = Boolean(row.is_test_data) || /^(e2e script|smoke upload|codex lifecycle|test upload)/i.test(String(row.title || ''));
  const lifecycleStatus = row.deleted_at
    ? 'deleted'
    : row.archived_at
      ? 'archived'
      : row.review_status === 'approved'
        ? 'approved'
        : row.analysis_quality_score != null || row.analysis_security_score != null || row.analysis_risk_score != null
          ? 'analyzed'
          : 'uploaded';
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
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archiveReason: row.archive_reason,
    reviewStatus: row.review_status || 'draft',
    isTestData,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    lifecycleStatus,
    category: row.category_name ? { id: row.category_id, name: row.category_name } : null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    user: row.author_username ? { id: row.user_id, username: row.author_username } : null,
    analysis: row.analysis_quality_score == null && row.analysis_security_score == null && row.analysis_risk_score == null
      ? null
      : {
          quality_score: row.analysis_quality_score,
          qualityScore: row.analysis_quality_score,
          security_score: row.analysis_security_score,
          securityScore: row.analysis_security_score,
          risk_score: row.analysis_risk_score,
          riskScore: row.analysis_risk_score,
        },
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
    criteriaVersion: executionSummary.criteria_version || ANALYSIS_CRITERIA_VERSION,
    scriptVersion: row.script_version,
    fileHash: row.file_hash,
    analysisSource: row.analysis_source || 'ai',
    isCurrent: true,
    analysisCriteria: executionSummary.analysis_criteria || [],
    prioritizedFindings: executionSummary.prioritized_findings || [],
    remediationPlan: executionSummary.remediation_plan || [],
    testRecommendations: executionSummary.test_recommendations || [],
    confidence: executionSummary.confidence ?? null,
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

function buildAnalysisReportLines(script: any, analysis: any): string[] {
  const lines = [
    `# ${script.title} Analysis`,
    '',
    '**Report Type:** PSScript AI Readiness Report',
    `**Generated:** ${new Date().toISOString()}`,
    `**Criteria Version:** ${analysis.criteriaVersion || analysis.executionSummary?.criteria_version || ANALYSIS_CRITERIA_VERSION}`,
    `**Confidence:** ${analysis.confidence ?? analysis.executionSummary?.confidence ?? 'N/A'}`,
    '',
    '## Executive Summary',
    '',
    analysis.purpose || 'No summary available.',
    '',
    '## Scorecard',
    '',
    `**Quality:** ${analysis.qualityScore ?? analysis.codeQualityScore ?? 'N/A'}/10`,
    `**Security:** ${analysis.securityScore ?? 'N/A'}/10`,
    `**Risk:** ${analysis.riskScore ?? 'N/A'}/10`,
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
    '## Analysis Criteria',
    '',
    ...((analysis.analysisCriteria || analysis.executionSummary?.analysis_criteria || []).length
      ? (analysis.analysisCriteria || analysis.executionSummary?.analysis_criteria).map((criterion: any) =>
          `**${criterion.name || 'Criterion'}:** Weight ${criterion.weight ?? 'N/A'}; Score ${criterion.score ?? 'N/A'}/10. ${criterion.summary || ''}`
        )
      : ['- No criteria were provided.']),
    '',
    '## Prioritized Findings',
    '',
    ...((analysis.prioritizedFindings || analysis.executionSummary?.prioritized_findings || []).length
      ? (analysis.prioritizedFindings || analysis.executionSummary?.prioritized_findings).flatMap((finding: any) => [
          `### ${finding.id || 'Finding'}: ${finding.title || 'Finding'}`,
          '',
          `**Severity:** ${finding.severity || 'N/A'}`,
          `**Category:** ${finding.category || 'N/A'}`,
          `**Evidence:** ${finding.evidence || 'N/A'}`,
          `**Impact:** ${finding.impact || 'N/A'}`,
          `**Recommendation:** ${finding.recommendation || 'N/A'}`,
          '',
        ])
      : ['- No prioritized findings were provided.', '']),
    '## Remediation Plan',
    '',
    ...((analysis.remediationPlan || analysis.executionSummary?.remediation_plan || []).length
      ? (analysis.remediationPlan || analysis.executionSummary?.remediation_plan).map((item: any) =>
          `**${item.priority || 'Priority'}:** ${item.action || 'Action not provided'} (${item.effort || 'effort unknown'}). ${item.rationale || ''}`
        )
      : ['- No remediation plan was provided.']),
    '',
    '## Test Recommendations',
    '',
    ...((analysis.testRecommendations || analysis.executionSummary?.test_recommendations || []).length
      ? (analysis.testRecommendations || analysis.executionSummary?.test_recommendations).map((item: string) => `- ${item}`)
      : ['- No test recommendations were provided.']),
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
          `**Purpose:** ${command.purpose || 'N/A'}`,
          `**Beginner explanation:** ${command.beginner_explanation || command.beginnerExplanation || 'N/A'}`,
          `**Management impact:** ${command.management_impact || command.managementImpact || 'N/A'}`,
          `**Example:** ${command.example || 'N/A'}`,
          '',
        ])
      : ['No key command breakdown was provided.', '']),
  ];

  return lines;
}

function exportAnalysisPdf(script: any, analysis: any): Response {
  const fileName = `${String(script.title || 'script-analysis').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'script-analysis'}-analysis.pdf`;
  const pdf = createTextPdf(buildAnalysisReportLines(script, analysis));

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(pdf.byteLength),
    },
  });
}

function createTextPdf(lines: string[]): Uint8Array {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const wrappedLines = lines.flatMap(line => wrapPdfLine(line, 92));
  const pages: PdfStyledLine[][] = [];
  let currentPage: PdfStyledLine[] = [];
  let remainingHeight = pageHeight - margin * 2;

  wrappedLines.forEach((line) => {
    const styledLine = stylePdfLine(line);
    const lineHeight = styledLine.leading;
    if (currentPage.length > 0 && remainingHeight < lineHeight) {
      pages.push(currentPage);
      currentPage = [];
      remainingHeight = pageHeight - margin * 2;
    }
    currentPage.push(styledLine);
    remainingHeight -= lineHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }
  if (pages.length === 0) pages.push([stylePdfLine('No report content was generated.')]);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const stream = buildPdfTextStream(pageLines, margin, pageHeight - margin);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(body, 'latin1'));
}

type PdfStyledLine = {
  text: string;
  font: 'F1' | 'F2';
  fontSize: number;
  leading: number;
};

function stylePdfLine(line: string): PdfStyledLine {
  const normalized = String(line ?? '');
  if (normalized.startsWith('# ')) {
    return { text: normalized.slice(2), font: 'F2', fontSize: 18, leading: 26 };
  }
  if (normalized.startsWith('## ')) {
    return { text: normalized.slice(3), font: 'F2', fontSize: 13, leading: 21 };
  }
  if (normalized.startsWith('### ')) {
    return { text: normalized.slice(4), font: 'F2', fontSize: 11, leading: 17 };
  }
  if (/^\*\*[^*]+:\*\*/.test(normalized)) {
    return { text: normalized.replace(/\*\*/g, ''), font: 'F2', fontSize: 10, leading: 15 };
  }
  return { text: normalized.replace(/\*\*/g, ''), font: 'F1', fontSize: 10, leading: 14 };
}

function buildPdfTextStream(lines: PdfStyledLine[], x: number, y: number): string {
  let cursorY = y;
  const textLines = lines.map((line, index) => {
    if (index > 0) {
      cursorY -= line.leading;
    }
    return `/${line.font} ${line.fontSize} Tf\n${x} ${cursorY} Td\n(${escapePdfText(line.text)}) Tj\n1 0 0 1 0 0 Tm`;
  });
  return `BT\n${textLines.join('\n')}\nET`;
}

function wrapPdfLine(line: string, maxChars: number): string[] {
  const normalized = String(line ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
  if (!normalized) return [''];

  const result: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const breakAt = remaining.lastIndexOf(' ', maxChars);
    const cutAt = breakAt > 20 ? breakAt : maxChars;
    result.push(remaining.slice(0, cutAt));
    remaining = remaining.slice(cutAt).trimStart();
  }
  result.push(remaining);
  return result;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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
