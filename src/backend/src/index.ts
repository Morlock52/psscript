/**
 * Application entry point
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import morgan from 'morgan';
import https from 'https';
import { readFileSync } from 'fs';
// Enhanced security middleware with helmet, rate limiting, input sanitization, and CSRF protection
import {
  securityHeaders,
  authLimiter,
  aiLimiter,
  voiceLimiter,
  uploadLimiter,
  scriptLimiter,
  sanitizeInput,
  securityLogger,
  validateRequestSize,
  csrfProtection,
} from './middleware/security';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import scriptRoutes from './routes/scripts';
import userRoutes from './routes/users';
import categoryRoutes from './routes/categories';
import tagRoutes from './routes/tags';
import analyticsRoutes from './routes/analytics';
import analyticsAiRoutes from './routes/analytics-ai';
import healthRoutes from './routes/health';
import chatRoutes from './routes/chat';
import voiceRoutes from './routes/voice';
import agentsRoutes from './routes/agents';
import aiAgentRoutes from './routes/ai-agent';
import assistantsRoutes from './routes/assistants';
import documentationRoutes from './routes/documentation';
import adminDbRoutes from './routes/admin-db';
import { errorHandler } from './middleware/errorHandler';
import { authenticateJWT, requireAdmin } from './middleware/authMiddleware';
import { setupSwagger } from './utils/swagger';
import path from 'path';
import { existsSync } from 'fs';
import { initAIMetricsModel, AIMetric } from './middleware/aiAnalytics';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(express.static(path.join(process.cwd(), 'src', 'backend', 'src', 'public')));

// Serve generated documentation exports when present in local or hosted builds.
const hostedDocsExportsDir = process.env.DOCS_EXPORTS_DIR;
const docsExportsDir = hostedDocsExportsDir || path.resolve(__dirname, '../../../docs/exports');
console.log(`Docs exports directory: ${docsExportsDir} (exists: ${existsSync(docsExportsDir)})`);
app.use('/docs/exports', express.static(docsExportsDir));
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const _isProduction = process.env.NODE_ENV === 'production';

// Log startup details
console.log(`Starting server: PORT=${port}, ENV=${process.env.NODE_ENV || 'development'}`);

import db from './database/connection';
import { validateTlsConfiguration } from './utils/secureHttpClient';

// SECURITY: Validate SSL/TLS configuration at startup
// This ensures certificate validation is properly enforced
try {
  validateTlsConfiguration();
} catch (error) {
  logger.error('TLS configuration validation failed:', error);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Exit in production if TLS is misconfigured
  }
}

// Set up environment-specific configuration
const isDevelopment = process.env.NODE_ENV !== 'production';

// Keep development startup explicit without enabling any runtime mock service paths.
if (isDevelopment) {
  logger.info('Development mode startup complete');
}

// Cache is now a standalone module to avoid circular dependencies
// Import and re-export for backward compatibility
import { cache } from './services/cacheService';
export { cache };
logger.info('Cache service initialized');

// Enhanced security middleware with CSP, XSS protection, and more
// Configured for Monaco editor compatibility while still providing robust protection
app.use(securityHeaders);

// Input sanitization - removes potentially dangerous control characters
app.use(sanitizeInput);

// Security event logging - detects and logs suspicious patterns
app.use(securityLogger);

// CSRF protection - validates Origin headers for state-changing requests
app.use(csrfProtection());

// Enable CORS - configure for both development and production with more permissive settings
// Supports Server-Sent Events (SSE) for real-time streaming
app.use(cors({
  // Use dynamic origin to support credentials (cannot be '*' with credentials: true)
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    // Allow all origins in development
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'x-openai-api-key',
    'x-api-key',
    'Cache-Control',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Cache-Control',
    'Connection',
    'X-Accel-Buffering'
  ],
  credentials: true, // Required for EventSource with withCredentials
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Request logging in non-test environments
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { 
    stream: { 
      write: (message) => logger.info(message.trim()) 
    }
  }));
}

// Compression middleware to reduce response size
app.use(compression());

// Apply endpoint-specific rate limiting for enhanced protection
// Auth: Stricter limits to prevent brute force (10 attempts per 15 min, successful requests don't count)
app.use('/api/auth', authLimiter);

// AI endpoints: 20 requests per minute (AI operations are expensive)
app.use('/api/ai-agent', aiLimiter);
app.use('/api/assistants', aiLimiter);
app.use('/api/chat', aiLimiter);
app.use('/api/voice', voiceLimiter);

// Script operations: 30 requests per 5 minutes
app.use('/api/scripts', scriptLimiter);

// Upload endpoints: 10 uploads per 5 minutes
app.use('/api/scripts/upload', uploadLimiter);

// Request size validation - rejects requests exceeding 50MB before parsing
app.use(validateRequestSize(50));

// Body parsing middleware with increased limits for script content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create a simple cache middleware to replace Redis
const cacheMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip non-GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Skip authentication routes and other non-cacheable endpoints
  // SECURITY: User management endpoints must NOT be cached to prevent
  // authorization bypass (admin responses being served to non-admin users)
  const skipRoutes = [
    '/api/auth',
    '/api/health',
    '/api/users',      // All user management endpoints - role-based access control
    '/api/categories', // Categories are mutated frequently; caching here causes stale UI after CRUD.
    // Scripts are interactive content and are mutated frequently (autosave, category changes, deletes).
    // Caching has caused stale reads and test flakiness (e.g., category uncategorize-delete not reflected).
    '/api/scripts',
    '/api/voice',     // Voice routes are user/auth dependent and can contain sensitive data.
    '/api/agents',     // Agent runs/threads are dynamic; /runs/:id must never be cached.
    '/api/analytics',  // Analytics is user/time dependent; caching can serve misleading data.
    '/api/admin/db',   // DB maintenance is stateful; cached backup listings hide newly created backups.
    // Documentation crawl jobs are async + progress-driven; caching breaks progress polling.
    '/api/documentation/crawl',
  ];
  
  if (skipRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  // Create a unique cache key based on the request path
  // Include query string to avoid collisions like /api/scripts?limit=5 vs ?limit=50.
  const cacheKey = `api:cache:${req.originalUrl}`;
  
  // Define cache TTL based on route
  let cacheTTL = 300; // Default: 5 minutes
  
  if (req.path.includes('/scripts/')) {
    cacheTTL = 3600; // Script details: 1 hour
  } else if (req.path.includes('/categories')) {
    cacheTTL = 86400; // Categories: 1 day
  }

  // Try to get cached response
  const cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    // Set cache header
    res.setHeader('X-Cache', 'HIT');
    return res.status(cachedData.statusCode).json(cachedData.body);
  }
  
  // Cache miss - continue with request
  res.setHeader('X-Cache', 'MISS');
  
  // Intercept the response to cache it
  const originalSend = res.send;
  res.send = function(body): express.Response {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        // Create cached response object
        const cachedResponse = {
          statusCode: res.statusCode,
          body: JSON.parse(body) // Only cache JSON responses
        };
        
        // Save to cache with expiration
        cache.set(cacheKey, cachedResponse, cacheTTL);
        
      } catch (error) {
        // If not valid JSON or other error, don't cache
        logger.debug('Response not cached (not valid JSON):', error instanceof Error ? error.message : String(error));
      }
    }
    
    // Call the original send method
    return originalSend.call(this, body);
  };
  
  next();
};

// Add cache middleware
app.use(cacheMiddleware);

// Setup Swagger API documentation
setupSwagger(app);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics/ai', analyticsAiRoutes);
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes); // Standard health check endpoint
app.use('/api/chat', chatRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ai-agent', aiAgentRoutes);
app.use('/api/assistants', assistantsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/documentation', documentationRoutes);
app.use('/api/admin/db', adminDbRoutes);

// Create proxy routes for the frontend to use
// This ensures the frontend can directly call /scripts/please instead of /api/ai-agent/please
app.use('/scripts/please', (req, res) => {
  req.url = '/api/ai-agent/please';
  (app as any)._router.handle(req, res);
});

app.use('/scripts/analyze/assistant', (req, res) => {
  req.url = '/api/ai-agent/analyze/assistant';
  (app as any)._router.handle(req, res);
});

app.use('/scripts/generate', (req, res) => {
  req.url = '/api/ai-agent/generate';
  (app as any)._router.handle(req, res);
});

app.use('/scripts/explain', (req, res) => {
  req.url = '/api/ai-agent/explain';
  (app as any)._router.handle(req, res);
});

app.use('/scripts/examples', (req, res) => {
  req.url = '/api/ai-agent/examples';
  (app as any)._router.handle(req, res);
});

// Root route with API information
app.get('/api', (req, res) => {
  res.json({
    message: 'PowerShell Script Management API',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api-docs',
    status: 'healthy'
  });
});

// Serve the index.html file at the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler - must be before the error handler
app.use((req, res, _next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource at ${req.originalUrl} was not found`
  });
});

// Error handling middleware
app.use(errorHandler);

// Create HTTP server with proper error handling
const startServer = async () => {
  try {
    // Test database connection with retry
    let connected = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!connected && attempts < maxAttempts) {
      try {
        attempts++;
        await db.connect();
        connected = true;
        logger.info('Database connection established successfully');

        // Ensure AI analytics model is registered against the live Sequelize instance.
        // Without this, /api/analytics/ai/* can throw "Sequelize not initialized".
        try {
          if (!AIMetric.sequelize) {
            initAIMetricsModel(db.sequelize);
          }
        } catch (err) {
          logger.error('Failed to initialize AIMetrics model:', err);
        }
      } catch (error) {
        logger.error(`Database connection attempt ${attempts} failed:`, error);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Add endpoint to clear cache
    // SECURITY: Requires authentication and admin role
    app.get('/api/cache/clear', authenticateJWT, requireAdmin, (req, res) => {
      const pattern = req.query.pattern as string;
      let count = 0;

      if (pattern) {
        count = cache.clearPattern(pattern) || 0;
        logger.info(`Cache cleared for pattern: ${pattern}, removed ${count} entries`);
      } else {
        const stats = cache.stats();
        count = stats.size;
        cache.clear();
        logger.info(`Full cache cleared, removed ${count} entries`);
      }
      
      res.json({
        success: true,
        message: `Cache cleared successfully`,
        entriesRemoved: count
      });
    });
    
    // Add enhanced endpoint to get detailed cache stats
    // SECURITY: Requires authentication and admin role
    app.get('/api/cache/stats', authenticateJWT, requireAdmin, (req, res) => {
      const stats = cache.stats();
      const memUsage = process.memoryUsage();
      
      res.json({
        // Basic stats
        size: stats.size,
        keys: stats.keys.slice(0, 100), // Limit to first 100 keys to avoid huge responses
        
        // Performance metrics
        hitRatio: stats.hitRatio,
        topHits: stats.topHits,
        topMisses: stats.topMisses,
        
        // Memory usage
        memoryUsage: {
          ...memUsage,
          cacheMemoryEstimate: stats.memoryEstimate,
          cacheMemoryPercentage: Math.round((stats.memoryEstimate / memUsage.heapUsed) * 100) / 100
        },
        
        // Error tracking
        errors: stats.errors,
        
        // LRU info
        maxItems: 10000,
        maxMemory: '500MB'
      });
    });
    
    // Add endpoint to test cache with random data
    // SECURITY: Requires authentication and admin role
    app.get('/api/cache/test', authenticateJWT, requireAdmin, (req, res) => {
      const count = parseInt(req.query.count as string, 10) || 100;
      const sizeKB = parseInt(req.query.sizeKB as string, 10) || 1;
      const ttl = parseInt(req.query.ttl as string, 10) || 60;
      
      try {
        // Generate random data to store in cache
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
        
        const startTime = Date.now();
        const randomData = generateRandomString(sizeKB);
        
        // Store items in cache
        for (let i = 0; i < count; i++) {
          const key = `test:cache:${Date.now()}:${i}`;
          cache.set(key, { data: randomData, index: i }, ttl);
        }
        
        const endTime = Date.now();
        
        res.json({
          success: true,
          message: `Added ${count} items (${sizeKB}KB each) to cache with TTL of ${ttl}s`,
          timeTaken: `${endTime - startTime}ms`,
          currentSize: cache.stats().size
        });
      } catch (error) {
        res.status(500).json({
          success: false, 
          message: 'Error during cache test',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Add endpoint to persist cache to file
    // SECURITY: Requires authentication, admin role, and validates file path
    app.post('/api/cache/persist', authenticateJWT, requireAdmin, async (req, res) => {
      try {
        // SECURITY: Only allow saving to predefined safe directory
        const allowedDir = path.resolve(process.cwd(), 'cache-backups');
        const requestedFile = path.basename(req.query.path as string || 'cache-backup.json');

        // Validate filename: only alphanumeric, dashes, underscores, and .json extension
        if (!/^[a-zA-Z0-9_-]+\.json$/.test(requestedFile)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid filename. Use only alphanumeric characters, dashes, underscores, and .json extension'
          });
        }

        const safePath = path.join(allowedDir, requestedFile);
        const success = await (cache as any).persistence.saveToFile(safePath);

        res.json({
          success,
          message: success ? `Cache persisted to ${requestedFile}` : `Failed to persist cache`,
          cacheSize: cache.stats().size
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error persisting cache',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Add endpoint to load cache from file
    // SECURITY: Requires authentication, admin role, and validates file path
    app.post('/api/cache/load', authenticateJWT, requireAdmin, async (req, res) => {
      try {
        // SECURITY: Only allow loading from predefined safe directory
        const allowedDir = path.resolve(process.cwd(), 'cache-backups');
        const requestedFile = path.basename(req.query.path as string || 'cache-backup.json');

        // Validate filename: only alphanumeric, dashes, underscores, and .json extension
        if (!/^[a-zA-Z0-9_-]+\.json$/.test(requestedFile)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid filename. Use only alphanumeric characters, dashes, underscores, and .json extension'
          });
        }

        const safePath = path.join(allowedDir, requestedFile);
        const success = await (cache as any).persistence.loadFromFile(safePath);

        res.json({
          success,
          message: success ? `Cache loaded from ${requestedFile}` : `Failed to load cache`,
          cacheSize: cache.stats().size
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error loading cache',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Determine if TLS is enabled (certificates mounted)
    const tlsEnabled = process.env.TLS_CERT && process.env.TLS_KEY;
    const protocol = tlsEnabled ? 'HTTPS' : 'HTTP';
    console.log(`Starting ${protocol} server on port ${port}`);

    // Initialize default categories
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const CategoryController = require('./controllers/CategoryController').default;
      await CategoryController.initializeDefaultCategories();
      logger.info('Default categories initialized');
    } catch (error) {
      logger.error('Error initializing default categories:', error);
    }
    
    // Start HTTP or HTTPS server based on certificate availability
    let server;
    if (tlsEnabled) {
      // mTLS: Load certificates for secure tunnel-to-origin communication
      const httpsOptions = {
        key: readFileSync(process.env.TLS_KEY!),
        cert: readFileSync(process.env.TLS_CERT!),
        // Optional: Load CA for client certificate verification (full mTLS)
        ...(process.env.TLS_CA && {
          ca: readFileSync(process.env.TLS_CA),
          requestCert: true,
          rejectUnauthorized: true
        })
      };

      server = https.createServer(httpsOptions, app).listen(port, '0.0.0.0', () => {
        console.log(`HTTPS server is now running on https://0.0.0.0:${port}`);
        logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port} (TLS enabled)`);
        logger.info(`API documentation available at https://localhost:${port}/api-docs`);
        logger.info(`mTLS origin protection active`);
      });
    } else {
      server = app.listen(port, '0.0.0.0', () => {
        console.log(`HTTP server is now running on http://0.0.0.0:${port}`);
        logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
        logger.info(`API documentation available at http://localhost:${port}/api-docs`);
        logger.info(`In-memory cache initialized and ready`);
      });
    }
    
    // Set server timeouts.
    //
    // NOTE: Some endpoints (documentation crawl/import, AI analysis) can legitimately take
    // multiple minutes. A 60s socket timeout causes clients to see generic "Network Error"
    // / empty replies. Keep a tighter timeout in production, but allow longer in dev.
    const isProd = process.env.NODE_ENV === 'production';
    server.timeout = isProd ? 2 * 60 * 1000 : 10 * 60 * 1000; // prod: 2m, dev: 10m
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Exiting.`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
    
    // Graceful shutdown logic
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      // Close HTTP server (stop accepting new connections)
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close database connection
          await db.close();
          logger.info('Database connections closed');
          
          // Clear in-memory cache
          cache.clear();
          logger.info('In-memory cache cleared');
          
          logger.info('Shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force close if graceful shutdown fails
      setTimeout(() => {
        logger.error('Shutdown took too long, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Don't exit immediately in production to allow for graceful handling
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled promise rejection:', reason);
  // Log but don't crash in production
});

// Export server for testing purposes
const server = startServer();
export default server;
