import { query } from './db';
import { getEnv, requireEnv } from './env';

export interface HostedUser {
  id: string;
  email: string;
  username: string;
  role: string;
  is_enabled: boolean;
  auth_provider: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
}

interface BearerUserOptions {
  allowDisabled?: boolean;
}

export async function getBearerUser(req: Request, options: BearerUserOptions = {}): Promise<HostedUser | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) {
    return null;
  }

  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!userResponse.ok) {
    return null;
  }

  const supabaseUser = await userResponse.json() as SupabaseUserResponse;
  const profile = await ensureProfile(supabaseUser);
  if (!profile.is_enabled && !options.allowDisabled) {
    throw Object.assign(new Error('Account is pending admin approval'), {
      status: 403,
      code: 'account_pending_approval',
    });
  }
  return profile;
}

export async function requireUser(req: Request): Promise<HostedUser> {
  const user = await getBearerUser(req);
  if (!user) {
    throw Object.assign(new Error('Authentication required'), { status: 401, code: 'missing_or_invalid_token' });
  }
  return user;
}

export async function requireUserAllowingDisabled(req: Request): Promise<HostedUser> {
  const user = await getBearerUser(req, { allowDisabled: true });
  if (!user) {
    throw Object.assign(new Error('Authentication required'), { status: 401, code: 'missing_or_invalid_token' });
  }
  return user;
}

export async function requireAdmin(req: Request): Promise<HostedUser> {
  const user = await requireUser(req);
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Admin role required'), { status: 403, code: 'admin_required' });
  }
  return user;
}

async function ensureProfile(user: SupabaseUserResponse): Promise<HostedUser> {
  const email = user.email || '';
  const metadataUsername = typeof user.user_metadata?.username === 'string'
    ? user.user_metadata.username
    : '';
  const username = metadataUsername || email.split('@')[0] || 'user';
  const defaultAdminEmail = getEnv('DEFAULT_ADMIN_EMAIL');
  const defaultRole = defaultAdminEmail && email.toLowerCase() === defaultAdminEmail.toLowerCase()
    ? 'admin'
    : 'user';
  const authProvider = normalizeAuthProvider(user);
  const isEnabled = defaultRole === 'admin' || authProvider !== 'google';

  const result = await query<HostedUser>(
    `
      INSERT INTO app_profiles (id, email, username, role, is_enabled, auth_provider, approved_at)
      VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 THEN now() ELSE NULL END)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          username = COALESCE(NULLIF(app_profiles.username, ''), EXCLUDED.username),
          auth_provider = COALESCE(NULLIF(app_profiles.auth_provider, ''), EXCLUDED.auth_provider),
          role = CASE
            WHEN app_profiles.role = 'admin' THEN app_profiles.role
            WHEN EXCLUDED.role = 'admin' THEN EXCLUDED.role
            ELSE app_profiles.role
          END,
          updated_at = now()
      RETURNING id, email, username, role, is_enabled, auth_provider, approved_at, approved_by
    `,
    [user.id, email, username, defaultRole, isEnabled, authProvider]
  );

  return result.rows[0];
}

function normalizeAuthProvider(user: SupabaseUserResponse): 'google' | 'password' {
  const providers: unknown[] = [
    user.app_metadata?.provider,
    ...(Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [user.app_metadata?.providers]),
    ...(Array.isArray(user.identities) ? user.identities.map(identity => identity.provider) : []),
  ];

  return providers.some(provider => String(provider || '').toLowerCase() === 'google')
    ? 'google'
    : 'password';
}
