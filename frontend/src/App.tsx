import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/ToastContainer';
import { PageSkeleton } from './components/ui/Skeleton';
import { initializeAuth } from './stores/authStore';
import { analytics } from './services/analytics';
import { errorReporter } from './services/errorReporter';

// Lazy-loaded pages for code splitting
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const GroupView = lazy(() => import('./pages/GroupView').then(m => ({ default: m.GroupView })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const InviteAccept = lazy(() => import('./pages/InviteAccept').then(m => ({ default: m.InviteAccept })));

// Documentation pages
const DocsIndex = lazy(() => import('./pages/DocsIndex').then(m => ({ default: m.DocsIndex })));
const DesignSystemPage = lazy(() => import('./pages/DesignSystem').then(m => ({ default: m.DesignSystem })));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const ApiCookbook = lazy(() => import('./pages/ApiCookbook'));
const ReleaseNotes = lazy(() => import('./pages/ReleaseNotes'));
const RoadmapDocs = lazy(() => import('./pages/RoadmapDocs'));
const PrivacyDocs = lazy(() => import('./pages/PrivacyDocs'));
const QuickStartGuide = lazy(() => import('./pages/QuickStartGuide'));
const HowToDocs = lazy(() => import('./pages/HowToDocs'));
const UnderstandingPriority = lazy(() => import('./pages/UnderstandingPriority'));
const GearMathDocs = lazy(() => import('./pages/GearMathDocs'));
const FAQDocs = lazy(() => import('./pages/FAQDocs'));

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-default rounded-lg p-6 max-w-md text-center">
        <h2 className="text-xl font-display text-status-error mb-2">Something went wrong</h2>
        <p className="text-text-secondary text-sm mb-4">{error.message}</p>
{/* design-system-ignore: error boundary uses inline button to minimize dependencies */}
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-surface-base">
      <PageSkeleton />
    </div>
  );
}

function App() {
  const location = useLocation();

  // Initialize auth on app load (check for existing session)
  useEffect(() => {
    initializeAuth();
    analytics.init();
    errorReporter.init();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    analytics.track('navigation', 'page_view', { page: location.pathname });
  }, [location.pathname]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="admin/statics" element={<AdminDashboard />} />
            <Route path="group/:shareCode" element={<GroupView />} />
            {/* Documentation routes */}
            <Route path="docs" element={<DocsIndex />} />
            <Route path="docs/quick-start" element={<QuickStartGuide />} />
            <Route path="docs/how-to" element={<HowToDocs />} />
            <Route path="docs/understanding-priority" element={<UnderstandingPriority />} />
            <Route path="docs/faq" element={<FAQDocs />} />
            <Route path="docs/design-system" element={<DesignSystemPage />} />
            <Route path="docs/api" element={<ApiDocs />} />
            <Route path="docs/api/cookbook" element={<ApiCookbook />} />
            <Route path="docs/gear-math" element={<GearMathDocs />} />
            <Route path="docs/release-notes" element={<ReleaseNotes />} />
            {/* Redirects from old documentation routes */}
            <Route path="docs/getting-started" element={<Navigate to="/docs/quick-start" replace />} />
            <Route path="docs/guides/leads" element={<Navigate to="/docs/quick-start" replace />} />
            <Route path="docs/guides/members" element={<Navigate to="/docs/quick-start" replace />} />
            <Route path="docs/guides/common-tasks" element={<Navigate to="/docs/how-to" replace />} />
            <Route path="docs/loot-math" element={<Navigate to="/docs/understanding-priority" replace />} />
            <Route path="docs/roadmap" element={<RoadmapDocs />} />
            <Route path="docs/privacy" element={<PrivacyDocs />} />
            {/* Legacy redirect for old /design-system URL */}
            <Route path="design-system" element={<DesignSystemPage />} />
          </Route>
          {/* Auth callback route (outside Layout for cleaner UX) */}
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* Invite accept route (outside Layout for focused experience) */}
          <Route path="/invite/:inviteCode" element={<InviteAccept />} />
        </Routes>
        <ToastContainer />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
