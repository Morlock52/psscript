import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BrandMark from '../components/BrandMark';
import { isHostedAuthConfigurationMissing } from '../services/supabase';

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-[var(--surface-base)] border border-[var(--surface-overlay)] text-[var(--ink-primary)]";
const labelStyles = "block text-sm font-medium mb-2 text-[var(--ink-secondary)]";
const linkStyles = "text-[var(--accent)] hover:text-[var(--accent-soft)]";
const buttonPrimaryStyles = "w-full bg-[var(--gradient-primary)] hover:opacity-95 text-slate-950 font-bold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-glow)]";

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const { register, error, isLoading } = useAuth();
  const navigate = useNavigate();
  const hostedAuthMissing = isHostedAuthConfigurationMissing();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Form validation
    if (!username || !email || !password || !confirmPassword) {
      setFormError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long');
      return;
    }

    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      // Error is handled by useAuth
      console.error('Registration failed:', err);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 bg-[var(--gradient-surface)]">
      <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-[var(--accent)]/20 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <BrandMark size="lg" className="justify-center" />
          <p className="mt-4 text-[var(--ink-secondary)]">Join the AI Ops Studio for PowerShell teams.</p>
        </div>

        <div className="rounded-3xl shadow-[var(--shadow-far)] p-8 bg-[var(--surface-raised)]/92 border border-[var(--surface-overlay)] backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Start secure</p>
          <h2 className="mt-2 text-2xl font-black mb-6 text-[var(--ink-primary)]">Create an account</h2>

          {hostedAuthMissing && (
            <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-bold text-amber-200">Hosted auth is not configured.</p>
              <p className="mt-1 text-amber-100/90">
                Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify build environment variables, then rebuild this deploy.
              </p>
            </div>
          )}

          {(error || formError) && (
            <div className="px-4 py-3 rounded mb-4 bg-red-500/10 border border-red-500/30 text-red-500">
              {error || formError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="username" className={labelStyles}>
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputStyles}
                placeholder="username"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="email" className={labelStyles}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className={labelStyles}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputStyles}
                placeholder="••••••••"
                required
              />
              <p className="mt-1 text-xs text-[var(--ink-tertiary)]">
                Password must be at least 8 characters long
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className={labelStyles}>
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputStyles}
                placeholder="••••••••"
                required
              />
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
                  <span>Creating account...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--ink-secondary)]">
              Already have an account?{' '}
              <Link to="/login" className={linkStyles}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-[var(--ink-tertiary)]">
          &copy; {new Date().getFullYear()} PSScript. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Register;
