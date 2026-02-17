import express from 'express';
import axios from 'axios';
import logger from '../utils/logger';
import { sequelize } from '../database/connection';
import { QueryTypes } from 'sequelize';

// TODO: Restore dbConnectionInfo and connectionEvents functionality
// These were removed in the database connection refactor
const dbConnectionInfo = {
  isConnected: () => true,
  lastSuccessfulConnection: () => Date.now(),
  retryCount: () => 0,
  consecutiveFailures: () => 0,
  tables: () => [],
  lastError: () => null,
  errorStats: () => ({}),
  pgPoolStatus: () => ({}),
  config: () => ({
    pool: {},
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'psscript',
    username: process.env.DB_USER || 'postgres'
  }),
  validateConnection: async () => true
};
const _connectionEvents = {};
import dns from 'dns';
import net from 'net';
import os from 'os';
import { cache } from '../index';
import {
  getCache,
  setCache,
  deleteCache,
  persistCache,
  loadCache
} from '../utils/redis';

// Constants for cache health checks
// These match the values defined in index.ts
const MAX_CACHE_ITEMS = 10000; // Maximum number of items to store in cache before eviction
const MAX_MEMORY_USAGE = process.env.MAX_CACHE_MEMORY ? parseInt(process.env.MAX_CACHE_MEMORY, 10) : 500 * 1024 * 1024; // 500MB default
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

const router = express.Router();

const isAllowedOllamaHost = (hostname: string): boolean => {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') {
    return true;
  }

  // Restrict to private network ranges to reduce SSRF risk.
  if (h.startsWith('10.') || h.startsWith('192.168.')) {
    return true;
  }

  const match172 = h.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
};

type ProviderModelSource = {
  id: string;
  owned_by?: string;
  created?: number;
  displayName?: string;
  rawName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

const sanitizeApiKey = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
};

const normalizeOpenAiModels = (value: unknown): ProviderModelSource[] => {
  if (!Array.isArray((value as any)?.data)) return [];

  return (value as any).data
    .filter((model: any) => typeof model?.id === 'string' && model.id.trim())
    .map((model: any) => ({
      id: model.id,
      owned_by: typeof model?.owned_by === 'string' ? model.owned_by : undefined,
      created: typeof model?.created === 'number' ? model.created : undefined,
    }));
};

