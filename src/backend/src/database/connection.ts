/**
 * Database Connection Manager
 * 
 * This module handles PostgreSQL database connections with Sequelize ORM.
 * Features:
 * - Connection pooling
 * - Automatic reconnection with exponential backoff
 * - Hosted Supabase connection mode
 * - Health checks and connection validation
 */

import { Sequelize, Options, QueryTypes } from 'sequelize';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import {
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  databaseSslEnabled,
} from '../utils/envValidation';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'database.log'),
      dirname: path.join(process.cwd(), 'logs'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  ]
});

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

// Connection configuration
const MAX_CONNECTION_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const CONNECTION_TIMEOUT_MS = 15000;
const POOL_MAX = 10;
const POOL_MIN = 0;
const POOL_ACQUIRE_TIMEOUT_MS = 30000;
const POOL_IDLE_TIMEOUT_MS = 10000;

function parseIntegerEnv(names: string[], fallback: number, minimum = 0): number {
  const value = names.map((name) => process.env[name]).find(Boolean);

  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function getConnectionTimeoutMs(): number {
  return parseIntegerEnv(['DB_CONNECTION_TIMEOUT_MS'], CONNECTION_TIMEOUT_MS, 1);
}

function getPoolConfig() {
  return {
    max: parseIntegerEnv(['DB_POOL_MAX'], POOL_MAX, 1),
    min: parseIntegerEnv(['DB_POOL_MIN'], POOL_MIN, 0),
    acquire: parseIntegerEnv(['DB_POOL_ACQUIRE_MS', 'DB_POOL_ACQUIRE'], POOL_ACQUIRE_TIMEOUT_MS, 1),
    idle: parseIntegerEnv(['DB_POOL_IDLE_MS', 'DB_POOL_IDLE'], POOL_IDLE_TIMEOUT_MS, 1),
  };
}

function isHostedSupabaseDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) {
    return false;
  }

  try {
    const url = new URL(databaseUrl);
    const host = url.hostname.toLowerCase();
    return host.endsWith('.supabase.co') || host.endsWith('.supabase.com');
  } catch (_error) {
    return false;
  }
}

// Error type definitions for better error handling
enum ConnectionErrorType {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RESOURCE = 'resource',
  UNKNOWN = 'unknown'
}

interface DbErrorStats {
  [errorType: string]: number;
}

interface DbDiagnosticState {
  connected: boolean;
  retryCount: number;
  lastSuccessfulConnection: number | null;
  consecutiveFailures: number;
  lastError: Error | null;
  errorStats: DbErrorStats;
  tables: string[];
  tablesLastRefreshed: number | null;
}

const TABLE_REFRESH_INTERVAL_MS = 60_000;

const dbDiagnosticState: DbDiagnosticState = {
  connected: false,
  retryCount: 0,
  lastSuccessfulConnection: null,
  consecutiveFailures: 0,
  lastError: null,
  errorStats: {},
  tables: [],
  tablesLastRefreshed: null
};

/**
 * Determine the type of database connection error
 */
function getErrorType(error: any): ConnectionErrorType {
  if (!error) return ConnectionErrorType.UNKNOWN;
  
  // Extract error details
  const errorMessage = error.message || '';
  const errorCode = error.original?.code || '';
  
  // Authentication errors
  if (
    errorCode === '28P01' || // Invalid password
    errorCode === '28000' || // Invalid authorization
    errorMessage.includes('authentication failed')
  ) {
    return ConnectionErrorType.AUTHENTICATION;
  }
  
  // Network errors
  if (
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'EHOSTUNREACH' ||
    errorCode === 'ENETUNREACH' ||
    errorCode === 'ETIMEDOUT' ||
    errorMessage.includes('connect ECONNREFUSED')
  ) {
    return ConnectionErrorType.NETWORK;
  }
  
  // Timeout errors
  if (
    errorCode === 'ETIMEDOUT' ||
    errorMessage.includes('Connection timed out')
  ) {
    return ConnectionErrorType.TIMEOUT;
  }
  
  // Resource errors (too many connections, out of memory, etc.)
  if (
    errorCode === '53300' || // Too many connections
    errorCode === '53200' || // Out of memory
    errorCode === '53100'    // Disk full
  ) {
    return ConnectionErrorType.RESOURCE;
  }
  
  return ConnectionErrorType.UNKNOWN;
}

