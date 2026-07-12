/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// ── A7 catch-all test mocks ──────────────────────────────────────────────────
// App's mount effect fires initializeAuth() (GET /api/auth/me), analytics.init()
// and errorReporter.init(); none of these may hit the network in jsdom. Only
// initializeAuth is overridden — everything else on authStore stays REAL because
// Layout/Header read useAuthStore/useAuthHydrated from the same module.
vi.mock('./stores/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stores/authStore')>();
  return { ...actual, initializeAuth: vi.fn() };
});
vi.mock('./services/analytics', () => ({ analytics: { init: vi.fn(), track: vi.fn() } }));
vi.mock('./services/errorReporter', () => ({ errorReporter: { init: vi.fn() } }));

import App, { ErrorFallback } from './App';
import { ThemeProvider } from './hooks/useTheme';

describe('App error fallback', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows stale chunk recovery copy after an automatic reload has already been attempted', () => {
    window.sessionStorage.setItem('xrp_chunk_reload_attempted', '1');

    render(
      <ErrorFallback
        error={new Error('error loading dynamically imported module: https://www.xivraidplanner.app/assets/GroupView-D4tlpFl.js')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('The app was updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('keeps normal errors on the generic fallback', () => {
    render(
      <ErrorFallback
        error={new Error('Cannot read properties of undefined')}
        resetErrorBoundary={() => {}}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('App catch-all route (A7)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom has no matchMedia; ThemeProvider (useTheme.ts:20) and useDevice
    // (Header/PageTransition) require it. Same stub shape as
    // CommandPalette.test.tsx.
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders NotFound INSIDE Layout chrome at an unmatched path', async () => {
    // Mirrors main.tsx's provider nesting (Router > ThemeProvider > App); App
    // itself renders no router, so MemoryRouter controls the location.
    render(
      <MemoryRouter initialEntries={['/this/route/does-not-exist']}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </MemoryRouter>,
    );

    // NotFound is a lazy route — wait for the chunk, then assert 404 content…
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();
    // …AND the app Header chrome (<header> = banner role, logo alt text),
    // proving the wildcard mounted INSIDE the Layout route — an unmatched URL
    // used to render literally nothing, Layout included.
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByAltText('FFXIV Raid Planner')).toBeInTheDocument();
  }, 10_000); // explicit test timeout: must exceed findByRole's 5s waitFor so the
  // pre-fix failure is the TestingLibraryElementError, not vitest's own 5s default
});
