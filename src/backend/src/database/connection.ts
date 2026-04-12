/**
 * Database Connection Manager
 * 
 * This module handles PostgreSQL database connections with Sequelize ORM.
 * Features:
 * - Connection pooling
 * - Automatic reconnection with exponential backoff
 * - Environment detection (Docker vs local)
 * - Health checks and connection validation
 */

import { Sequelize, Options, QueryTypes } from 'sequelize';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { IS_PRODUCTION, IS_DEVELOPMENT } from '../utils/envValidation';

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
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      return {
        host: dbUrl.hostname || 'localhost',
        port: parseInt(dbUrl.port || '5432', 10),
        database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : 'psscript',
        username: dbUrl.username || 'postgres',
        pool: {
          max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : POOL_MAX,
          min: POOL_MIN,
          acquire: POOL_ACQUIRE_TIMEOUT_MS,
          idle: POOL_IDLE_TIMEOUT_MS
        },
        connectionTimeout: CONNECTION_TIMEOUT_MS,
        maxRetries: MAX_CONNECTION_RETRIES,
        dialect: 'postgres' as const
      };
    } catch (_error) {
      // Fall back to env-based parsing below
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'psscript',
    username: process.env.DB_USER || 'postgres',
    pool: {
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : POOL_MAX,
      min: POOL_MIN,
      acquire: POOL_ACQUIRE_TIMEOUT_MS,
      idle: POOL_IDLE_TIMEOUT_MS
    },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
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
  connectionEvents.emit('error', {
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

export async function ensureRuntimeCompatibility(sequelize: Sequelize): Promise<void> {
  await sequelize.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
  `);

  await sequelize.query(`
    UPDATE users
    SET locked_until = COALESCE(locked_until, lockout_until)
    WHERE EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'lockout_until'
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until)
    WHERE locked_until IS NOT NULL;
  `);

  await markMigrationApplied(sequelize, '20260412_fix_users_locked_until_column.sql');

  // Self-heal legacy local databases that predate newer migrations.
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

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id ON ai_metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_endpoint ON ai_metrics(endpoint);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_model ON ai_metrics(model);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_created_at ON ai_metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_metrics_success ON ai_metrics(success);
  `);

  await markMigrationApplied(sequelize, '20260412_create_ai_metrics_table.sql');

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
  private getSSLConfig(): object | undefined {
    const useSSL = process.env.DB_SSL === 'true';

    if (!useSSL) {
      return undefined;
    }

    // In production, ALWAYS validate SSL certificates
    // This prevents man-in-the-middle attacks
    if (IS_PRODUCTION) {
      const caPath = process.env.DB_SSL_CA_PATH;
      return {
        require: true,
        rejectUnauthorized: true, // CRITICAL: Always verify certs in production
        ca: caPath ? fs.readFileSync(caPath).toString() : undefined
      };
    }

    // In development, allow self-signed certificates with warning
    if (IS_DEVELOPMENT) {
      logger.warn('⚠️  SSL certificate validation disabled in development mode');
      return {
        require: true,
        rejectUnauthorized: false // Only acceptable in development
      };
    }

    // Default: require validation
    return {
      require: true,
      rejectUnauthorized: true
    };
  }

  /**
   * Get database configuration from environment variables
   */
  private getConfig(): Options {
    const databaseUrl = process.env.DATABASE_URL;
    const sslConfig = this.getSSLConfig();

    // Use DATABASE_URL if available
    if (databaseUrl) {
      return {
        dialect: 'postgres',
        logging: (msg) => logger.debug(msg),
        dialectOptions: {
          ssl: sslConfig,
          connectTimeout: CONNECTION_TIMEOUT_MS
        },
        pool: {
          max: POOL_MAX,
          min: POOL_MIN,
          acquire: POOL_ACQUIRE_TIMEOUT_MS,
          idle: POOL_IDLE_TIMEOUT_MS
        },
        retry: {
          max: 3,
          match: [/Deadlock/i]
        }
      };
    }

    // Otherwise use individual connection parameters
    // Log connection details (password obfuscated for security)
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432');
    const database = process.env.DB_NAME || 'psscript';
    const username = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'postgres';

    logger.info(`Database config: ${username}@${host}:${port}/${database}`);
    if (IS_DEVELOPMENT && password === 'postgres') {
      logger.warn('⚠️  Using default database password in development');
    }

    return {
      host,
      port,
      database,
      username,
      password,
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      dialectOptions: {
        ssl: sslConfig,
        connectTimeout: CONNECTION_TIMEOUT_MS
      },
      pool: {
        max: POOL_MAX,
        min: POOL_MIN,
        acquire: POOL_ACQUIRE_TIMEOUT_MS,
        idle: POOL_IDLE_TIMEOUT_MS
      },
      retry: {
        max: 3,
        match: [/Deadlock/i]
      }
    };
  }
  
  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    const config = this.getConfig();
    
    if (databaseUrl) {
      this.sequelize = new Sequelize(databaseUrl, config);
      logger.info('Initialized Sequelize connection using DATABASE_URL');
    } else {
      this.sequelize = new Sequelize(config);
      logger.info('Initialized Sequelize connection using individual connection parameters');
    }
    
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
