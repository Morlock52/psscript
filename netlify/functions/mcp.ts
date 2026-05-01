import type { Config, Context } from '@netlify/functions';
import { getBearerUser } from './_shared/auth';
import { getEnv } from './_shared/env';
import { json } from './_shared/http';

export const config: Config = {
  path: [
    '/mcp',
    '/.well-known/mcp/server.json',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
  ],
};

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, any>;
};
type ToolScope =
  | 'scripts:read'
  | 'scripts:write'
  | 'scripts:admin'
  | 'docs:read'
  | 'docs:write'
  | 'analytics:read'
  | 'ai:use'
  | 'admin:manage';
type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, any>;
  annotations?: Record<string, any>;
  scopes: ToolScope[];
  adminOnly?: boolean;
  destructive?: boolean;
};

const MCP_PROTOCOL_VERSION = '2025-06-18';

const emptyObjectSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

const tools: ToolDefinition[] = [
  {
    name: 'psscript.list_scripts',
    title: 'List scripts',
    description: 'List scripts visible to the authenticated user.',
    scopes: ['scripts:read'],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        includeArchived: { type: 'boolean' },
        includeTestData: { type: 'boolean' },
      },
    },
  },
  {
    name: 'psscript.get_script',
    title: 'Get script',
    description: 'Fetch one script, including metadata and content, if visible to the authenticated user.',
    scopes: ['scripts:read'],
    inputSchema: requiredObject({ id: { type: ['integer', 'string'], description: 'Script id.' } }, ['id']),
  },
  {
    name: 'psscript.search_scripts',
    title: 'Search scripts',
    description: 'Search scripts by text, category, tags, ownership, and sort order.',
    scopes: ['scripts:read'],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        q: { type: 'string' },
        categoryId: { type: ['integer', 'string', 'null'] },
        tags: { type: 'array', items: { type: 'string' } },
        mine: { type: 'boolean' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0 },
        sort: { type: 'string', enum: ['relevance', 'updated', 'created', 'name', 'quality', 'executions'] },
        includeArchived: { type: 'boolean' },
        includeTestData: { type: 'boolean' },
      },
    },
  },
  {
    name: 'psscript.get_script_analysis',
    title: 'Get script analysis',
    description: 'Fetch the saved AI/static analysis for a script.',
    scopes: ['scripts:read'],
    inputSchema: requiredObject({ id: { type: ['integer', 'string'] } }, ['id']),
  },
  {
    name: 'psscript.find_similar_scripts',
    title: 'Find similar scripts',
    description: 'Find semantically similar scripts using the hosted search/similarity path.',
    scopes: ['scripts:read'],
    inputSchema: requiredObject({
      id: { type: ['integer', 'string'] },
      limit: { type: 'integer', minimum: 1, maximum: 20 },
    }, ['id']),
  },
  {
    name: 'psscript.list_categories',
    title: 'List categories',
    description: 'List script categories.',
    scopes: ['scripts:read'],
    inputSchema: emptyObjectSchema,
  },
  {
    name: 'psscript.list_tags',
    title: 'List tags',
    description: 'List available script tags.',
    scopes: ['scripts:read'],
    inputSchema: { type: 'object', additionalProperties: false, properties: { includeSystem: { type: 'boolean' } } },
  },
  {
    name: 'psscript.search_documentation',
    title: 'Search documentation',
    description: 'Search documentation items.',
    scopes: ['docs:read'],
    inputSchema: requiredObject({
      query: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      offset: { type: 'integer', minimum: 0 },
    }, ['query']),
  },
  {
    name: 'psscript.get_dashboard',
    title: 'Get dashboard',
    description: 'Fetch dashboard analytics for visible scripts and current activity.',
    scopes: ['analytics:read'],
    inputSchema: emptyObjectSchema,
  },
  {
    name: 'psscript.get_ai_analytics',
    title: 'Get AI analytics',
    description: 'Fetch hosted AI usage, latency, model, endpoint, and cost analytics.',
    scopes: ['analytics:read'],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
      },
    },
  },
  {
    name: 'psscript.create_script',
    title: 'Create script',
    description: 'Create a script using the same hosted route as the app.',
    scopes: ['scripts:write'],
    inputSchema: scriptWriteSchema(['title', 'content']),
  },
  {
    name: 'psscript.update_script_details',
    title: 'Update script details',
    description: 'Admin-only script metadata/content update. Content changes preserve version history through the app route.',
    scopes: ['scripts:write', 'scripts:admin'],
    adminOnly: true,
    inputSchema: requiredObject({
      id: { type: ['integer', 'string'] },
      title: { type: 'string' },
      description: { type: 'string' },
      categoryId: { type: ['integer', 'null'] },
      isPublic: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      content: { type: 'string' },
      commitMessage: { type: 'string' },
    }, ['id']),
  },
  {
    name: 'psscript.upload_script_text',
    title: 'Upload script text',
    description: 'Create a new script from text content.',
    scopes: ['scripts:write'],
    inputSchema: scriptWriteSchema(['title', 'content']),
  },
  {
    name: 'psscript.analyze_script',
    title: 'Analyze script',
    description: 'Analyze a saved script by id, or analyze ad hoc PowerShell content.',
    scopes: ['scripts:write', 'ai:use'],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: ['integer', 'string'] },
        title: { type: 'string' },
        content: { type: 'string' },
      },
      anyOf: [{ required: ['id'] }, { required: ['content'] }],
    },
  },
  {
    name: 'psscript.generate_script',
    title: 'Generate script',
    description: 'Generate PowerShell script content from a natural-language description.',
    scopes: ['ai:use'],
    inputSchema: requiredObject({ description: { type: 'string', minLength: 1 } }, ['description']),
  },
  {
    name: 'psscript.explain_script',
    title: 'Explain script',
    description: 'Explain or security-review PowerShell content.',
    scopes: ['ai:use'],
    inputSchema: requiredObject({
      content: { type: 'string', minLength: 1 },
      type: { type: 'string', enum: ['simple', 'detailed', 'security'] },
    }, ['content']),
  },
  {
    name: 'psscript.create_documentation',
    title: 'Create documentation',
    description: 'Admin-only documentation creation.',
    scopes: ['docs:write'],
    adminOnly: true,
    inputSchema: documentationSchema(['title', 'content']),
  },
  {
    name: 'psscript.update_documentation',
    title: 'Update documentation',
    description: 'Admin-only documentation update.',
    scopes: ['docs:write'],
    adminOnly: true,
    inputSchema: requiredObject({ id: { type: ['integer', 'string'] }, ...documentationFields() }, ['id', 'title', 'content']),
  },
  {
    name: 'psscript.archive_script',
    title: 'Archive script',
    description: 'Archive a script. Requires explicit confirmation.',
    scopes: ['scripts:admin'],
    adminOnly: true,
    destructive: true,
    inputSchema: confirmedSchema({ id: { type: ['integer', 'string'] }, reason: { type: 'string' } }, ['id']),
  },
  {
    name: 'psscript.restore_script',
    title: 'Restore script',
    description: 'Restore an archived script. Requires explicit confirmation.',
    scopes: ['scripts:admin'],
    adminOnly: true,
    destructive: true,
    inputSchema: confirmedSchema({ id: { type: ['integer', 'string'] } }, ['id']),
  },
  {
    name: 'psscript.delete_script',
    title: 'Delete script',
    description: 'Soft-delete or hard-delete a script through the hosted app route. Requires explicit confirmation.',
    scopes: ['scripts:admin'],
    adminOnly: true,
    destructive: true,
    inputSchema: confirmedSchema({
      id: { type: ['integer', 'string'] },
      mode: { type: 'string', enum: ['archive', 'delete'] },
    }, ['id']),
  },
  {
    name: 'psscript.bulk_delete_scripts',
    title: 'Bulk delete scripts',
    description: 'Archive or delete multiple scripts. Requires explicit confirmation.',
    scopes: ['scripts:admin'],
    adminOnly: true,
    destructive: true,
    inputSchema: confirmedSchema({
      ids: { type: 'array', items: { type: ['integer', 'string'] }, minItems: 1 },
      mode: { type: 'string', enum: ['archive', 'delete'] },
      reason: { type: 'string' },
    }, ['ids']),
  },
  {
    name: 'psscript.bulk_import_documentation',
    title: 'Bulk import documentation',
    description: 'Admin-only bulk documentation import.',
    scopes: ['docs:write'],
    adminOnly: true,
    inputSchema: requiredObject({
      documents: {
        type: 'array',
        minItems: 1,
        items: documentationSchema(['title', 'content']),
      },
    }, ['documents']),
  },
  {
    name: 'psscript.manage_user',
    title: 'Manage user',
    description: 'Admin-only user management. Delete/disable actions require explicit confirmation.',
    scopes: ['admin:manage'],
    adminOnly: true,
    inputSchema: requiredObject({
      action: { type: 'string', enum: ['list', 'create', 'update', 'delete', 'reset_password'] },
      id: { type: 'string' },
      email: { type: 'string' },
      username: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', enum: ['admin', 'user'] },
      isEnabled: { type: 'boolean' },
      confirm: { type: 'boolean' },
    }, ['action']),
  },
  {
    name: 'psscript.create_db_backup',
    title: 'Create database backup',
    description: 'Admin-only hosted database backup.',
    scopes: ['admin:manage'],
    adminOnly: true,
    inputSchema: { type: 'object', additionalProperties: false, properties: { filename: { type: 'string' } } },
  },
  {
    name: 'psscript.restore_db_backup',
    title: 'Restore database backup',
    description: 'Admin-only hosted database restore. Requires explicit confirmation.',
    scopes: ['admin:manage'],
    adminOnly: true,
    destructive: true,
    inputSchema: confirmedSchema({
      filename: { type: 'string' },
      confirmText: { type: 'string', const: 'RESTORE BACKUP' },
    }, ['filename', 'confirmText']),
  },
];

