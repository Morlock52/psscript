import { Sequelize, QueryTypes, Options } from 'sequelize';
import { Pool as PgPool, PoolClient } from 'pg';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import { networkInterfaces } from 'os';
import dns from 'dns';
import net from 'net';
import EventEmitter from 'events';

// Load environment variables
dotenv.config();

// Detect environment
const isDocker = process.env.DOCKER_ENV === 'true';
const isProduction = process.env.NODE_ENV === 'production';

// Database config - Use localhost when running tests or local development outside Docker
const DB_HOST = isDocker ? (process.env.DB_HOST || 'postgres') : 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'psscript';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
const DB_SSL = process.env.DB_SSL === 'true';

// Connection pool configuration
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '20');
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '5');
const POOL_ACQUIRE = parseInt(process.env.DB_POOL_ACQUIRE || '60000');
const POOL_IDLE = parseInt(process.env.DB_POOL_IDLE || '30000'); // Increased from 10000 to reduce connection cycling
const POOL_EVICT = parseInt(process.env.DB_POOL_EVICT || '60000'); // Increased from 30000

// Connection health checking configuration
const CONNECTION_HEALTHCHECK_INTERVAL = parseInt(process.env.DB_HEALTHCHECK_INTERVAL || '20000'); // 20 seconds
const MAX_CONNECTION_RETRIES = parseInt(process.env.DB_MAX_RETRIES || '100');
const CONNECTION_RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY || '5000'); // 5 seconds

// Log DB connection attempt with enhanced diagnostics
logger.info('Initializing database connection with the following settings:');
logger.info(`- Host: ${DB_HOST}`);
logger.info(`- Port: ${DB_PORT}`);
logger.info(`- Database: ${DB_NAME}`);
logger.info(`- User: ${DB_USER}`);
logger.info(`- Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`- Docker: ${isDocker ? 'true' : 'false'}`);
logger.info(`- Pool Size: ${POOL_MIN}-${POOL_MAX} connections`);
logger.info(`- Pool Idle Timeout: ${POOL_IDLE}ms`);
logger.info(`- Pool Eviction Interval: ${POOL_EVICT}ms`);
logger.info(`- Health Check Interval: ${CONNECTION_HEALTHCHECK_INTERVAL}ms`);
logger.info(`- SSL: ${DB_SSL ? 'enabled' : 'disabled'}`);

// Get network interfaces for diagnostics
try {
  const interfaces = networkInterfaces();
  let addresses: Array<{interface: string, addresses: string[]}> = [];
  for (const [name, netInterface] of Object.entries(interfaces)) {
    if (netInterface) {
      const ipv4Addresses = netInterface
        .filter(details => details.family === 'IPv4' && !details.internal)
        .map(details => details.address);
      
      if (ipv4Addresses.length > 0) {
        addresses.push({ interface: name, addresses: ipv4Addresses });
      }
    }
  }
  logger.info(`Available network interfaces: ${JSON.stringify(addresses)}`);
} catch (err: unknown) {
  const error = err as Error;
  logger.warn(`Could not determine network interfaces: ${error.message}`);
}

// Create a connection event emitter to track state changes
const connectionEvents = new EventEmitter();

// Validate hostname resolution before attempting connection
async function validateHostname(): Promise<boolean> {
  if (DB_HOST === 'localhost' || net.isIP(DB_HOST)) {
    return true;
  }
  
  try {
    const addresses = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
      dns.lookup(DB_HOST, { all: true }, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    
    if (addresses && addresses.length > 0) {
      logger.info(`Resolved ${DB_HOST} to ${JSON.stringify(addresses)}`);
      return true;
    } else {
      logger.warn(`Hostname ${DB_HOST} resolved but no addresses returned`);
      return false;
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn(`Could not resolve hostname ${DB_HOST}: ${error.message}`);
    return false;
  }
}

// Test port connectivity with timeout
async function testPortConnectivity(): Promise<boolean> {
  try {
    await new Promise<boolean>((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Timeout connecting to ${DB_HOST}:${DB_PORT}`));
      }, 5000);
      
      socket.connect(DB_PORT, DB_HOST, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', (err) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(err);
      });
    });
    
    logger.info(`Port ${DB_PORT} on ${DB_HOST} is reachable`);
    return true;
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn(`Port connectivity test failed: ${error.message}`);
    return false;
  }
}

