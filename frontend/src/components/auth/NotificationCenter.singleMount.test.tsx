/**
 * NotificationCenter single-mount (Stage-1 req 10, T2).
 *
 * Before T2 the center was mounted TWICE in a v2 group render — NewShell AND
 * UserMenu each self-mounted one. Open-state now lives in notificationStore
 * (`centerOpen`/`openCenter`/`closeCenter`) and ONE app-level host
 * (NotificationCenterHost, mounted by App.tsx) renders the center for both
 * shells. This suite pins:
 *
 *   1. a v2 group render (real NewShell + the host, as App composes them)
 *      contains exactly ONE NotificationCenter instance;
 *   2. both openers — the TopBar bell and the (rail) UserMenu Notifications
 *      item — open that single center via the store;
 *   3. RC6 (director-required V1 characterization): the change is an
 *      UNCONDITIONAL legacy-path edit (the legacy Header renders UserMenu on
 *      every route), so the legacy-shape render — UserMenu with NO
 *      V2ChromeContext provider — is pinned explicitly: its Notifications item
 *      opens the single center, and the center's onClose closes it.
 *
 * The center itself is stubbed (props captured) — its internals are covered by
 * NotificationCenter.test.tsx; here only mount count and open/close wiring
 * matter. NewShell's mock surface mirrors NewShell.rail.test.tsx, except
 * UserMenu and TopBar's opener wiring stay REAL/observable — they are the
 * subjects under test.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const centerSpy = vi.hoisted(() => ({
  current: null as null | { isOpen: boolean; onClose: () => void },
}));
vi.mock('./NotificationCenter', () => ({
  NotificationCenter: (props: { isOpen: boolean; onClose: () => void }) => {
    centerSpy.current = props;
    return <div data-testid="notification-center" data-open={String(props.isOpen)} />;
  },
}));

const mocks = vi.hoisted(() => ({
  fetchGroupByShareCode: vi.fn(),
  fetchGroups: vi.fn(),
  clearGroupError: vi.fn(),
  fetchTiers: vi.fn().mockResolvedValue(undefined),
  fetchTier: vi.fn().mockResolvedValue(undefined),
  clearTiers: vi.fn(),
  clearTierError: vi.fn(),
}));

// ── NewShell mock surface (mirrors NewShell.rail.test.tsx; body stubs only —
// UserMenu stays REAL, TopBar is a minimal opener-forwarding stub) ──────────
vi.mock('../../pages/GroupViewContent', () => ({ GroupViewContent: () => <div data-testid="gvc" /> }));
vi.mock('../home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('../../pages/groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('../../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('../../pages/newShellTestScaffold');
  return {
    useGroupViewState: () => makeGroupViewStateMock({
      pageMode: 'overview',
      searchParams: new URLSearchParams(),
    }),
  };
});
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      groups: [],
      currentGroup: { id: 'a', shareCode: 'ABC', name: 'Alpha Static' },
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
vi.mock('../../stores/tierStore', () => ({
  useCurrentTier: () => null,
  useTierStore: useTierStoreMock,
}));

// Dual-form auth mock (selector + whole-store), stable identity — UserMenu
// renders for real, so the user needs the fields it reads (discordId is fed
// to BigInt for the default avatar).
const authState = vi.hoisted(() => ({
  user: {
    id: 'u1', discordId: '123456789', discordUsername: 'tester',
    displayName: 'Tester', isAdmin: false, activityDisplayMode: 'named',
  },
  logout: vi.fn(),
  updatePreferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../stores/authStore', () => {
  const useAuthStoreMock = (sel?: (s: typeof authState) => unknown) =>
    sel ? sel(authState) : authState;
  useAuthStoreMock.getState = () => authState;
  return { useAuthStore: useAuthStoreMock };
});

vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: true,
    canManageInvitations: false,
  }),
}));
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));
// Minimal TopBar stub that keeps the onOpenNotifications wiring observable —
// the bell click path is the subject under test, the rest of TopBar is not.
vi.mock('../layout/TopBar', () => ({
  TopBar: ({ onOpenNotifications }: { onOpenNotifications: () => void }) => (
    <button type="button" data-testid="bell-opener" onClick={onOpenNotifications}>bell</button>
  ),
}));
vi.mock('../layout/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../../pages/V2SettingsHost', () => ({ V2SettingsHost: () => null }));
// Backstop: no store action may hit the network in jsdom.
vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue(undefined),
    patch: vi.fn().mockResolvedValue(undefined),
  },
}));

import { NewShell } from '../../pages/NewShell';
import { NotificationCenterHost } from './NotificationCenterHost';
import { UserMenu } from './UserMenu';
import { TooltipProvider } from '../primitives';
import { useNotificationStore } from '../../stores/notificationStore';

beforeEach(() => {
  centerSpy.current = null;
  localStorage.clear();
  sessionStorage.clear();
  // The store is REAL (that's the point — both openers write it); reset the
  // open-state and stub the fetch action so UserMenu's mount effect stays off
  // the network.
  useNotificationStore.setState({
    centerOpen: false,
    notifications: [],
    unreadCount: 0,
    fetchNotifications: vi.fn(),
  });
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

/** The v2 composition as App arranges it: NewShell on the group route plus the
 *  single app-level host. */
