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
  // Build query string
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

  const token = localStorage.getItem('auth_token');
  const apiUrl = getApiUrl();
  const url = `${apiUrl}/scripts/${scriptId}/analysis-stream?${params.toString()}`;
  const abortController = new AbortController();
  let closed = false;

  const parseSseFrame = (frame: string): AnalysisEvent | null => {
    const lines = frame.split('\n');
    const dataLines = lines
      .map((line) => line.trimEnd())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
      .filter(Boolean);

    if (dataLines.length === 0) return null;

    try {
      return JSON.parse(dataLines.join('\n')) as AnalysisEvent;
    } catch (error) {
      console.error('[LangGraph] Failed to parse SSE payload:', error, dataLines.join('\n'));
      return null;
    }
  };

  const streamOnce = async (): Promise<void> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      cache: 'no-store',
      signal: abortController.signal,
    });

    if (!response.ok) {
      let message = `Analysis stream request failed (${response.status})`;
      try {
        const errorBody = await response.json();
        if (errorBody?.message) {
          message = String(errorBody.message);
        }
      } catch {
        // Ignore non-JSON error payloads
      }

      if (response.status === 401 || response.status === 403) {
        message = 'Please sign in to run AI agent analysis.';
      } else if (response.status === 404) {
        message = 'Script not found.';
      } else if (response.status === 503) {
        message = 'AI service is temporarily unavailable. Please try again shortly.';
      }

      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No stream reader available for analysis.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (!parsed) continue;

        onEvent(parsed);

        if (parsed.type === 'completed' || parsed.type === 'error') {
          closed = true;
          abortController.abort();
          return;
        }
      }
    }
  };

  // Modern streaming implementation using Fetch + ReadableStream so we can
  // send auth headers and surface real HTTP errors instead of generic SSE failures.
  void streamOnce().catch((error: any) => {
    if (closed || abortController.signal.aborted) return;
    console.error('[LangGraph] Streaming failed:', error);
    onEvent({
      type: 'error',
      message: error?.message || 'Connection to analysis stream lost',
    });
  });

  return () => {
    closed = true;
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
