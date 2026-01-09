import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  
  const { login, defaultLogin, error, isLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Clear form error when inputs change
  useEffect(() => {
    if (formError) setFormError('');
  }, [email, password]);
  
  // Get the redirect path from location state or default to dashboard
  const from = (location.state as any)?.from?.pathname || '/';
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);
    setFormError('');

    // Enhanced validation
    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }
    
    if (!password) {
      setFormError('Password is required');
      return;
    }
    
    if (!email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }
    
    try {
      await login(email, password);

      // Navigate to the dashboard or the page they were trying to access
      navigate(from, { replace: true });
    } catch (err: any) {
      // Enhanced error handling
      console.error('Login failed:', err);

      // Try to extract structured error information if available
      if (err.response?.data) {
        const responseData = err.response.data;
        setErrorDetails({
          code: responseData.error || 'unknown_error',
          message: responseData.message || 'An unexpected error occurred',
          details: responseData.details
        });
      } else {
        // Handle simple Error objects (e.g., from demo auth)
        setFormError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      }
    }
  };
  
  // Function to get a user-friendly error message based on error code
  const getErrorMessage = (code: string): string => {
    switch (code) {
      case 'validation_error':
        return 'Please check your input and try again';
      case 'invalid_credentials':
        return 'The email or password you entered is incorrect';
      case 'user_not_found':
        return 'No account found with this email address';
      case 'server_error':
        return 'Server error. Please try again later';
      default:
        return 'An error occurred during login';
    }
  };
  
  return (
    <div className={`flex items-center justify-center min-h-screen px-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>PSScript</h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>PowerShell Script Management</p>
        </div>
        
        <div className={`rounded-lg shadow-xl p-8 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Login</h2>
          
          {/* Enhanced error display */}
          {(error || formError || errorDetails) && (
            <div
              data-testid="login-error-message"
              className={`px-4 py-3 rounded mb-4 ${
              theme === 'dark'
                ? 'bg-red-900/50 border border-red-800 text-red-300'
                : 'bg-red-100 border border-red-200 text-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium">
                    {errorDetails 
                      ? getErrorMessage(errorDetails.code) 
                      : error || formError}
                  </h3>
                  {errorDetails?.details && (
                    <div className="mt-2 text-sm">
                      <ul className="list-disc pl-5 space-y-1">
                        {Object.entries(errorDetails.details).map(([key, value]) => (
                          <li key={key}>{`${key}: ${value}`}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border border-gray-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                } ${formError && formError.includes('email') ? 'border-red-500 ring-red-500' : ''}`}
                placeholder="you@example.com"
                required
                
              />
              {formError && formError.includes('email') && (
                <p className="mt-1 text-sm text-red-500">{formError}</p>
              )}
            </div>
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className={`block text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <a href="#" className={`text-sm ${
                  theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
                }`}>
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  theme === 'dark'
                    ? 'bg-gray-700 border border-gray-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-900'
                } ${formError && formError.includes('password') ? 'border-red-500 ring-red-500' : ''}`}
                placeholder="••••••••"
                required
                
              />
              {formError && formError.includes('password') && (
                <p className="mt-1 text-sm text-red-500">{formError}</p>
              )}
            </div>
            
            <div className="flex items-center mb-6">
              <input
                id="remember-me"
                type="checkbox"
                className={`h-4 w-4 rounded text-blue-600 focus:ring-blue-500 ${
                  theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
              />
              <label htmlFor="remember-me" className={`ml-2 block text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-700'
              }`}>
                Remember me
              </label>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark' ? 'focus:ring-offset-2 focus:ring-offset-gray-800' : 'focus:ring-offset-2 focus:ring-offset-white'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>
              Don't have an account?{' '}
              <Link to="/register" className={`${
                theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              }`}>
                Sign up
              </Link>
            </p>
          </div>
          
          <div className={`mt-6 p-4 rounded-lg border ${
            theme === 'dark' 
              ? 'bg-gray-700 border-gray-600' 
              : 'bg-gray-100 border-gray-200'
          }`}>
            <h3 className={`text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`}>Demo Information</h3>
            <p className={`text-xs mb-3 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              This is a demo application with a mocked authentication system. You can use any email and password to log in.
            </p>
            <button
              onClick={async () => {
                try {
                  await defaultLogin();
                  navigate(from, { replace: true });
                } catch (err) {
                  console.error('Default login failed:', err);
                }
              }}
              className={`w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark' 
                  ? 'focus:ring-offset-2 focus:ring-offset-gray-800' 
                  : 'focus:ring-offset-2 focus:ring-offset-white'
              }`}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Use Default Login'}
            </button>
          </div>
        </div>
        
        <div className={`text-center mt-8 text-sm ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
        }`}>
          &copy; {new Date().getFullYear()} PSScript. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Login;