function renderV2() {
  return render(
    <MemoryRouter initialEntries={['/group/ABC']}>
      <TooltipProvider>
        <Routes>
          <Route path="/group/:shareCode" element={<NewShell />} />
        </Routes>
        <NotificationCenterHost />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

/** The legacy composition shape: Header's UserMenu (no V2ChromeContext
 *  provider anywhere) plus the same app-level host. */
function renderLegacy() {
  return render(
    <MemoryRouter initialEntries={['/group/ABC']}>
      <TooltipProvider>
        <UserMenu />
        <NotificationCenterHost />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

function openUserMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: /user menu/i }), { key: 'Enter' });
}

describe('NotificationCenter — single mount (v2)', () => {
  it('a v2 group render contains exactly ONE NotificationCenter instance', () => {
    renderV2();
    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('false');
  });

  it('the TopBar bell opens the single center via the store', () => {
    renderV2();
    fireEvent.click(screen.getByTestId('bell-opener'));
    expect(useNotificationStore.getState().centerOpen).toBe(true);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('true');
  });

  it('the rail UserMenu Notifications item opens the same single center', async () => {
    renderV2();
    openUserMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /notifications/i }));
    expect(useNotificationStore.getState().centerOpen).toBe(true);
    // Still exactly one center — UserMenu no longer self-mounts a second one.
    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('true');
  });
});

describe('NotificationCenter — V1 characterization (RC6)', () => {
  it('legacy Header UserMenu (no provider): the Notifications item opens the single center and onClose closes it', async () => {
    // This dedupe is an UNCONDITIONAL legacy-path edit (the legacy Header
    // renders UserMenu on every route) — it is NOT provably inert on legacy,
    // so the legacy behavior is pinned explicitly rather than assumed.
    renderLegacy();
    expect(screen.getAllByTestId('notification-center')).toHaveLength(1);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('false');

    openUserMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: /notifications/i }));
    expect(useNotificationStore.getState().centerOpen).toBe(true);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('true');

    // Close through the center's own onClose (the host wires closeCenter).
    act(() => centerSpy.current!.onClose());
    expect(useNotificationStore.getState().centerOpen).toBe(false);
    expect(screen.getByTestId('notification-center').getAttribute('data-open')).toBe('false');
  });
});

describe('NotificationCenterHost session gate', () => {
  it('renders nothing when the session is cleared, even with centerOpen true', () => {
    const savedUser = authState.user;
    // Simulate mid-flight session loss (refresh-token failure clears user).
    (authState as { user: typeof authState.user | null }).user = null;
    useNotificationStore.setState({ centerOpen: true });
    try {
      const { container } = render(<NotificationCenterHost />);
      expect(container).toBeEmptyDOMElement();
    } finally {
      (authState as { user: typeof authState.user | null }).user = savedUser;
    }
  });
});