const toolsByName = new Map(tools.map(tool => [tool.name, tool]));

export default async function handleMcp(req: Request, context: Context): Promise<Response> {
  try {
    const url = new URL(req.url);
    if (url.pathname === '/.well-known/mcp/server.json') return mcpServerMetadata(req);
    if (url.pathname === '/.well-known/oauth-protected-resource') return oauthProtectedResourceMetadata(req);
    if (url.pathname === '/.well-known/oauth-authorization-server') return oauthAuthorizationServerMetadata(req);

    if (req.method === 'GET') {
      return json({
        name: 'psscript-mcp',
        title: 'PSScript MCP',
        description: 'Remote MCP server for PSScript scripts, documentation, analytics, AI tools, and admin workflows.',
        protocolVersion: MCP_PROTOCOL_VERSION,
        transport: 'streamable-http',
        tools: tools.map(toPublicTool),
      });
    }

    if (req.method !== 'POST') {
      return json({ error: 'method_not_allowed', message: 'MCP endpoint expects POST JSON-RPC requests.' }, { status: 405 });
    }

    const payload = await req.json().catch(() => null);
    if (Array.isArray(payload)) {
      const responses = await Promise.all(payload.map(message => handleJsonRpc(req, message)));
      return json(responses.filter(Boolean));
    }

    const response = await handleJsonRpc(req, payload);
    return response ? json(response) : new Response(null, { status: 202 });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    console.error('[mcp]', context.requestId, err);
    return json(rpcError(null, err.status === 401 ? -32001 : -32603, err.message || 'MCP request failed', err.code), {
      status: err.status || 500,
    });
  }
}

