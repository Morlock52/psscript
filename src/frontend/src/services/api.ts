import axios, { AxiosRequestConfig, AxiosError, InternalAxiosRequestConfig } from "axios";
import { getApiUrl, isLocalhost as checkIsLocalhost } from "../utils/apiUrl";
import { extractApiError, ErrorCodes as _ErrorCodes } from "../utils/errorUtils";

// Determine if we're running in a development environment
// This is evaluated at runtime in the browser
const isDevelopment = import.meta.env.DEV ||
  (typeof window !== 'undefined' && checkIsLocalhost());

// Create axios instance WITHOUT baseURL - we'll add it dynamically via interceptor
// This ensures the URL is computed at RUNTIME, not BUILD time
const apiClient = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to dynamically set baseURL at runtime AND add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Step 1: Prepend API URL if the request URL is relative (doesn't start with http)
    if (config.url && !config.url.startsWith('http')) {
      const apiUrl = getApiUrl();
      config.url = `${apiUrl}${config.url.startsWith('/') ? '' : '/'}${config.url}`;
    }

    // Step 2: Add auth token
    const token = localStorage.getItem("auth_token");

    const isFileUpload = config.url?.includes('/upload') === true;

    // Upload endpoints are authenticated too, so do not suppress the auth header.
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    // Log requests in development
    if (isDevelopment) {
      console.log(`[api.ts] Request: ${config.method?.toUpperCase()} ${config.url}`,
        isFileUpload ? '[File Upload]' : '');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Export apiClient for use in other modules
export { apiClient };

// Also export apiClient as default for backward compatibility
export default apiClient;

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    
    // Handle token expiration (401 errors)
    const config = originalRequest;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      
      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const res = await apiClient.post("/auth/refresh", { refreshToken });
          const { token } = res.data;
          
          // Update stored token
          localStorage.setItem("auth_token", token);
          
          // Retry original request with new token
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (_refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }

    if (
      error.response?.status === 403 &&
      (error.response.data as any)?.error === 'account_pending_approval' &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/pending-approval'
    ) {
      window.location.href = '/pending-approval';
    }
    
    // Use centralized error extraction for consistent error handling
    // This ensures all errors have the same shape: { status, message, code, isNetworkError, ... }
    const apiError = extractApiError(error);

    // Log in development mode
    if (isDevelopment) {
      console.error(`[api.ts] API Error:`, {
        code: apiError.code,
        status: apiError.status,
        message: apiError.message,
        isNetworkError: apiError.isNetworkError,
      });
    }

    // Return standardized error object
    return Promise.reject(apiError);
  }
);

