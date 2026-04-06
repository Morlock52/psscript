/**
 * LangGraph Analysis Service
 *
 * Provides integration with LangGraph 1.0 production orchestrator
 * for advanced multi-agent script analysis.
 *
 * Features:
 * - Non-streaming analysis with full results
 * - Real-time streaming with Server-Sent Events (SSE)
 * - Human-in-the-loop feedback integration
 * - State persistence and recovery
 */

import { apiClient } from './api';
import { getApiUrl } from '../utils/apiUrl';

// ============================================================================
// Types
// ============================================================================

export interface LangGraphAnalysisOptions {
  require_human_review?: boolean;
  thread_id?: string;
  model?: string;
  /** AI provider inferred from model ID: 'openai' or 'anthropic' */
  provider?: string;
}

export interface ToolExecution {
  name: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface AnalysisEvent {
  type: 'connected' | 'stage_change' | 'tool_started' | 'tool_completed' |
        'reasoning' | 'finding' | 'completed' | 'error' | 'human_review_required';
  message?: string;
  data?: any;
  script_id?: string;
  timestamp?: string;
}

function createAnalysisRequestId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferStreamErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Connection to analysis stream lost';
}

export function buildAnalysisStreamUrl(
  scriptId: number,
  options: LangGraphAnalysisOptions = {},
  requestId?: string
): string {
  const params = new URLSearchParams();
  if (options.require_human_review !== undefined) {
    params.append('require_human_review', options.require_human_review.toString());
  }
  if (options.thread_id) {
    params.append('thread_id', options.thread_id);
  }
  if (options.model) {
    params.append('model', options.model);
  }
  if (requestId) {
    params.append('request_id', requestId);
  }

  const baseUrl = getApiUrl();
  const query = params.toString();
  return `${baseUrl}/scripts/${scriptId}/analysis-stream${query ? `?${query}` : ''}`;
}

export function normalizeAnalysisEvent(payload: unknown): AnalysisEvent {
  if (!payload || typeof payload !== 'object') {
    return {
      type: 'error',
      message: 'Received malformed analysis event',
    };
  }

  const event = payload as Record<string, any>;

  if (event.type === 'connected' || event.type === 'completed' || event.type === 'error' || event.type === 'human_review_required') {
    return event as AnalysisEvent;
  }

  if (event.type === 'stage_change') {
    return {
      type: 'stage_change',
      message: event.message,
      data: event.data,
      script_id: event.script_id,
      timestamp: event.timestamp,
    };
  }

  if (event.type === 'tool_started' || event.type === 'tool_completed' || event.type === 'reasoning' || event.type === 'finding') {
    return event as AnalysisEvent;
  }

  if (typeof event.stage === 'string') {
    return {
      type: 'stage_change',
      message: event.message,
      data: {
        ...event.data,
        workflow_id: event.workflow_id ?? event.data?.workflow_id,
        stage: event.current_stage ?? event.stage,
        node_name: event.node_name ?? event.node,
      },
      script_id: event.script_id,
      timestamp: event.timestamp,
    };
  }

  return {
    type: 'error',
    message: 'Received unknown analysis event format',
    data: event,
  };
}

export interface SecurityFinding {
  category: string;
  severity: number;
  pattern: string;
  description: string;
}

export interface QualityMetrics {
  quality_score: number;
  metrics: {
    total_lines: number;
    comment_lines?: number;
    empty_lines?: number;
    code_lines: number;
    comment_ratio?: number;
  };
  issues?: string[];
  recommendations?: string[];
}

export interface Optimization {
  category: string;
  priority: string;
  recommendation: string;
  impact: string;
}

export interface LangGraphAnalysisResults {
  workflow_id: string;
  thread_id: string;
  status: 'completed' | 'in_progress' | 'failed' | 'paused';
  current_stage: string;
  final_response?: string;
  analysis_results?: {
    analyze_powershell_script?: string;
    security_scan?: string;
    quality_analysis?: string;
    generate_optimizations?: string;
  };
  security_findings?: SecurityFinding[];
  quality_metrics?: QualityMetrics;
  optimizations?: Optimization[];
  requires_human_review: boolean;
  started_at: string;
  completed_at?: string;
}

