import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Reusable style constants for theme-aware styling
const inputStyles = "w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]";
const labelStyles = "block text-sm font-medium mb-2 text-[var(--color-text-secondary)]";
const linkStyles = "text-[var(--color-primary)] hover:text-[var(--color-primary-light)]";
const buttonPrimaryStyles = "w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed";

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const { register, error, isLoading } = useAuth();
  const navigate = useNavigate();

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
    <div className="flex items-center justify-center min-h-screen px-4 bg-[var(--color-bg-secondary)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">PSScript</h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">PowerShell Script Management</p>
        </div>

        <div className="rounded-lg shadow-[var(--shadow-xl)] p-8 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
          <h2 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">Create an Account</h2>

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
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
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
              disabled={isLoading}
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
            <p className="text-[var(--color-text-secondary)]">
              Already have an account?{' '}
              <Link to="/login" className={linkStyles}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-[var(--color-text-tertiary)]">
          &copy; {new Date().getFullYear()} PSScript. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Register;
