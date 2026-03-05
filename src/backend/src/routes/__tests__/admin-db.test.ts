import request from 'supertest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TEST_BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'psscript-admin-db-test-'));
process.env.DISABLE_AUTH = 'true';
process.env.DB_BACKUP_DIR = TEST_BACKUP_DIR;

jest.mock('../../database/connection', () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
    getQueryInterface: jest.fn()
  }
}));

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateJWT: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next()
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import adminDbRouter from '../admin-db';
import { sequelize } from '../../database/connection';

const mockedSequelize = sequelize as unknown as {
  query: jest.Mock;
  transaction: jest.Mock;
  getQueryInterface: jest.Mock;
};

const defaultAdminDbTables = [
  'users',
  'categories',
  'tags',
  'scripts',
  'script_versions',
  'script_tags',
  'script_analysis',
  'script_embeddings',
  'script_dependencies',
  'execution_logs',
  'user_favorites',
  'comments',
  'chat_history',
  'documentation'
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/db', adminDbRouter);
  return app;
}

function cleanBackupDir() {
  if (!fs.existsSync(TEST_BACKUP_DIR)) {
    fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
  }

  for (const file of fs.readdirSync(TEST_BACKUP_DIR)) {
    fs.unlinkSync(path.join(TEST_BACKUP_DIR, file));
  }
}

function mockInformationSchemaTables(names: string[]) {
  mockedSequelize.query.mockImplementation(async (sql: string) => {
    if (sql.includes('information_schema.tables')) {
      return names.map((table_name) => ({ table_name }));
    }

    if (sql.includes('SELECT * FROM "users"')) {
      return [{ id: 1, username: 'admin' }];
    }

    if (sql.includes('SELECT * FROM "scripts"')) {
      return [{ id: 10, title: 'test script' }];
    }

    if (sql.includes('SELECT * FROM "script_analysis"')) {
      return [{ id: 1, script_id: 10, security_score: 8 }];
    }

    if (sql.includes('SELECT COUNT(*)::int AS count')) {
      return [{ count: 3 }];
    }

    return [];
  });
}

