import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isAuthDisabledForCurrentHost } from '../services/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading } = useAuth();

  // Local dev convenience: allow running with auth disabled.
  if (isAuthDisabledForCurrentHost()) {
    return <>{children}</>;
  }

  // If authentication is still loading, show a loading indicator
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--surface-base)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.isEnabled === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  // If role is required and user doesn't have it, show unauthorized
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--surface-base)] text-[var(--ink-primary)]">
        <h1 className="text-3xl font-bold mb-4">Unauthorized</h1>
        <p className="text-[var(--ink-tertiary)] mb-8">
          You don&apos;t have permission to access this page.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--color-primary-dark)]"
        >
          Go Back
        </button>
      </div>
    );
  }

  // User is authenticated and has the required role (if any)
  return <>{children}</>;
};

export default ProtectedRoute;
