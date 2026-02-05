import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

// API URL is now computed at runtime via getApiUrl() to support tunnels/proxies

// Types for documentation API
export interface DocItem {
  id: number;
  title: string;
  url: string;
  content: string;
  summary?: string;
  similarity?: number;
  source: string;
  contentType?: string;
  category?: string;
  crawledAt: string;
  tags: string[];
  extractedCommands?: string[];
  extractedFunctions?: string[];
  extractedModules?: string[];
  metadata?: Record<string, unknown>;
}

export interface CrawlConfig {
  url: string;
  maxPages: number;
  depth: number;
  includeExternalLinks: boolean;
  fileTypes: string[];
}

export interface CrawlResult {
  pagesProcessed: number;
  totalPages: number;
  scriptsFound: number;
  status: 'completed' | 'error';
  message?: string;
  data?: DocItem[];
}

export interface AICrawlJobStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress: {
    pagesProcessed: number;
    totalPages: number;
    scriptsFound: number;
    scriptsSaved: number;
    currentUrl?: string;
  };
  result?: {
    total: number;
    scriptsFound: number;
    scriptsSaved: number;
    message: string;
  };
  error?: string;
}

export class AICrawlJobStartError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AICrawlJobStartError';
    this.status = status;
  }
}

export interface SearchParams {
  query?: string;
  sources?: string[];
  tags?: string[];
  contentTypes?: string[];
  sortBy?: 'relevance' | 'date' | 'title';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: DocItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocStats {
  total: number;
  sources: Record<string, number>;
  tagsCount: number;
  lastCrawled: string | null;
}

// Documentation API service
const documentationApi = {
  // Get recent documentation
  getRecentDocumentation: async (limit = 20): Promise<DocItem[]> => {
    try {
      const response = await axios.get(`${getApiUrl()}/documentation?limit=${limit}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch documentation');
    } catch (error) {
      console.error('Error fetching recent documentation:', error);
      // Return empty array on error so UI can handle gracefully
      return [];
    }
  },

  // Search documentation
  searchDocumentation: async (params: SearchParams): Promise<SearchResult> => {
    try {
      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append('query', params.query);
      if (params.sources?.length) queryParams.append('sources', params.sources.join(','));
      if (params.tags?.length) queryParams.append('tags', params.tags.join(','));
      if (params.contentTypes?.length) queryParams.append('contentTypes', params.contentTypes.join(','));
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());

      const response = await axios.get(`${getApiUrl()}/documentation/search?${queryParams.toString()}`);
      if (response.data.success) {
        return {
          items: response.data.data,
          total: response.data.total,
          limit: response.data.limit,
          offset: response.data.offset
        };
      }
      throw new Error(response.data.error || 'Failed to search documentation');
    } catch (error) {
      console.error('Error searching documentation:', error);
      return { items: [], total: 0, limit: params.limit || 20, offset: params.offset || 0 };
    }
  },

  // Get available sources
  getSources: async (): Promise<string[]> => {
    try {
      const response = await axios.get(`${getApiUrl()}/documentation/sources`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch sources');
    } catch (error) {
      console.error('Error fetching documentation sources:', error);
      // Return default sources on error
      return ['Microsoft Learn', 'PowerShell Gallery', 'GitHub'];
    }
  },

  // Get available tags
  getTags: async (): Promise<string[]> => {
    try {
      const response = await axios.get(`${getApiUrl()}/documentation/tags`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch tags');
    } catch (error) {
      console.error('Error fetching documentation tags:', error);
      return [];
    }
  },

  // Get documentation statistics
  getStats: async (): Promise<DocStats> => {
    try {
      const response = await axios.get(`${getApiUrl()}/documentation/stats`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch stats');
    } catch (error) {
      console.error('Error fetching documentation stats:', error);
      return { total: 0, sources: {}, tagsCount: 0, lastCrawled: null };
    }
  },

  // Get single documentation item by ID
  getById: async (id: number): Promise<DocItem | null> => {
    try {
      const response = await axios.get(`${getApiUrl()}/documentation/${id}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to fetch documentation');
    } catch (error) {
      console.error('Error fetching documentation by ID:', error);
      return null;
    }
  },

  // Start a crawl from a URL
  startCrawl: async (config: CrawlConfig): Promise<CrawlResult> => {
    try {
      const response = await axios.post(`${getApiUrl()}/documentation/crawl`, {
        url: config.url,
        maxPages: config.maxPages,
        depth: config.depth,
        includeExternalLinks: config.includeExternalLinks,
        fileTypes: config.fileTypes
      });

      if (response.data.success) {
        return {
          pagesProcessed: response.data.total,
          totalPages: response.data.total,
          scriptsFound: response.data.total,
          status: 'completed',
          message: response.data.message,
          data: response.data.data
        };
      }
      throw new Error(response.data.error || 'Failed to crawl documentation');
    } catch (error) {
      console.error('Error starting crawl:', error);
      return {
        pagesProcessed: 0,
        totalPages: 0,
        scriptsFound: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Create or update documentation
  upsert: async (doc: Partial<DocItem>): Promise<DocItem | null> => {
    try {
      const response = await axios.post(`${getApiUrl()}/documentation`, doc);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(response.data.error || 'Failed to save documentation');
    } catch (error) {
      console.error('Error upserting documentation:', error);
      return null;
    }
  },

  // Bulk import documentation
  bulkImport: async (documents: Partial<DocItem>[]): Promise<{ imported: number; errors: number }> => {
    try {
      const response = await axios.post(`${getApiUrl()}/documentation/bulk`, { documents });
      if (response.data.success) {
        return {
          imported: response.data.imported,
          errors: response.data.errors
        };
      }
      throw new Error(response.data.error || 'Failed to import documentation');
    } catch (error) {
      console.error('Error bulk importing documentation:', error);
      return { imported: 0, errors: documents.length };
    }
  },

  // Delete documentation
  delete: async (id: number): Promise<boolean> => {
    try {
      const response = await axios.delete(`${getApiUrl()}/documentation/${id}`);
      return response.data.success;
    } catch (error) {
      console.error('Error deleting documentation:', error);
      return false;
    }
  },

  // AI-powered crawl - fetches real content and uses AI for titles, summaries, script analysis
  crawlWithAI: async (config: { url: string; maxPages: number; depth: number }): Promise<CrawlResult> => {
    try {
      const response = await axios.post(`${getApiUrl()}/documentation/crawl/ai`, {
        url: config.url,
        maxPages: config.maxPages,
        depth: config.depth
      }, {
        timeout: 120000 // 2 minute timeout for AI processing
      });

      if (response.data.success) {
        return {
          pagesProcessed: response.data.total,
          totalPages: response.data.total,
          scriptsFound: response.data.data?.reduce((sum: number, d: any) => sum + (d.doc?.metadata?.scriptsFound || 0), 0) || 0,
          status: 'completed',
          message: response.data.message,
          data: response.data.data?.map((d: any) => d.doc) || []
        };
      }
      throw new Error(response.data.error || 'AI crawl failed');
    } catch (error) {
      console.error('Error in AI crawl:', error);
      return {
        pagesProcessed: 0,
        totalPages: 0,
        scriptsFound: 0,
        status: 'error',
        message: error instanceof Error ? error.message : 'AI crawl failed'
      };
    }
  },

  // Async AI crawl job (recommended): start job and poll status
  startAICrawlJob: async (config: { url: string; maxPages: number; depth: number }): Promise<string> => {
    try {
      const response = await axios.post(`${getApiUrl()}/documentation/crawl/ai/start`, {
        url: config.url,
        maxPages: config.maxPages,
        depth: config.depth
      }, {
        timeout: 15000
      });

      if (response.data?.success && response.data?.jobId) {
        return response.data.jobId as string;
      }

      throw new AICrawlJobStartError(response.data?.error || 'Failed to start AI crawl job', response.status);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message || 'Failed to start AI crawl job';
        throw new AICrawlJobStartError(message, status);
      }
      throw error;
    }
  },

  getAICrawlJobStatus: async (jobId: string): Promise<AICrawlJobStatus> => {
    const response = await axios.get(`${getApiUrl()}/documentation/crawl/ai/status/${jobId}`, {
      timeout: 15000
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data as AICrawlJobStatus;
    }

    throw new Error(response.data?.error || 'Failed to fetch AI crawl job status');
  }
};

export default documentationApi;
