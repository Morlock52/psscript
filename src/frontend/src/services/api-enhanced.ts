// Enhanced API service with additional methods for the PSScript application
import { apiClient, scriptService as baseScriptService, categoryService, analyticsService } from './api';
import { normalizeScriptSummaries } from '../utils/scriptSummary';

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

interface DashboardStats {
  totalScripts: number;
  scriptsChange: number;
  totalCategories: number;
  avgSecurityScore: number;
  securityScoreChange: number;
  totalAnalyses: number;
  analysesChange: number;
  recentScripts?: Script[];
  popularScripts?: Script[];
}

interface SecurityMetrics {
  securityScores: {
    score: number;
    count: number;
    percentage: number;
  }[];
  commonIssues: {
    issue: string;
    count: number;
    percentage: number;
  }[];
  averageScore: number;
  totalScripts: number;
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
    try {
      const dashboard = await apiClient.get('/analytics/dashboard').then(response => response.data);
      
      // Get recent scripts
      const recentScripts = await scriptService.getRecentScripts(5);
      
      // Get popular scripts
      const popularScripts = await scriptService.getPopularScripts(5);
      
      // Get categories
      const categoriesResponse = await categoryService.getCategories();
      const categories = categoriesResponse.categories || [];
      
      return {
        totalScripts: dashboard.totalScripts || 0,
        scriptsChange: dashboard.scriptsChange || 0,
        totalCategories: categories.length,
        avgSecurityScore: dashboard.avgSecurityScore || 0,
        securityScoreChange: dashboard.securityScoreChange || 0,
        totalAnalyses: dashboard.totalAnalyses || 0,
        analysesChange: dashboard.analysesChange || 0,
        recentScripts,
        popularScripts
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalScripts: 0,
        scriptsChange: 0,
        totalCategories: 0,
        avgSecurityScore: 0,
        securityScoreChange: 0,
        totalAnalyses: 0,
        analysesChange: 0
      };
    }
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
    try {
      const usage = await analyticsService.getUsageStats();
      const rows = Array.isArray(usage) ? usage : [];
      return {
        uploads: rows.map((row: any) => ({ date: row.date, count: Number(row.scripts || row.count || 0) })).reverse(),
        executions: [],
        analyses: [],
      };
    } catch (error) {
      console.error(`Error fetching script trends for ${period}:`, error);
      return {
        uploads: [],
        executions: [],
        analyses: []
      };
    }
  }
};

// Enhanced analytics service
export const analysisService = {
  ...analyticsService,
  
  // Get security metrics
  getSecurityMetrics: async (): Promise<SecurityMetrics> => {
    try {
      const metrics = await analyticsService.getSecurityMetrics();
      
      // Transform to the expected format
      return {
        securityScores: [
          { score: 8, count: metrics.highSecurityCount || 0, percentage: metrics.highSecurityPercentage || 0 },
          { score: 5, count: metrics.mediumSecurityCount || 0, percentage: metrics.mediumSecurityPercentage || 0 },
          { score: 2, count: metrics.lowSecurityCount || 0, percentage: metrics.lowSecurityPercentage || 0 }
        ],
        commonIssues: metrics.commonIssues || [],
        averageScore: (metrics.highSecurityCount * 8 + metrics.mediumSecurityCount * 5 + metrics.lowSecurityCount * 2) / 
                     (metrics.highSecurityCount + metrics.mediumSecurityCount + metrics.lowSecurityCount) || 0,
        totalScripts: metrics.highSecurityCount + metrics.mediumSecurityCount + metrics.lowSecurityCount || 0
      };
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      return {
        securityScores: [
          { score: 8, count: 0, percentage: 0 },
          { score: 5, count: 0, percentage: 0 },
          { score: 2, count: 0, percentage: 0 }
        ],
        commonIssues: [],
        averageScore: 0,
        totalScripts: 0
      };
    }
  }
};

// Re-export other services
export { categoryService, analyticsService };
