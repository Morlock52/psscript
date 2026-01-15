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

import { Sequelize, Options } from 'sequelize';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
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
      
      // Update connected status
      this.connected = true;
      this.retries = 0;
      logger.info('Database connection established successfully');
      
      // Create migrations table if it doesn't exist
      await this.createMigrationsTable();
    } catch (error: any) {
      this.connected = false;
      const errorType = getErrorType(error);
      logger.error(`Database connection failed (${errorType}): ${error.message}`);
      
      if (this.retries < MAX_CONNECTION_RETRIES) {
        // Calculate exponential backoff delay
        const delay = RETRY_DELAY_MS * Math.pow(2, this.retries);
        this.retries++;
        
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
      return true;
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
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

// Debug: Log to verify sequelize is defined
if (!sequelize) {
  console.error('CRITICAL: sequelize instance is undefined at export time!');
} else {
  console.log('sequelize instance exported successfully');
}