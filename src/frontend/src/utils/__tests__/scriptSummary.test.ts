import { describe, expect, it } from 'vitest';
import { normalizeScriptSummary } from '../scriptSummary';

describe('normalizeScriptSummary', () => {
  it('normalizes snake_case script fields and hides system tags', () => {
    const summary = normalizeScriptSummary({
      id: 42,
      title: 'Smoke Upload 2026',
      created_at: '2026-04-28T10:00:00.000Z',
      updated_at: '2026-04-29T10:00:00.000Z',
      category_name: 'Security Tools',
      author_username: 'david',
      tags: ['PowerShell', 'codex-smoke', 'powershell'],
      execution_count: 7,
      is_public: true,
      analysis: {
        quality_score: 8.6,
        security_score: 9.1,
        script_version: 2,
      },
      version: 2,
    });

    expect(summary.id).toBe('42');
    expect(summary.author).toBe('david');
    expect(summary.categoryName).toBe('Security Tools');
    expect(summary.executionCount).toBe(7);
    expect(summary.qualityScore).toBe(8.6);
    expect(summary.securityScore).toBe(9.1);
    expect(summary.visibleTags).toEqual(['powershell']);
    expect(summary.systemTags).toEqual(['codex-smoke']);
    expect(summary.isTestData).toBe(true);
    expect(summary.lifecycleStatus).toBe('analyzed');
  });

  it('marks archived, deleted, stale, and risky scripts accurately', () => {
    expect(normalizeScriptSummary({ id: 1, archived_at: '2026-04-29T12:00:00Z' }).lifecycleStatus).toBe('archived');
    expect(normalizeScriptSummary({ id: 2, deleted_at: '2026-04-29T12:00:00Z' }).lifecycleStatus).toBe('deleted');

    const stale = normalizeScriptSummary({
      id: 3,
      version: 4,
      file_hash: 'new-hash',
      content: 'Remove-Item C:\\Temp\\x -Force; Invoke-WebRequest https://example.com',
      analysis: {
        qualityScore: 7,
        scriptVersion: 3,
        fileHash: 'old-hash',
      },
    });

    expect(stale.lifecycleStatus).toBe('stale_analysis');
    expect(stale.riskBadges).toContain('Deletes files');
    expect(stale.riskBadges).toContain('Downloads remote content');
  });
});
