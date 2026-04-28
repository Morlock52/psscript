const SUPABASE_HOST_SUFFIXES = ['.supabase.co', '.supabase.com'];

function parseDatabaseUrl(databaseUrl) {
  try {
    return new URL(databaseUrl);
  } catch (_error) {
    return null;
  }
}

function isHostedSupabaseDatabaseUrl(databaseUrl) {
  const url = parseDatabaseUrl(databaseUrl);
  if (!url) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return SUPABASE_HOST_SUFFIXES.some(suffix => host.endsWith(suffix));
}

function assertHostedSupabaseDatabaseUrl(databaseUrl = process.env.DATABASE_URL, label = 'DATABASE_URL') {
  if (!databaseUrl) {
    console.error(`${label} is required and must point at hosted Supabase Postgres.`);
    process.exit(1);
  }

  if (!isHostedSupabaseDatabaseUrl(databaseUrl)) {
    console.error(`${label} must point at hosted Supabase Postgres. Refusing to use a local or non-Supabase database.`);
    process.exit(1);
  }
}

function databaseUrlRequestsSSL(databaseUrl) {
  const url = parseDatabaseUrl(databaseUrl);
  if (!url) {
    return false;
  }

  const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
  return ['require', 'verify-ca', 'verify-full'].includes(sslMode) || isHostedSupabaseDatabaseUrl(databaseUrl);
}

function pgConnectionConfig(databaseUrl = process.env.DATABASE_URL) {
  assertHostedSupabaseDatabaseUrl(databaseUrl);
  return {
    connectionString: databaseUrl,
    ssl: databaseUrlRequestsSSL(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  };
}

function sequelizeConnection(databaseUrl = process.env.DATABASE_URL, logging = false) {
  assertHostedSupabaseDatabaseUrl(databaseUrl);
  return {
    databaseUrl,
    options: {
      dialect: 'postgres',
      logging,
      dialectOptions: databaseUrlRequestsSSL(databaseUrl)
        ? { ssl: { rejectUnauthorized: false } }
        : undefined,
    },
  };
}

module.exports = {
  assertHostedSupabaseDatabaseUrl,
  databaseUrlRequestsSSL,
  isHostedSupabaseDatabaseUrl,
  pgConnectionConfig,
  sequelizeConnection,
};
