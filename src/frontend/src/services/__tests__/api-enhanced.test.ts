import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMock = vi.fn();
const getCategoriesMock = vi.fn();
const getScriptsMock = vi.fn();
const searchScriptsMock = vi.fn();
const getSecurityMetricsMock = vi.fn();
const getUsageStatsMock = vi.fn();

vi.mock('../api', () => ({
  apiClient: {
    get: getMock,
  },
  scriptService: {
    getScripts: getScriptsMock,
    searchScripts: searchScriptsMock,
  },
  categoryService: {
    getCategories: getCategoriesMock,
  },
  analyticsService: {
    getSecurityMetrics: getSecurityMetricsMock,
    getUsageStats: getUsageStatsMock,
  },
}));

describe('enhanced API service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses /analytics/dashboard as the dashboard contract without extra category/script fetches', async () => {
    const { scriptService } = await import('../api-enhanced');
    getMock.mockResolvedValue({
      data: {
        totalScripts: 4,
        scriptsChange: 1,
        totalCategories: 2,
        avgSecurityScore: 8.25,
        securityScoreChange: 0,
        totalAnalyses: 3,
        analysesChange: 1,
        categoryDistribution: [{ name: 'Ops', count: 4 }],
        securityMetrics: { securityScores: [], commonIssues: [], averageScore: 8.25, totalScripts: 3 },
        trends: { uploads: [], executions: [], analyses: [] },
        recentActivity: [],
        workflowCounts: { uploaded: 4, analyzed: 3, needsReview: 1, highRisk: 0, documented: 0, exported: 0 },
      },
    });

    const stats = await scriptService.getDashboardStats();

    expect(getMock).toHaveBeenCalledWith('/analytics/dashboard');
    expect(getCategoriesMock).not.toHaveBeenCalled();
    expect(getScriptsMock).not.toHaveBeenCalled();
    expect(searchScriptsMock).not.toHaveBeenCalled();
    expect(stats.totalScripts).toBe(4);
    expect(stats.categoryDistribution).toEqual([{ name: 'Ops', count: 4 }]);
    expect(stats.workflowCounts.needsReview).toBe(1);
  });

  it('does not replace dashboard failures with zeroed live data', async () => {
    const { scriptService } = await import('../api-enhanced');
    getMock.mockRejectedValue(new Error('offline'));

    await expect(scriptService.getDashboardStats()).rejects.toThrow('offline');
  });
});
