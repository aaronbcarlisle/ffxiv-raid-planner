/**
 * Dashboard Page
 *
 * The `/dashboard` route ("My Statics"). The statics browser itself lives in
 * `MyStaticsPanel` so it can be reused inside the Player Hub "My Statics" tab;
 * this page is just the auth gate + full-page host for it.
 */

import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useInV2Chrome } from '../lib/chromeContext';
import { Spinner } from '../components/ui';
import { MyStaticsPanel } from '../components/dashboard/MyStaticsPanel';

export function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, authInitialized } = useAuthStore();
  const inV2Chrome = useInV2Chrome();

  // Redirect if not authenticated. Wait for authInitialized to prevent redirect
  // during auth state propagation.
  useEffect(() => {
    if (authInitialized && !authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authInitialized, authLoading, isAuthenticated, navigate]);

  // Stage-3 PH1 seam: under v2 chrome the statics list lives on the Player Hub's Overview.
  if (inV2Chrome) return <Navigate to="/profile" replace />;

  // Show loading while auth is initializing or loading
  if (!authInitialized || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading authentication" />
      </div>
    );
  }

  return <MyStaticsPanel />;
}