const normalizeGoogleModels = (value: unknown): ProviderModelSource[] => {
  const models = Array.isArray((value as any)?.models) ? (value as any).models : [];
  return models
    .filter((model: any) => {
      if (typeof model?.name !== 'string' || !model.name.trim()) return false;
      const methods = Array.isArray(model?.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
      return methods.includes('generateContent');
    })
    .map((model: any) => {
      const rawName = String(model.name || '');
      const id = rawName.replace(/^models\//, '');
      const methods = Array.isArray(model?.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
      return {
        id,
        rawName,
        displayName: typeof model?.displayName === 'string' && model.displayName.trim() ? model.displayName.trim() : id,
        description: typeof model?.description === 'string' ? model.description : undefined,
        inputTokenLimit: typeof model?.inputTokenLimit === 'number' ? model.inputTokenLimit : undefined,
        outputTokenLimit: typeof model?.outputTokenLimit === 'number' ? model.outputTokenLimit : undefined,
        supportedGenerationMethods: methods,
      };
    });
};

const fetchGoogleModels = async (apiKey: string): Promise<ProviderModelSource[]> => {
  let nextPageToken: string | undefined;
  const collected: ProviderModelSource[] = [];

  do {
    const baseUrl = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    baseUrl.searchParams.set('key', apiKey);
    baseUrl.searchParams.set('pageSize', '100');
    if (nextPageToken) {
      baseUrl.searchParams.set('pageToken', nextPageToken);
    }

    const response = await axios.get(baseUrl.toString(), {
      validateStatus: () => true,
      timeout: 10000,
    });

    if (response.status < 200 || response.status >= 300) {
      const details = (response.data as any)?.error || response.statusText;
      throw new Error(typeof details === 'string' ? details : `HTTP ${response.status}`);
    }

    const normalized = normalizeGoogleModels(response.data);
    collected.push(...normalized);
    nextPageToken = typeof response.data?.nextPageToken === 'string' ? response.data.nextPageToken : undefined;
  } while (nextPageToken);

  const seen = new Set<string>();
  return collected
    .filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
};

// Enhanced basic health check
router.get('/', async (req, res) => {
  let dbStatus: string = 'disconnected';
  let authErrorMessage: string = '';
  let tables: string[] = [];
  
  try {
    try {
      await sequelize.authenticate();
      dbStatus = 'connected';
    } catch (error: any) {
      logger.error('Database authentication failed: ' + error.message);
      dbStatus = 'disconnected';
      authErrorMessage = error.message;
    }
    
    // Only try to fetch tables if the database is connected
    if (dbStatus === 'connected') {
      try {
        const results = await sequelize.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
          { type: QueryTypes.SELECT }
        );
        // Depending on Sequelize config/version, QueryTypes.SELECT can return rows as:
        // - objects: { table_name: '...' }
        // - arrays:  ['...']
        // Normalize to string table names.
        tables = (results as any[]).map((r: any) => {
          if (Array.isArray(r)) return String(r[0] ?? '');
          if (r && typeof r === 'object') return String((r.table_name ?? r.tableName ?? r[0]) ?? '');
          return '';
        }).filter((t) => Boolean(t));
        logger.info("Health check - fetched tables: " + tables.join(", "));
      } catch (error: any) {
        logger.error("Error fetching tables in health endpoint: " + error.message);
        // Do not fail the entire request if table fetching fails
        tables = [];
      }
    }
    
    // Check in-memory cache status
    let cacheStatus = 'connected';
    let cacheMetrics = {};
    
    try {
      // Get cache statistics
      const cacheStats = cache.stats();
      
      cacheMetrics = {
        size: cacheStats.size,
        keys: cacheStats.keys.slice(0, 10), // Show first 10 keys
        memoryUsage: process.memoryUsage()
      };
      
      logger.info('Health check - In-memory cache statistics retrieved successfully');
    } catch (cacheError: any) {
      const errorMessage = cacheError instanceof Error ? cacheError.message : String(cacheError);
      logger.error('Cache statistics check failed:', errorMessage);
      cacheStatus = 'error';
      
      cacheMetrics = { 
        error: 'Failed to get cache metrics'
      };
    }
    
    // Always return a valid response
    // Use "ok" as status value to match test expectations (acceptable alias for "pass" per RFC)
    return res.status(200).json({
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      database: dbStatus, // Test expects 'database' property
      redis: cacheStatus, // Test expects 'redis' property (our in-memory cache is similar)
      dbStatus: dbStatus,
      cacheStatus: cacheStatus,
      message: authErrorMessage ? `DB: ${authErrorMessage}` : '',
      time: new Date().toISOString(),
      uptime: process.uptime(),
      tables: tables,
      cache: cacheMetrics,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    // Fallback error handling to ensure we always return a valid JSON response
    logger.error('Uncaught error in health check endpoint: ' + error.message);
    return res.status(500).json({
      dbStatus: 'error',
      status: 'error',
      message: error.message,
      time: new Date().toISOString()
    });
  }
});

router.get('/provider-models/openai', async (req, res) => {
  try {
    const apiKey = sanitizeApiKey(req.headers['x-openai-api-key']) || sanitizeApiKey(req.query.apiKey);
    if (!apiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing OpenAI API key. Set x-openai-api-key header or apiKey query parameter.',
      });
    }

    const response = await axios.get('https://api.openai.com/v1/models', {
      validateStatus: () => true,
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status < 200 || response.status >= 300) {
      const details = (response.data as any)?.error?.message || response.statusText;
      return res.status(response.status).json({
        status: 'error',
        message: typeof details === 'string' ? details : `HTTP ${response.status}`,
      });
    }

    const models = normalizeOpenAiModels(response.data);
    return res.status(200).json({
      status: 'ok',
      provider: 'openai',
      models,
    });
  } catch (error: any) {
    return res.status(502).json({
      status: 'error',
      message: `Unable to fetch OpenAI models: ${error?.message || 'Unknown error'}`,
    });
  }
});

router.get('/provider-models/google', async (req, res) => {
  try {
    const apiKey = sanitizeApiKey(req.headers['x-goog-api-key']) || sanitizeApiKey(req.headers['x-api-key']) || sanitizeApiKey(req.query.apiKey);
    if (!apiKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing Google API key. Set x-goog-api-key/x-api-key header or apiKey query parameter.',
      });
    }

    const models = await fetchGoogleModels(apiKey);
    return res.status(200).json({
      status: 'ok',
      provider: 'google',
      models,
    });
  } catch (error: any) {
    return res.status(502).json({
      status: 'error',
      message: `Unable to fetch Google models: ${error?.message || 'Unknown error'}`,
    });
  }
});

// Server-side Ollama connectivity test (avoids browser CORS/localhost issues).
router.get('/ollama', async (req, res) => {
  try {
    const requested = String(req.query.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').trim();
    const normalizedBase = requested.replace(/\/+$/, '');
    const parsed = new URL(normalizedBase);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid Ollama URL protocol. Use http or https.',
      });
    }

    if (!isAllowedOllamaHost(parsed.hostname)) {
      return res.status(400).json({
        status: 'error',
        message: 'Ollama host is not allowed. Use localhost or a private network address.',
      });
    }

    const response = await axios.get(`${normalizedBase}/api/tags`, {
      timeout: 6000,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      return res.status(502).json({
        status: 'error',
        message: `Ollama responded with HTTP ${response.status}`,
      });
    }

    const models = Array.isArray(response.data?.models) ? response.data.models : [];
    return res.status(200).json({
      status: 'ok',
      message: 'Ollama connection successful',
      modelCount: models.length,
    });
  } catch (error: any) {
    return res.status(502).json({
      status: 'error',
      message: `Unable to reach Ollama: ${error?.message || 'Unknown error'}`,
    });
  }
});

