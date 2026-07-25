/**
 * Admin Layout - Wrapper with sidebar + content area
 *
 * Provides the admin sidebar navigation alongside an outlet for
 * nested admin routes. Content area scrolls independently.
 */

import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useInV2Chrome } from '../lib/chromeContext';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { Spinner } from '../components/ui';

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, authInitialized } = useAuthStore();
  // Stage-1 T5, matrix A3 — SANCTIONED legacy-file seam, provably false on
  // every legacy render path (the V2ChromeContext provider exists only inside
  // AppChrome, mounted only by Layout's v2 branch; default `false`). Two
  // fitting adjustments under v2 chrome:
  //   1. the chrome bar above is `h-14` (3.5rem), not the legacy Header's 4rem;
  //   2. AppChrome owns the page's single `<main id="main-content">` (the
  //      SkipLink target), so this nested `<main>` becomes a plain `<div>` —
  //      two <main> landmarks on one page is an a11y defect.
  // The legacy branch keeps the original element and class literals verbatim.
  const inV2Chrome = useInV2Chrome();

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

  const content = <Outlet />;

  return (
    <div className={inV2Chrome ? 'flex min-h-[calc(100vh-3.5rem)]' : 'flex min-h-[calc(100vh-4rem)]'}>
      <AdminSidebar />
      {inV2Chrome ? (
        <div className="flex-1 p-6 overflow-y-auto">{content}</div>
      ) : (
        <main className="flex-1 p-6 overflow-y-auto">{content}</main>
      )}
    </div>
  );
}
