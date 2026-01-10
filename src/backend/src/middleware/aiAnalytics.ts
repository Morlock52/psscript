/**
 * AI Analytics Middleware
 * Tracks AI usage, costs, token consumption, and performance metrics
 *
 * Based on TECH-REVIEW-2026.md recommendations
 * Date: 2026-01-26
 */

import { Request, Response, NextFunction } from 'express';
import { Sequelize, DataTypes, Model } from 'sequelize';
import logger from '../utils/logger';

/**
 * AI Metrics Model
 * Tracks individual AI API calls with usage and cost data
 */
export interface AIMetricAttributes {
  id?: number;
  userId?: number;
  endpoint: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  latency: number;
  success: boolean;
  errorMessage?: string;
  requestPayload?: any;
  responsePayload?: any;
  createdAt?: Date;
}

export class AIMetric extends Model<AIMetricAttributes> implements AIMetricAttributes {
  public id!: number;
  public userId?: number;
  public endpoint!: string;
  public model!: string;
  public promptTokens!: number;
  public completionTokens!: number;
  public totalTokens!: number;
  public totalCost!: number;
  public latency!: number;
  public success!: boolean;
  public errorMessage?: string;
  public requestPayload?: any;
  public responsePayload?: any;
  public readonly createdAt!: Date;
}

/**
 * Initialize AI Metrics model
 */
export function initAIMetricsModel(sequelize: Sequelize): void {
  AIMetric.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      endpoint: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'API endpoint that made the AI request',
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'AI model used (e.g., gpt-4o, gpt-4o-mini, o3-mini)',
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'prompt_tokens',
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'completion_tokens',
      },
      totalTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'total_tokens',
      },
      totalCost: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false,
        defaultValue: 0,
        field: 'total_cost',
        comment: 'Cost in USD',
      },
      latency: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Latency in milliseconds',
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
      },
      requestPayload: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'request_payload',
        comment: 'Sanitized request data for debugging',
      },
      responsePayload: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'response_payload',
        comment: 'Sanitized response data for debugging',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at',
      },
    },
    {
      sequelize,
      tableName: 'ai_metrics',
      timestamps: false,
      indexes: [
        {
          fields: ['user_id'],
        },
        {
          fields: ['endpoint'],
        },
        {
          fields: ['model'],
        },
        {
          fields: ['created_at'],
        },
        {
          fields: ['success'],
        },
      ],
    }
  );

  logger.info('AIMetrics model initialized');
}

/**
 * Calculate cost based on model and token usage
 * Pricing as of January 2026
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Prices per 1M tokens (January 2026)
  const pricing: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o': { prompt: 2.50, completion: 10.00 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
    'o3-mini': { prompt: 1.10, completion: 4.40 },
    'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
    'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },
    'text-embedding-3-small': { prompt: 0.02, completion: 0 },
    'text-embedding-3-large': { prompt: 0.13, completion: 0 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini']; // Fallback to mini

  const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;

  return Number((promptCost + completionCost).toFixed(6));
}

/**
 * AI Analytics Middleware
 * Tracks all AI requests automatically
 */
export class AIAnalyticsMiddleware {
  /**
   * Track AI usage for a request
   */
  static trackUsage() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to capture response
      res.json = function (data: any) {
        const endTime = Date.now();
        const latency = endTime - startTime;

        // Extract usage data from response if available
        const usage = data?.usage || res.locals.usage;
        const model = req.body?.model || res.locals.model || 'gpt-4o-mini';

        if (usage) {
          const promptTokens = usage.prompt_tokens || 0;
          const completionTokens = usage.completion_tokens || 0;
          const totalTokens = usage.total_tokens || promptTokens + completionTokens;
          const totalCost = calculateCost(model, promptTokens, completionTokens);

          // Save metrics asynchronously (don't block response)
          AIMetric.create({
            userId: (req as any).user?.id,
            endpoint: req.path,
            model,
            promptTokens,
            completionTokens,
            totalTokens,
            totalCost,
            latency,
            success: res.statusCode < 400,
            errorMessage: res.statusCode >= 400 ? data?.error : undefined,
            requestPayload: {
              method: req.method,
              path: req.path,
              // Don't store sensitive data
              hasBody: !!req.body,
            },
            responsePayload: {
              statusCode: res.statusCode,
              hasData: !!data,
            },
          }).catch((error) => {
            logger.error('Failed to save AI metrics:', error);
          });

          logger.info('AI Request Tracked', {
            endpoint: req.path,
            model,
            tokens: totalTokens,
            cost: totalCost,
            latency,
          });
        }

        return originalJson(data);
      };

