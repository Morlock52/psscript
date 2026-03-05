import express from 'express';
import fs from 'fs';
import path from 'path';
import { QueryTypes, Transaction } from 'sequelize';
import { authenticateJWT, requireAdmin } from '../middleware/authMiddleware';
import { sequelize } from '../database/connection';
import logger from '../utils/logger';

type BackupPayload = {
  version: number;
  createdAt: string;
  database: string;
  tables: Record<string, any[]>;
};

const router = express.Router();
const BACKUP_DIR = process.env.DB_BACKUP_DIR || path.resolve('/tmp', 'psscript-db-backups');
const RESERVED_TABLES = new Set(['schema_migrations']);
const CLEAR_TABLES = [
  'comments',
  'execution_logs',
  'script_dependencies',
  'script_tags',
  'script_versions',
  'script_analysis',
  'script_embeddings',
  'user_favorites',
  'chat_history',
  'ai_metrics',
  'scripts'
];
const DEFAULT_CLEAR_TABLES = CLEAR_TABLES.filter((table) => table !== 'ai_metrics');
const FILENAME_MAX_LEN = 96;

function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function sanitizeBackupFilename(filename?: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fallback = `db-backup-${stamp}.json`;
  const incoming = (filename || fallback).trim();

  if (!incoming) {
    return fallback;
  }

  const withExt = incoming.endsWith('.json') ? incoming : `${incoming}.json`;
  const clean = path.basename(withExt);

  if (!/^[a-zA-Z0-9._-]+\.json$/.test(clean)) {
    throw new Error('Invalid filename. Use letters, numbers, dot, dash, underscore, and .json extension.');
  }

  return clean;
}

function getBackupFilename(prefix: string): string {
  const safePrefix = prefix
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^[-.]+|[-.]+$)/g, '')
    .slice(0, FILENAME_MAX_LEN) || 'backup';

  return sanitizeBackupFilename(`${safePrefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
}

async function getPublicTables(): Promise<string[]> {
  const rows = await sequelize.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    { type: QueryTypes.SELECT }
  ) as Array<{ table_name: string }>;

  return rows
    .map((row) => row.table_name)
    .filter((table) => table && !RESERVED_TABLES.has(table));
}

async function existingTablesFrom(names: string[]): Promise<string[]> {
  const publicTables = new Set(await getPublicTables());
  return names.filter((name) => publicTables.has(name));
}

function uniqueTableNames(raw: string[] | null | undefined): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const cleaned = raw
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name.length > 0)
    .filter((name) => /^[a-zA-Z0-9._-]+$/.test(name));

  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of cleaned) {
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }

  return result;
}

async function buildBackupPayload(): Promise<BackupPayload> {
  const tables = await getPublicTables();
  const payload: BackupPayload = {
    version: 1,
    createdAt: new Date().toISOString(),
    database: process.env.DB_NAME || 'psscript',
    tables: {}
  };

  for (const table of tables) {
    const rows = await sequelize.query(`SELECT * FROM "${table}"`, {
      type: QueryTypes.SELECT
    });
    payload.tables[table] = rows as any[];
  }

  return payload;
}

async function restoreBackup(payload: BackupPayload): Promise<{ inserted: Record<string, number> }> {
  const currentTables = await getPublicTables();
  const restoreTables = currentTables.filter((table) => Object.prototype.hasOwnProperty.call(payload.tables || {}, table));

  const inserted: Record<string, number> = {};

  await sequelize.transaction(async (tx: Transaction) => {
    if (restoreTables.length > 0) {
      const truncateSql = `TRUNCATE TABLE ${restoreTables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`;
      await sequelize.query(truncateSql, { transaction: tx });
    }

    for (const table of restoreTables) {
      const rows = Array.isArray(payload.tables[table]) ? payload.tables[table] : [];
      if (rows.length > 0) {
        await sequelize.getQueryInterface().bulkInsert(table, rows, { transaction: tx });
      }
      inserted[table] = rows.length;
    }

    if (restoreTables.length > 0) {
      const sequenceColumns = await sequelize.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name IN (:tables)
           AND (
             column_default LIKE 'nextval(%'
             OR is_identity = 'YES'
           )
         ORDER BY table_name, ordinal_position`,
        {
          replacements: { tables: restoreTables },
          type: QueryTypes.SELECT,
          transaction: tx
        }
      ) as Array<{ table_name: string; column_name: string }>;

      for (const { table_name: tableName, column_name: columnName } of sequenceColumns) {
        const quotedTable = `"${tableName}"`;
        const quotedColumn = `"${columnName}"`;
        const qualifiedTable = `public.${tableName}`;

        await sequelize.query(
          `SELECT setval(
             pg_get_serial_sequence(:qualifiedTable, :columnName),
             COALESCE((SELECT MAX(${quotedColumn}) FROM ${quotedTable}), 1),
             COALESCE((SELECT MAX(${quotedColumn}) IS NOT NULL FROM ${quotedTable}), false)
           )`,
          {
            replacements: {
              qualifiedTable,
              columnName
            },
            transaction: tx
          }
        );
      }
    }
  });

  return { inserted };
}

