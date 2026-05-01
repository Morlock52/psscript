// Enhanced API service with additional methods for the PSScript application
import { apiClient, scriptService as baseScriptService, categoryService, analyticsService } from './api';
import { normalizeScriptSummaries } from '../utils/scriptSummary';
import type { DashboardSecurityMetrics, DashboardStats } from '../types/dashboard';

// Define types for the enhanced API
interface Script {
  id: string;
  title: string;
  description: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  category_id: number;
  category_name?: string;
  tags?: string[];
  is_public: boolean;
  version: number;
  security_score?: number;
  quality_score?: number;
  views?: number;
  executions?: number;
  file_hash?: string;
}

interface _Category {
  id: number;
  name: string;
  description: string;
  count?: number;
  color?: string;
}

interface Activity {
  id: string;
  type: 'create' | 'update' | 'execute' | 'analyze' | 'delete';
  script_id?: string;
  script_title?: string;
  user_id: string;
  username: string;
  timestamp: string;
  details?: any;
}

// Enhanced script service
export const scriptService = {
  ...baseScriptService,
  
  // Get scripts by category
  getScriptsByCategory: async (categoryId: number): Promise<Script[]> => {
    try {
      const response = await baseScriptService.searchScripts('', { category_id: categoryId, limit: 8 });
      return normalizeScriptSummaries(response.scripts || []) as unknown as Script[];
    } catch (error) {
      console.error(`Error fetching scripts for category ${categoryId}:`, error);
      return [];
    }
  },
  
  // Get recent scripts
  getRecentScripts: async (limit: number = 10): Promise<Script[]> => {
    try {
      const response = await baseScriptService.getScripts({
        sort: 'updated',
        limit
      });
      return normalizeScriptSummaries(response.scripts || []) as unknown as Script[];
    } catch (error) {
      console.error('Error fetching recent scripts:', error);
      return [];
    }
  },
  
  // Get popular scripts
  getPopularScripts: async (limit: number = 10): Promise<Script[]> => {
    try {
      const response = await baseScriptService.searchScripts('', {
        sort: 'executions',
        limit
      });
      return normalizeScriptSummaries(response.scripts || []) as unknown as Script[];
    } catch (error) {
      console.error('Error fetching popular scripts:', error);
      return [];
    }
  },
  
  // Get dashboard stats
  getDashboardStats: async (): Promise<DashboardStats> => {
    const dashboard = await apiClient.get('/analytics/dashboard').then(response => response.data);

    return {
      totalScripts: Number(dashboard.totalScripts || 0),
      scriptsChange: Number(dashboard.scriptsChange || 0),
      totalCategories: Number(dashboard.totalCategories || 0),
      avgSecurityScore: Number(dashboard.avgSecurityScore || 0),
      securityScoreChange: Number(dashboard.securityScoreChange || 0),
      totalAnalyses: Number(dashboard.totalAnalyses || 0),
      analysesChange: Number(dashboard.analysesChange || 0),
      categoryDistribution: Array.isArray(dashboard.categoryDistribution) ? dashboard.categoryDistribution : [],
      securityMetrics: dashboard.securityMetrics || {
        securityScores: [],
        commonIssues: [],
        averageScore: 0,
        totalScripts: 0,
      },
      trends: dashboard.trends || { uploads: [], executions: [], analyses: [] },
      recentActivity: Array.isArray(dashboard.recentActivity) ? dashboard.recentActivity : [],
      workflowCounts: dashboard.workflowCounts || {
        uploaded: 0,
        analyzed: 0,
        needsReview: 0,
        highRisk: 0,
        documented: 0,
        exported: 0,
      },
      refreshedAt: dashboard.refreshedAt,
      source: dashboard.source,
    };
  },
  
  // Get recent activity
  getRecentActivity: async (limit: number = 10): Promise<Activity[]> => {
    try {
      const response = await apiClient.get('/activity/recent', { params: { limit } });
      return response.data.activities || [];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  },
  
  // Get script trends data
  getScriptTrends: async (period: 'week' | 'month' | 'year' = 'week'): Promise<{
    uploads: { date: string; count: number }[];
    executions: { date: string; count: number }[];
    analyses: { date: string; count: number }[];
  }> => {
    const dashboard = await scriptService.getDashboardStats();
    const points = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    return {
      uploads: dashboard.trends.uploads.slice(-points),
      executions: dashboard.trends.executions.slice(-points),
      analyses: dashboard.trends.analyses.slice(-points),
    };
  }
};

// Enhanced analytics service
export const analysisService = {
  ...analyticsService,
  
  // Get security metrics
  getSecurityMetrics: async (): Promise<DashboardSecurityMetrics> => {
    try {
      const metrics = await analyticsService.getSecurityMetrics();
      if (Array.isArray(metrics.securityScores)) return metrics;
      const high = Number(metrics.highSecurityCount ?? metrics.high ?? 0);
      const medium = Number(metrics.mediumSecurityCount ?? metrics.medium ?? 0);
      const low = Number(metrics.lowSecurityCount ?? metrics.low ?? 0);
      const total = Number(metrics.totalScripts ?? high + medium + low);
      
      return {
        securityScores: [
          { score: 8, count: high, percentage: total ? Math.round((high / total) * 100) : Number(metrics.highSecurityPercentage || 0) },
          { score: 5, count: medium, percentage: total ? Math.round((medium / total) * 100) : Number(metrics.mediumSecurityPercentage || 0) },
          { score: 2, count: low, percentage: total ? Math.round((low / total) * 100) : Number(metrics.lowSecurityPercentage || 0) }
        ],
        commonIssues: metrics.commonIssues || [],
        averageScore: Number(metrics.averageScore ?? metrics.average ?? 0),
        totalScripts: total
      };
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      throw error;
    }
  }
};

// Re-export other services
export { categoryService, analyticsService };