async function handleJsonRpc(req: Request, message: unknown) {
  const rpc = message as JsonRpcRequest | null;
  const id = rpc?.id ?? null;
  if (!rpc || rpc.jsonrpc !== '2.0' || !rpc.method) {
    return rpcError(id, -32600, 'Invalid JSON-RPC request');
  }

  if (rpc.method === 'notifications/initialized') return null;
  if (rpc.method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
      serverInfo: { name: 'psscript-mcp', version: '0.1.0' },
      instructions: 'Use PSScript tools to manage PowerShell scripts, documentation, analytics, and admin workflows. Destructive tools require explicit confirmation.',
    });
  }

  if (rpc.method === 'ping') return rpcResult(id, {});
  if (rpc.method === 'resources/list') return rpcResult(id, { resources: [] });
  if (rpc.method === 'prompts/list') return rpcResult(id, { prompts: [] });

  const user = await getBearerUser(req);
  if (!user) return rpcError(id, -32001, 'Authentication required', 'missing_or_invalid_token');

  if (rpc.method === 'tools/list') {
    return rpcResult(id, { tools: tools.map(toPublicTool) });
  }

  if (rpc.method === 'tools/call') {
    const name = String(rpc.params?.name || '');
    const tool = toolsByName.get(name);
    if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`, 'unknown_tool');
    if (tool.adminOnly && user.role !== 'admin') return rpcError(id, -32003, 'Admin role required', 'admin_required');
    const args = rpc.params?.arguments && typeof rpc.params.arguments === 'object' ? rpc.params.arguments : {};
    if (tool.destructive && args.confirm !== true) {
      return rpcError(id, -32004, 'Explicit confirmation is required for this destructive tool.', 'confirmation_required');
    }

    const result = await callTool(req, name, args);
    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    });
  }

  return rpcError(id, -32601, `Method not found: ${rpc.method}`);
}

async function callTool(req: Request, name: string, args: Record<string, any>) {
  switch (name) {
    case 'psscript.list_scripts':
      return apiRequest(req, 'GET', `/api/scripts?${toSearchParams({
        limit: args.limit,
        includeArchived: args.includeArchived,
        includeTestData: args.includeTestData,
      })}`);
    case 'psscript.get_script':
      return apiRequest(req, 'GET', `/api/scripts/${encodeURIComponent(String(args.id))}`);
    case 'psscript.search_scripts':
      return apiRequest(req, 'GET', `/api/scripts/search?${toSearchParams({
        q: args.q,
        categoryId: args.categoryId,
        tags: Array.isArray(args.tags) ? args.tags.join(',') : undefined,
        mine: args.mine,
        limit: args.limit,
        offset: args.offset,
        sort: args.sort,
        includeArchived: args.includeArchived,
        includeTestData: args.includeTestData,
      })}`);
    case 'psscript.get_script_analysis':
      return apiRequest(req, 'GET', `/api/scripts/${encodeURIComponent(String(args.id))}/analysis`);
    case 'psscript.find_similar_scripts':
      return apiRequest(req, 'GET', `/api/scripts/${encodeURIComponent(String(args.id))}/similar?${toSearchParams({ limit: args.limit })}`);
    case 'psscript.list_categories':
      return apiRequest(req, 'GET', '/api/categories');
    case 'psscript.list_tags':
      return apiRequest(req, 'GET', `/api/tags?${toSearchParams({ includeSystem: args.includeSystem })}`);
    case 'psscript.search_documentation':
      return apiRequest(req, 'GET', `/api/documentation/search?${toSearchParams({ query: args.query, limit: args.limit, offset: args.offset })}`);
    case 'psscript.get_dashboard':
      return apiRequest(req, 'GET', '/api/analytics/dashboard');
    case 'psscript.get_ai_analytics':
      return apiRequest(req, 'GET', `/api/analytics/ai?${toSearchParams({ startDate: args.startDate, endDate: args.endDate })}`);
    case 'psscript.create_script':
    case 'psscript.upload_script_text':
      return apiRequest(req, 'POST', '/api/scripts', normalizeScriptPayload(args));
    case 'psscript.update_script_details':
      return apiRequest(req, 'PUT', `/api/scripts/${encodeURIComponent(String(args.id))}`, normalizeScriptPayload(args));
    case 'psscript.analyze_script':
      return args.id
        ? apiRequest(req, 'POST', `/api/scripts/${encodeURIComponent(String(args.id))}/analyze`, {})
        : apiRequest(req, 'POST', '/api/scripts/analyze', { title: args.title, content: args.content });
    case 'psscript.generate_script':
      return apiRequest(req, 'POST', '/api/scripts/generate', { description: args.description });
    case 'psscript.explain_script':
      return apiRequest(req, 'POST', '/api/scripts/explain', { content: args.content, type: args.type || 'simple' });
    case 'psscript.create_documentation':
      return apiRequest(req, 'POST', '/api/documentation', normalizeDocumentationPayload(args));
    case 'psscript.update_documentation':
      return apiRequest(req, 'PUT', `/api/documentation/${encodeURIComponent(String(args.id))}`, normalizeDocumentationPayload(args));
    case 'psscript.archive_script':
      return apiRequest(req, 'POST', `/api/scripts/${encodeURIComponent(String(args.id))}/archive`, { reason: args.reason || 'Archived from MCP' });
    case 'psscript.restore_script':
      return apiRequest(req, 'POST', `/api/scripts/${encodeURIComponent(String(args.id))}/restore`, {});
    case 'psscript.delete_script':
      return apiRequest(req, 'DELETE', `/api/scripts/${encodeURIComponent(String(args.id))}?${toSearchParams({ mode: args.mode || 'archive' })}`);
    case 'psscript.bulk_delete_scripts':
      return apiRequest(req, 'POST', '/api/scripts/delete', { ids: args.ids, mode: args.mode || 'archive', reason: args.reason || 'Bulk action from MCP' });
    case 'psscript.bulk_import_documentation':
      return apiRequest(req, 'POST', '/api/documentation/bulk', { documents: args.documents });
    case 'psscript.manage_user':
      return manageUser(req, args);
    case 'psscript.create_db_backup':
      return apiRequest(req, 'POST', '/api/admin/db/backup', { filename: args.filename });
    case 'psscript.restore_db_backup':
      return apiRequest(req, 'POST', '/api/admin/db/restore', { filename: args.filename, confirmText: args.confirmText });
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { status: 400, code: 'unknown_tool' });
  }
}

async function manageUser(req: Request, args: Record<string, any>) {
  if (args.action === 'list') return apiRequest(req, 'GET', '/api/users');
  if (args.action === 'create') {
    return apiRequest(req, 'POST', '/api/users', {
      email: args.email,
      username: args.username,
      password: args.password,
      role: args.role,
    });
  }
  if (args.action === 'update') {
    if (args.isEnabled === false && args.confirm !== true) {
      throw Object.assign(new Error('Disabling users requires confirmation.'), { status: 400, code: 'confirmation_required' });
    }
    return apiRequest(req, 'PUT', `/api/users/${encodeURIComponent(String(args.id))}`, {
      email: args.email,
      username: args.username,
      password: args.password,
      role: args.role,
      isEnabled: args.isEnabled,
    });
  }
  if (args.action === 'delete') {
    if (args.confirm !== true) {
      throw Object.assign(new Error('Deleting users requires confirmation.'), { status: 400, code: 'confirmation_required' });
    }
    return apiRequest(req, 'DELETE', `/api/users/${encodeURIComponent(String(args.id))}`);
  }
  if (args.action === 'reset_password') {
    if (args.confirm !== true) {
      throw Object.assign(new Error('Resetting passwords requires confirmation.'), { status: 400, code: 'confirmation_required' });
    }
    return apiRequest(req, 'POST', `/api/users/${encodeURIComponent(String(args.id))}/reset-password`, { password: args.password });
  }
  throw Object.assign(new Error('Unsupported user action'), { status: 400, code: 'unsupported_user_action' });
}

async function apiRequest(req: Request, method: string, path: string, body?: unknown) {
  const response = await fetch(new URL(path, req.url), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(req.headers.get('authorization') ? { Authorization: req.headers.get('authorization')! } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? parseJson(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `App route failed with HTTP ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status, code: data?.error || 'app_route_failed' });
  }
  return data;
}

