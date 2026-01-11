/**
 * Protected Route - Wrapper that requires authentication
 *
 * Usage:
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 */

import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoginButton } from './LoginButton';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Where to redirect after login (defaults to current page) */
  redirectTo?: string;
  /** Show a loading spinner while checking auth (default: true) */
  showLoading?: boolean;
  /** Show login prompt instead of redirecting (default: true) */
  showLoginPrompt?: boolean;
}

export function ProtectedRoute({
  children,
  redirectTo,
  showLoading = true,
  showLoginPrompt = true,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, fetchUser } = useAuthStore();

  // Check auth status on mount if we have a persisted user but haven't verified yet
  // With httpOnly cookies, we verify by calling the API
  useEffect(() => {
    if (user && !isAuthenticated && !isLoading) {
      fetchUser();
    }
  }, [isAuthenticated, user, isLoading, fetchUser]);

  // Store intended destination for post-login redirect
  useEffect(() => {
    if (!isAuthenticated && !isLoading && redirectTo) {
      sessionStorage.setItem('auth_redirect', redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  // Loading state - show spinner while verifying session
  // Also show spinner if we have a persisted user but haven't verified yet
  if (isLoading || (user && !isAuthenticated)) {
    if (!showLoading) return null;

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    if (!showLoginPrompt) {
      navigate('/');
      return null;
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md mx-auto p-8 bg-surface-card rounded-lg border border-border-default">
          <h2 className="text-xl font-display text-accent mb-4">Login Required</h2>
          <p className="text-text-secondary mb-6">
            You need to be logged in to access this page. Sign in with your Discord account to continue.
          </p>
          <LoginButton />
        </div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
}
