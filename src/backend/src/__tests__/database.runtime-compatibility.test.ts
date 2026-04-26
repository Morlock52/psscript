import { describe, expect, it, jest } from '@jest/globals';
import { ensureRuntimeCompatibility } from '../database/connection';

type QueryCall = [string, any?];

function createQueryMock(initialTables: string[], scoreType = 'double precision') {
  const tables = new Set(initialTables);

  return jest.fn(async (sql: string, options?: any) => {
    if (sql.includes('to_regclass(:qualifiedName)')) {
      const qualifiedName = options?.replacements?.qualifiedName as string;
      return [{ exists: tables.has(qualifiedName.replace(/^public\./, '')) }];
    }

    if (sql.includes('CREATE TABLE IF NOT EXISTS ai_metrics') || sql.includes('CREATE TABLE public.ai_metrics')) {
      tables.add('ai_metrics');
    }

    if (sql.includes('FROM information_schema.columns') && sql.includes('script_analysis')) {
      return [
        { column_name: 'security_score', data_type: scoreType },
        { column_name: 'quality_score', data_type: scoreType },
        { column_name: 'risk_score', data_type: scoreType },
      ];
    }

    return [];
  });
}

describe('database runtime compatibility', () => {
  it('creates ai_metrics and records the migration for legacy databases', async () => {
    const query = createQueryMock(['users', 'script_versions', 'script_tags']);

    await ensureRuntimeCompatibility({ query } as any);

    const calls = query.mock.calls as QueryCall[];
    const sqlCalls = calls.map(([sql]) => String(sql));
    const migrationNames = calls
      .map(([, options]) => options?.replacements?.name)
      .filter(Boolean);

    expect(sqlCalls.some((sql) => sql.includes('ALTER TABLE users'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ai_metrics'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('idx_script_versions_user'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('idx_script_tags_tag'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('ALTER COLUMN security_score TYPE DOUBLE PRECISION'))).toBe(false);

    expect(migrationNames).toEqual(
      expect.arrayContaining([
        '20260412_fix_users_locked_until_column.sql',
        '20260412_create_ai_metrics_table.sql',
        '20260426_supabase_runtime_compatibility.sql',
        '20260412_fix_script_analysis_score_types.sql',
      ])
    );
  });

  it('skips local users mutations for Supabase app_profiles schemas', async () => {
    const query = createQueryMock(['app_profiles', 'ai_metrics', 'hosted_artifacts']);

    await ensureRuntimeCompatibility({ query } as any);

    const sqlCalls = (query.mock.calls as QueryCall[]).map(([sql]) => String(sql));

    expect(sqlCalls.some((sql) => sql.includes('ALTER TABLE users'))).toBe(false);
    expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ai_metrics'))).toBe(false);
    expect(sqlCalls.some((sql) => sql.includes('idx_hosted_artifacts_user'))).toBe(true);
  });

  it('upgrades script_analysis score columns when older schemas still use integer types', async () => {
    const query = createQueryMock(['users', 'ai_metrics'], 'integer');

    await ensureRuntimeCompatibility({ query } as any);

    const calls = query.mock.calls as QueryCall[];
    const sqlCalls = calls.map(([sql]) => String(sql));

    expect(
      sqlCalls.some((sql) =>
        sql.includes('ALTER COLUMN security_score TYPE DOUBLE PRECISION')
      )
    ).toBe(true);
  });
});