function getConnectionConfigInfo() {
  const pool = getPoolConfig();
  const connectionTimeout = getConnectionTimeoutMs();
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const dbUrl = new URL(databaseUrl);
      return {
        host: dbUrl.hostname,
        port: Number.parseInt(dbUrl.port || '5432', 10),
        database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'psscript',
        username: dbUrl.username || 'postgres',
        ssl: databaseSslEnabled(databaseUrl),
        pool,
        connectionTimeout,
        maxRetries: MAX_CONNECTION_RETRIES,
        dialect: 'postgres' as const
      };
    } catch (_error) {
      // Fall back to env-based parsing below
    }
  }

  return {
    host: 'DATABASE_URL required',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    ssl: true,
    pool,
    connectionTimeout,
    maxRetries: MAX_CONNECTION_RETRIES,
    dialect: 'postgres' as const
  };
}

export const connectionEvents = new EventEmitter();

function updateConnectionStateFromSuccess() {
  const now = Date.now();
  dbDiagnosticState.connected = true;
  dbDiagnosticState.retryCount = 0;
  dbDiagnosticState.consecutiveFailures = 0;
  dbDiagnosticState.lastSuccessfulConnection = now;
  dbDiagnosticState.lastError = null;
  connectionEvents.emit('connected', { timestamp: now });
}

function updateConnectionStateFromRetry(error: any, attempt: number) {
  dbDiagnosticState.retryCount = attempt;
  dbDiagnosticState.connected = false;
  connectionEvents.emit('retry', {
    attempt,
    message: error instanceof Error ? error.message : String(error)
  });
}

function updateConnectionStateFromError(error: any) {
  const now = Date.now();
  const errorType = getErrorType(error);
  dbDiagnosticState.connected = false;
  dbDiagnosticState.consecutiveFailures += 1;
  dbDiagnosticState.lastError = error instanceof Error ? error : new Error(String(error));
  dbDiagnosticState.errorStats[errorType] = (dbDiagnosticState.errorStats[errorType] || 0) + 1;
  connectionEvents.emit('connectionError', {
    timestamp: now,
    type: errorType,
    message: dbDiagnosticState.lastError.message
  });
}

function getPoolStatus(sequelize: Sequelize): Record<string, any> {
  const pool = (sequelize as any).connectionManager?.pool;
  if (!pool) {
    return {
      size: null,
      available: null,
      used: null,
      pending: null
    };
  }

  return {
    size: pool.size,
    available: pool.available,
    used: pool.used,
    pending: pool.pending
  };
}

async function refreshTableCache(sequelize: Sequelize, force = false): Promise<void> {
  const now = Date.now();
  if (!force && dbDiagnosticState.tablesLastRefreshed && (now - dbDiagnosticState.tablesLastRefreshed) < TABLE_REFRESH_INTERVAL_MS) {
    return;
  }

  try {
    const tableRows = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      { type: QueryTypes.SELECT }
    );
    dbDiagnosticState.tables = (tableRows as Array<Record<string, any>>)
      .map((row) => row.table_name)
      .filter(Boolean);
    dbDiagnosticState.tablesLastRefreshed = now;
  } catch (error) {
    logger.warn(`Unable to refresh table cache for diagnostics: ${error}`);
  }
}

async function markMigrationApplied(sequelize: Sequelize, name: string): Promise<void> {
  await sequelize.query(
    `
      INSERT INTO schema_migrations (name)
      VALUES (:name)
      ON CONFLICT (name) DO NOTHING
    `,
    {
      replacements: { name }
    }
  );
}

