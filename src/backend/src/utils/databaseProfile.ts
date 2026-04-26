import { DataTypes } from 'sequelize';

function databaseUrlHost(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return '';
  }

  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch (_error) {
    return '';
  }
}

export function isSupabaseDatabase(): boolean {
  const explicitProfile = process.env.DB_PROFILE?.toLowerCase();
  if (explicitProfile) {
    return explicitProfile === 'supabase';
  }

  const host = databaseUrlHost();
  return (
    Boolean(process.env.SUPABASE_URL) ||
    host.endsWith('.supabase.co') ||
    host.endsWith('.pooler.supabase.com')
  );
}

export function getUserTableName(): string {
  return isSupabaseDatabase() ? 'app_profiles' : 'users';
}

export function getUserIdDataType() {
  return isSupabaseDatabase() ? DataTypes.UUID : DataTypes.INTEGER;
}