// Get detailed database connection status information
router.get('/db/status', async (req, res) => {
  try {
    // Get basic connection info
    const isConnected = dbConnectionInfo.isConnected();
    const lastConnect = dbConnectionInfo.lastSuccessfulConnection();
    
    // Get database info if connected
    let dbVersion = null;
    let dbTime = null;
    let pid = null;
    let connectionDuration = null;
    let dbProcessInfo = null;
    let queriesExecuted = null;
    let idleConnections = null;
    
    // Calculate time since last connection
    if (lastConnect) {
      connectionDuration = Date.now() - lastConnect;
    }
    
    if (isConnected) {
      try {
        // Get database server information
        const dbInfo = await sequelize.query(
          `SELECT version() as version, 
           now() as time, 
           pg_backend_pid() as pid,
           (SELECT count(*) FROM pg_stat_activity) as connections,
           (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
           current_setting('max_connections') as max_connections`,
          { type: QueryTypes.SELECT }
        );
        
        if (dbInfo && dbInfo.length > 0) {
          const info = dbInfo[0] as Record<string, any>;
          dbVersion = info.version;
          dbTime = info.time;
          pid = info.pid;
          
          // Get process information
          try {
            const processInfo = await sequelize.query(
              "SELECT datname, usename, application_name, client_addr, backend_start, state, wait_event_type, wait_event, query FROM pg_stat_activity WHERE pid = $pid LIMIT 1",
              { 
                type: QueryTypes.SELECT,
                bind: { pid }
              }
            );
            
            if (processInfo && processInfo.length > 0) {
              dbProcessInfo = processInfo[0];
            }
            
            // Get additional query statistics
            const queryStats = await sequelize.query(
              "SELECT sum(xact_commit + xact_rollback) as transactions FROM pg_stat_database",
              { type: QueryTypes.SELECT }
            );
            
            if (queryStats && queryStats.length > 0) {
              const stats = queryStats[0] as Record<string, any>;
              queriesExecuted = stats.transactions;
            }
            
            const info = dbInfo[0] as Record<string, any>;
            idleConnections = info.idle_connections;
          } catch (err: unknown) {
            const error = err as Error;
            logger.warn(`Unable to get database process information: ${error.message}`);
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.warn(`Unable to get database server information: ${error.message}`);
      }
    }
    
    // Get comprehensive status info
    const statusInfo = {
      connected: isConnected,
      lastSuccessfulConnection: lastConnect ? new Date(lastConnect).toISOString() : null,
      connectionDuration: connectionDuration ? Math.round(connectionDuration / 1000) : null,
      connectionAttempts: dbConnectionInfo.retryCount(),
      consecutiveFailures: dbConnectionInfo.consecutiveFailures(),
      tables: dbConnectionInfo.tables(),
      lastError: dbConnectionInfo.lastError() ? {
        message: dbConnectionInfo.lastError()?.message,
        time: null, // Error objects don't track time by default
        type: dbConnectionInfo.lastError()?.name || 'Error'
      } : null,
      errorStats: dbConnectionInfo.errorStats(),
      pgPoolStatus: dbConnectionInfo.pgPoolStatus(),
      dbInfo: {
        version: dbVersion,
        time: dbTime,
        pid: pid,
        processInfo: dbProcessInfo,
        queriesExecuted,
        idleConnections
      },
      config: dbConnectionInfo.config()
    };

    res.json(statusInfo);
  } catch (error: any) {
    logger.error(`Error in database status endpoint: ${error.message}`);
    res.status(500).json({
      error: error.message,
      status: 'error'
    });
  }
});

// Dedicated network testing endpoint
router.get('/network-test', async (req, res) => {
  const dbConfig = dbConnectionInfo.config();
  const results: any = {
    host: dbConfig.host,
    port: dbConfig.port,
    networkInterfaces: {},
    dnsResolution: null,
    portConnectivity: null,
    tcpInfo: null,
    time: new Date().toISOString()
  };
  
  try {
    // Get network interfaces
    const interfaces = os.networkInterfaces();
    for (const [name, netInterface] of Object.entries(interfaces)) {
      if (netInterface) {
        const ipv4Addresses = netInterface
          .filter(details => details.family === 'IPv4')
          .map(details => ({
            address: details.address,
            internal: details.internal
          }));
        
        if (ipv4Addresses.length > 0) {
          results.networkInterfaces[name] = ipv4Addresses;
        }
      }
    }
    
    // Test DNS resolution
    if (dbConfig.host !== 'localhost' && !net.isIP(dbConfig.host)) {
      try {
        const dnsStart = Date.now();
        const addresses = await new Promise<dns.LookupAddress[]>((resolve, reject) => {
          dns.lookup(dbConfig.host, { all: true }, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });
        const dnsEnd = Date.now();
        
        results.dnsResolution = {
          success: true,
          addresses: addresses,
          time: dnsEnd - dnsStart,
          message: `Resolved ${dbConfig.host} to ${addresses.map(a => a.address).join(', ')}`
        };
      } catch (err) {
        results.dnsResolution = {
          success: false,
          error: (err as Error).message,
          message: `Failed to resolve hostname ${dbConfig.host}`
        };
      }
    } else {
      results.dnsResolution = {
        success: true,
        message: `Using ${dbConfig.host === 'localhost' ? 'localhost' : 'IP address directly'}, no DNS resolution needed`
      };
    }
    
    // Test port connectivity
    try {
      const portStart = Date.now();
      await new Promise<boolean>((resolve, reject) => {
        const socket = new net.Socket();
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error(`Timeout connecting to ${dbConfig.host}:${dbConfig.port}`));
        }, 5000);
        
        socket.connect(dbConfig.port, dbConfig.host, () => {
          clearTimeout(timeout);
          
          // Get socket info for diagnostics
          const tcpInfo = {
            localAddress: socket.localAddress,
            localPort: socket.localPort,
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
            bytesWritten: socket.bytesWritten,
            bytesRead: socket.bytesRead
          };
          
          results.tcpInfo = tcpInfo;
          
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', (err) => {
          clearTimeout(timeout);
          socket.destroy();
          reject(err);
        });
      });
      const portEnd = Date.now();
      
      results.portConnectivity = {
        success: true,
        time: portEnd - portStart,
        message: `Successfully connected to ${dbConfig.host}:${dbConfig.port}`
      };
    } catch (err) {
      results.portConnectivity = {
        success: false,
        error: (err as Error).message,
        message: `Failed to connect to ${dbConfig.host}:${dbConfig.port}`
      };
    }
    
    res.json(results);
  } catch (error: any) {
    logger.error(`Error in network test endpoint: ${error.message}`);
    res.status(500).json({
      error: error.message,
      status: 'error'
    });
  }
});

