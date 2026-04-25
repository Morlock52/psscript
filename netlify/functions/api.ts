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
    security_score: { type: 'number', minimum: 0, maximum: 10 },
    quality_score: { type: 'number', minimum: 0, maximum: 10 },
    risk_score: { type: 'number', minimum: 0, maximum: 10 },
    suggestions: { type: 'array', items: { type: 'string' } },
    security_issues: { type: 'array', items: { type: 'string' } },
    best_practice_violations: { type: 'array', items: { type: 'string' } },
    performance_insights: { type: 'array', items: { type: 'string' } },
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
    const err = error as Error & { status?: number; code?: string };
    console.error('[netlify-api]', context.requestId, err);
    return json({
      success: false,
      error: err.code || 'hosted_api_error',
      message: err.message || 'Hosted API error',
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
  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

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
      message: 'Hosted documentation crawling is not available in the Netlify v1 API. Import documentation manually or use the bulk endpoint.',
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

  return json({ success: true, script, message: 'Script uploaded and saved successfully' }, { status: 201 });
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
  const result = await query(
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
        content: 'You are a senior PowerShell security reviewer. Return only the requested analysis fields for the supplied script.',
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
    security_score: Number(parsed.security_score ?? parsed.securityScore ?? 7),
    quality_score: Number(parsed.quality_score ?? parsed.qualityScore ?? 7),
    risk_score: Number(parsed.risk_score ?? parsed.riskScore ?? 3),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    security_issues: Array.isArray(parsed.security_issues) ? parsed.security_issues : [],
    best_practice_violations: Array.isArray(parsed.best_practice_violations) ? parsed.best_practice_violations : [],
    performance_insights: Array.isArray(parsed.performance_insights) ? parsed.performance_insights : [],
  };
}

async function saveAnalysis(scriptId: number, analysis: any) {
  const result = await query(
    `
      INSERT INTO script_analysis (
        script_id, purpose, security_score, quality_score, risk_score,
        suggestions, security_issues, best_practice_violations, performance_insights
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
      ON CONFLICT (script_id) DO UPDATE
      SET purpose = EXCLUDED.purpose,
          security_score = EXCLUDED.security_score,
          quality_score = EXCLUDED.quality_score,
          risk_score = EXCLUDED.risk_score,
          suggestions = EXCLUDED.suggestions,
          security_issues = EXCLUDED.security_issues,
          best_practice_violations = EXCLUDED.best_practice_violations,
          performance_insights = EXCLUDED.performance_insights,
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
      JSON.stringify(analysis.security_issues || []),
      JSON.stringify(analysis.best_practice_violations || []),
      JSON.stringify(analysis.performance_insights || []),
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
        max_output_tokens: Number(getEnv('OPENAI_ANALYSIS_MAX_OUTPUT_TOKENS', '1800')),
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
  return {
    ...row,
    scriptId: row.script_id,
    securityScore: row.security_score,
    qualityScore: row.quality_score,
    riskScore: row.risk_score,
    parameterDocs: row.parameter_docs,
    securityIssues: row.security_issues,
    bestPracticeViolations: row.best_practice_violations,
    performanceInsights: row.performance_insights,
    potentialRisks: row.potential_risks,
    codeComplexityMetrics: row.code_complexity_metrics,
    compatibilityNotes: row.compatibility_notes,
    executionSummary: row.execution_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
