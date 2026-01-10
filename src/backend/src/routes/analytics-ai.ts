/**
 * AI Analytics API Routes
 * Provides endpoints for viewing AI usage, costs, and performance metrics
 *
 * Based on TECH-REVIEW-2026.md recommendations
 * Date: 2026-01-26
 */

import express, { Request, Response } from 'express';
import { AIAnalyticsMiddleware } from '../middleware/aiAnalytics';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/analytics/ai
 * Get aggregated AI analytics for a date range
 *
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - userId: Optional user ID to filter by
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const userId = req.query.userId
      ? parseInt(req.query.userId as string)
      : undefined;

    const analytics = await AIAnalyticsMiddleware.getAnalytics(
      startDate,
      endDate,
      userId
    );

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error fetching AI analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI analytics',
    });
  }
});

/**
 * GET /api/analytics/ai/budget-alerts
 * Check if daily or monthly budget has been exceeded
 *
 * Query params:
 * - dailyBudget: Daily budget in USD (default: 50)
 * - monthlyBudget: Monthly budget in USD (default: 1000)
 */
router.get('/budget-alerts', async (req: Request, res: Response) => {
  try {
    const dailyBudget = req.query.dailyBudget
      ? parseFloat(req.query.dailyBudget as string)
      : 50;

    const monthlyBudget = req.query.monthlyBudget
      ? parseFloat(req.query.monthlyBudget as string)
      : 1000;

    const alerts = await AIAnalyticsMiddleware.checkBudgetAlerts(
      dailyBudget,
      monthlyBudget
    );

    res.json({
      success: true,
      alerts,
      hasAlerts: alerts.length > 0,
    });
  } catch (error) {
    logger.error('Error checking budget alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check budget alerts',
    });
  }
});

/**
 * GET /api/analytics/ai/summary
 * Get a quick summary of AI usage for today
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const analytics = await AIAnalyticsMiddleware.getAnalytics(
      today,
      tomorrow
    );

    res.json({
      success: true,
      data: {
        summary: analytics.summary,
        topModels: analytics.byModel.slice(0, 5),
        topEndpoints: analytics.byEndpoint.slice(0, 5),
      },
    });
  } catch (error) {
    logger.error('Error fetching AI summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI summary',
    });
  }
});

export default router;