// Enhanced PG Pool error handler that manages native pg connection pool
// This complements Sequelize's built-in connection management
class PgConnectionManager {
  private pgPool: PgPool | null = null;
  private pgConnections: Set<PoolClient> = new Set();
  private lastError: Error | null = null;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private connectionRetries: number = 0;
  
  constructor() {
    // Initialize base properties
    this.setupPgPool();
    
    // Start health checking
    this.startHealthChecks();
    
    // Listen for application shutdown
    process.on('SIGTERM', this.handleShutdown.bind(this));
    process.on('SIGINT', this.handleShutdown.bind(this));
  }
  
  private setupPgPool(): void {
    try {
      // Create native pg pool for direct connection management
      // This is separate from but complementary to Sequelize's pool
      this.pgPool = new PgPool({
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
        max: POOL_MAX,
        min: POOL_MIN,
        idleTimeoutMillis: POOL_IDLE,
        connectionTimeoutMillis: 10000, // 10 seconds
        allowExitOnIdle: false,
        
        // Advanced connection options
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      
      // Setup event handlers
      this.pgPool.on('connect', (client: PoolClient) => {
        this.isConnected = true;
        this.connectionRetries = 0;
        this.pgConnections.add(client);
        logger.debug(`New PG connection created, total connections: ${this.pgConnections.size}`);
        connectionEvents.emit('connected');
        
        // Enable TCP keepalive on this specific connection if possible
        // Note: pg types don't expose this but it's available in the native implementation
        const pgClient = client as any;
        if (pgClient.connection && typeof pgClient.connection.setKeepAlive === 'function') {
          pgClient.connection.setKeepAlive(true, 10000);
          logger.debug('TCP keepalive enabled on new database connection');
        }
        
        // Log when client is returned to pool (for custom tracking)
        // We use a monkey-patched release method to track when connections are released
        const origRelease = client.release;
        client.release = function(err?: Error | boolean): void {
          logger.debug(`PG connection released back to pool`);
          return origRelease.call(this, err);
        };
      });
      
      this.pgPool.on('error', (err: Error) => {
        this.lastError = err;
        logger.error(`PG Pool error: ${err.message}`);
        connectionEvents.emit('error', err);
        
        // Force health check on error
        this.runHealthCheck();
      });
      
      this.pgPool.on('remove', (client: PoolClient) => {
        this.pgConnections.delete(client);
        logger.debug(`PG connection removed from pool, remaining connections: ${this.pgConnections.size}`);
      });
      
      logger.info('PG connection pool initialized');
    } catch (err) {
      logger.error(`Failed to initialize PG pool: ${(err as Error).message}`);
      this.lastError = err as Error;
    }
  }
  
  public getStatus(): {
    isConnected: boolean;
    poolSize: number;
    lastError: Error | null;
    retries: number;
  } {
    return {
      isConnected: this.isConnected,
      poolSize: this.pgConnections.size,
      lastError: this.lastError,
      retries: this.connectionRetries
    };
  }
  
  private async runHealthCheck(): Promise<boolean> {
    if (!this.pgPool) {
      logger.warn('Health check failed: PG Pool not initialized');
      return false;
    }
    
    try {
      // Get a client from the pool with timeout
      const client = await this.pgPool.connect();
      
      try {
        // Run a simple query to test the connection
        const result = await client.query('SELECT NOW() as time, version() as version, pg_backend_pid() as pid');
        
        if (result && result.rows && result.rows.length > 0) {
          // Track successful connection
          this.isConnected = true;
          this.connectionRetries = 0;
          
          // Log diagnostics periodically (not on every health check)
          if (Math.random() < 0.1) { // ~10% of health checks
            const row = result.rows[0];
            logger.debug(`Database health check successful. Server time: ${row.time}, PID: ${row.pid}`);
          }
          
          connectionEvents.emit('healthy');
          return true;
        } else {
          throw new Error('Empty result from health check query');
        }
      } finally {
        // Always release the client back to the pool
        client.release();
      }
    } catch (err) {
      // Handle health check failure
      this.isConnected = false;
      this.lastError = err as Error;
      this.connectionRetries++;
      
      // Only log errors occasionally to avoid spam
      if (this.connectionRetries === 1 || this.connectionRetries % 5 === 0) {
        logger.warn(`Database health check failed (attempt ${this.connectionRetries}): ${(err as Error).message}`);
      }
      
      connectionEvents.emit('unhealthy', err);
      
      // If pool seems completely broken, try recreating it
      if (this.connectionRetries % 10 === 0) {
        this.resetPool();
      }
      
      return false;
    }
  }
  
  private startHealthChecks(): void {
    // Clear any existing timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    // Start regular health checks
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      CONNECTION_HEALTHCHECK_INTERVAL
    );
    
    // Run an immediate health check
    this.runHealthCheck();
  }
  
  private resetPool(): void {
    logger.info('Resetting PG connection pool due to persistent connection issues');
    
    // Attempt to close the existing pool gracefully
    if (this.pgPool) {
      this.pgPool.end()
        .catch((err: Error) => logger.error(`Error closing PG pool: ${err.message}`))
        .finally(() => {
          // Create a new pool regardless of whether the old one closed cleanly
          this.pgConnections.clear();
          this.setupPgPool();
          logger.info('PG connection pool has been reset');
        });
    } else {
      // No existing pool, just create a new one
      this.setupPgPool();
    }
  }
  
  private async handleShutdown(): Promise<void> {
    logger.info('Application shutdown detected, closing database connections...');
    
    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // Clear reconnect timer if active
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Close the pool gracefully
    if (this.pgPool) {
      try {
        await this.pgPool.end();
        logger.info(`Closed ${this.pgConnections.size} PG connections successfully`);
        this.pgConnections.clear();
      } catch (err) {
        logger.error(`Error closing PG pool during shutdown: ${(err as Error).message}`);
      }
    }
  }
}

// Initialize PG connection manager
const pgConnectionManager = new PgConnectionManager();

// Configure Sequelize with improved settings
const sequelizeConfig: Options = {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  
  // Enhanced connection pool settings to prevent connection dropping
  pool: {
    max: POOL_MAX,
    min: POOL_MIN,
    acquire: POOL_ACQUIRE, 
    idle: POOL_IDLE,    // Increased to reduce connection cycling
    evict: POOL_EVICT   // Increased eviction check interval
  },
  
  // More aggressive retry configuration
  retry: {
    match: [
      /Deadlock/i, 
      /Lock/i, 
      /Timeout/i, 
      /ECONNREFUSED/i, 
      /ECONNRESET/i,
      /Connection terminated/i,
      /connecting to server/i,
      /role .* does not exist/i,
      /database .* does not exist/i,
      /no pg_hba.conf entry/i,
      /Connection terminated unexpectedly/i,
      /server closed the connection unexpectedly/i,
      /terminating connection due to administrator command/i,
      /connection to server was lost/i,
      /connection timed out/i,
      /EOF detected/i
    ],
    max: 15,  // Max retries for transient errors
    backoffBase: 1000,
    backoffExponent: 1.5
  },
  
  // Advanced PostgreSQL-specific options
  dialectOptions: {
    // Connection timeout settings
    connectTimeout: 30000, // 30 second connection timeout
    statement_timeout: 60000, // 1 minute statement timeout
    idle_in_transaction_session_timeout: 120000, // 2 minute idle transaction timeout
    
    // Critical TCP connection maintenance settings
    keepAlive: true,
    keepAliveInitialDelay: 10000, // 10 seconds
    
    // Add application_name for better identification in pg_stat_activity
    application_name: 'psscript_backend',
    
    // TCP options that help with stability
    // Note: some of these must be set in PostgreSQL config as well
    tcp_user_timeout: 60000, // 60 seconds 
    
    // SSL options if needed
    ssl: DB_SSL ? {
      rejectUnauthorized: false // Allow self-signed certificates
    } : false
  },
  
  // Add hooks for connection monitoring and configuration
  hooks: {
    beforeConnect: async (config) => {
      // Log connection attempt
      logger.info(`Attempting database connection to ${DB_HOST}:${DB_PORT}`);
      
      // Run pre-connection diagnostics
      await validateHostname();
      await testPortConnectivity();
    },
    
    afterConnect: (connection: unknown) => {
      // Set additional PG client options for better reliability
      if (connection) {
        logger.info(`Database connection established successfully`);
        
        // Record connection time
        lastSuccessfulConnection = Date.now();
        
        // Enable TCP keepalive on the raw connection if available
        const conn = connection as any;
        if (conn.connection && typeof conn.connection.setKeepAlive === 'function') {
          conn.connection.setKeepAlive(true, 10000);
          logger.debug('TCP keepalive enabled on database connection');
        }
        
        // Set additional PostgreSQL session parameters for this connection
        void sequelize.query(`
          SET SESSION tcp_keepalives_idle = 60;
          SET SESSION tcp_keepalives_interval = 30;
          SET SESSION tcp_keepalives_count = 5;
          SET SESSION statement_timeout = 60000;
          SET SESSION idle_in_transaction_session_timeout = 120000;
        `).catch((err: Error) => {
          logger.warn(`Failed to set PostgreSQL session parameters: ${err.message}`);
          // Non-fatal, continue
        });
      }
    }
  }
};

// Initialize Sequelize with enhanced configuration
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, sequelizeConfig);