async function publicTableExists(sequelize: Sequelize, tableName: string): Promise<boolean> {
  const rows = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(:qualifiedName) IS NOT NULL AS "exists"`,
    {
      replacements: { qualifiedName: `public.${tableName}` },
      type: QueryTypes.SELECT
    }
  );

  return Boolean(rows[0]?.exists);
}

async function hardenExtensionPlacement(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    CREATE SCHEMA IF NOT EXISTS extensions;
  `);

  await sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        BEGIN
          ALTER EXTENSION vector SET SCHEMA extensions;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Skipping vector extension schema move: %', SQLERRM;
        END;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        BEGIN
          ALTER EXTENSION pgcrypto SET SCHEMA extensions;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Skipping pgcrypto extension schema move: %', SQLERRM;
        END;
      END IF;

      BEGIN
        EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', current_database());
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipping database search_path update: %', SQLERRM;
      END;
    END $$;
  `);
}

async function ensureLegacyUsersCompatibility(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
  `);

  await sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'lockout_until'
      ) THEN
        EXECUTE '
          UPDATE users
          SET locked_until = COALESCE(locked_until, lockout_until)
        ';
      END IF;
    END $$;
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until)
    WHERE locked_until IS NOT NULL;
  `);

  await markMigrationApplied(sequelize, '20260412_fix_users_locked_until_column.sql');
}

async function ensureAiMetricsCompatibility(
  sequelize: Sequelize,
  hasUsersTable: boolean,
  hasAppProfilesTable: boolean
): Promise<void> {
  const hasAiMetricsTable = await publicTableExists(sequelize, 'ai_metrics');

  if (!hasAiMetricsTable) {
    if (hasAppProfilesTable) {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ai_metrics (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID REFERENCES app_profiles(id) ON DELETE SET NULL,
          endpoint TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          total_cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
          latency INTEGER NOT NULL DEFAULT 0,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          request_payload JSONB,
          response_payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else if (hasUsersTable) {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ai_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          endpoint VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
          latency INTEGER NOT NULL DEFAULT 0,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT,
          request_payload JSONB,
          response_payload JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  }

  if (await publicTableExists(sequelize, 'ai_metrics')) {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON ai_metrics(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint ON ai_metrics(endpoint);
      CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON ai_metrics(model);
      CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON ai_metrics(created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON ai_metrics(success);
    `);

    await markMigrationApplied(sequelize, '20260412_create_ai_metrics_table.sql');
  }
}