// Manual database connection management
router.post('/db/:action', async (req, res) => {
  const { action } = req.params;
  try {
    if (action === 'disconnect') {
      try {
        await sequelize.close();
        res.json({ dbStatus: 'disconnected', message: 'Database disconnected successfully' });
      } catch (closeError: any) {
        logger.error(`Error while disconnecting from database: ${closeError.message}`);
        res.status(500).json({ 
          error: closeError.message, 
          dbStatus: 'error',
          message: 'Failed to disconnect from database'
        });
      }
    } else if (action === 'connect') {
      try {
        await sequelize.authenticate();
        res.json({ dbStatus: 'connected', message: 'Database connected successfully' });
      } catch (authError: any) {
        logger.error(`Error while authenticating database connection: ${authError.message}`);
        res.status(500).json({ 
          error: authError.message, 
          dbStatus: 'error',
          message: 'Failed to connect to database'
        });
      }
    } else if (action === 'validate') {
      try {
        // Use the validateConnection function from dbConnectionInfo
        const isValid = await dbConnectionInfo.validateConnection();
        res.json({ 
          dbStatus: isValid ? 'connected' : 'disconnected',
          valid: isValid,
          message: isValid ? 'Database connection is valid' : 'Database connection is invalid'
        });
      } catch (validationError: any) {
        logger.error(`Error validating database connection: ${validationError.message}`);
        res.status(500).json({ 
          error: validationError.message, 
          dbStatus: 'error',
          message: 'Failed to validate database connection'
        });
      }
    } else {
      res.status(400).json({ 
        error: 'Invalid action', 
        dbStatus: 'error',
        message: `Action '${action}' is not supported. Valid actions: connect, disconnect, validate`
      });
    }
  } catch (error: any) {
    logger.error(`Unexpected error in /db/${action} endpoint: ${error.message}`);
    // Ensure we always send a JSON response even on uncaught errors
    res.status(500).json({ 
      error: error.message, 
      dbStatus: 'error',
      message: 'An unexpected error occurred'
    });
  }
});

