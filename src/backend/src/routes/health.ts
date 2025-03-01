import express from 'express';
import { Sequelize } from 'sequelize';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Get API health status
 *     description: Check the health status of the API and its dependencies
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                 timestamp:
 *                   type: string
 *                   example: "2023-08-01T12:00:00Z"
 *                 services:
 *                   type: object
 *       500:
 *         description: System is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/', async (req, res) => {
  const startTime = process.hrtime();
  const errors: string[] = [];
  let dbStatus = 'unknown';
  let redisStatus = 'unknown';
  let aiStatus = 'unknown';
  
  // Check database connection
  try {
    // Access the sequelize instance from app locals
    const sequelize = req.app.locals.sequelize as Sequelize;
    await sequelize.authenticate();
    dbStatus = 'healthy';
  } catch (error) {
    dbStatus = 'unhealthy';
    errors.push(`Database connection failed: ${error.message}`);
    logger.error('Health check - Database error:', error);
  }
  
  // Check Redis connection if available
  try {
    const redisClient = req.app.locals.redisClient as Redis;
    if (redisClient) {
      const pingResult = await redisClient.ping();
      redisStatus = pingResult === 'PONG' ? 'healthy' : 'unhealthy';
    } else {
      redisStatus = 'not configured';
    }
  } catch (error) {
    redisStatus = 'unhealthy';
    errors.push(`Redis connection failed: ${error.message}`);
    logger.error('Health check - Redis error:', error);
  }
  
  // Check AI service connection
  try {
    // This would be implemented to check AI service health
    // For now, just set as healthy
    aiStatus = 'healthy';
  } catch (error) {
    aiStatus = 'unhealthy';
    errors.push(`AI service connection failed: ${error.message}`);
    logger.error('Health check - AI service error:', error);
  }
  
  // Calculate response time
  const hrtime = process.hrtime(startTime);
  const responseTimeMs = Math.round(hrtime[0] * 1000 + hrtime[1] / 1000000);
  
  // Determine overall status
  const isHealthy = errors.length === 0;
  
  // Build response
  const healthStatus = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    responseTime: `${responseTimeMs}ms`,
    services: {
      database: dbStatus,
      redis: redisStatus,
      ai: aiStatus
    }
  };
  
  if (errors.length > 0) {
    healthStatus['errors'] = errors;
  }
  
  // Log health check result if unhealthy
  if (!isHealthy) {
    logger.warn('Health check failed', { errors });
  }
  
  res.status(isHealthy ? 200 : 500).json(healthStatus);
});

/**
 * @swagger
 * /api/health/db:
 *   get:
 *     summary: Check database health
 *     description: Check the connection to the database
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Database connection is healthy
 *       500:
 *         description: Database connection failed
 */
router.get('/db', async (req, res) => {
  try {
    const sequelize = req.app.locals.sequelize as Sequelize;
    await sequelize.authenticate();
    res.status(200).json({
      status: 'healthy',
      message: 'Database connection is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/health/redis:
 *   get:
 *     summary: Check Redis health
 *     description: Check the connection to Redis
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Redis connection is healthy
 *       500:
 *         description: Redis connection failed
 */
router.get('/redis', async (req, res) => {
  try {
    const redisClient = req.app.locals.redisClient as Redis;
    if (!redisClient) {
      return res.status(200).json({
        status: 'not configured',
        message: 'Redis is not configured',
        timestamp: new Date().toISOString()
      });
    }
    
    const pingResult = await redisClient.ping();
    if (pingResult === 'PONG') {
      res.status(200).json({
        status: 'healthy',
        message: 'Redis connection is working',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    logger.error('Redis health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      message: 'Redis connection failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;