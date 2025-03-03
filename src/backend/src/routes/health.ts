import express from 'express';
import logger from '../utils/logger';
import { sequelize, dbConnectionInfo, connectionEvents } from '../database/connection';
import { QueryTypes } from 'sequelize';
import dns from 'dns';
import net from 'net';
import os from 'os';

const router = express.Router();

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
        tables = results.map((r: any) => r.table_name as string);
        logger.info("Health check - fetched tables: " + tables.join(", "));
      } catch (error: any) {
        logger.error("Error fetching tables in health endpoint: " + error.message);
        // Do not fail the entire request if table fetching fails
        tables = [];
      }
    }
    
    // Always return a valid response
    return res.status(200).json({
      dbStatus: dbStatus,
      status: 'healthy',
      message: authErrorMessage,
      time: new Date().toISOString(),
      uptime: process.uptime(),
      tables: tables
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

export default router;