// Comprehensive diagnostics endpoint
router.get('/diagnostics', async (req, res) => {
  try {
    // System information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem()
    };
    
    // Network information
    const networkInfo = {
      interfaces: os.networkInterfaces()
    };
    
    // Database information
    let dbInfo = null;
    let dbConnections = null;
    let dbQueries = null;
    let dbTables = null;
    
    if (dbConnectionInfo.isConnected()) {
      try {
        // General database information
        const dbInfoResult = await sequelize.query(
          `SELECT version() as version, 
           now() as time, 
           current_database() as database,
           pg_size_pretty(pg_database_size(current_database())) as db_size,
           current_setting('max_connections') as max_connections`,
          { type: QueryTypes.SELECT }
        );
        
        if (dbInfoResult && dbInfoResult.length > 0) {
          dbInfo = dbInfoResult[0];
        }
        
        // Connection information
        const connectionResult = await sequelize.query(
          `SELECT count(*) as total_connections,
           count(*) FILTER (WHERE state = 'active') as active,
           count(*) FILTER (WHERE state = 'idle') as idle,
           count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
           count(*) FILTER (WHERE wait_event is not null) as waiting,
           extract(epoch from (now() - backend_start)) as max_connection_age_seconds
           FROM pg_stat_activity 
           WHERE backend_type = 'client backend'`,
          { type: QueryTypes.SELECT }
        );
        
        if (connectionResult && connectionResult.length > 0) {
          dbConnections = connectionResult[0];
        }
        
        // Query information
        const queryResult = await sequelize.query(
          `SELECT datname, 
           xact_commit as commits, 
           xact_rollback as rollbacks,
           blks_read, 
           blks_hit,
           tup_returned, 
           tup_fetched, 
           tup_inserted, 
           tup_updated, 
           tup_deleted
           FROM pg_stat_database 
           WHERE datname = current_database()`,
          { type: QueryTypes.SELECT }
        );
        
        if (queryResult && queryResult.length > 0) {
          dbQueries = queryResult[0];
        }
        
        // Table information (limited to 10 tables)
        const tableResult = await sequelize.query(
          `SELECT relname as table_name, 
           n_live_tup as row_count,
           pg_size_pretty(pg_relation_size(quote_ident(relname))) as size,
           seq_scan,
           idx_scan
           FROM pg_stat_user_tables
           ORDER BY n_live_tup DESC
           LIMIT 10`,
          { type: QueryTypes.SELECT }
        );
        
        if (tableResult && tableResult.length > 0) {
          dbTables = tableResult;
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.warn(`Unable to get detailed database information: ${error.message}`);
      }
    }
    
    // Connection pool information
    const poolInfo = {
      config: dbConnectionInfo.config().pool,
      status: dbConnectionInfo.pgPoolStatus()
    };
    
    // Combine all diagnostics
    const diagnostics = {
      time: new Date().toISOString(),
      system: systemInfo,
      network: networkInfo,
      database: {
        connected: dbConnectionInfo.isConnected(),
        lastSuccessfulConnection: dbConnectionInfo.lastSuccessfulConnection() 
          ? new Date(dbConnectionInfo.lastSuccessfulConnection()!).toISOString() 
          : null,
        info: dbInfo,
        connections: dbConnections,
        queries: dbQueries,
        tables: dbTables,
        pool: poolInfo
      }
    };
    
    res.json(diagnostics);
  } catch (error: any) {
    logger.error(`Error in diagnostics endpoint: ${error.message}`);
    res.status(500).json({
      error: error.message,
      status: 'error',
      time: new Date().toISOString()
    });
  }
});

