/**
 * AppChrome ↔ NewShell portal integration (Stage-1 T3, RC7 — director-required).
 *
 * THE RC1 SURFACE, tested with the REAL modules: the real AppChrome publishes
 * its slot nodes, the real NewShell portals the REAL TopBar into them, and
 * TopBar's TierBreadcrumb calls `useGroupActions()` — which resolves the REAL
 * `GroupActionModals` provider that lives in NewShell, BELOW the host. Under
 * the rejected element-passing slot design, the TopBar element would have
 * rendered at the HOST's tree position (no provider ancestor) and thrown —
 * killing the whole v2 group route behind the app ErrorBoundary, invisibly to
 * `NewShell.rail.test.tsx` (stubs TopBar) and `TopBar.test.tsx` (mocks
 * useGroupActions). This suite renders the shipped wiring end-to-end and
 * asserts the tier kebab — the exact affordance that design would have killed
 * — renders inside the host's top-bar container.
 *
 * Real: AppChrome, chromeSlots, NewShell (portal wiring), GroupActionModals,
 * TopBar, TierBreadcrumb, TierSelector, TierActionsMenu, StaticPicker,
 * NotificationBell, SettingsGear, ThemeToggle, Spine, ShellContentStates, and
 * the Zustand stores (seeded via setState; fetch ACTIONS stubbed on the real
 * stores so nothing hits the network).
 * Stubbed (off the RC1 chain): route bodies (GroupViewContent + the four slot
 * screens), banners, CommandPalette, V2SettingsHost, UserMenu, the api module
 * (backstop), and useGroupViewState (URL-sync machinery irrelevant here).
 */
import { Component, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('../../components/home/Home', () => ({ Home: () => null }));
vi.mock('../../components/roster/Roster', () => ({ Roster: () => null }));
vi.mock('../../components/loot/Loot', () => ({ Loot: () => null }));
vi.mock('../../components/schedule/Schedule', () => ({ Schedule: () => null }));
vi.mock('../../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('../../components/layout/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../V2SettingsHost', () => ({ V2SettingsHost: () => null }));
vi.mock('../../components/auth', () => ({ UserMenu: () => null }));
vi.mock('../../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('../newShellTestScaffold');
  return {
    useGroupViewState: () => makeGroupViewStateMock({
      pageMode: 'overview',
      searchParams: new URLSearchParams(),
    }),
  };
});
// Backstop: no store action may hit the network in jsdom.
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue(undefined),
    patch: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

import { AppChrome } from './AppChrome';
import { NewShell } from '../NewShell';
import { TopBar } from '../../components/layout/TopBar';
import { TooltipProvider } from '../../components/primitives';
import { ThemeProvider } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import type { StaticGroup, StaticGroupListItem, TierSnapshot, User } from '../../types';

const groupFixture = {
  id: 'g1',
  shareCode: 'ABC',
  name: 'Alpha Static',
  settings: {},
  userRole: 'owner',
  isAdminAccess: false,
  isPublic: false,
  ownerId: 'u1',
  memberCount: 1,
  source: 'membership',
};
const group = groupFixture as unknown as StaticGroup;
const groupListItem = groupFixture as unknown as StaticGroupListItem;

const tier = {
  id: 'snap1',
  tierId: 'aac-heavyweight',
  contentType: 'savage',
  isActive: true,
  players: [],
} as unknown as TierSnapshot;

beforeEach(() => {
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
  // REAL stores, seeded state, fetch ACTIONS stubbed (never the context/portal
  // machinery under test). clearTiers is a no-op so NewShell's clear-on-switch
  // mount effect doesn't wipe the seeded tiers before the assertion.
  useAuthStore.setState({ user: { id: 'u1', isAdmin: false } as unknown as User });
  useStaticGroupStore.setState({
    groups: [groupListItem],
    currentGroup: group,
    isLoading: false,
    error: null,
    fetchGroups: vi.fn(),
    fetchGroupByShareCode: vi.fn(),
  });
  useTierStore.setState({
    tiers: [tier],
    currentTier: tier,
    isLoading: false,
    error: null,
    fetchTiers: vi.fn().mockResolvedValue(undefined),
    fetchTier: vi.fn().mockResolvedValue(undefined),
    clearTiers: vi.fn(),
  });
  useInvitationStore.setState({ invitations: [], fetchInvitations: vi.fn() });
  useJoinRequestStore.setState({ pendingCount: 0, fetchGroupRequests: vi.fn() });
  useLootTrackingStore.setState({ fetchCurrentWeek: vi.fn() });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The shipped composition: Layout's v2 branch mounts AppChrome; the group
 *  route renders NewShell inside it; NewShell portals TopBar/Spine into the
 *  host's slot containers. */
function renderShipped() {
  return render(
    <MemoryRouter initialEntries={['/group/ABC']}>
      <ThemeProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/group/:shareCode" element={<AppChrome><NewShell /></AppChrome>} />
          </Routes>
        </TooltipProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('AppChrome + NewShell portals — GroupActionModals context resolves through the portal (RC7)', () => {
  it('renders the tier kebab inside the host top-bar container (the RC1 surface)', () => {
    renderShipped();

    // The kebab exists — TierBreadcrumb's useGroupActions() resolved the
    // provider through the portal (element-slots would have thrown here).
    const kebab = screen.getByRole('button', { name: 'Tier actions menu' });

    // …and it lives in the HOST's DOM container, not in NewShell's subtree.
    expect(screen.getByTestId('chrome-topbar-slot')).toContainElement(kebab);

    // The Spine portal landed in its host container too.
    const spine = screen.getByRole('tablist', { name: 'Main content sections' });
    expect(screen.getByTestId('chrome-spine-slot')).toContainElement(spine);

    // The routed content renders inside the host's #main-content.
    const main = document.querySelector('main#main-content');
    expect(main).not.toBeNull();
    expect(main).toContainElement(screen.getByTestId('gvc'));
  });
});

class Catcher extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message !== null
      ? <div data-testid="caught">{this.state.message}</div>
      : this.props.children;
  }
}

describe('negative control — TopBar at the host position (no provider) throws', () => {
  it('documents RC1: rendering the real TopBar outside GroupActionModals is a provider error', () => {
    // Element-passing slots would have rendered TopBar exactly like this —
    // at the host's tree position, above the provider. Silence the expected
    // boundary noise for this render only.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/group/ABC']}>
        <TooltipProvider>
          <Catcher>
            <Routes>
              <Route
                path="/group/:shareCode"
                element={<TopBar onOpenPalette={() => {}} onOpenNotifications={() => {}} />}
              />
            </Routes>
          </Catcher>
        </TooltipProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('caught').textContent).toMatch(/GroupActionModals/);
  });
});