export async function ensureRuntimeCompatibility(sequelize: Sequelize): Promise<void> {
  const hasUsersTable = await publicTableExists(sequelize, 'users');
  const hasAppProfilesTable = await publicTableExists(sequelize, 'app_profiles');

  await hardenExtensionPlacement(sequelize);

  if (hasUsersTable) {
    await ensureLegacyUsersCompatibility(sequelize);
  }

  await ensureAiMetricsCompatibility(sequelize, hasUsersTable, hasAppProfilesTable);

  await sequelize.query(`
    DO $$
    BEGIN
      IF to_regclass('public.script_versions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_script_versions_user ON script_versions(user_id);
      END IF;

      IF to_regclass('public.hosted_artifacts') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_hosted_artifacts_user ON hosted_artifacts(user_id);
      END IF;

      IF to_regclass('public.comments') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_comments_script ON comments(script_id);
        CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
      END IF;

      IF to_regclass('public.script_dependencies') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_script_dependencies_child ON script_dependencies(child_script_id);
      END IF;

      IF to_regclass('public.script_tags') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON script_tags(tag_id);
      END IF;

      IF to_regclass('public.user_favorites') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_user_favorites_script ON user_favorites(script_id);
      END IF;

      IF to_regclass('public.script_analysis_script_id_key') IS NOT NULL
         AND to_regclass('public.idx_script_analysis_script') IS NOT NULL THEN
        DROP INDEX public.idx_script_analysis_script;
      END IF;

      IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
        ALTER FUNCTION public.update_updated_at_column()
          SET search_path = public, extensions, pg_catalog;
      END IF;

      IF to_regprocedure('public.update_chat_history_updated_at()') IS NOT NULL THEN
        ALTER FUNCTION public.update_chat_history_updated_at()
          SET search_path = public, extensions, pg_catalog;
      END IF;
    END $$;
  `);

  await markMigrationApplied(sequelize, '20260426_supabase_runtime_compatibility.sql');

  const scoreColumns = await sequelize.query<
    { column_name: string; data_type: string }
  >(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'script_analysis'
        AND column_name IN ('security_score', 'quality_score', 'risk_score')
    `,
    {
      type: QueryTypes.SELECT
    }
  );

  const needsScoreTypeFix = scoreColumns.some(
    column => column.data_type !== 'real' && column.data_type !== 'double precision'
  );

  if (needsScoreTypeFix) {
    await sequelize.query(`
      ALTER TABLE script_analysis
        ALTER COLUMN security_score TYPE DOUBLE PRECISION USING security_score::double precision,
        ALTER COLUMN quality_score TYPE DOUBLE PRECISION USING quality_score::double precision,
        ALTER COLUMN risk_score TYPE DOUBLE PRECISION USING risk_score::double precision;
    `);
  }

  await markMigrationApplied(sequelize, '20260412_fix_script_analysis_score_types.sql');
}

/**
 * Sequelize database connection class
 */
class Database {
  private static instance: Database;
  public sequelize: Sequelize;
  private retries: number = 0;
  private connected: boolean = false;
  
  /**
   * Get SSL configuration based on environment
   * - Production: Require SSL with certificate validation
   * - Development: SSL optional, can use self-signed certs
   */
  private getSSLConfig(databaseUrl?: string): object | undefined {
    const useSSL = databaseSslEnabled(databaseUrl);

    if (!useSSL) {
      return undefined;
    }

    const caPath = process.env.DB_SSL_CA_PATH;
    const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED
      ? process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      : !IS_DEVELOPMENT;

    // In production, ALWAYS validate SSL certificates
    // This prevents man-in-the-middle attacks
    if (IS_PRODUCTION) {
      return {
        require: true,
        rejectUnauthorized: true, // CRITICAL: Always verify certs in production
        ca: caPath ? fs.readFileSync(caPath).toString() : undefined
      };
    }

    // In development, allow self-signed certificates with warning
    if (IS_DEVELOPMENT) {
      if (!rejectUnauthorized) {
        logger.warn('⚠️  SSL certificate validation disabled in development mode');
      }
      return {
        require: true,
        rejectUnauthorized,
        ca: caPath ? fs.readFileSync(caPath).toString() : undefined
      };
    }

    // Default: require validation
    return {
      require: true,
      rejectUnauthorized,
      ca: caPath ? fs.readFileSync(caPath).toString() : undefined
    };
  }

  /**
   * Get database configuration from environment variables
   */
  private getConfig(): Options {
    const databaseUrl = process.env.DATABASE_URL;
    if (!isHostedSupabaseDatabaseUrl(databaseUrl)) {
      throw new Error('DATABASE_URL must point at hosted Supabase Postgres.');
    }

    const sslConfig = this.getSSLConfig(databaseUrl);
    const pool = getPoolConfig();
    const connectionTimeout = getConnectionTimeoutMs();
    const dialectOptions = {
      ssl: sslConfig,
      connectTimeout: connectionTimeout,
      application_name: process.env.DB_APPLICATION_NAME || 'psscript-api'
    };

    return {
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      dialectOptions,
      pool,
      retry: {
        max: 3,
        match: [/Deadlock/i]
      }
    };
  }
  
  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    const config = this.getConfig();
    
    this.sequelize = new Sequelize(databaseUrl as string, config);
    logger.info('Initialized Sequelize connection using hosted Supabase DATABASE_URL');
    
    // Set connection status flag
    this.connected = false;
    this.retries = 0;
    
    // Log connection status
    logger.info('Database connection initialized');
  }
  
  /**
   * Get Database singleton instance
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
  
  /**
   * Initialize database connection
   */
  public async connect(): Promise<void> {
    try {
      logger.info('Connecting to database...');
      await this.sequelize.authenticate();
      this.connected = true;
      this.retries = 0;
      updateConnectionStateFromSuccess();
      logger.info('Database connection established successfully');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
      await ensureRuntimeCompatibility(this.sequelize);
      await refreshTableCache(this.sequelize, true);
    } catch (error: any) {
      this.connected = false;
      updateConnectionStateFromError(error);
      const errorType = getErrorType(error);
      logger.error(`Database connection failed (${errorType}): ${error.message}`);
      
      if (this.retries < MAX_CONNECTION_RETRIES) {
        // Calculate exponential backoff delay
        const delay = RETRY_DELAY_MS * Math.pow(2, this.retries);
        this.retries++;
        updateConnectionStateFromRetry(error, this.retries);
        
        logger.info(`Retrying connection (attempt ${this.retries}/${MAX_CONNECTION_RETRIES}) in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect();
      } else {
        logger.error(`Maximum connection retries (${MAX_CONNECTION_RETRIES}) exceeded`);
        if (errorType === ConnectionErrorType.AUTHENTICATION) {
          logger.error('Authentication failed. Check your database credentials.');
        } else if (errorType === ConnectionErrorType.NETWORK) {
          logger.error('Network error. Check if the database server is running and accessible.');
        }
        throw error;
      }
    }
  }
  
  /**
   * Create migrations tracking table if it doesn't exist
   */
  private async createMigrationsTable(): Promise<void> {
    try {
      await this.sequelize.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      logger.info('Migrations tracking table created or verified');
    } catch (error: any) {
      logger.error(`Failed to create migrations table: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check database health
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.sequelize.query('SELECT 1');
      updateConnectionStateFromSuccess();
      this.connected = true;
      await refreshTableCache(this.sequelize);
      return true;
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
      updateConnectionStateFromError(error);
      this.connected = false;
      return false;
    }
  }
  
  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    try {
      await this.sequelize.close();
      this.connected = false;
      dbDiagnosticState.connected = false;
      connectionEvents.emit('disconnected', { timestamp: Date.now() });
      logger.info('Database connection closed');
    } catch (error) {
      logger.error(`Error closing database connection: ${error}`);
      throw error;
    }
  }
}

// Create and export database instance
const db = Database.getInstance();
export default db;

// Export sequelize instance for model initialization
export const sequelize = db.sequelize;

// Connection info for diagnostics (safe to expose - no passwords)
export const dbConnectionInfo = {
  isConnected: () => dbDiagnosticState.connected,
  lastSuccessfulConnection: () => dbDiagnosticState.lastSuccessfulConnection,
  retryCount: () => dbDiagnosticState.retryCount,
  consecutiveFailures: () => dbDiagnosticState.consecutiveFailures,
  tables: () => [...dbDiagnosticState.tables],
  refreshTables: async (force = false) => refreshTableCache(sequelize, force),
  lastError: () => dbDiagnosticState.lastError,
  errorStats: () => ({ ...dbDiagnosticState.errorStats }),
  pgPoolStatus: () => getPoolStatus(sequelize),
  config: () => getConnectionConfigInfo(),
  validateConnection: async () => db.healthCheck()
};

// Debug: Log to verify sequelize is defined
if (!sequelize) {
  console.error('CRITICAL: sequelize instance is undefined at export time!');
} else {
  console.log('sequelize instance exported successfully');
}
