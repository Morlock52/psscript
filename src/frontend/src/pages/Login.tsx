import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';
import { FcGoogle } from 'react-icons/fc';
import { isAuthDisabledForCurrentHost, isHostedAuthConfigurationMissing, isSupabaseAuthEnabled } from '../services/supabase';

interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
}

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--surface-base)] border border-[var(--surface-overlay)] text-[var(--ink-primary)]";
const labelStyles = "block text-sm font-medium mb-2 text-[var(--ink-secondary)]";
const linkStyles = "text-[var(--accent)] hover:text-[var(--accent-soft)]";
const buttonPrimaryStyles = "w-full bg-[var(--gradient-primary)] hover:opacity-95 text-slate-950 font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-glow)]";

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);

  const { login, loginWithGoogle, defaultLogin, error, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const disableAuth = isAuthDisabledForCurrentHost();
  const hostedAuthMissing = isHostedAuthConfigurationMissing();
  const supabaseAuth = isSupabaseAuthEnabled();

  // Clear form error when inputs change
  useEffect(() => {
    if (formError) setFormError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  // Get the redirect path from location state or default to dashboard
  const from = (location.state as any)?.from?.pathname || '/';

  // If auth is disabled (local dev), never show the login screen.
  useEffect(() => {
    if (disableAuth) {
      navigate(from, { replace: true });
    }
  }, [disableAuth, from, navigate]);

  if (disableAuth) {
    // Avoid flashing the login UI for a frame before the redirect effect runs.
    return null;
  }

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

  const handleGoogleLogin = async () => {
    setErrorDetails(null);
    setFormError('');
    try {
      await loginWithGoogle(from);
    } catch (err: any) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
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
    <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <BrandMark size="lg" className="justify-center" />
          <p className="mt-4 text-[var(--ink-secondary)]">
            Secure PowerShell intelligence for teams that move fast.
          </p>
        </div>

        <div className="rounded-3xl shadow-[var(--shadow-far)] p-8 bg-[var(--surface-raised)]/92 border border-[var(--surface-overlay)] backdrop-blur-xl">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Command center</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--ink-primary)]">Sign in to PSScript</h2>
          </div>

          {hostedAuthMissing && (
            <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-bold text-amber-200">Hosted auth is not configured.</p>
              <p className="mt-1 text-amber-100/90">
                Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify build environment variables, then rebuild this deploy.
              </p>
            </div>
          )}

          {/* Enhanced error display */}
          {(error || formError || errorDetails) && (
            <div
              data-testid="login-error-message"
              className="px-4 py-3 rounded mb-4 bg-red-500/10 border border-red-500/30 text-red-500"
            >
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
              <label htmlFor="email" className={labelStyles}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputStyles} ${formError && formError.includes('email') ? 'border-red-500 ring-red-500' : ''}`}
                placeholder="you@example.com"
                required

              />
              {formError && formError.includes('email') && (
                <p className="mt-1 text-sm text-red-500">{formError}</p>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-[var(--ink-secondary)]">
                  Password
                </label>
                <a href="#" className={`text-sm ${linkStyles}`}>
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputStyles} ${formError && formError.includes('password') ? 'border-red-500 ring-red-500' : ''}`}
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
                className="h-4 w-4 rounded text-[var(--accent)] focus:ring-[var(--accent)] bg-[var(--surface-base)] border-[var(--surface-overlay)]"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--ink-secondary)]">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || hostedAuthMissing}
              className={buttonPrimaryStyles}
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

          {supabaseAuth && (
            <div className="mt-5">
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[var(--surface-overlay)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--surface-raised)] px-2 text-[var(--ink-tertiary)]">or</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading || hostedAuthMissing}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-4 py-3 font-bold text-[var(--ink-primary)] transition hover:bg-[var(--surface-overlay)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FcGoogle className="h-5 w-5" aria-hidden="true" />
                Continue with Google
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-[var(--ink-secondary)]">
              Don&apos;t have an account?{' '}
              <Link to="/register" className={linkStyles}>
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 rounded-2xl border bg-[var(--surface-overlay)] border-[var(--surface-overlay)]">
            <h3 className="text-sm font-bold mb-2 text-[var(--accent)]">Quick Access</h3>
            <p className="text-xs mb-3 text-[var(--ink-secondary)]">
              Preview the enterprise dashboard with a seeded demo admin session.
            </p>
            <button
              onClick={async () => {
                try {
                  await defaultLogin();
                  navigate(from, { replace: true });
                } catch (err: any) {
                  console.error('Default login failed:', err);
                  setFormError(err.message || 'Demo login failed. Please ensure the backend is running.');
                }
              }}
              className="w-full bg-[var(--surface-base)] hover:bg-[var(--accent-soft)] text-[var(--ink-primary)] font-bold py-3 px-4 rounded-xl border border-[var(--surface-overlay)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || hostedAuthMissing}
            >
              {isLoading ? 'Signing in...' : 'Use Default Login'}
            </button>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-[var(--ink-tertiary)]">
          &copy; {new Date().getFullYear()} PSScript. All rights reserved.
        </div>
      </div>
    );
};

export default Login;