// Real API service
const scriptService = {
  getScripts: async (params = {}) => {
    try {
      const response = await apiClient.get("/scripts", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching scripts:", error);
      return { scripts: [], total: 0 };
    }
  },
  
  getScript: async (id: string) => {
    try {
      const response = await apiClient.get(`/scripts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching script ${id}:`, error);
      throw error;
    }
  },
  
  uploadScript: async (scriptData: any, isLargeFile: boolean = false) => {
    try {
      // Check if we're dealing with FormData or JSON
      const isFormData = scriptData instanceof FormData;
      const authToken = localStorage.getItem("auth_token");
      
      // Let the browser set multipart boundaries for FormData automatically.
      const config: AxiosRequestConfig = {
        headers: isFormData ? {} : {
          'Content-Type': 'application/json'
        },
        // Increase timeout for large files
        timeout: isLargeFile ? 60000 : 30000, // 60 seconds for large files
        withCredentials: false
      };
      
      // Choose the appropriate endpoint based on file size and type
      const endpoint = isFormData
        ? isLargeFile
          ? "/scripts/upload/large"
          : "/scripts/upload"
        : "/scripts/upload";

      const uploadConfig: AxiosRequestConfig = {
        ...config,
        // Increase timeout for all uploads
        timeout: isLargeFile ? 180000 : 120000, // 3 minutes for large files, 2 minutes for regular
        withCredentials: false,
        // Set max content length (same as server settings)
        maxContentLength: isLargeFile ? 6 * 1024 * 1024 : 5 * 1024 * 1024,
        maxBodyLength: isLargeFile ? 6 * 1024 * 1024 : 5 * 1024 * 1024,
        headers: {
          ...config.headers,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      };
	        
      const response = await apiClient.post(endpoint, scriptData, uploadConfig);
      return response.data;
	       
     } catch (error) {
      const err = error as AxiosError & {
        status?: number;
        code?: string;
        details?: Record<string, unknown>;
        existingScriptId?: string | number;
        requestId?: string;
      };
      const responseData = (err.response?.data as Record<string, unknown> | undefined) || err.details || {};
      const status = err.status ?? err.response?.status;
      const requestId = err.requestId || responseData.requestId;

      const throwUploadError = (message: string, extra: Record<string, unknown> = {}) => {
        throw Object.assign(new Error(message), {
          status,
          code: err.code || responseData.error,
          details: responseData,
          requestId,
          ...extra,
        });
      };

      if (status === 409) {
        throwUploadError(err.message || String(responseData.message || 'This script already exists.'), {
          existingScriptId: err.existingScriptId || responseData.existingScriptId,
        });
      }
      
      // Enhanced error handling with more detailed messages
      if (err.code === 'ECONNABORTED') {
        throw new Error('The upload request timed out. Please check your connection and try again with a smaller file or better connection.');
      }
      
      if (err.message && (
          err.message.includes('Network Error') || 
          err.message.includes('network') ||
          err.message.includes('connection') ||
          err.message.includes('socket')
      )) {
        throw new Error('Network error detected. This could be due to server unavailability or connection problems. Please check your internet connection and try again.');
      }
      
      if (err.code === 'CORS_ERROR' || 
          (err.message && err.message.includes('CORS')) ||
          (err.message && err.message.includes('cross-origin'))
      ) {
        throw new Error('Cross-Origin Resource Sharing (CORS) error. Please try again or contact support if the issue persists.');
      }
      
      // Handle axios errors with response
      if (err.response || status) {
        if (status === 400 && responseData.error === 'file_read_error') {
          throwUploadError('Could not read the uploaded file. Please try again with a different file.');
        }
        
        if (status === 400 && responseData.error === 'invalid_content') {
          throwUploadError('The file does not appear to be a valid PowerShell script. Please check the file contents.');
        }
        
        if (status === 400 && responseData.error === 'too_many_tags') {
          throwUploadError('A maximum of 10 tags is allowed. Please reduce the number of tags.');
        }
        
        if (status === 413) {
          throwUploadError(String(responseData.message || 'The script is too large. Maximum hosted upload size is 4MB.'));
        }
        
        if (status === 429) {
          throwUploadError('Too many upload attempts. Please wait a moment and try again.');
        }
        
        if (status >= 500) {
          throwUploadError('Server error. The upload service is currently unavailable. Please try again later.');
        }
        
        if (responseData && responseData.message) {
          throwUploadError(String(responseData.message));
        }
      }
      
      // Handle request errors (no response received)
      if ((error as any).request) {
        throw new Error('No response received from the server. Please check your connection and try again.');
      }
      
      // Default error message
      throw (error as any).message 
        ? new Error((error as any).message) 
        : new Error('An error occurred while uploading the script');
    }
  },
  
  updateScript: async (id: string, scriptData: any) => {
    try {
      const response = await apiClient.put(`/scripts/${id}`, scriptData);
      return response.data;
    } catch (error) {
      console.error(`Error updating script ${id}:`, error);
      throw error;
    }
  },
  
  deleteScript: async (id: string) => {
    try {
      const response = await apiClient.delete(`/scripts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting script ${id}:`, error);
      
      // Provide more specific error messages
      if ((error as any).status === 404) {
        throw new Error('Script not found. It may have been already deleted.');
      }
      
      if ((error as any).status === 403) {
        throw new Error('You do not have permission to delete this script.');
      }
      
      // Return a structured error object
      throw {
        message: (error as any).message || 'Failed to delete script',
        status: (error as any).status || 500,
        success: false
      };
    }
  },

  archiveScript: async (id: string, reason?: string) => {
    try {
      const response = await apiClient.post(`/scripts/${id}/archive`, { reason });
      return response.data;
    } catch (error) {
      console.error(`Error archiving script ${id}:`, error);
      throw error;
    }
  },

  restoreScript: async (id: string) => {
    try {
      const response = await apiClient.post(`/scripts/${id}/restore`);
      return response.data;
    } catch (error) {
      console.error(`Error restoring script ${id}:`, error);
      throw error;
    }
  },
  
  getScriptAnalysis: async (id: string) => {
    try {
      const response = await apiClient.get(`/scripts/${id}/analysis`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching analysis for script ${id}:`, error);
      throw error;
    }
  },
  
  executeScript: async (id: string, params = {}) => {
    try {
      const response = await apiClient.post(`/scripts/${id}/execute`, { params });
      return response.data;
    } catch (error) {
      console.error(`Error executing script ${id}:`, error);
      throw error;
    }
  },
  
  getExecutionHistory: async (id: string, limit = 10, offset = 0) => {
    try {
      const response = await apiClient.get(`/scripts/${id}/execution-history`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching execution history for script ${id}:`, error);
      return { executions: [], pagination: { total: 0, limit, offset, hasMore: false } };
    }
  },
  
  getSimilarScripts: async (id: string) => {
    try {
      const response = await apiClient.get(`/scripts/${id}/similar`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching similar scripts for ${id}:`, error);
      return { similar_scripts: [] };
    }
  },
  
  searchScripts: async (query: string, filters = {}) => {
    try {
      const params = { q: query, ...filters };
      const response = await apiClient.get("/scripts/search", { params });
      return response.data;
    } catch (error) {
      console.error("Error searching scripts:", error);
      return { scripts: [], total: 0 };
    }
  },
  
  analyzeScript: async (content: string) => {
    try {
      const response = await apiClient.post("/scripts/analyze", { content });
      return response.data;
    } catch (error) {
      console.error("Error analyzing script:", error);
      throw error;
    }
  },
  
  analyzeScriptAndSave: async (id: string) => {
    try {
      const response = await apiClient.post(`/scripts/${id}/analyze`);
      return response.data;
    } catch (error) {
      console.error("Error analyzing and saving script:", error);
      throw error;
    }
  },
  
  getScriptVersions: async (id: string) => {
    try {
      const response = await apiClient.get(`/scripts/${id}/versions`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching versions for script ${id}:`, error);
      return { versions: [] };
    }
  },

  bulkUpdateScripts: async (data: { ids: string[], isPublic: boolean }) => {
    try {
      const response = await apiClient.post("/scripts/bulk-update", data);
      return response.data;
    } catch (error) {
      console.error("Error bulk updating scripts:", error);
      throw error;
    }
  },
  
  bulkDeleteScripts: async (ids: string[], mode: 'archive' | 'delete' = 'archive') => {
    try {
      const response = await apiClient.post("/scripts/delete", { ids, mode });
      return response.data;
    } catch (error) {
      console.error("Error bulk deleting scripts:", error);
      throw error;
    }
  },

  deleteScripts: async (ids: string[], mode: 'archive' | 'delete' = 'archive') => {
    try {
      const response = await apiClient.post("/scripts/delete", { ids, mode });
      return response.data;
    } catch (error) {
      console.error("Error deleting scripts:", error);
      throw error;
    }
  },
  
  applyAiSuggestions: async (scriptId: string, suggestions: string[]) => {
    try {
      const response = await apiClient.post(`/scripts/${scriptId}/apply-suggestions`, { suggestions });
      return response.data;
    } catch (error) {
      console.error("Error applying AI suggestions:", error);
      throw error;
    }
  },
  
  checkAsyncUploadStatus: async (uploadId: string) => {
    try {
      const response = await apiClient.get(`/scripts/upload/status/${uploadId}`);
      return response.data;
    } catch (error) {
      console.error(`Error checking async upload status for ${uploadId}:`, error);
      throw error;
    }
  }
};

// Category service
export const categoryService = {
  // Get all categories
  getCategories: async () => {
    try {
      const response = await apiClient.get("/categories");
      return response.data;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return { categories: [] };
    }
  },

  createCategory: async (data: { name: string; description?: string | null }) => {
    const response = await apiClient.post('/categories', data);
    return response.data;
  },

  updateCategory: async (id: number | string, data: { name?: string; description?: string | null }) => {
    const response = await apiClient.put(`/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: number | string, opts?: { mode?: 'uncategorize' }) => {
    const mode = opts?.mode ? `?mode=${encodeURIComponent(opts.mode)}` : '';
    const response = await apiClient.delete(`/categories/${id}${mode}`);
    return response.data;
  }
};

// Tag service
export const tagService = {
  // Get all tags
  getTags: async () => {
    try {
      const response = await apiClient.get("/tags");
      return response.data;
    } catch (error) {
      console.error("Error fetching tags:", error);
      return { tags: [] };
    }
  },
  
  // Create a new tag
  createTag: async (name: string) => {
    try {
      const response = await apiClient.post("/tags", { name });
      return response.data;
    } catch (error) {
      console.error("Error creating tag:", error);
      throw error;
    }
  }
};

// Analytics service
export const analyticsService = {
  // Get usage statistics
  getUsageStats: async () => {
    try {
      const response = await apiClient.get("/analytics/usage");
      return response.data;
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      return {
        totalScripts: 0,
        executionsToday: 0,
        userScripts: 0,
        averageQuality: 0,
        executionsLastWeek: 0,
        activeUsers: 0,
        totalExecutions: 0,
        recentActivity: []
      };
    }
  },
  
  // Get security metrics
  getSecurityMetrics: async () => {
    try {
      // Check if the endpoint exists by making a request
      const response = await apiClient.get("/analytics/security");
      return response.data;
    } catch (error) {
      // If we get a 404, the endpoint doesn't exist yet - use mock data instead of showing errors
      if (error.response && error.response.status === 404) {
        console.log("Security metrics endpoint not implemented yet, using mock data");
        // Return mock data that matches the expected structure
        return {
          highSecurityCount: 5,
          highSecurityPercentage: 75,
          mediumSecurityCount: 3,
          mediumSecurityPercentage: 15,
          lowSecurityCount: 2,
          lowSecurityPercentage: 10,
          totalScripts: 10,
          commonIssues: [
            { name: 'Hardcoded credentials', count: 2 },
            { name: 'Insecure function calls', count: 1 },
            { name: 'Missing error handling', count: 3 }
          ]
        };
      } else {
        // For other errors, log them but don't display in UI
        console.error("Error fetching security metrics:", error);
        return {
          highSecurityCount: 0,
          highSecurityPercentage: 0,
          mediumSecurityCount: 0,
          mediumSecurityPercentage: 0,
          lowSecurityCount: 0,
          lowSecurityPercentage: 0,
          totalScripts: 0,
          commonIssues: []
        };
      }
    }
  },
  
  // Get category distribution
  getCategoryDistribution: async () => {
    try {
      const response = await apiClient.get("/analytics/categories");
      return response.data;
    } catch (error) {
      console.error("Error fetching category distribution:", error);
      return {
        categories: []
      };
    }
  },

  // Get AI usage/cost/latency analytics
  getAiAnalytics: async () => {
    try {
      const response = await apiClient.get("/analytics/ai");
      return response.data?.data || response.data;
    } catch (error) {
      console.error("Error fetching AI analytics:", error);
      return {
        summary: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          totalCost: 0,
          avgCostPerRequest: 0,
          avgLatency: 0,
          p95Latency: 0,
          successRate: 0,
          errorRate: 0,
        },
        byModel: [],
        byEndpoint: [],
        byProvider: [],
        costTrend: [],
      };
    }
  }
};

// Define types for chat
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface ChatResponse {
  response: string;
}

// Chat service
export const chatService = {
  // Send a chat message to the AI
  sendMessage: async (messages: ChatMessage[]): Promise<ChatResponse> => {
    try {
      const useMockMode = localStorage.getItem('psscript_mock_mode') === 'true';
      
      // Log if we're in mock mode
      if (useMockMode) {
        console.log("Using mock mode for chat service");
      }
      
      console.log(`Sending hosted chat request with ${messages.length} messages`);
      
      // Try using the backend endpoint first
      try {
        const response = await apiClient.post("/chat/message", { 
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }, {
          timeout: 30000 // 30 second timeout
        });
        
        return response.data;
      } catch (backendError) {
        console.warn("Hosted chat service failed:", backendError);
        throw backendError;
      }
    } catch (error) {
      console.error("Error sending chat message:", error);
      
      // Return more specific error messages based on error type
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          // Network error
          throw new Error("Network error. Please check your connection and try again.");
        } else if (error.response.status === 429) {
          // Rate limiting
          throw new Error("You've sent too many messages. Please wait a moment and try again.");
        } else if (error.response.status >= 500) {
          // Server error
          throw new Error("The AI service is currently unavailable. Please try again later.");
        } else if (error.response.status === 401) {
          // Authentication error
          throw new Error("Authentication failed. Please sign in again.");
        }
      }
      
      // Mock response for development or when mock mode is enabled
      const useMockMode = localStorage.getItem('psscript_mock_mode') === 'true' || 
                          import.meta.env.DEV;
      
      if (useMockMode) {
        console.log("Returning mock response in mock/development mode");
        
        // Generate a more helpful mock response based on the last user message
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
        
        // Match certain keywords to give more contextual responses
        if (lastUserMessage.toLowerCase().includes('powershell')) {
          return {
            response: "PowerShell is a cross-platform task automation solution made up of a command-line shell, a scripting language, and a configuration management framework. PowerShell runs on Windows, Linux, and macOS."
          };
        } else if (lastUserMessage.toLowerCase().includes('script')) {
          return {
            response: "Scripts are a great way to automate repetitive tasks. In PowerShell, scripts are stored in .ps1 files and can be executed directly from the PowerShell console or scheduled to run at specific times."
          };
        } else if (lastUserMessage.toLowerCase().includes('error') || lastUserMessage.toLowerCase().includes('help')) {
          return {
            response: "I'm sorry you're experiencing an issue. When troubleshooting PowerShell scripts, it's helpful to use Write-Debug statements, try/catch blocks for error handling, and ensuring you have the right execution policy set with 'Set-ExecutionPolicy'."
          };
        }
        
        // Default mock response
        return {
          response: "This is a mock response since the AI service is in mock mode. Your message contained: \"" + lastUserMessage.substring(0, 50) + (lastUserMessage.length > 50 ? '...' : '') + "\""
        };
      }
      
      // Generic error
      throw new Error("Sorry, I encountered an error processing your request. Please try again.");
    }
  },
  
  // Get chat history for current user
  getChatHistory: async (): Promise<{ history: ChatMessage[] }> => {
    try {
      const response = await apiClient.get("/chat/history");
      return response.data;
    } catch (error) {
      console.error("Error fetching chat history:", error);
      return { history: [] };
    }
  },
  
  // Save chat history to server
  saveChatHistory: async (messages: ChatMessage[]): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.post("/chat/history", { messages });
      return response.data;
    } catch (error) {
      console.error("Error saving chat history:", error);
      return { success: false };
    }
  },
  
  // Clear chat history from server
  clearChatHistory: async (): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.delete("/chat/history");
      return response.data;
    } catch (error) {
      console.error("Error clearing chat history:", error);
      return { success: false };
    }
  },
  
  // Search chat history with semantic search
  searchChatHistory: async (query: string): Promise<any[]> => {
    try {
      const response = await apiClient.get("/chat/search", { params: { q: query } });
      
      // Handle different potential response formats
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results.map((result: any) => ({
          id: result.id || String(Math.random()),
          messages: Array.isArray(result.messages) ? result.messages : [],
          score: typeof result.score === 'number' ? result.score : 1.0,
          date: result.date || new Date(result.timestamp || Date.now()).toLocaleDateString(),
          timestamp: result.timestamp || Date.now()
        }));
      } else if (response.data && Array.isArray(response.data)) {
        return response.data.map((result: any) => ({
          id: result.id || String(Math.random()),
          messages: Array.isArray(result.messages) ? result.messages : [],
          score: typeof result.score === 'number' ? result.score : 1.0,
          date: result.date || new Date(result.timestamp || Date.now()).toLocaleDateString(),
          timestamp: result.timestamp || Date.now()
        }));
      }
      
      // Fallback to empty array if no valid data
      return [];
    } catch (error) {
      console.error("Error searching chat history:", error);
      return [];
    }
  },
  
  // Get chat categories for organizing history
  getChatCategories: async (): Promise<string[]> => {
    try {
      const response = await apiClient.get("/chat/categories");
      return response.data.categories || [];
    } catch (error) {
      console.error("Error fetching chat categories:", error);
      return [];
    }
  },
  
  // Set category for a chat session
  setChatCategory: async (chatId: string, category: string): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.post(`/chat/${chatId}/category`, { category });
      return response.data;
    } catch (error) {
      console.error("Error setting chat category:", error);
      return { success: false };
    }
  },
  
  // Delete a specific chat session
  deleteChatSession: async (chatId: string): Promise<{ success: boolean }> => {
    try {
      const response = await apiClient.delete(`/chat/history/${chatId}`);
      return response.data;
    } catch (error) {
      console.error("Error deleting chat session:", error);
      return { success: false };
    }
  }
};

// Export script service
export { scriptService };
