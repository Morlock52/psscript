import crypto from 'crypto';

export type DocCrawlJobStatus = 'queued' | 'running' | 'completed' | 'error' | 'canceled';

export interface DocCrawlJobProgress {
  pagesProcessed: number;
  totalPages: number;
  scriptsFound: number;
  scriptsSaved: number;
}

export interface DocCrawlJobState {
  id: string;
  status: DocCrawlJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  message: string;
  error?: string;
  config: {
    url: string;
    maxPages: number;
    depth: number;
  };
  progress: DocCrawlJobProgress;
  result?: {
    totalDocsSaved: number;
    scriptsFound: number;
    scriptsSaved: number;
  };
  canceled?: boolean;
}

/**
 * Minimal in-memory job tracker for long-running documentation crawls.
 *
 * Why in-memory:
 * - Local dev UX: avoids "Network Error" caused by long requests/proxy timeouts.
 * - Simple cancellation/progress.
 *
 * Note: jobs are lost if the backend restarts. If we need persistence, we can
 * back this with Redis later.
 */
export class DocCrawlJobService {
  private jobs = new Map<string, DocCrawlJobState>();

  createJob(config: DocCrawlJobState['config']): DocCrawlJobState {
    const id = crypto.randomUUID();
    const job: DocCrawlJobState = {
      id,
      status: 'queued',
      createdAt: new Date().toISOString(),
      message: 'Queued',
      config,
      progress: {
        pagesProcessed: 0,
        totalPages: config.maxPages,
        scriptsFound: 0,
        scriptsSaved: 0,
      },
      canceled: false,
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): DocCrawlJobState | undefined {
    return this.jobs.get(id);
  }

  cancelJob(id: string): DocCrawlJobState | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    job.canceled = true;
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'canceled';
      job.finishedAt = new Date().toISOString();
      job.message = 'Canceled';
    }
    return job;
  }

  updateJob(id: string, patch: Partial<DocCrawlJobState>): DocCrawlJobState | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch);
    this.jobs.set(id, job);
    return job;
  }
}

export const docCrawlJobService = new DocCrawlJobService();

