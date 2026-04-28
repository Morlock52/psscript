import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';

const AuthCallback: React.FC = () => {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const completeOAuthLoginRef = useRef(completeOAuthLogin);

  useEffect(() => {
    completeOAuthLoginRef.current = completeOAuthLogin;
  }, [completeOAuthLogin]);

  useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      try {
        const user = await completeOAuthLoginRef.current();
        if (cancelled) return;

        const nextPath = sanitizeNextPath(sessionStorage.getItem('oauth_next_path'));
        sessionStorage.removeItem('oauth_next_path');

        if (!user) {
          setError('No Supabase session was returned for this sign-in.');
          return;
        }

        if (user.isEnabled === false) {
          navigate('/pending-approval', { replace: true });
          return;
        }

        navigate(nextPath, { replace: true });
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Unable to complete Google sign-in.');
        }
      }
    };

    complete();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-[var(--surface-overlay)] bg-[var(--surface-raised)]/92 p-8 text-center shadow-[var(--shadow-far)]">
        <BrandMark size="lg" className="justify-center" />
        <h1 className="mt-6 text-2xl font-black text-[var(--ink-primary)]">Completing sign-in</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-400">{error}</p>
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--color-primary-dark)]"
            >
              Back to login
            </Link>
          </>
        ) : (
          <div className="mt-6 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--surface-overlay)] border-t-[var(--accent)]" />
          </div>
        )}
      </div>
  );
};

function sanitizeNextPath(path: string | null): string {
  if (!path || !path.startsWith('/')) return '/dashboard';
  if (path === '/login' || path === '/auth/callback' || path === '/pending-approval') return '/dashboard';
  return path;
}

export default AuthCallback;
