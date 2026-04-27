import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware';
import analyticsController from '../controllers/AnalyticsController';
import logger from '../utils/logger';

const router = express.Router();
const controller = new analyticsController();

// Apply authentication middleware to all analytics routes
router.use(authenticateJWT);

/**
 * Endpoint to get security metrics and statistics
 */
router.get('/security', async (req, res) => {
  try {
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
    await controller.getCategoryDistribution(req, res);
  } catch (error) {
    logger.error('Error fetching category distribution:', error);
    return res.status(500).json({
      message: 'Failed to retrieve category distribution',
      status: 'error'
    });
  }
});

/**
 * General analytics summary - aggregates key metrics
 */
router.get('/summary', async (req, res) => {
  try {
    const { sequelize } = await import('../database/connection');
    const { QueryTypes } = await import('sequelize');

    const [scriptStats] = await sequelize.query(
      `SELECT
        COUNT(*)::int AS total_scripts,
        COUNT(DISTINCT user_id)::int AS total_authors,
        SUM(execution_count)::int AS total_executions,
        ROUND(AVG(execution_count), 1) AS avg_executions
      FROM scripts`,
      { type: QueryTypes.SELECT }
    ) as any[];

    const [analysisStats] = await sequelize.query(
      `SELECT
        COUNT(*)::int AS total_analyses,
        ROUND(AVG(security_score)::numeric, 1) AS avg_security_score,
        ROUND(AVG(quality_score)::numeric, 1) AS avg_quality_score,
        ROUND(AVG(risk_score)::numeric, 1) AS avg_risk_score
      FROM script_analysis`,
      { type: QueryTypes.SELECT }
    ) as any[];

    const [profileSource] = await sequelize.query(
      `SELECT
        CASE
          WHEN to_regclass('public.users') IS NOT NULL THEN 'users'
          WHEN to_regclass('public.app_profiles') IS NOT NULL THEN 'app_profiles'
          ELSE NULL
        END AS table_name`,
      { type: QueryTypes.SELECT }
    ) as any[];

    let userStats = { total_users: 0, active_users_30d: 0 };
    if (profileSource?.table_name === 'users') {
      [userStats] = await sequelize.query(
        `SELECT
          COUNT(*)::int AS total_users,
          COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END)::int AS active_users_30d
        FROM users`,
        { type: QueryTypes.SELECT }
      ) as any[];
    } else if (profileSource?.table_name === 'app_profiles') {
      const [profileColumns] = await sequelize.query(
        `SELECT
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'app_profiles'
              AND column_name = 'is_enabled'
          ) AS has_is_enabled`,
        { type: QueryTypes.SELECT }
      ) as any[];

      [userStats] = await sequelize.query(
        profileColumns?.has_is_enabled
          ? `SELECT
              COUNT(*)::int AS total_users,
              COUNT(CASE WHEN is_enabled = true THEN 1 END)::int AS active_users_30d
            FROM app_profiles`
          : `SELECT
              COUNT(*)::int AS total_users,
              COUNT(*)::int AS active_users_30d
            FROM app_profiles`,
        { type: QueryTypes.SELECT }
      ) as any[];
    }

    res.json({
      success: true,
      summary: {
        scripts: scriptStats || {},
        analysis: analysisStats || {},
        users: userStats || {},
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching analytics summary:', error);
    return res.status(500).json({
      message: 'Failed to retrieve analytics summary',
      status: 'error'
    });
  }
});

export default router;
