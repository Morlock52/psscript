import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import Redis from 'ioredis';
import logger from './utils/logger';
import authRoutes from './routes/auth';
import scriptRoutes from './routes/scripts';
import userRoutes from './routes/users';
import categoryRoutes from './routes/categories';
import tagRoutes from './routes/tags';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { redisMiddleware } from './middleware/redisMiddleware';
import { setupSwagger } from './utils/swagger';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// Database connection with improved error handling and connection pooling
const sequelize = new Sequelize(
  process.env.DB_NAME || 'psscript',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    },
    retry: {
      match: [/Deadlock/i, /Lock/i, /Timeout/i],
      max: 3
    }
  }
);

// Set up Redis client for caching
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
  // Don't crash on Redis errors, the app can still function
});

// Security middleware
app.use(helmet());

// Enable CORS with specific origins in production
app.use(cors({
  origin: isProduction 
    ? [process.env.FRONTEND_URL || 'https://psscript.example.com', /\.psscript\.com$/]
    : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to authentication endpoints
app.use('/api/auth', apiLimiter);

// Body parsing middleware with increased limits for script content
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add Redis middleware for caching
app.use(redisMiddleware(redisClient));

// Setup Swagger API documentation
setupSwagger(app);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/health', healthRoutes);

// Root route with API information
app.get('/', (req, res) => {
  res.json({
    message: 'PowerShell Script Management API',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api-docs',
    status: 'healthy'
  });
});

// 404 handler - must be before the error handler
app.use((req, res, next) => {
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
        await sequelize.authenticate();
        connected = true;
        logger.info('Database connection established successfully');
      } catch (error) {
        logger.error(`Database connection attempt ${attempts} failed:`, error);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // Start HTTP server
    const server = app.listen(port, () => {
      logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
      logger.info(`API documentation available at http://localhost:${port}/api-docs`);
    });
    
    // Set server timeouts
    server.timeout = 60000; // 60 seconds
    
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
          await sequelize.close();
          logger.info('Database connections closed');
          
          // Close Redis connection
          await redisClient.quit();
          logger.info('Redis connection closed');
          
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

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  // Log but don't crash in production
});

// Export server for testing purposes
const server = startServer();
export default server;