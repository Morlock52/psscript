import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../database/connection';

async function selectRows<T>(query: string): Promise<T[]> {
  return sequelize.query(query, {
    type: QueryTypes.SELECT
  }) as Promise<T[]>;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  return Number.parseFloat(value || '0');
}

async function getTotalUsers(): Promise<number> {
  const profileSource = await selectRows<{ table_name: 'users' | 'app_profiles' | null }>(`
    SELECT
      CASE
        WHEN to_regclass('public.users') IS NOT NULL THEN 'users'
        WHEN to_regclass('public.app_profiles') IS NOT NULL THEN 'app_profiles'
        ELSE NULL
      END AS table_name
  `);

  if (!profileSource[0]?.table_name) {
    return 0;
  }

  const totalUsers = await selectRows<{ count: string | number }>(`
    SELECT COUNT(*) as count FROM ${profileSource[0].table_name}
  `);

  return toNumber(totalUsers[0]?.count);
}

export default class AnalyticsController {
  /**
   * Get security metrics for scripts
   * Provides aggregated security metrics for analysis
   */
  async getSecurityMetrics(req: Request, res: Response) {
    try {
      // Fetch scripts with security scan results
      const scripts = await selectRows<{
        id: number;
        title: string;
        security_score: string | number | null;
        risk_score: string | number | null;
        suggestions: unknown;
        created_at: string;
      }>(`
        SELECT
          s.id,
          s.title,
          sa.security_score,
          sa.risk_score,
          sa.suggestions,
          s.created_at
        FROM scripts s
        INNER JOIN script_analysis sa ON s.id = sa.script_id
        ORDER BY s.created_at DESC
        LIMIT 100
      `);

      // Calculate security distribution based on security_score
      const highSecurityCount = scripts.filter((s: any) => {
        const score = toNumber(s.security_score);
        return score >= 8 && score <= 10;
      }).length;

      const mediumSecurityCount = scripts.filter((s: any) => {
        const score = toNumber(s.security_score);
        return score >= 5 && score < 8;
      }).length;

      const lowSecurityCount = scripts.filter((s: any) => {
        const score = toNumber(s.security_score);
        return score >= 0 && score < 5;
      }).length;

      // Extract common issues from suggestions
      const issuesMap = new Map<string, number>();
      scripts.forEach((script: any) => {
        if (script.suggestions && Array.isArray(script.suggestions)) {
          script.suggestions.forEach((suggestion: any) => {
            if (suggestion.title || suggestion.name) {
              const issueName = suggestion.title || suggestion.name;
              issuesMap.set(issueName, (issuesMap.get(issueName) || 0) + 1);
            }
          });
        }
      });

      // Convert to array and sort by count
      const commonIssues = Array.from(issuesMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5 issues

      // Get average security score
      const avgScore = await selectRows<{ average_score: string | number | null }>(`
        SELECT AVG(security_score) as average_score
        FROM script_analysis
      `);

      res.status(200).json({
        averageScore: toNumber(avgScore[0]?.average_score),
        totalScriptsAnalyzed: scripts.length,
        highSecurityCount,
        mediumSecurityCount,
        lowSecurityCount,
        commonIssues: commonIssues
      });
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      res.status(500).json({ message: 'Failed to fetch security metrics' });
    }
  }
  
  /**
   * Get usage analytics
   */
  async getUsageAnalytics(req: Request, res: Response) {
    try {
      // Get total scripts
      const totalScripts = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count FROM scripts
      `);

      // Get scripts created in the last 30 days for change calculation
      const recentScripts = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count
        FROM scripts
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      // Get scripts created in the previous 30 days for comparison
      const previousScripts = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count
        FROM scripts
        WHERE created_at >= NOW() - INTERVAL '60 days'
          AND created_at < NOW() - INTERVAL '30 days'
      `);

      // Calculate percentage change
      const currentCount = toNumber(recentScripts[0]?.count);
      const previousCount = toNumber(previousScripts[0]?.count);
      const scriptsChange = previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : 0;

      const totalUsers = await getTotalUsers();

      // Get total analyses (count of scripts with analysis results)
      const totalAnalyses = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count
        FROM script_analysis
      `);

      // Get recent analyses for change calculation
      const recentAnalyses = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count
        FROM script_analysis
        WHERE updated_at >= NOW() - INTERVAL '30 days'
      `);

      // Get previous analyses for comparison
      const previousAnalyses = await selectRows<{ count: string | number }>(`
        SELECT COUNT(*) as count
        FROM script_analysis
        WHERE updated_at >= NOW() - INTERVAL '60 days'
          AND updated_at < NOW() - INTERVAL '30 days'
      `);

      const currentAnalysesCount = toNumber(recentAnalyses[0]?.count);
      const previousAnalysesCount = toNumber(previousAnalyses[0]?.count);
      const analysesChange = previousAnalysesCount > 0
        ? Math.round(((currentAnalysesCount - previousAnalysesCount) / previousAnalysesCount) * 100)
        : 0;

      // Get script creation count by date
      const scriptsByDate = await selectRows<{ date: string; count: string | number }>(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM scripts
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `);

      res.status(200).json({
        totalScripts: toNumber(totalScripts[0]?.count),
        scriptsChange: scriptsChange,
        totalUsers,
        totalAnalyses: toNumber(totalAnalyses[0]?.count),
        analysesChange: analysesChange,
        scriptsByDate: scriptsByDate
      });
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      res.status(500).json({ message: 'Failed to fetch usage analytics' });
    }
  }

  /**
   * Get category distribution analytics
   */
  async getCategoryDistribution(req: Request, res: Response) {
    try {
      // Get all categories with script counts
      const categories = await selectRows<{
        id: number;
        name: string;
        description: string | null;
        script_count: string | number;
      }>(`
        SELECT
          c.id,
          c.name,
          c.description,
          COUNT(s.id) as script_count
        FROM categories c
        LEFT JOIN scripts s ON s.category_id = c.id
        GROUP BY c.id, c.name, c.description
        HAVING COUNT(s.id) > 0
        ORDER BY COUNT(s.id) DESC
      `);

      // Calculate total scripts for percentage calculation
      const totalScripts = categories.reduce((sum: number, cat: any) =>
        sum + parseInt(cat.script_count || 0), 0
      );

      // Format categories with percentages and colors
      const formattedCategories = categories.map((cat: any, index: number) => {
        const count = toNumber(cat.script_count);
        const percentage = totalScripts > 0
          ? Math.round((count / totalScripts) * 100)
          : 0;

        // Assign colors for pie chart
        const colors = [
          '#4299E1', // blue
          '#48BB78', // green
          '#ED8936', // orange
          '#9F7AEA', // purple
          '#F56565', // red
          '#38B2AC', // teal
          '#ED64A6', // pink
          '#ECC94B', // yellow
          '#667EEA', // indigo
          '#FC8181'  // light red
        ];

        return {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          count: count,
          scriptCount: count,
          percentage: percentage,
          color: colors[index % colors.length]
        };
      });

      res.status(200).json({
        categories: formattedCategories,
        totalScripts: totalScripts
      });
    } catch (error) {
      console.error('Error fetching category distribution:', error);
      res.status(500).json({ message: 'Failed to fetch category distribution' });
    }
  }
}
