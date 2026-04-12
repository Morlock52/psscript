import { describe, expect, it, jest } from '@jest/globals';
import { ensureRuntimeCompatibility } from '../database/connection';

describe('database runtime compatibility', () => {
  it('creates ai_metrics and records the migration for legacy databases', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM information_schema.columns') && sql.includes('script_analysis')) {
        return [
          { column_name: 'security_score', data_type: 'double precision' },
          { column_name: 'quality_score', data_type: 'double precision' },
          { column_name: 'risk_score', data_type: 'double precision' },
        ];
      }

      return [];
    });

    await ensureRuntimeCompatibility({ query } as any);

    const calls = query.mock.calls as Array<[string, any?]>;
    const sqlCalls = calls.map(([sql]) => String(sql));
    const migrationNames = calls
      .map(([, options]) => options?.replacements?.name)
      .filter(Boolean);

    expect(sqlCalls.some((sql) => sql.includes('ALTER TABLE users'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ai_metrics'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('CREATE INDEX IF NOT EXISTS idx_ai_metrics_user_id'))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('ALTER COLUMN security_score TYPE DOUBLE PRECISION'))).toBe(false);

    expect(migrationNames).toEqual(
      expect.arrayContaining([
        '20260412_fix_users_locked_until_column.sql',
        '20260412_create_ai_metrics_table.sql',
        '20260412_fix_script_analysis_score_types.sql',
      ])
    );
  });

  it('upgrades script_analysis score columns when older schemas still use integer types', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM information_schema.columns') && sql.includes('script_analysis')) {
        return [
          { column_name: 'security_score', data_type: 'integer' },
          { column_name: 'quality_score', data_type: 'integer' },
          { column_name: 'risk_score', data_type: 'integer' },
        ];
      }

      return [];
    });

    await ensureRuntimeCompatibility({ query } as any);

    const calls = query.mock.calls as Array<[string, any?]>;
    const sqlCalls = calls.map(([sql]) => String(sql));

    expect(
      sqlCalls.some((sql) =>
        sql.includes('ALTER COLUMN security_score TYPE DOUBLE PRECISION')
      )
    ).toBe(true);
  });
});
