import { query } from './db';
import { getEnv, requireEnv } from './env';

export interface HostedUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export async function getBearerUser(req: Request): Promise<HostedUser | null> {
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
  return profile;
}

export async function requireUser(req: Request): Promise<HostedUser> {
  const user = await getBearerUser(req);
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

  const result = await query<HostedUser>(
    `
      INSERT INTO app_profiles (id, email, username, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          username = COALESCE(NULLIF(app_profiles.username, ''), EXCLUDED.username),
          updated_at = now()
      RETURNING id, email, username, role
    `,
    [user.id, email, username, defaultRole]
  );

  return result.rows[0];
}
