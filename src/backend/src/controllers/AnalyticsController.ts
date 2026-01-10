import { Request, Response } from 'express';
import db from '../db';

export default class AnalyticsController {
  /**
   * Get security metrics for scripts
   * Provides aggregated security metrics for analysis
   */
  async getSecurityMetrics(req: Request, res: Response) {
    try {
      // Fetch scripts with security scan results
      const scripts = await db.query(`
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
        const score = parseFloat(s.security_score || 0);
        return score >= 8 && score <= 10;
      }).length;

      const mediumSecurityCount = scripts.filter((s: any) => {
        const score = parseFloat(s.security_score || 0);
        return score >= 5 && score < 8;
      }).length;

      const lowSecurityCount = scripts.filter((s: any) => {
        const score = parseFloat(s.security_score || 0);
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
      const avgScore = await db.query(`
        SELECT AVG(security_score) as average_score
        FROM script_analysis
      `);

      res.status(200).json({
        averageScore: parseFloat(avgScore[0]?.average_score || 0),
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
      const totalScripts = await db.query(`
        SELECT COUNT(*) as count FROM scripts
      `);

      // Get scripts created in the last 30 days for change calculation
      const recentScripts = await db.query(`
        SELECT COUNT(*) as count
        FROM scripts
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      // Get scripts created in the previous 30 days for comparison
      const previousScripts = await db.query(`
        SELECT COUNT(*) as count
        FROM scripts
        WHERE created_at >= NOW() - INTERVAL '60 days'
          AND created_at < NOW() - INTERVAL '30 days'
      `);

      // Calculate percentage change
      const currentCount = parseInt(recentScripts[0]?.count || 0);
      const previousCount = parseInt(previousScripts[0]?.count || 0);
      const scriptsChange = previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : 0;

      // Get total users
      const totalUsers = await db.query(`
        SELECT COUNT(*) as count FROM users
      `);

      // Get total analyses (count of scripts with analysis results)
      const totalAnalyses = await db.query(`
        SELECT COUNT(*) as count
        FROM script_analysis
      `);

      // Get recent analyses for change calculation
      const recentAnalyses = await db.query(`
        SELECT COUNT(*) as count
        FROM script_analysis
        WHERE updated_at >= NOW() - INTERVAL '30 days'
      `);

      // Get previous analyses for comparison
      const previousAnalyses = await db.query(`
        SELECT COUNT(*) as count
        FROM script_analysis
        WHERE updated_at >= NOW() - INTERVAL '60 days'
          AND updated_at < NOW() - INTERVAL '30 days'
      `);

      const currentAnalysesCount = parseInt(recentAnalyses[0]?.count || 0);
      const previousAnalysesCount = parseInt(previousAnalyses[0]?.count || 0);
      const analysesChange = previousAnalysesCount > 0
        ? Math.round(((currentAnalysesCount - previousAnalysesCount) / previousAnalysesCount) * 100)
        : 0;

      // Get script creation count by date
      const scriptsByDate = await db.query(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM scripts
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `);

      res.status(200).json({
        totalScripts: parseInt(totalScripts[0]?.count || 0),
        scriptsChange: scriptsChange,
        totalUsers: parseInt(totalUsers[0]?.count || 0),
        totalAnalyses: parseInt(totalAnalyses[0]?.count || 0),
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
      const categories = await db.query(`
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
        const count = parseInt(cat.script_count || 0);
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