      next();
    };
  }

  /**
   * Get aggregated analytics
   */
  static async getAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<any> {
    const sequelize = AIMetric.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize not initialized');
    }

    const whereClause: any = {
      createdAt: {
        [Sequelize.Op.gte]: startDate,
        [Sequelize.Op.lte]: endDate,
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const [totalStats, byModel, byEndpoint, costTrend] = await Promise.all([
      // Total statistics
      AIMetric.findOne({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalRequests'],
          [sequelize.fn('SUM', sequelize.col('total_tokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'totalCost'],
          [sequelize.fn('AVG', sequelize.col('latency')), 'avgLatency'],
          [
            sequelize.literal(
              'PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency)'
            ),
            'p95Latency',
          ],
          [
            sequelize.literal(
              'AVG(CASE WHEN success = true THEN 1 ELSE 0 END)'
            ),
            'successRate',
          ],
        ],
        where: whereClause,
        raw: true,
      }),

      // By model
      AIMetric.findAll({
        attributes: [
          'model',
          [sequelize.fn('COUNT', sequelize.col('id')), 'requests'],
          [sequelize.fn('SUM', sequelize.col('total_tokens')), 'totalTokens'],
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'totalCost'],
          [sequelize.fn('AVG', sequelize.col('latency')), 'avgLatency'],
        ],
        where: whereClause,
        group: ['model'],
        order: [[sequelize.fn('SUM', sequelize.col('total_cost')), 'DESC']],
        raw: true,
      }),

      // By endpoint
      AIMetric.findAll({
        attributes: [
          'endpoint',
          [sequelize.fn('COUNT', sequelize.col('id')), 'requests'],
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'totalCost'],
          [sequelize.fn('AVG', sequelize.col('latency')), 'avgLatency'],
        ],
        where: whereClause,
        group: ['endpoint'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 10,
        raw: true,
      }),

      // Cost trend (daily)
      AIMetric.findAll({
        attributes: [
          [
            sequelize.fn('DATE', sequelize.col('created_at')),
            'date',
          ],
          [sequelize.fn('SUM', sequelize.col('total_cost')), 'cost'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'requests'],
        ],
        where: whereClause,
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true,
      }),
    ]);

    return {
      summary: totalStats,
      byModel,
      byEndpoint,
      costTrend,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get cost alerts if budget threshold is exceeded
   */
  static async checkBudgetAlerts(
    dailyBudget: number,
    monthlyBudget: number
  ): Promise<any[]> {
    const sequelize = AIMetric.sequelize;
    if (!sequelize) {
      throw new Error('Sequelize not initialized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [dailyCost, monthlyCost] = await Promise.all([
      AIMetric.sum('total_cost', {
        where: {
          createdAt: {
            [Sequelize.Op.gte]: today,
          },
        },
      }),
      AIMetric.sum('total_cost', {
        where: {
          createdAt: {
            [Sequelize.Op.gte]: startOfMonth,
          },
        },
      }),
    ]);

    const alerts: any[] = [];

    if (dailyCost && dailyCost > dailyBudget) {
      alerts.push({
        type: 'daily_budget_exceeded',
        threshold: dailyBudget,
        actual: dailyCost,
        percentage: ((dailyCost / dailyBudget) * 100).toFixed(1),
      });
    }

    if (monthlyCost && monthlyCost > monthlyBudget) {
      alerts.push({
        type: 'monthly_budget_exceeded',
        threshold: monthlyBudget,
        actual: monthlyCost,
        percentage: ((monthlyCost / monthlyBudget) * 100).toFixed(1),
      });
    }

    return alerts;
  }
}

export default AIAnalyticsMiddleware;
