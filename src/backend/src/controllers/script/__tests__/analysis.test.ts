jest.mock('../shared', () => ({
  Script: {
    findByPk: jest.fn()
  },
  ScriptAnalysis: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  sequelize: {
    transaction: jest.fn(),
    query: jest.fn()
  },
  Transaction: {
    ISOLATION_LEVELS: {
      SERIALIZABLE: 'SERIALIZABLE'
    }
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  },
  axios: {
    post: jest.fn(),
    isAxiosError: jest.fn()
  },
  AI_SERVICE_URL: 'http://ai-service',
  TIMEOUTS: {
    STANDARD: 100,
    FULL_ANALYSIS: 100,
    EXTENDED: 100
  },
  CACHE_TTL: {},
  fetchScriptAnalysis: jest.fn(),
  getCache: jest.fn(),
  crypto: {
    randomUUID: jest.fn(() => 'test-uuid')
  }
}));

import { getScriptAnalysis, analyzeScript, normalizeLangGraphStreamEvent } from '../analysis';
import * as shared from '../shared';

function createResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('script analysis controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getScriptAnalysis returns 404 when script exists but analysis is missing', async () => {
    (shared.fetchScriptAnalysis as jest.Mock).mockResolvedValue(null);
    (shared.Script.findByPk as jest.Mock).mockResolvedValue({ id: 42 });

    const req: any = { params: { id: '42' } };
    const res = createResponse();
    const next = jest.fn();

    await getScriptAnalysis(req, res, next);

    expect(shared.fetchScriptAnalysis).toHaveBeenCalledWith('42');
    expect(shared.Script.findByPk).toHaveBeenCalledWith('42', { attributes: ['id'] });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Analysis not found for this script',
      error: 'analysis_not_found',
      scriptId: 42
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('analyzeScript returns 502 when upstream analysis service responds with an error', async () => {
    const upstreamError = {
      response: { status: 429 }
    };

    (shared.axios.post as jest.Mock).mockRejectedValue(upstreamError);
    ((shared.axios.isAxiosError as unknown) as jest.Mock).mockReturnValue(true);

    const req: any = {
      body: { content: 'Write-Host "test"' },
      headers: {}
    };
    const res = createResponse();

    await analyzeScript(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Analysis service returned an error',
      error: 'analysis_service_error',
      status: 429
    });
  });

  test('analyzeScript returns 504 when analysis times out', async () => {
    (shared.axios.post as jest.Mock).mockRejectedValue(new Error('Analysis request timed out'));
    ((shared.axios.isAxiosError as unknown) as jest.Mock).mockReturnValue(false);

    const req: any = {
      body: { content: 'Write-Host "test"' },
      headers: {}
    };
    const res = createResponse();

    await analyzeScript(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Analysis request timed out',
      error: 'analysis_timeout'
    });
  });

  test('normalizeLangGraphStreamEvent converts workflow node events to stage_change', () => {
    const event = normalizeLangGraphStreamEvent('42', {
      node_name: 'tools',
      stage: 'tool_execution',
      workflow_id: 'wf-1',
      timestamp: '2026-04-05T00:00:00.000Z'
    });

    expect(event).toEqual({
      type: 'stage_change',
      message: 'Workflow advanced to tools',
      data: {
        workflow_id: 'wf-1',
        stage: 'tool_execution',
        node_name: 'tools'
      },
      script_id: '42',
      timestamp: '2026-04-05T00:00:00.000Z'
    });
  });

  test('normalizeLangGraphStreamEvent preserves terminal completed events', () => {
    const event = normalizeLangGraphStreamEvent('42', {
      type: 'completed',
      workflow_id: 'wf-2',
      final_response: 'done',
      analysis_results: { security_scan: '{}' },
      timestamp: '2026-04-05T00:00:01.000Z'
    });

    expect(event).toEqual({
      type: 'completed',
      message: 'Analysis complete',
      data: {
        workflow_id: 'wf-2',
        stage: 'unknown',
        node_name: undefined,
        final_response: 'done',
        analysis_results: { security_scan: '{}' }
      },
      script_id: '42',
      timestamp: '2026-04-05T00:00:01.000Z'
    });
  });
});
