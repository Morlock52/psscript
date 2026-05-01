import { requireUser } from './auth';
import { query } from './db';
import { json } from './http';

async function tableExists(tableName: string): Promise<boolean> {
  const result = await query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function handleAnalyticsDashboard(req: Request): Promise<Response> {
  const user = await requireUser(req);
  const visibleScriptsWhere = `
    (s.user_id = $1 OR s.is_public = true)
    AND s.deleted_at IS NULL
    AND s.archived_at IS NULL
    AND s.is_test_data = false
  `;
  const summary = await query(
    `
      SELECT
        COUNT(*)::int AS total_scripts,
        COUNT(*) FILTER (WHERE s.created_at > now() - interval '7 days')::int AS recent_scripts,
        COUNT(sa.script_id)::int AS total_analyses,
        COUNT(sa.script_id) FILTER (WHERE sa.created_at > now() - interval '7 days')::int AS recent_analyses,
        COALESCE(AVG(sa.security_score), 0)::float AS average_security_score,
        COUNT(*) FILTER (WHERE sa.script_id IS NULL)::int AS needs_review,
        COUNT(*) FILTER (WHERE sa.risk_score >= 7 OR sa.security_score < 5)::int AS high_risk
      FROM scripts s
      LEFT JOIN script_analysis sa ON sa.script_id = s.id
      WHERE ${visibleScriptsWhere}
    `,
    [user.id]
  );
  const categories = await query(
    `
      SELECT c.id, COALESCE(c.name, 'Uncategorized') AS name, COUNT(s.id)::int AS count
      FROM scripts s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE ${visibleScriptsWhere}
      GROUP BY c.id, c.name
      ORDER BY count DESC, name ASC
    `,
    [user.id]
  );
  const security = await query(
    `
      SELECT
        COALESCE(AVG(sa.security_score), 0)::float AS average,
        COUNT(*) FILTER (WHERE sa.security_score >= 8)::int AS high,
        COUNT(*) FILTER (WHERE sa.security_score >= 5 AND sa.security_score < 8)::int AS medium,
        COUNT(*) FILTER (WHERE sa.security_score < 5)::int AS low
      FROM script_analysis sa
      JOIN scripts s ON s.id = sa.script_id
      WHERE ${visibleScriptsWhere}
    `,
    [user.id]
  );
  const trends = await query(
    `
      WITH days AS (
        SELECT generate_series((current_date - interval '29 days')::date, current_date, interval '1 day')::date AS date
      ),
      uploads AS (
        SELECT date_trunc('day', s.created_at)::date AS date, COUNT(*)::int AS count
        FROM scripts s
        WHERE ${visibleScriptsWhere}
        GROUP BY 1
      ),
      analyses AS (
        SELECT date_trunc('day', sa.created_at)::date AS date, COUNT(*)::int AS count
        FROM script_analysis sa
        JOIN scripts s ON s.id = sa.script_id
        WHERE ${visibleScriptsWhere}
        GROUP BY 1
      ),
      executions AS (
        SELECT date_trunc('day', se.executed_at)::date AS date, COUNT(*)::int AS count
        FROM script_executions se
        JOIN scripts s ON s.id = se.script_id
        WHERE ${visibleScriptsWhere}
        GROUP BY 1
      )
      SELECT
        days.date::text AS date,
        COALESCE(uploads.count, 0)::int AS uploads,
        COALESCE(analyses.count, 0)::int AS analyses,
        COALESCE(executions.count, 0)::int AS executions
      FROM days
      LEFT JOIN uploads ON uploads.date = days.date
      LEFT JOIN analyses ON analyses.date = days.date
      LEFT JOIN executions ON executions.date = days.date
      ORDER BY days.date ASC
    `,
    [user.id]
  ).catch(() => ({ rows: [] as any[] }));
  const recentActivity = (await tableExists('audit_events'))
    ? await query(
        `
          SELECT id, event_type, script_id, script_title, user_id, username, details, created_at
          FROM audit_events
          WHERE user_id = $1 OR user_id IS NULL
          ORDER BY created_at DESC
          LIMIT 8
        `,
        [user.id]
      )
    : { rows: [] as any[] };
  const summaryRow = summary.rows[0] || {};
  const securityRow = security.rows[0] || {};
  const securityTotal = Number(securityRow.high || 0) + Number(securityRow.medium || 0) + Number(securityRow.low || 0);
  const trendRows = trends.rows || [];
  return json({
    totalScripts: Number(summaryRow.total_scripts || 0),
    scriptsChange: Number(summaryRow.recent_scripts || 0),
    totalCategories: categories.rows.length,
    avgSecurityScore: Number(summaryRow.average_security_score || 0),
    securityScoreChange: 0,
    totalAnalyses: Number(summaryRow.total_analyses || 0),
    analysesChange: Number(summaryRow.recent_analyses || 0),
    categoryDistribution: categories.rows.map((row: any) => ({
      id: row.id == null ? undefined : Number(row.id),
      name: row.name || 'Uncategorized',
      count: Number(row.count || 0),
      scriptCount: Number(row.count || 0),
    })),
    securityMetrics: {
      securityScores: [
        { score: 8, count: Number(securityRow.high || 0), percentage: securityTotal ? Math.round((Number(securityRow.high || 0) / securityTotal) * 100) : 0 },
        { score: 5, count: Number(securityRow.medium || 0), percentage: securityTotal ? Math.round((Number(securityRow.medium || 0) / securityTotal) * 100) : 0 },
        { score: 2, count: Number(securityRow.low || 0), percentage: securityTotal ? Math.round((Number(securityRow.low || 0) / securityTotal) * 100) : 0 },
      ],
      commonIssues: [],
      averageScore: Number(securityRow.average || 0),
      totalScripts: securityTotal,
    },
    trends: {
      uploads: trendRows.map((row: any) => ({ date: row.date, count: Number(row.uploads || 0) })),
      executions: trendRows.map((row: any) => ({ date: row.date, count: Number(row.executions || 0) })),
      analyses: trendRows.map((row: any) => ({ date: row.date, count: Number(row.analyses || 0) })),
    },
    recentActivity: recentActivity.rows.map((row: any) => ({
      id: String(row.id),
      type: row.event_type,
      script_id: row.script_id == null ? undefined : String(row.script_id),
      script_title: row.script_title,
      user_id: row.user_id || '',
      username: row.username || 'System',
      timestamp: row.created_at,
      details: row.details || {},
    })),
    workflowCounts: {
      uploaded: Number(summaryRow.total_scripts || 0),
      analyzed: Number(summaryRow.total_analyses || 0),
      needsReview: Number(summaryRow.needs_review || 0),
      highRisk: Number(summaryRow.high_risk || 0),
      documented: 0,
      exported: 0,
    },
    refreshedAt: new Date().toISOString(),
    source: '/api/analytics/dashboard',
  });
}
