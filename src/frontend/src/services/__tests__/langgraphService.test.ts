import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAnalysisStreamUrl,
  normalizeAnalysisEvent,
} from '../langgraphService';

vi.mock('../../utils/apiUrl', () => ({
  getApiUrl: vi.fn(() => '/api'),
}));

describe('langgraphService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('buildAnalysisStreamUrl', () => {
    it('builds the SSE URL from the runtime API base instead of axios defaults', () => {
      const url = buildAnalysisStreamUrl(42, {
        require_human_review: false,
        thread_id: 'thread-123',
        model: 'gpt-5.4',
      }, 'analysis-req-1');

      expect(url).toBe(
        '/api/scripts/42/analysis-stream?require_human_review=false&thread_id=thread-123&model=gpt-5.4&request_id=analysis-req-1'
      );
    });
  });

  describe('normalizeAnalysisEvent', () => {
    it('passes through supported stage_change events', () => {
      const event = normalizeAnalysisEvent({
        type: 'stage_change',
        message: 'Analyzing',
        data: { stage: 'analysis', workflow_id: 'wf-1' },
      });

      expect(event).toEqual({
        type: 'stage_change',
        message: 'Analyzing',
        data: { stage: 'analysis', workflow_id: 'wf-1' },
      });
    });

    it('normalizes legacy workflow events into stage_change payloads', () => {
      const event = normalizeAnalysisEvent({
        node: 'tools',
        stage: 'tool_execution',
        workflow_id: 'wf-2',
        timestamp: '2026-04-05T00:00:00.000Z',
      });

      expect(event).toEqual({
        type: 'stage_change',
        message: undefined,
        data: {
          workflow_id: 'wf-2',
          stage: 'tool_execution',
          node_name: 'tools',
        },
        script_id: undefined,
        timestamp: '2026-04-05T00:00:00.000Z',
      });
    });

    it('reports malformed payloads as errors', () => {
      expect(normalizeAnalysisEvent(null)).toEqual({
        type: 'error',
        message: 'Received malformed analysis event',
      });
    });
  });

  describe('terminal event normalization', () => {
    it('preserves explicit backend error events so they are not replaced by generic transport errors', () => {
      const event = normalizeAnalysisEvent({
        type: 'error',
        message: 'OpenAI API key is invalid or missing.',
        data: { stage: 'failed', workflow_id: 'wf-3', request_id: 'analysis-req-2' },
      });

      expect(event).toEqual({
        type: 'error',
        message: 'OpenAI API key is invalid or missing.',
        data: { stage: 'failed', workflow_id: 'wf-3', request_id: 'analysis-req-2' },
      });
    });
  });
});
