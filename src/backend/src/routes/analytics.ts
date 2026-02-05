import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import analyticsController from '../controllers/AnalyticsController';
import logger from '../utils/logger';
import analyticsAiRoutes from './analytics-ai';

const router = express.Router();

// Apply authentication middleware to all analytics routes
router.use(authenticateJWT);

// AI analytics endpoints (usage/cost/perf)
router.use('/ai', analyticsAiRoutes);

/**
 * Endpoint to get security metrics and statistics
 */
router.get('/security', async (req, res) => {
  try {
    const controller = new analyticsController();
    await controller.getSecurityMetrics(req, res);
  } catch (error) {
    logger.error('Error fetching security metrics:', error);
    return res.status(500).json({
      message: 'Failed to retrieve security metrics',
      status: 'error'
    });
  }
});

/**
 * Usage analytics endpoint
 */
router.get('/usage', async (req, res) => {
  try {
    const controller = new analyticsController();
    await controller.getUsageAnalytics(req, res);
  } catch (error) {
    logger.error('Error fetching usage analytics:', error);
    return res.status(500).json({
      message: 'Failed to retrieve usage analytics',
      status: 'error'
    });
  }
});

/**
 * Category distribution endpoint
 */
router.get('/categories', async (req, res) => {
  try {
    const controller = new analyticsController();
    await controller.getCategoryDistribution(req, res);
  } catch (error) {
    logger.error('Error fetching category distribution:', error);
    return res.status(500).json({
      message: 'Failed to retrieve category distribution',
      status: 'error'
    });
  }
});

// General analytics summary
router.get('/summary', (req, res) => {
  const controller = new analyticsController();
  return controller.getSummary(req, res);
});

export default router;