export interface FeedbackOptions {
  thread_id: string;
  feedback: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Analyze a script using LangGraph orchestrator (non-streaming)
 *
 * @param scriptId - ID of the script to analyze
 * @param options - Analysis configuration options
 * @returns Promise with complete analysis results
 */
export async function analyzeLangGraph(
  scriptId: number,
  options: LangGraphAnalysisOptions = {}
): Promise<LangGraphAnalysisResults> {
  try {
    const response = await apiClient.post(
      `/scripts/${scriptId}/analyze-langgraph`,
      options,
      {
        timeout: 120000, // 2 minute timeout for full analysis
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('[LangGraph] Analysis failed:', error);

    // Provide user-friendly error messages
    if (error.response?.status === 503) {
      throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
    }

    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your API key.');
    }

    if (error.code === 'ECONNABORTED') {
      throw new Error('Analysis timed out. The script may be too complex.');
    }

    throw new Error(error.response?.data?.message || 'Analysis failed');
  }
}

/**
 * Stream analysis progress with Server-Sent Events (SSE)
 *
 * @param scriptId - ID of the script to analyze
 * @param onEvent - Callback function for each SSE event
 * @param options - Analysis configuration options
 * @returns Function to close the event stream
 */
export function streamAnalysis(
  scriptId: number,
  onEvent: (event: AnalysisEvent) => void,
  options: LangGraphAnalysisOptions = {}
): () => void {
  const requestId = createAnalysisRequestId();
  const url = buildAnalysisStreamUrl(scriptId, options, requestId);
  const abortController = new AbortController();
  let manuallyClosed = false;
  let sawAnyEvent = false;
  let sawTerminalEvent = false;

  void (async () => {
    try {
      const token = localStorage.getItem('auth_token');
      console.info('[LangGraph] Opening analysis stream', {
        requestId,
        scriptId,
        model: options.model,
        threadId: options.thread_id,
        url,
        hasAuthToken: Boolean(token),
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        let errorMessage = `Analysis stream request failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.json() as { message?: string; error?: string };
          errorMessage = errorBody.message || errorBody.error || errorMessage;
          console.error('[LangGraph] Analysis stream HTTP error body', {
            requestId,
            scriptId,
            status: response.status,
            statusText: response.statusText,
            errorBody,
          });
        } catch {
          // Ignore JSON parsing issues and keep the default HTTP error message.
          console.error('[LangGraph] Analysis stream HTTP error without JSON body', {
            requestId,
            scriptId,
            status: response.status,
            statusText: response.statusText,
          });
        }

        onEvent({
          type: 'error',
          message: `${errorMessage} (request ${requestId})`,
          data: { request_id: requestId, status: response.status },
        });
        sawTerminalEvent = true;
        return;
      }

      console.info('[LangGraph] Analysis stream connected', {
        requestId,
        scriptId,
        status: response.status,
        contentType: response.headers.get('content-type'),
        backendRequestId: response.headers.get('x-analysis-request-id'),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable analysis stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (!manuallyClosed) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split('\n')
            .find((line) => line.startsWith('data: '));

          if (!dataLine) {
            continue;
          }

          try {
            const data = normalizeAnalysisEvent(JSON.parse(dataLine.slice(6)));
            sawAnyEvent = true;
            if (!data.data) {
              data.data = {};
            }
            if (!data.data.request_id) {
              data.data.request_id = requestId;
            }
            onEvent(data);

            if (data.type === 'completed' || data.type === 'error') {
              console.info('[LangGraph] Analysis stream terminal event', {
                requestId,
                scriptId,
                type: data.type,
                message: data.message,
                data: data.data,
              });
              sawTerminalEvent = true;
              manuallyClosed = true;
              abortController.abort();
              return;
            }
          } catch (error) {
            console.error('[LangGraph] Failed to parse streaming event', {
              requestId,
              scriptId,
              rawEvent,
              error,
            });
          }
        }
      }

      if (!manuallyClosed && sawAnyEvent && !sawTerminalEvent) {
        onEvent({
          type: 'error',
          message: `Analysis stream was interrupted before completion (request ${requestId})`,
          data: { request_id: requestId },
        });
      }
    } catch (error) {
      if (manuallyClosed || sawTerminalEvent) {
        return;
      }

      console.error('[LangGraph] Streaming request error', {
        requestId,
        scriptId,
        model: options.model,
        threadId: options.thread_id,
        sawAnyEvent,
        error,
      });
      onEvent({
        type: 'error',
        message: `${inferStreamErrorMessage(error)} (request ${requestId})`,
        data: { request_id: requestId },
      });
    }
  })();

  return () => {
    manuallyClosed = true;
    console.info('[LangGraph] Closing analysis stream', { requestId, scriptId });
    abortController.abort();
  };
}

/**
 * Provide human feedback to continue a paused workflow
 *
 * @param scriptId - ID of the script being analyzed
 * @param feedbackOptions - Thread ID and feedback text
 * @returns Promise with updated analysis results
 */
export async function provideFeedback(
  scriptId: number,
  feedbackOptions: FeedbackOptions
): Promise<LangGraphAnalysisResults> {
  try {
    const response = await apiClient.post(
      `/scripts/${scriptId}/provide-feedback`,
      feedbackOptions,
      {
        timeout: 120000,
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('[LangGraph] Feedback submission failed:', error);

    if (error.response?.status === 400) {
      throw new Error('Invalid feedback. Please provide both thread_id and feedback text.');
    }

    if (error.response?.status === 404) {
      throw new Error('Workflow not found. It may have expired.');
    }

    throw new Error(error.response?.data?.message || 'Failed to submit feedback');
  }
}

/**
 * Check if a thread_id has an active or resumable workflow
 *
 * Note: This would require a backend endpoint to check workflow status
 * For now, we'll store thread_ids locally
 */
export function getActiveThreadId(scriptId: number): string | null {
  const key = `langgraph_thread_${scriptId}`;
  return localStorage.getItem(key);
}

/**
 * Save thread_id for later resumption
 */
export function saveThreadId(scriptId: number, threadId: string): void {
  const key = `langgraph_thread_${scriptId}`;
  localStorage.setItem(key, threadId);

  // Also store timestamp for cleanup
  const timestampKey = `${key}_timestamp`;
  localStorage.setItem(timestampKey, Date.now().toString());
}

/**
 * Clear saved thread_id (call after successful completion)
 */
export function clearThreadId(scriptId: number): void {
  const key = `langgraph_thread_${scriptId}`;
  localStorage.removeItem(key);
  localStorage.removeItem(`${key}_timestamp`);
}

/**
 * Parse analysis results from tool outputs
 *
 * LangGraph tools return JSON strings that need parsing
 */
export function parseAnalysisResults(results: LangGraphAnalysisResults): {
  security?: any;
  quality?: any;
  optimizations?: any;
  basicAnalysis?: any;
} {
  const parsed: any = {};

  if (results.analysis_results) {
    try {
      if (results.analysis_results.security_scan) {
        parsed.security = JSON.parse(results.analysis_results.security_scan);
      }

      if (results.analysis_results.quality_analysis) {
        parsed.quality = JSON.parse(results.analysis_results.quality_analysis);
      }

      if (results.analysis_results.generate_optimizations) {
        parsed.optimizations = JSON.parse(results.analysis_results.generate_optimizations);
      }

      if (results.analysis_results.analyze_powershell_script) {
        parsed.basicAnalysis = JSON.parse(results.analysis_results.analyze_powershell_script);
      }
    } catch (error) {
      console.error('[LangGraph] Failed to parse analysis results:', error);
    }
  }

  return parsed;
}

/**
 * Clean up stale thread_ids (older than 24 hours)
 * Call this on app initialization
 */
export function cleanupStaleThreads(): void {
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  // Iterate through localStorage to find thread_ids
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith('langgraph_thread_') && key.endsWith('_timestamp')) {
      const timestamp = parseInt(localStorage.getItem(key) || '0', 10);

      if (now - timestamp > maxAge) {
        // Remove stale thread
        const threadKey = key.replace('_timestamp', '');
        localStorage.removeItem(threadKey);
        localStorage.removeItem(key);
        console.log(`[LangGraph] Cleaned up stale thread: ${threadKey}`);
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format analysis duration in human-readable form
 */
export function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const durationMs = end - start;

  const seconds = Math.floor(durationMs / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get risk level badge color based on risk score
 */
export function getRiskLevelColor(riskScore: number): string {
  if (riskScore > 30) return 'error'; // CRITICAL
  if (riskScore > 20) return 'error'; // HIGH
  if (riskScore > 10) return 'warning'; // MEDIUM
  return 'success'; // LOW
}

/**
 * Get risk level label based on risk score
 */
export function getRiskLevelLabel(riskScore: number): string {
  if (riskScore > 30) return 'CRITICAL';
  if (riskScore > 20) return 'HIGH';
  if (riskScore > 10) return 'MEDIUM';
  return 'LOW';
}

// Export default for convenience
export default {
  analyzeLangGraph,
  streamAnalysis,
  provideFeedback,
  getActiveThreadId,
  saveThreadId,
  clearThreadId,
  parseAnalysisResults,
  cleanupStaleThreads,
  formatDuration,
  getRiskLevelColor,
  getRiskLevelLabel,
};