function normalizeScriptPayload(args: Record<string, any>) {
  return {
    title: args.title,
    description: args.description,
    content: args.content,
    categoryId: args.categoryId,
    isPublic: args.isPublic,
    tags: args.tags,
    commitMessage: args.commitMessage,
  };
}

function normalizeDocumentationPayload(args: Record<string, any>) {
  return {
    title: args.title,
    url: args.url,
    content: args.content,
    source: args.source || 'manual',
    tags: args.tags,
  };
}

function toSearchParams(input: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

function toPublicTool(tool: ToolDefinition) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      readOnlyHint: !tool.scopes.some(scope => scope.endsWith(':write') || scope.endsWith(':admin') || scope === 'admin:manage'),
      destructiveHint: Boolean(tool.destructive),
      openWorldHint: false,
      scopes: tool.scopes,
      adminOnly: Boolean(tool.adminOnly),
      ...tool.annotations,
    },
  };
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string, errorCode?: string) {
  return { jsonrpc: '2.0', id, error: { code, message, data: errorCode ? { code: errorCode } : undefined } };
}

function requiredObject(properties: Record<string, any>, required: string[]) {
  return { type: 'object', additionalProperties: false, required, properties };
}

function confirmedSchema(properties: Record<string, any>, required: string[]) {
  return requiredObject({ ...properties, confirm: { type: 'boolean', const: true } }, [...required, 'confirm']);
}

