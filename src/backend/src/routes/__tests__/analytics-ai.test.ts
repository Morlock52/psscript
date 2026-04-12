import express from 'express';
import request from 'supertest';

jest.mock('../../middleware/aiAnalytics', () => ({
  AIAnalyticsMiddleware: {
    getAnalytics: jest.fn(),
    checkBudgetAlerts: jest.fn(),
  },
}));

import router from '../analytics-ai';
import { AIAnalyticsMiddleware } from '../../middleware/aiAnalytics';

describe('analytics ai routes', () => {
  const app = express();
  app.use('/api/analytics/ai', router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns analytics data from the root endpoint', async () => {
    (AIAnalyticsMiddleware.getAnalytics as jest.Mock).mockResolvedValue({
      summary: { totalRequests: '3' },
      byModel: [],
      byEndpoint: [],
      costTrend: [],
    });

    const response = await request(app).get('/api/analytics/ai');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.totalRequests).toBe('3');
    expect(AIAnalyticsMiddleware.getAnalytics).toHaveBeenCalledTimes(1);
  });

  it('returns budget alerts from the budget-alerts endpoint', async () => {
    (AIAnalyticsMiddleware.checkBudgetAlerts as jest.Mock).mockResolvedValue([
      { type: 'daily_budget_exceeded', actual: 60, threshold: 50 },
    ]);

    const response = await request(app)
      .get('/api/analytics/ai/budget-alerts')
      .query({ dailyBudget: '50', monthlyBudget: '1000' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.hasAlerts).toBe(true);
    expect(response.body.alerts).toHaveLength(1);
    expect(AIAnalyticsMiddleware.checkBudgetAlerts).toHaveBeenCalledWith(50, 1000);
  });

  it('returns summary slices from the summary endpoint', async () => {
    (AIAnalyticsMiddleware.getAnalytics as jest.Mock).mockResolvedValue({
      summary: { totalRequests: '7' },
      byModel: [{ model: 'gpt-5.4-mini' }],
      byEndpoint: [{ endpoint: '/api/chat' }],
      costTrend: [],
    });

    const response = await request(app).get('/api/analytics/ai/summary');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.totalRequests).toBe('7');
    expect(response.body.data.topModels).toEqual([{ model: 'gpt-5.4-mini' }]);
    expect(response.body.data.topEndpoints).toEqual([{ endpoint: '/api/chat' }]);
  });
});
