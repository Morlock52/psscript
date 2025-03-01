import axios from 'axios';

// Create an axios instance with default config
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token in all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common error cases
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized responses
    if (error.response && error.response.status === 401) {
      // Clear token from local storage
      localStorage.removeItem('token');
      
      // Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API service functions
export const scriptService = {
  // Get all scripts with optional filters
  getScripts: async (params = {}) => {
    const response = await api.get('/scripts', { params });
    return response.data;
  },
  
  // Get a single script by ID
  getScript: async (id: string) => {
    const response = await api.get(`/scripts/${id}`);
    return response.data;
  },
  
  // Upload a new script
  uploadScript: async (scriptData: any) => {
    const response = await api.post('/scripts', scriptData);
    return response.data;
  },
  
  // Update an existing script
  updateScript: async (id: string, scriptData: any) => {
    const response = await api.put(`/scripts/${id}`, scriptData);
    return response.data;
  },
  
  // Delete a script
  deleteScript: async (id: string) => {
    const response = await api.delete(`/scripts/${id}`);
    return response.data;
  },
  
  // Get script analysis
  getScriptAnalysis: async (id: string) => {
    const response = await api.get(`/scripts/${id}/analysis`);
    return response.data;
  },
  
  // Execute a script
  executeScript: async (id: string, params = {}) => {
    const response = await api.post(`/scripts/${id}/execute`, { params });
    return response.data;
  },
  
  // Find similar scripts
  getSimilarScripts: async (id: string) => {
    const response = await api.get(`/scripts/${id}/similar`);
    return response.data;
  },
  
  // Search scripts by query
  searchScripts: async (query: string) => {
    const response = await api.get('/scripts/search', { params: { query } });
    return response.data;
  }
};

export const categoryService = {
  // Get all categories
  getCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  }
};

export const tagService = {
  // Get all tags
  getTags: async () => {
    const response = await api.get('/tags');
    return response.data;
  },
  
  // Create a new tag
  createTag: async (name: string) => {
    const response = await api.post('/tags', { name });
    return response.data;
  }
};

export const analyticsService = {
  // Get usage statistics
  getUsageStats: async () => {
    const response = await api.get('/analytics/usage');
    return response.data;
  },
  
  // Get security metrics
  getSecurityMetrics: async () => {
    const response = await api.get('/analytics/security');
    return response.data;
  },
  
  // Get category distribution
  getCategoryDistribution: async () => {
    const response = await api.get('/analytics/categories');
    return response.data;
  }
};