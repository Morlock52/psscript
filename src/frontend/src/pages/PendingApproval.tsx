import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';

const PendingApproval: React.FC = () => {
  const { user, isLoading, completeOAuthLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.isEnabled !== false) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, navigate, user]);

  const handleRetry = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const refreshedUser = await completeOAuthLogin();
      if (refreshedUser?.isEnabled !== false) {
        navigate('/dashboard', { replace: true });
        return;
      }
      setMessage('Your account is still waiting for admin approval.');
    } catch (err: any) {
      setMessage(err.message || 'Could not refresh approval status.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--gradient-surface)] px-4">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--surface-overlay)] bg-[var(--surface-raised)]/92 p-8 shadow-[var(--shadow-far)]">
        <BrandMark size="lg" className="justify-center" />
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-black text-[var(--ink-primary)]">Account pending approval</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-secondary)]">
            Your Google sign-in created a PSScript account for {user?.email || 'this email'}, but an admin must enable it before you can use the app.
          </p>
          {message && (
            <p className="mt-4 rounded-xl border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-4 py-3 text-sm text-[var(--ink-secondary)]">
              {message}
            </p>
          )}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Check status'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex-1 rounded-xl border border-[var(--surface-overlay)] bg-[var(--surface-base)] px-4 py-3 font-bold text-[var(--ink-primary)] transition hover:bg-[var(--surface-overlay)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
