/**
 * NewShell — v2 skips the auth-required fetchGroups() cold-fetch for guests
 * (flip-P1 browser-validation fix).
 *
 * Regression: NewShell's cold-fetch effect unconditionally called
 * `fetchGroups()` whenever `groups.length === 0` on mount, regardless of auth
 * state. `fetchGroups()` hits the AUTH-REQUIRED `GET /api/static-groups` ("my
 * statics" list) — for a logged-out guest this 401s and writes into the
 * shared `staticGroupStore.error`. `ShellContentStates`' branch 5 error-modal
 * check (`error && currentGroup`) then fires for a guest viewing an otherwise-
 * correctly-loaded PUBLIC static (loaded via the separate, unauthenticated
 * `fetchGroupByShareCode` call) — a false "Not authenticated" modal over a
 * correct read-only guest view.
 *
 * Legacy never has this problem: legacy's Header/TopBar chrome only calls
 * `fetchGroups` lazily, when the static-switcher dropdown opens AND the
 * viewer `isMember` (`StaticPicker.tsx:76` — `if (open && isMember)
 * onFetchGroups();`). It is never called eagerly on mount for anyone,
 * authenticated or not.
 *
 * Fix: gate NewShell's mount-fetch on `useAuthStore`'s `user` — a guest has
 * no "my statics" list to fetch, so the auth-required endpoint must not be
 * hit for them.
 *
 * Mock surface mirrors `NewShell.rail.test.tsx` (the other full-`<NewShell/>`
 * render harness), plus an explicit `authStore` mock so `user` is
 * controllable per test. The mock holds `user` on the shared `mocks` object
 * (not a fresh literal per call) so its identity is stable across re-renders
 * — an unstable identity would re-fire the `user`-keyed effect every render.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mocks = vi.hoisted(() => ({
  groups: [] as unknown[],
  currentGroup: null as unknown | null,
  fetchGroupByShareCode: vi.fn(),
  fetchGroups: vi.fn(),
  clearGroupError: vi.fn(),
  fetchTiers: vi.fn().mockResolvedValue(undefined),
  fetchTier: vi.fn().mockResolvedValue(undefined),
  clearTiers: vi.fn(),
  clearTierError: vi.fn(),
  user: null as { id: string } | null,
}));

vi.mock('./GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({
    setPageMode: vi.fn(),
    pageMode: 'overview',
    searchParams: new URLSearchParams('tab=roster'),
    setSearchParams: vi.fn(),
  }),
}));
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      groups: mocks.groups,
      currentGroup: mocks.currentGroup,
      fetchGroupByShareCode: mocks.fetchGroupByShareCode,
      fetchGroups: mocks.fetchGroups,
      clearError: mocks.clearGroupError,
    }),
}));
// Dual-form: supports both the selector call (`useAuthStore((s) => s.user)`,
// used by NewShell/ShellContent) and the no-arg whole-store destructure
// (`const { user } = useAuthStore()`, used by `useViewAsUrlSync`). `user`
// lives on the shared `mocks` object so its reference is stable across
// re-renders within a test (only reassigned by the test body itself).
vi.mock('../stores/authStore', () => ({
  useAuthStore: (sel?: (s: { user: unknown }) => unknown) => {
    const state = { user: mocks.user };
    return sel ? sel(state) : state;
  },
}));

const tierState = {
  tiers: [] as unknown[],
  isLoading: false,
  fetchTiers: mocks.fetchTiers,
  fetchTier: mocks.fetchTier,
  clearTiers: mocks.clearTiers,
  clearError: mocks.clearTierError,
};
function useTierStoreMock(sel?: (s: typeof tierState) => unknown) {
  return sel ? sel(tierState) : tierState;
}
useTierStoreMock.getState = () => tierState;
vi.mock('../stores/tierStore', () => ({
  useCurrentTier: () => null,
  useTierStore: useTierStoreMock,
}));
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: null,
    isAdmin: false,
    isAdminAccess: false,
    isMember: false,
    canEdit: false,
    canManageInvitations: false,
  }),
}));
vi.mock('../components/layout/TopBar', () => ({ TopBar: () => <div data-testid="topbar-stub" /> }));
vi.mock('../components/layout/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../components/auth/NotificationCenter', () => ({ NotificationCenter: () => null }));
vi.mock('../components/auth', () => ({ UserMenu: () => null }));
vi.mock('./V2SettingsHost', () => ({ V2SettingsHost: () => null }));

import { NewShell } from './NewShell';

beforeEach(() => {
  mockNavigate.mockClear();
  mocks.fetchGroups.mockClear();
  try { localStorage.clear(); } catch { /* ignore */ }
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
  // Empty groups list on every test — the unconditional call in the buggy
  // code fires whenever `groups.length === 0`, so this is the discriminating
  // precondition for both cases below.
  mocks.groups = [];
  mocks.currentGroup = { id: 'a', shareCode: 'ABC', name: 'Alpha Static' };
  mocks.user = null;
});

function renderShell(shareCode = 'ABC') {
  return render(
    <MemoryRouter initialEntries={[`/group/${shareCode}`]}>
      <Routes>
        <Route path="/group/:shareCode" element={<NewShell />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewShell — guest guard on the auth-required fetchGroups() cold-fetch', () => {
  it('does NOT call fetchGroups for a logged-out guest (no user), even with an empty groups list', () => {
    mocks.user = null;
    renderShell();
    expect(mocks.fetchGroups).not.toHaveBeenCalled();
  });

  it('DOES call fetchGroups for an authenticated user with an empty groups list', () => {
    mocks.user = { id: 'u1' };
    renderShell();
    expect(mocks.fetchGroups).toHaveBeenCalledTimes(1);
  });
});
