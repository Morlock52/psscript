import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Define user type
interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string;
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

// API URL from environment variable or default
const API_URL = import.meta.env.VITE_API_URL || 
  `http://${window.location.hostname}:4001/api`; // Dynamic hostname to work with Docker

// Force log the API URL to ensure it's correct
console.log('AuthContext API URL is set to:', API_URL);

// Create AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Clear error
  const clearError = () => setError(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Check if we have a token
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Validate token and get user data
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Set user if successful
        if (response.data && response.data.user) {
          setUser(response.data.user);
        }
      } catch (err) {
        // Clear token if invalid
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        console.error('Error loading user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Default login credentials
  const DEFAULT_EMAIL = "admin@psscript.com";
  const DEFAULT_PASSWORD = "admin123";

  // Default login function
  const defaultLogin = async () => {
    return login(DEFAULT_EMAIL, DEFAULT_PASSWORD);
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      clearError();

      // Send login request
      const response = await axios.post(`${API_URL}/auth/login`, {
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
      
      // Extract the most useful error message
      let errorMessage = 'Login failed';
      
      if (err.response) {
        // The request was made and the server responded with a status code outside of 2xx
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        console.error('Server response:', err.response.data);
      } else if (err.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check your connection.';
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
      const response = await axios.post(`${API_URL}/auth/register`, {
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
    // Clear token from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    
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
        `${API_URL}/auth/user`,
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
