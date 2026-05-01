export interface DashboardTrendPoint {
  date: string;
  count: number;
}

export interface DashboardCategory {
  id?: number;
  name: string;
  count: number;
  scriptCount?: number;
  color?: string;
}

export interface DashboardActivity {
  id: string;
  type: 'create' | 'update' | 'execute' | 'analyze' | 'delete' | 'archive' | 'restore';
  script_id?: string;
  script_title?: string;
  user_id: string;
  username: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DashboardSecurityMetrics {
  securityScores: {
    score: number;
    count: number;
    percentage: number;
  }[];
  commonIssues: {
    issue?: string;
    name?: string;
    count: number;
    percentage?: number;
  }[];
  averageScore: number;
  totalScripts: number;
}

export interface DashboardWorkflowCounts {
  uploaded: number;
  analyzed: number;
  needsReview: number;
  highRisk: number;
  documented: number;
  exported: number;
}

export interface DashboardStats {
  totalScripts: number;
  scriptsChange: number;
  totalCategories: number;
  avgSecurityScore: number;
  securityScoreChange: number;
  totalAnalyses: number;
  analysesChange: number;
  categoryDistribution: DashboardCategory[];
  securityMetrics: DashboardSecurityMetrics;
  trends: {
    uploads: DashboardTrendPoint[];
    executions: DashboardTrendPoint[];
    analyses: DashboardTrendPoint[];
  };
  recentActivity: DashboardActivity[];
  workflowCounts: DashboardWorkflowCounts;
  refreshedAt?: string;
  source?: string;
}
