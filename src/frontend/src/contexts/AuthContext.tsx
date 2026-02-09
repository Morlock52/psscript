import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

// Define user type
interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  company?: string;
  bio?: string;
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  defaultLogin: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  defaultLogin: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: async () => {},
  error: null,
  clearError: () => {},
});

// Define props for AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// API URL is now imported from centralized utils/apiUrl.ts
// This ensures runtime URL detection works correctly with tunnels/proxies

// Create AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // In unit tests we want to exercise the real auth flow by default.
  // Local dev frequently sets VITE_DISABLE_AUTH=true, which would short-circuit tests.
  const disableAuth = import.meta.env.MODE !== 'test' && import.meta.env.VITE_DISABLE_AUTH === 'true';

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Clear error
  const clearError = () => setError(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      if (disableAuth) {
        setUser({
          id: 'dev-admin',
          username: 'dev-admin',
          email: 'dev-admin@local',
          role: 'admin',
          created_at: new Date().toISOString(),
        });
        setIsLoading(false);
        return;
      }

      try {
        // Check if we have a token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Validate token and get user data
        const response = await axios.get(`${getApiUrl()}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Set user if successful
        if (response.data && response.data.user) {
          setUser(response.data.user);
        }
      } catch (err: any) {
        // Clear token if invalid
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('ps_user');
        localStorage.removeItem('ps_token');

        // Only log as error for unexpected issues, not for expired/invalid tokens
        const isTokenError = err?.response?.status === 401 ||
                            err?.response?.data?.error === 'invalid_token';
        if (isTokenError) {
          // Expected scenario - token expired or invalid, user will need to login again
          console.debug('[Auth] Token validation failed, user logged out');
        } else {
          // Unexpected error - network issues, server down, etc.
          console.warn('[Auth] Could not validate session:', err?.message || err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [disableAuth]);

  // Demo login function - uses actual API authentication with demo credentials
  // This ensures proper token validation and persistence across page refreshes
  // Works through tunnel access as well as localhost
  //
  // SECURITY NOTE: Demo credentials are read from environment variables at build time.
  // In production, either:
  //   1. Remove the demo login feature entirely
  //   2. Use environment variables for credentials
  //   3. Replace with a proper dev/staging authentication flow
  const defaultLogin = async () => {
    if (disableAuth) {
      localStorage.setItem('auth_token', 'dev-auth-disabled');
      setUser({
        id: 'dev-admin',
        username: 'dev-admin',
        email: 'dev-admin@local',
        role: 'admin',
        created_at: new Date().toISOString(),
      });
      return;
    }

    // Read demo credentials from environment variables (set at build time)
    // These should only be set in development environments
    // Defaults match seeded dev admin in src/db/seeds/01-initial-data.sql
    const demoEmail = import.meta.env.VITE_DEMO_EMAIL || 'admin@example.com';
    const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || 'admin123';

    // If these defaults don't work, the caller will show the error and the user can use regular login.
    await login(demoEmail, demoPassword);
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      if (disableAuth) {
        localStorage.setItem('auth_token', 'dev-auth-disabled');
        setUser({
          id: 'dev-admin',
          username: 'dev-admin',
          email: email || 'dev-admin@local',
          role: 'admin',
          created_at: new Date().toISOString(),
        });
        return;
      }

      setIsLoading(true);
      clearError();

      // SECURITY: Test credential patterns removed from production code
      // E2E tests should use proper mocking or test users instead of client-side bypasses

      // Send login request - use getApiUrl() to ensure runtime URL detection
      const apiUrl = getApiUrl();
      console.log('Making login request to:', `${apiUrl}/auth/login`);
      const response = await axios.post(`${apiUrl}/auth/login`, {
        email,
        password,
      });

      // Check if we got a token and user
      if (response.data && response.data.token) {
        // Save token to localStorage
        localStorage.setItem('auth_token', response.data.token);
        
        // Save refresh token if provided
        if (response.data.refreshToken) {
          localStorage.setItem('refresh_token', response.data.refreshToken);
        }
        
        // Set user
        setUser(response.data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      // Handle error with more detailed logging
      console.error('Login error details:', err);
      console.error('API_URL used:', getApiUrl());
      console.error('Request config:', err.config);

      // Extract the most useful error message
      let errorMessage = 'Login failed';

      if (err.response) {
        // The request was made and the server responded with a status code outside of 2xx
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        console.error('Server response:', err.response.data);
      } else if (err.request) {
        // The request was made but no response was received
        // This usually means CORS blocked, network error, or timeout
        const requestUrl = err.config?.url || getApiUrl();
        errorMessage = `No response from server (${requestUrl}). This may be a CORS or network issue.`;
        console.error('Request made but no response. URL:', requestUrl);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
      } else {
        // Something happened in setting up the request
        errorMessage = err.message || 'Login request failed';
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      clearError();

      // Send register request
      const response = await axios.post(`${getApiUrl()}/auth/register`, {
        username,
        email,
        password,
      });

      // Check if we got a token and user
      if (response.data && response.data.token) {
        // Save token to localStorage
        localStorage.setItem('auth_token', response.data.token);
        
        // Save refresh token if provided
        if (response.data.refreshToken) {
          localStorage.setItem('refresh_token', response.data.refreshToken);
        }
        
        // Set user
        setUser(response.data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      // Handle error with more detailed logging
      console.error('Registration error details:', err);
      
      // Extract the most useful error message
      let errorMessage = 'Registration failed';
      
      if (err.response) {
        // The request was made and the server responded with a status code outside of 2xx
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        console.error('Server response:', err.response.data);
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        // Something happened in setting up the request
        errorMessage = err.message || 'Registration request failed';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    if (disableAuth) {
      return;
    }

    // Clear token from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('ps_user');
    localStorage.removeItem('ps_token');
    
    // Clear user
    setUser(null);
  };

  // Update user function
  const updateUser = async (userData: Partial<User>) => {
    try {
      setIsLoading(true);
      clearError();

      // Get token
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Send update request
      const response = await axios.put(
        `${getApiUrl()}/auth/user`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update user if successful
      if (response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      // Handle error
      const errorMessage = err.response?.data?.message || err.message || 'Update failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Provide auth context to children
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        defaultLogin,
        register,
        logout,
        updateUser,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using auth
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
