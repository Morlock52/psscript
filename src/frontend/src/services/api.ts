import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

// API base URL from environment variable or default
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // Handle token expiration (401 errors)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
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
    
    // Handle network errors
    if (!error.response) {
      console.error("Network Error:", error.message);
      return Promise.reject({
        message: "Network error. Please check your connection.",
        originalError: error,
      });
    }
    
    // Return specific error from API when available
    const errorMessage = error.response?.data?.message || error.message;
    return Promise.reject({
      status: error.response?.status,
      message: errorMessage,
      originalError: error,
    });
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
  
  uploadScript: async (scriptData: any) => {
    try {
      const response = await apiClient.post("/scripts", scriptData);
      return response.data;
    } catch (error) {
      console.error("Error uploading script:", error);
      throw error;
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
  
  bulkDeleteScripts: async (ids: string[]) => {
    try {
      const response = await apiClient.post("/scripts/bulk-delete", { ids });
      return response.data;
    } catch (error) {
      console.error("Error bulk deleting scripts:", error);
      throw error;
    }
  },

  deleteScripts: async (ids: string[]) => {
    try {
      const response = await apiClient.post("/scripts/delete", { ids });
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
      const response = await apiClient.get("/analytics/security");
      return response.data;
    } catch (error) {
      console.error("Error fetching security metrics:", error);
      return {
        highSecurityCount: 0,
        highSecurityPercentage: 0,
        mediumSecurityCount: 0,
        mediumSecurityPercentage: 0,
        lowSecurityCount: 0,
        lowSecurityPercentage: 0,
        commonIssues: []
      };
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

// AI service URL
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

// Chat service
export const chatService = {
  // Send a chat message to the AI
  sendMessage: async (messages: ChatMessage[]): Promise<ChatResponse> => {
    try {
      // Use environment variable if available or default to localhost
      const response = await axios.post(`${AI_SERVICE_URL}/chat`, { 
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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'
        },
        timeout: 30000 // 30 second timeout
      });
      
      return response.data;
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
        }
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