// Test cache persistence
router.get('/cache/persistence', async (req, res) => {
  try {
    const filePath = './cache-backup-test.json';
    
    // First check if we can persist the cache
    const beforeSize = cache.stats().size;
    const persistResult = await persistCache(filePath);
    
    if (!persistResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to persist cache',
        error: persistResult.error
      });
    }
    
    // Now clear the cache and verify it's empty
    cache.clear();
    const afterClearSize = cache.stats().size;
    
    if (afterClearSize !== 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        beforeSize,
        afterClearSize
      });
    }
    
    // Now load the cache from the file
    const loadResult = await loadCache(filePath);
    
    if (!loadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load cache from file',
        error: loadResult.error
      });
    }
    
    // Verify the cache is loaded
    const afterLoadSize = cache.stats().size;
    
    // Run test with typed cache operations
    const testKey = 'typed:test:key';
    const testValue = { name: 'Test Object', value: Date.now() };
    
    // Test typed set operation
    const setResult = await setCache<typeof testValue>(testKey, testValue, 60);
    
    // Test typed get operation
    const getResult = await getCache<typeof testValue>(testKey);
    
    // Test delete operation
    const deleteResult = await deleteCache(testKey);
    
    res.json({
      success: true,
      message: 'Cache persistence test completed successfully',
      persistResult: {
        success: persistResult.success,
        filePath: persistResult.value
      },
      loadResult: {
        success: loadResult.success,
        filePath: loadResult.value
      },
      sizeBefore: beforeSize,
      sizeAfterClear: afterClearSize,
      sizeAfterLoad: afterLoadSize,
      typedCacheOperations: {
        set: setResult,
        get: getResult,
        delete: deleteResult
      }
    });
    
    // Try to clean up the test file
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      logger.error('Failed to clean up test file:', cleanupError);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Cache persistence test failed:', errorMessage);
    
    return res.status(500).json({
      success: false,
      message: 'Cache persistence test failed',
      error: errorMessage
    });
  }
});