// Status tracking
let dbConnected = false;
let lastConnectAttempt = Date.now();
let lastSuccessfulConnection: number | null = null;
let databaseTables: string[] = [];
let lastError: Error | null = null;
let connectionErrorCount: Record<string, number> = {};
let consecutiveFailures = 0;
let connectionRetries = 0;

// Store last query time to detect inactive connections
let lastQueryTime = Date.now();

// Track query execution with timings
// @ts-ignore - This is a Sequelize extension
sequelize.beforeQuery(() => {
  lastQueryTime = Date.now();
});

// Enhanced connection validation that checks both Sequelize pool and underlying PG connections
async function validateConnection(): Promise<boolean> {
  try {
    // First, check if the PG pool shows connection issues
    const pgStatus = pgConnectionManager.getStatus();
    if (!pgStatus.isConnected && pgStatus.retries > 0) {
      logger.warn(`PG pool reports connection issues, attempting full Sequelize authentication`);
    }
    
    // Then validate Sequelize connection
    await sequelize.authenticate();
    
    // Update connection tracking
    const wasDisconnected = !dbConnected;
    dbConnected = true;
    lastSuccessfulConnection = Date.now();
    connectionRetries = 0;
    consecutiveFailures = 0;
    
    // Log reconnection events
    if (wasDisconnected) {
      logger.info(`Database connection re-established successfully to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      
      // Emit connection event for any listeners
      connectionEvents.emit('reconnected');
      
      // Check database structure on reconnection
      await validateDatabaseStructure();
    }
    
    return true;
  } catch (err) {
    // Handle connection failure
    dbConnected = false;
    lastError = err as Error;
    lastConnectAttempt = Date.now();
    
    // Track error statistics
    connectionRetries++;
    consecutiveFailures++;
    const errorType = getErrorType(err);
    connectionErrorCount[errorType] = (connectionErrorCount[errorType] || 0) + 1;
    
    // Log failures (with rate limiting to avoid spam)
    if (consecutiveFailures === 1 || consecutiveFailures % 5 === 0) {
      logger.error(`Database connection validation failed: ${(err as Error).message}`);
      
      // Emit error event for any listeners
      connectionEvents.emit('validation_failed', err);
    }
    
    return false;
  }
}

// Validate database structure is ready for application
async function validateDatabaseStructure(): Promise<boolean> {
  try {
    // Get list of tables to verify schema is set up
    const tables = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      { type: QueryTypes.SELECT }
    );
    
    // Process results
    databaseTables = tables.map((t: any) => t.table_name);
    logger.info(`Database has ${databaseTables.length} tables`);
    
    // Check if tables exist
    if (databaseTables.length > 0) {
      logger.debug(`Available tables: ${databaseTables.join(', ')}`);
      return true;
    } else {
      logger.warn('No tables found in database. The application may need to be initialized.');
      return false;
    }
  } catch (err) {
    logger.warn(`Failed to validate database structure: ${(err as Error).message}`);
    return false;
  }
}

// Helper function to categorize errors
function getErrorType(err: unknown): string {
  const error = err as Error;
  const message = (error.message || '').toLowerCase();
  
  if (message.includes('econnrefused')) return 'connection_refused';
  if (message.includes('etimedout') || message.includes('timeout')) return 'timeout';
  if (message.includes('authentication failed')) return 'authentication_failed';
  if (message.includes('database') && message.includes('does not exist')) return 'database_not_exist';
  if (message.includes('role') && message.includes('does not exist')) return 'role_not_exist';
  if (message.includes('too many clients')) return 'too_many_connections';
  if (message.includes('terminated')) return 'connection_terminated';
  if (message.includes('econnreset')) return 'connection_reset';
  if (message.includes('closed')) return 'connection_closed';
  if (message.includes('EOF detected')) return 'connection_eof';
  if (message.includes('idle')) return 'idle_timeout';
  
  return 'unknown_error';
}

// Initial connection validation
async function initializeConnection() {
  try {
    logger.info('Performing initial database connection validation...');
    
    // Run hostname and port tests first
    const hostnameValid = await validateHostname();
    const portAccessible = await testPortConnectivity();
    
    if (!hostnameValid || !portAccessible) {
      logger.warn('Pre-connection checks failed, but attempting connection anyway');
    }
    
    // Attempt full connection validation
    const connectionValid = await validateConnection();
    
    if (connectionValid) {
      logger.info('Initial database connection successful');
      
      // One-time structure validation
      await validateDatabaseStructure();
    } else {
      logger.error('Initial database connection validation failed');
      
      // Initial connection failed, schedule retry
      setTimeout(validateConnection, CONNECTION_RETRY_DELAY);
    }
  } catch (err) {
    logger.error(`Error during initial connection setup: ${(err as Error).message}`);
    
    // Schedule retry
    setTimeout(validateConnection, CONNECTION_RETRY_DELAY);
  }
}

// Schedule periodic connection validation
setInterval(async () => {
  // Skip if we're already in a failed state
  if (!dbConnected) return;
  
  // Check if we need to validate based on inactivity
  const inactivityTime = Date.now() - lastQueryTime;
  if (inactivityTime > 60000) { // 1 minute of inactivity
    logger.debug(`No database activity for ${Math.round(inactivityTime/1000)}s, validating connection`);
    await validateConnection();
  } else {
    // Simple ping if recent activity
    try {
      const result = await sequelize.query('SELECT 1 as ping', { type: QueryTypes.SELECT });
      if (result && result.length > 0) {
        if (Math.random() < 0.05) { // Limit logging to ~5% of pings
          logger.debug('Database ping successful');
        }
      } else {
        logger.warn('Database ping returned empty result');
        await validateConnection();
      }
    } catch (err) {
      logger.warn(`Database ping failed: ${(err as Error).message}`);
      dbConnected = false;
      await validateConnection();
    }
  }
}, CONNECTION_HEALTHCHECK_INTERVAL);

// Start initial connection
initializeConnection();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, closing database connections...');
  try {
    // Close Sequelize connections
    // @ts-ignore - The ConnectionManager doesn't expose this type properly
    const poolSize = sequelize.connectionManager.pool.size;
    logger.info(`Closing ${poolSize} database connections...`);
    await sequelize.close();
    logger.info('All database connections closed successfully');
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Error closing database connections: ${error.message}`);
  }
  process.exit(0);
});

