import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkspaceFile(...parts: string[]): string {
  return fs.readFileSync(path.resolve(process.cwd(), '..', '..', ...parts), 'utf8');
}

describe('hosted API structural guarantees', () => {
  it('keeps bulk documentation writes admin-only', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const bulkRoute = netlifyApi.slice(
      netlifyApi.indexOf("route.path === '/documentation/bulk'"),
      netlifyApi.indexOf("route.path.startsWith('/documentation/crawl')")
    );

    expect(bulkRoute).toContain('await requireAdmin(req)');
    expect(bulkRoute).not.toContain('await requireUser(req)');
  });

  it('keeps dashboard analytics as a single rich contract', () => {
    const netlifyApi = readWorkspaceFile('netlify/functions/api.ts');
    const dashboardHandler = readWorkspaceFile('netlify/functions/_shared/dashboard.ts');

    expect(netlifyApi).toContain("import { handleAnalyticsDashboard } from './_shared/dashboard'");
    expect(dashboardHandler).toContain('categoryDistribution');
    expect(dashboardHandler).toContain('securityMetrics');
    expect(dashboardHandler).toContain('trends');
    expect(dashboardHandler).toContain('recentActivity');
    expect(dashboardHandler).toContain('workflowCounts');
  });
});
