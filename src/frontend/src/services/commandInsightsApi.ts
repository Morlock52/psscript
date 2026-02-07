import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

export type CommandInsightFlag = {
  severity: 'info' | 'warn' | 'danger';
  pattern?: string;
  reason?: string;
  saferAlternative?: string;
};

export type CommandInsight = {
  id: number;
  cmdletName: string;
  description: string | null;
  howToUse: string | null;
  keyParameters: Array<{
    name?: string;
    description?: string;
    required?: boolean;
    dangerous?: boolean;
    notes?: string;
    example?: string;
  }>;
  useCases: Array<{
    title?: string;
    scenario?: string;
    exampleCommand?: string;
    sampleOutput?: string;
  }>;
  examples: Array<{
    title?: string;
    command?: string;
    explanation?: string;
    sampleOutput?: string;
  }>;
  sampleOutput: string | null;
  flags: CommandInsightFlag[];
  docsUrls: Array<{ title?: string; url?: string }>;
  lastEnrichedAt?: string;
  updatedAt?: string;
};

export type CommandEnrichmentJobStatus = 'queued' | 'running' | 'completed' | 'error' | 'cancelled';

export type CommandEnrichmentJob = {
  id: string;
  status: CommandEnrichmentJobStatus;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentCmdlet?: string | null;
  cancelRequested?: boolean;
  error?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  updatedAt?: string;
};

const commandInsightsApi = {
  getInsight: async (cmdlet: string): Promise<CommandInsight | null> => {
    const c = cmdlet.trim();
    if (!c) return null;
    try {
      const resp = await axios.get(`${getApiUrl()}/commands/${encodeURIComponent(c)}`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      return resp.data as CommandInsight;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) return null;
      throw err;
    }
  },

  startEnrichment: async (): Promise<{ jobId: string; alreadyRunning: boolean }> => {
    try {
      const resp = await axios.post(`${getApiUrl()}/commands/enrich`, {}, { headers: { 'Cache-Control': 'no-cache' } });
      return resp.data as { jobId: string; alreadyRunning: boolean };
    } catch (err: any) {
      // Backend returns 409 if a job is already queued/running, but includes jobId.
      if (err?.response?.status === 409 && err?.response?.data?.jobId) {
        return err.response.data as { jobId: string; alreadyRunning: boolean };
      }
      throw err;
    }
  },

  getJobStatus: async (jobId: string): Promise<CommandEnrichmentJob> => {
    const resp = await axios.get(`${getApiUrl()}/commands/enrich/${encodeURIComponent(jobId)}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    return resp.data as CommandEnrichmentJob;
  },

  cancelJob: async (jobId: string): Promise<void> => {
    await axios.post(`${getApiUrl()}/commands/enrich/${encodeURIComponent(jobId)}/cancel`, {}, { headers: { 'Cache-Control': 'no-cache' } });
  }
};

export default commandInsightsApi;