// Export connection event emitter for application monitoring
export { connectionEvents };

// Export connection information with enhanced details
export const dbConnectionInfo = {
  isConnected: () => dbConnected,
  lastSuccessfulConnection: () => lastSuccessfulConnection,
  tables: () => databaseTables,
  retryCount: () => connectionRetries,
  lastError: () => lastError,
  errorStats: () => connectionErrorCount,
  consecutiveFailures: () => consecutiveFailures,
  pgPoolStatus: () => pgConnectionManager.getStatus(),
  validateConnection: validateConnection,
  config: () => ({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    dialect: 'postgres',
    docker: isDocker,
    production: isProduction,
    ssl: DB_SSL,
    pool: {
      max: POOL_MAX,
      min: POOL_MIN,
      idle: POOL_IDLE,
      acquire: POOL_ACQUIRE
    }
  })
};

// Helper function for proper queries
export async function safeQuery<T = any>(sql: string, options: any = {}): Promise<T[]> {
  const result = await sequelize.query(sql, {
    ...options,
    type: QueryTypes.SELECT,
    plain: false,
    raw: true,
    mapToModel: false,
    // Add query timeout to prevent hanging queries
    timeout: options.timeout || 30000
  });
  
  return result as unknown as T[];
}

// Export both the sequelize instance and connection info
export { sequelize };
export default sequelize;