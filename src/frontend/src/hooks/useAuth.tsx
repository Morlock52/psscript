import React, { createContext, useState, useContext, useEffect } from 'react';

// Define user type
interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

// Define context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

// Create context with undefined initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo user for mock auth
const DEMO_USER = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin'
};

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage on initial mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const storedUser = localStorage.getItem('ps_user');
        const storedToken = localStorage.getItem('ps_token');
        
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (err) {
        console.error('Failed to load auth state:', err);
        // Clear potentially corrupted values
        localStorage.removeItem('ps_user');
        localStorage.removeItem('ps_token');
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  // Login function with demo auth
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Demo auth - any email/password combo works
      const user = DEMO_USER;
      const token = 'demo-token-' + Math.random().toString(36).substring(2);
      
      // Save to state
      setUser(user);
      setToken(token);
      
      // Save to localStorage for persistence
      localStorage.setItem('ps_user', JSON.stringify(user));
      localStorage.setItem('ps_token', token);
    } catch (err) {
      setError('Failed to login. Please try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function with demo auth
  const register = async (username: string, email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create user from provided data
      const user = {
        id: 1,
        username,
        email,
        role: 'user'
      };
      const token = 'demo-token-' + Math.random().toString(36).substring(2);
      
      // Save to state
      setUser(user);
      setToken(token);
      
      // Save to localStorage for persistence
      localStorage.setItem('ps_user', JSON.stringify(user));
      localStorage.setItem('ps_token', token);
    } catch (err) {
      setError('Failed to register. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    // Clear state
    setUser(null);
    setToken(null);
    
    // Clear localStorage
    localStorage.removeItem('ps_user');
    localStorage.removeItem('ps_token');
  };

  // Provide auth context to children
  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isLoading, 
      error,
      isAuthenticated: !!user && !!token, 
      login, 
      register, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};