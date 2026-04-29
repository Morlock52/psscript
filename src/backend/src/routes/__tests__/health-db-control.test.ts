import request from 'supertest';
import express from 'express';

const mockAuthState = {
  authenticated: false,
  role: 'user'
};

jest.mock('../../database/connection', () => ({
  sequelize: {
    close: jest.fn().mockResolvedValue(undefined),
    authenticate: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../../models', () => ({
  dbConnectionInfo: jest.fn().mockReturnValue({
    host: 'localhost',
    port: 5432,
    database: 'psscript',
    username: 'test',
    dialect: 'postgres'
  })
}));

jest.mock('../../middleware/authMiddleware', () => ({
  authenticateJWT: jest.fn((req: any, res: any, next: any) => {
    if (!mockAuthState.authenticated) {
      return res.status(401).json({ error: 'missing_token' });
    }

    req.user = {
      id: 1,
      username: 'test-user',
      email: 'test@example.com',
      role: mockAuthState.role
    };
    return next();
  }),
  requireAdmin: jest.fn((req: any, res: any, next: any) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'insufficient_privileges' });
    }

    return next();
  })
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

jest.mock('../../services/cacheService', () => ({
  cache: {
    stats: jest.fn().mockReturnValue({ size: 0, keys: [] })
  }
}));

jest.mock('../../utils/redis', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  persistCache: jest.fn(),
  loadCache: jest.fn()
}));

import healthRouter from '../health';
import { sequelize } from '../../database/connection';

const mockedSequelize = sequelize as unknown as {
  close: jest.Mock;
  authenticate: jest.Mock;
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  return app;
}

describe('health database control routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.authenticated = false;
    mockAuthState.role = 'user';
  });

  test('rejects unauthenticated disconnect without closing the database connection', async () => {
    const app = createApp();

    const response = await request(app).post('/api/health/db/disconnect');

    expect(response.status).toBe(401);
    expect(mockedSequelize.close).not.toHaveBeenCalled();
  });

  test('rejects non-admin disconnect without closing the database connection', async () => {
    mockAuthState.authenticated = true;
    mockAuthState.role = 'user';
    const app = createApp();

    const response = await request(app).post('/api/health/db/disconnect');

    expect(response.status).toBe(403);
    expect(mockedSequelize.close).not.toHaveBeenCalled();
  });

  test('allows admin disconnect through the protected route', async () => {
    mockAuthState.authenticated = true;
    mockAuthState.role = 'admin';
    const app = createApp();

    const response = await request(app).post('/api/health/db/disconnect');

    expect(response.status).toBe(200);
    expect(response.body.dbStatus).toBe('disconnected');
    expect(mockedSequelize.close).toHaveBeenCalledTimes(1);
  });
});
