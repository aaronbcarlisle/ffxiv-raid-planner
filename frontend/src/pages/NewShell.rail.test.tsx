/**
 * NewShell — rail avatar static-switch restores tabs (Task 7 follow-up, FIX 3).
 *
 * Locks that the v2 rail's avatar static-switch affordance (`personLayerEntries`
 * inside `NewShell()`) calls the SAME `buildStaticNavHref` repoint as
 * `StaticPicker` — restoring the target static's saved tab when "remember tab
 * per static" is ON, instead of hardcoding a bare `/group/{code}` (which
 * silently dropped the saved tab).
 *
 * Heavy mocking isolates the rail-click wiring from the rest of the v2 shell
 * (ShellContent's slots, TopBar, CommandPalette, V2SettingsHost, etc. — none of
 * which matter for this assertion). The mock surface mirrors
 * NewShell.banners.test.tsx's (GroupViewContent/Home/AdminBanners/
 * JoinRequestBanner/groupActionsContext/useGroupViewState/staticGroupStore/
 * tierStore/useStaticPermissions), extended to cover full `NewShell()` (that
 * file only renders the inner `ShellContent`). `tiers: []` keeps the tier-fetch
 * effect on its early-return branch, so no real fetch actions ever fire.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be declared before vi.mock so the factory can close over it.
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
}));

vi.mock('./GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return {
    useGroupViewState: () => makeGroupViewStateMock({
      pageMode: 'overview',
      searchParams: new URLSearchParams('tab=roster'),
    }),
  };
});
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
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: true,
    canManageInvitations: true,
  }),
}));
vi.mock('../components/layout/TopBar', () => ({ TopBar: () => <div data-testid="topbar-stub" /> }));
vi.mock('../components/layout/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../components/auth', () => ({ UserMenu: () => null }));
vi.mock('./V2SettingsHost', () => ({ V2SettingsHost: () => null }));

import { NewShell } from './NewShell';

beforeEach(() => {
  mockNavigate.mockClear();
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
  mocks.groups = [
    { id: 'a', shareCode: 'ABC', name: 'Alpha Static' },
    { id: 'b', shareCode: 'XYZ', name: 'Beta Static' },
  ];
  mocks.currentGroup = { id: 'a', shareCode: 'ABC', name: 'Alpha Static' };
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

describe('NewShell rail avatar static-switch — restores saved tabs', () => {
  it('restores the target static\'s saved tab (remember ON, the default)', () => {
    localStorage.setItem('static-nav-XYZ', 'tab=loot&sub=weapon');
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ?tab=loot&sub=weapon');
  });

  it('falls back to a bare href when there is no saved tab for the target static', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Beta Static' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group/XYZ');
  });
});

describe('NewShell rail Person-layer entries — navigate to real routes (Phase A, A5a)', () => {
  it('Player Hub navigates to /profile', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Player Hub' }));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('Static Finder navigates to /discover', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Static Finder' }));
    expect(mockNavigate).toHaveBeenCalledWith('/discover');
  });
});
