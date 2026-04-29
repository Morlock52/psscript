import React, { useEffect, useState } from 'react';
import BrandMark from './BrandMark';

// Define props for LoadingScreen
interface LoadingScreenProps {
  message?: string;
  timeoutMs?: number;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading PSScript...',
  timeoutMs = 10000
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs]);

  const clearSessionAndLogin = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    Object.keys(localStorage)
      .filter(key => key.includes('supabase') || key.includes('auth-token'))
      .forEach(key => localStorage.removeItem(key));
    window.location.href = '/login';
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--surface-base)] text-[var(--ink-primary)]"
    >
      <div className="mb-8">
        <BrandMark size="lg" />
        <div className="mt-3 text-center text-sm text-[var(--ink-secondary)]">
          AI-powered PowerShell command center
        </div>
      </div>

      {/* Loading Animation */}
      <div className="flex space-x-2 mb-4">
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce"></div>
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce delay-150"></div>
        <div className="w-3 h-3 bg-[var(--accent)] rounded-full animate-bounce delay-300"></div>
      </div>

      {/* Loading Message */}
      <p className="text-sm text-[var(--ink-secondary)]">
        {message}
      </p>

      {isTimedOut && (
        <div className="mt-6 w-full max-w-md rounded-2xl border border-[var(--surface-overlay)] bg-[var(--surface-raised)] p-4 text-center shadow-[var(--shadow-near)]">
          <h2 className="text-base font-semibold text-[var(--ink-primary)]">Still loading</h2>
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">
            The app is taking longer than expected to start. This can happen after a deploy, expired sign-in, or a slow network request.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/login'; }}
              className="rounded-lg border border-[var(--surface-overlay)] px-3 py-2 text-sm font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-overlay)]"
            >
              Login
            </button>
            <button
              type="button"
              onClick={clearSessionAndLogin}
              className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              Clear session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