function documentationFields() {
  return {
    title: { type: 'string', minLength: 2, maxLength: 500 },
    url: { type: ['string', 'null'] },
    content: { type: 'string', minLength: 1 },
    source: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 24 },
  };
}

function documentationSchema(required: string[]) {
  return requiredObject(documentationFields(), required);
}

function scriptWriteSchema(required: string[]) {
  return requiredObject({
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    content: { type: 'string', minLength: 1 },
    categoryId: { type: ['integer', 'null'] },
    isPublic: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
  }, required);
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function mcpServerMetadata(req: Request): Response {
  const origin = new URL(req.url).origin;
  return json({
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    name: 'com.morloksmaze/psscript',
    title: 'PSScript',
    description: 'Remote MCP server for PSScript PowerShell script management.',
    version: '0.1.0',
    remotes: [{ type: 'streamable-http', url: `${origin}/mcp` }],
  });
}

function oauthProtectedResourceMetadata(req: Request): Response {
  const origin = new URL(req.url).origin;
  return json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: Array.from(new Set(tools.flatMap(tool => tool.scopes))),
  });
}

function oauthAuthorizationServerMetadata(req: Request): Response {
  const origin = new URL(req.url).origin;
  const supabaseUrl = getEnv('SUPABASE_URL').replace(/\/+$/, '');
  return json({
    issuer: origin,
    authorization_endpoint: supabaseUrl ? `${supabaseUrl}/auth/v1/authorize` : `${origin}/login`,
    token_endpoint: supabaseUrl ? `${supabaseUrl}/auth/v1/token` : `${origin}/api/auth/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: Array.from(new Set(tools.flatMap(tool => tool.scopes))),
    code_challenge_methods_supported: ['S256'],
  });
}