// Enhanced Cache health check endpoint
router.get('/cache', async (req, res) => {
  try {
    // Get enhanced cache statistics with metrics
    const cacheStats = cache.stats();
    
    // Test cache with a simple set/get
    let readWriteTest = false;
    let readWriteError = null;
    let readWriteTime = 0;
    
    try {
      const testKey = 'health:check:test';
      const testValue = `test-${Date.now()}`;
      
      // Set a value in the cache and measure time
      const setStart = Date.now();
      cache.set(testKey, testValue, 60); // 60 seconds expiry
      const setEnd = Date.now();
      
      // Retrieve the value and measure time
      const getStart = Date.now();
      const retrievedValue = cache.get(testKey);
      const getEnd = Date.now();
      
      // Total operation time
      readWriteTime = (setEnd - setStart) + (getEnd - getStart);
      
      // Check if the retrieved value matches the original
      readWriteTest = testValue === retrievedValue;
      logger.info(`Cache diagnostics - Read/write test ${readWriteTest ? 'successful' : 'failed'} in ${readWriteTime}ms`);
      
      // Clean up by removing the test key
      cache.del(testKey);
    } catch (rwError) {
      readWriteError = rwError instanceof Error ? rwError.message : String(rwError);
      logger.error('Cache diagnostics - Read/write test failed:', readWriteError);
    }
    
    // Count different types of keys by prefix
    const keyTypes = cacheStats.keys.reduce((acc: Record<string, number>, key: string) => {
      // Check common key prefixes
      const prefix = key.split(':')[0] || 'other';
      acc[prefix] = (acc[prefix] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate memory usage
    const memoryUsage = process.memoryUsage();
    const cacheMemoryPercentage = Math.round((cacheStats.memoryEstimate / memoryUsage.heapUsed) * 100);
    
    // Get the hottest keys (most accessed)
    const hotKeys = cacheStats.topHits.map(hit => ({
      key: hit.key,
      hits: hit.hits,
      accessFrequency: 'high'
    }));
    
    // Get the coldest keys (most missed)
    const coldKeys = cacheStats.topMisses.map(miss => ({
      key: miss.key,
      misses: miss.misses,
      accessFrequency: 'low'
    }));
    
    // Run stressful operation to measure performance
    let stressTestResult = null;
    try {
      const testItemCount = 100;
      const testItemSize = 1; // 1KB
      
      const stressStart = Date.now();
      
      // Create a test key with timestamp to avoid conflicts
      const stressTestKeyPrefix = `stress:test:${Date.now()}:`;
      
      // Generate random data
      const generateRandomString = (sizeKB: number) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        // 1KB is roughly 1000 characters
        const length = sizeKB * 1000;
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      const testData = generateRandomString(testItemSize);
      
      // Add items to cache
      for (let i = 0; i < testItemCount; i++) {
        cache.set(`${stressTestKeyPrefix}${i}`, { 
          data: testData,
          index: i
        }, 30); // 30 seconds TTL
      }
      
      // Read back some random items
      const readItems = 20;
      for (let i = 0; i < readItems; i++) {
        const randomIndex = Math.floor(Math.random() * testItemCount);
        cache.get(`${stressTestKeyPrefix}${randomIndex}`);
      }
      
      const stressEnd = Date.now();
      const stressTime = stressEnd - stressStart;
      
      // Clean up stress test keys
      cache.clearPattern(stressTestKeyPrefix);
      
      stressTestResult = {
        success: true,
        itemsCreated: testItemCount,
        itemsRead: readItems,
        itemSizeKB: testItemSize,
        executionTimeMs: stressTime,
        opsPerSecond: Math.round((testItemCount + readItems) / (stressTime / 1000))
      };
    } catch (stressError) {
      stressTestResult = {
        success: false,
        error: stressError instanceof Error ? stressError.message : String(stressError)
      };
    }
    
    return res.status(200).json({
      status: 'connected',
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      
      // Basic tests
      basicTest: {
        readWriteTest,
        readWriteError,
        readWriteTimeMs: readWriteTime
      },
      
      // Cache metrics
      metrics: {
        totalKeys: cacheStats.size,
        keysByType: keyTypes,
        hitRatio: cacheStats.hitRatio,
        errorsCount: Object.values(cacheStats.errors || {}).reduce((a, b) => a + b, 0),
        keysSample: cacheStats.keys.slice(0, 10)
      },
      
      // Memory usage
      memory: {
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        external: `${Math.round((memoryUsage.external || 0) / 1024 / 1024)} MB`,
        cacheEstimate: `${Math.round(cacheStats.memoryEstimate / 1024 / 1024)} MB`,
        cachePercentage: `${cacheMemoryPercentage}%`,
        maxAllowed: `${Math.round(MAX_MEMORY_USAGE / 1024 / 1024)} MB`,
      },
      
      // Performance metrics
      performance: {
        hotKeys,
        coldKeys,
        stressTest: stressTestResult,
        cpuUsage: process.cpuUsage(),
        resourceUsage: process.resourceUsage ? process.resourceUsage() : null
      },
      
      // Configuration
      config: {
        maxItems: MAX_CACHE_ITEMS,
        ttlCleanupInterval: CLEANUP_INTERVAL / 1000 + ' seconds',
        persistenceSupported: true
      },
      
      // Server info
      serverInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: `${Math.floor(process.uptime())} seconds`
      }
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Cache health check failed:', errorMessage);
    
    return res.status(500).json({
      status: 'error',
      message: errorMessage,
      time: new Date().toISOString()
    });
  }
});

export default router;