describe('admin-db routes', () => {
  beforeEach(() => {
    cleanBackupDir();
    jest.clearAllMocks();

    mockedSequelize.transaction.mockImplementation(async (cb: any) => cb({}));
    mockedSequelize.getQueryInterface.mockReturnValue({
      bulkInsert: jest.fn().mockResolvedValue(undefined)
    });

    mockInformationSchemaTables(defaultAdminDbTables);
  });

  afterAll(() => {
    fs.rmSync(TEST_BACKUP_DIR, { recursive: true, force: true });
  });

  test('GET /backups returns empty list when no files exist', async () => {
    const app = createApp();

    const res = await request(app).get('/api/admin/db/backups');

    expect(res.status).toBe(200);
    expect(res.body.backups).toEqual([]);
    expect(res.body.directory).toBe(TEST_BACKUP_DIR);
  });

  test('POST /backup creates a backup json file', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/admin/db/backup')
      .send({ filename: 'unit-test-backup' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.backup.name).toBe('unit-test-backup.json');

    const backupPath = path.join(TEST_BACKUP_DIR, 'unit-test-backup.json');
    expect(fs.existsSync(backupPath)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(payload.tables.users).toHaveLength(1);
    expect(payload.tables.scripts).toHaveLength(1);
  });

  test('POST /backup auto-generates a default safe backup filename when omitted', async () => {
    const app = createApp();

    const res = await request(app).post('/api/admin/db/backup').send({});

    expect(res.status).toBe(200);
    expect(res.body.backup?.name).toMatch(/^db-backup-.*\.json$/);
  });

  test('POST /restore returns 404 for missing backup file', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/admin/db/restore')
      .send({ filename: 'does-not-exist.json' });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  test('POST /restore truncates and bulk-inserts table rows from backup', async () => {
    const app = createApp();
    const backupName = 'restore-source.json';
    const backupPath = path.join(TEST_BACKUP_DIR, backupName);
    const backupPayload = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: 'psscript',
      tables: {
        users: [{ id: 2, username: 'restored-user' }],
        scripts: [{ id: 9, title: 'restored-script' }]
      }
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupPayload));

    mockedSequelize.query.mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.tables')) {
        return [{ table_name: 'users' }, { table_name: 'scripts' }];
      }
      return [];
    });

    const bulkInsertMock = jest.fn().mockResolvedValue(undefined);
    mockedSequelize.getQueryInterface.mockReturnValue({ bulkInsert: bulkInsertMock });

    const res = await request(app)
      .post('/api/admin/db/restore')
      .send({ filename: backupName });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const truncateCall = mockedSequelize.query.mock.calls.find((call) =>
      String(call[0]).includes('TRUNCATE TABLE')
    );
    expect(truncateCall).toBeDefined();
    expect(String(truncateCall?.[0])).toContain('"users"');
    expect(String(truncateCall?.[0])).toContain('"scripts"');

    expect(bulkInsertMock).toHaveBeenCalledWith('users', [{ id: 2, username: 'restored-user' }], expect.any(Object));
    expect(bulkInsertMock).toHaveBeenCalledWith('scripts', [{ id: 9, title: 'restored-script' }], expect.any(Object));
  });

  test('POST /clear-test-data requires exact confirmation text', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/admin/db/clear-test-data')
      .send({ confirmText: 'CLEAR' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/confirmation text mismatch/i);
  });

  test('POST /clear-test-data truncates only configured test-data tables', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/api/admin/db/clear-test-data')
      .send({
        confirmText: 'CLEAR TEST DATA',
        backupFirst: false
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.clearedTables)).toBe(true);
    expect(res.body.clearedTables).toContain('scripts');
    expect(res.body.clearedTables).not.toContain('documentation');
    expect(res.body.clearedTables).not.toContain('ai_metrics');
    expect(res.body.requestedTables).toEqual(expect.arrayContaining([
      'comments',
      'execution_logs',
      'script_dependencies',
      'script_tags',
      'script_versions',
      'script_analysis',
      'script_embeddings',
      'user_favorites',
      'chat_history',
      'scripts'
    ]));
    expect(res.body.filteredTables).toEqual(expect.arrayContaining(res.body.clearedTables));

    const truncateCall = mockedSequelize.query.mock.calls.find((call) =>
      String(call[0]).includes('TRUNCATE TABLE')
    );
    expect(truncateCall).toBeDefined();
    expect(String(truncateCall?.[0])).toContain('"scripts"');
    expect(String(truncateCall?.[0])).not.toContain('"documentation"');
  });

  test('POST /clear-test-data supports explicit table filters and ignores unavailable tables', async () => {
    const app = createApp();

    mockInformationSchemaTables(['scripts', 'comments', 'documentation']);

    const res = await request(app)
      .post('/api/admin/db/clear-test-data')
      .send({
        confirmText: 'CLEAR TEST DATA',
        backupFirst: false,
        tables: ['scripts', 'comments', 'ghost_table']
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clearedTables).toEqual(expect.arrayContaining(['scripts', 'comments']));
    expect(res.body.requestedTables).toEqual(['scripts', 'comments', 'ghost_table']);
    expect(res.body.filteredTables).toEqual(expect.arrayContaining(['scripts', 'comments']));
    expect(res.body.ignoredTables).toEqual(['ghost_table']);
    expect(res.body.clearedTables).not.toContain('ghost_table');
  });

  test('POST /clear-test-data deduplicates table filters and returns skipped tables', async () => {
    const app = createApp();

    mockInformationSchemaTables(['scripts', 'comments', 'documentation']);

    const res = await request(app)
      .post('/api/admin/db/clear-test-data')
      .send({
        confirmText: 'CLEAR TEST DATA',
        backupFirst: false,
        tables: ['scripts', 'scripts', 'ghost_table', 'comments', 'comments']
      });

    expect(res.status).toBe(200);
    expect(res.body.requestedTables).toEqual(['scripts', 'ghost_table', 'comments']);
    expect(res.body.filteredTables).toEqual(['scripts', 'comments']);
    expect(res.body.ignoredTables).toEqual(['ghost_table']);
    expect(res.body.clearedTables).toEqual(['scripts', 'comments']);
  });
});
