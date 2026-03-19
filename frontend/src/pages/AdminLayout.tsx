/**
 * Admin Layout - Wrapper with sidebar + content area
 *
 * Provides the admin sidebar navigation alongside an outlet for
 * nested admin routes. Content area scrolls independently.
 */

import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { Spinner } from '../components/ui';

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, authInitialized } = useAuthStore();

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (authInitialized && !authLoading) {
      if (!isAuthenticated) {
        navigate('/');
      } else if (user && user.isAdmin === false) {
        navigate('/dashboard');
      }
    }
  }, [authInitialized, authLoading, isAuthenticated, user, navigate]);

  // Show loading while auth initializes
  if (!authInitialized || authLoading || (isAuthenticated && user && user.isAdmin === undefined)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading admin dashboard" />
      </div>
    );
  }

  // Redirect will fire via the effect above
  if (!isAuthenticated || !user || user.isAdmin === false) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