// Admin only for all DB maintenance operations
router.use(authenticateJWT, requireAdmin);

router.get('/backups', async (_req, res) => {
  try {
    ensureBackupDir();
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((name) => {
        const fullPath = path.join(BACKUP_DIR, name);
        const stats = fs.statSync(fullPath);
        return {
          name,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

    return res.json({ backups: files, directory: BACKUP_DIR });
  } catch (error: any) {
    logger.error('Failed to list DB backups:', error);
    return res.status(500).json({ message: 'Failed to list backups', error: error.message });
  }
});

router.post('/backup', async (req, res) => {
  try {
    ensureBackupDir();
    const requestedName = req.body?.filename || req.body?.name || req.body?.backupName;
    const filename = requestedName ? sanitizeBackupFilename(requestedName) : getBackupFilename('db-backup');
    const target = path.join(BACKUP_DIR, filename);

    const payload = await buildBackupPayload();
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');

    return res.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        name: filename,
        path: target,
        tableCount: Object.keys(payload.tables).length,
        createdAt: payload.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to create DB backup:', error);
    return res.status(500).json({ message: 'Failed to create backup', error: error.message });
  }
});

router.post('/restore', async (req, res) => {
  try {
    ensureBackupDir();
    const filename = sanitizeBackupFilename(req.body?.filename);
    const source = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(source)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }

    const raw = fs.readFileSync(source, 'utf8');
    const payload = JSON.parse(raw) as BackupPayload;

    if (!payload || typeof payload !== 'object' || !payload.tables || typeof payload.tables !== 'object') {
      return res.status(400).json({ message: 'Invalid backup format' });
    }

    const result = await restoreBackup(payload);

    return res.json({
      success: true,
      message: 'Database restore completed',
      restoredFrom: filename,
      insertedRows: result.inserted
    });
  } catch (error: any) {
    logger.error('Failed to restore DB backup:', error);
    return res.status(500).json({ message: 'Failed to restore backup', error: error.message });
  }
});

router.post('/clear-test-data', async (req, res) => {
  try {
    const confirmText = String(req.body?.confirmText || '');
    const backupFirst = req.body?.backupFirst !== false;
    const backupFilename = req.body?.backupFilename as string | undefined;
    const requestedClearTables = uniqueTableNames(req.body?.tables);
    if (confirmText !== 'CLEAR TEST DATA') {
      return res.status(400).json({
        message: 'Confirmation text mismatch. Send confirmText as exactly: CLEAR TEST DATA'
      });
    }

    const requestedTableList = requestedClearTables.length > 0
      ? requestedClearTables
      : DEFAULT_CLEAR_TABLES;

    const resolvedClearTables = await existingTablesFrom(requestedTableList);
    const ignoredTables = requestedTableList.filter((name) => !resolvedClearTables.includes(name));

    if (resolvedClearTables.length === 0) {
      return res.status(409).json({
        message: 'No clearable tables were found in this environment.',
        requestedTables: requestedTableList,
        filteredTables: resolvedClearTables,
        ignoredTables
      });
    }

    let backup: { name: string; path: string } | null = null;
    if (backupFirst) {
      ensureBackupDir();
      const filename = backupFilename
        ? sanitizeBackupFilename(backupFilename)
        : getBackupFilename('pre-clear-test-data');
      const target = path.join(BACKUP_DIR, filename);
      const payload = await buildBackupPayload();
      fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
      backup = { name: filename, path: target };
    }

    const tableCountsBefore: Record<string, number> = {};
    for (const table of resolvedClearTables) {
      const rows = await sequelize.query(`SELECT COUNT(*)::int AS count FROM "${table}"`, {
        type: QueryTypes.SELECT
      }) as Array<{ count: number }>;
      tableCountsBefore[table] = Number(rows[0]?.count || 0);
    }

    await sequelize.transaction(async (tx: Transaction) => {
      const truncateSql = `TRUNCATE TABLE ${resolvedClearTables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`;
      await sequelize.query(truncateSql, { transaction: tx });
    });

    return res.json({
      success: true,
      message: 'Test data cleared successfully',
      backup,
      clearedTables: resolvedClearTables,
      requestedTables: requestedTableList,
      filteredTables: resolvedClearTables,
      ignoredTables,
      rowsBeforeClear: tableCountsBefore,
      note: 'Users, categories, tags, documentation, and schema migrations were preserved.'
    });
  } catch (error: any) {
    logger.error('Failed to clear test data:', error);
    return res.status(500).json({ message: 'Failed to clear test data', error: error.message });
  }
});

export default router;
