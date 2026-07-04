/**
 * NewShell — v2 Roster slot integration (F6c Task 11).
 *
 * Locks that `ShellContent` mounts the real `<Roster/>` (Task 10) as
 * `GroupViewContent`'s `roster` slot at `pageMode='roster'`, mirroring the F6b
 * `overview` slot. Renders the REAL chain ShellContent → GroupViewContent →
 * Roster and asserts:
 *   (a) the v2 Roster renders — its dynamic "N raiders …" `PageHeader` subtitle
 *       (`buildSubtitle`), which the LEGACY roster `PageHeader` ("Manage members,
 *       roles, and characters.") does NOT contain, so it discriminates the v2
 *       slot from the legacy body;
 *   (b) the legacy roster sub-tab chrome (`role="tablist"` `aria-label="Roster
 *       view"`, gated in Task 3 on `!slots?.roster`) is ABSENT.
 *
 * The mock surface is the union of `GroupViewContent.rosterSlot.test.tsx` (which
 * renders the real GroupViewContent at `pageMode='roster'`) and
 * `Roster.test.tsx` (which renders the real Roster). The store mocks are made
 * dual-form (return the whole state to GroupViewContent's `useStore()` reads,
 * and honour the selector for ShellContent's / Roster's `useStore((s) => …)`
 * reads) via the shared `./newShellTestScaffold` builders. The heavy leaves
 * that neither assertion inspects (Home behind the overview slot,
 * CharacterManageBridge, the legacy roster body components) are stubbed.
 * Interaction (unused here) would use `fireEvent`, never
 * `@testing-library/user-event` (not a dependency of this project).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ── View state: pinned to the roster tab, with every field GVC + Roster read ──
vi.mock('../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return { useGroupViewState: () => makeGroupViewStateMock({ pageMode: 'roster' }) };
});

// ── Stores — dual-form: GroupViewContent reads the whole object (`useStore()`),
//    while ShellContent / Roster use a selector (`useStore((s) => …)`). ──
vi.mock('../stores/tierStore', async () => {
  const { makeTierStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  const state = makeTierStoreState();
  return { useTierStore: dualFormStoreMock(state), useCurrentTier: () => state.currentTier };
});
vi.mock('../stores/staticGroupStore', async () => {
  const { makeStaticGroupStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useStaticGroupStore: dualFormStoreMock(makeStaticGroupStoreState()) };
});
vi.mock('../stores/authStore', async () => {
  const { makeAuthStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useAuthStore: dualFormStoreMock(makeAuthStoreState()) };
});
vi.mock('../stores/viewAsStore', async () => {
  const { dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useViewAsStore: dualFormStoreMock({ viewAsUser: null }) };
});
// Dual-form: GroupViewContent reads the whole object (`useStore()`), while
// Roster uses selectors (`useStore((s) => s.lootLog)` etc.) for its Board
// next-upgrade highlight + mount fetch. `dualFormStoreMock` is called once
// (module init) so both reads share the same state/fn identities — a fresh
// object per call broke referential identity between GroupViewContent's
// whole-state read and Roster's selector reads (PR review finding).
vi.mock('../stores/lootTrackingStore', async () => {
  const { dualFormStoreMock } = await import('./newShellTestScaffold');
  const state = {
    currentWeek: 1, maxWeek: 1, fetchCurrentWeek: vi.fn(), fetchLootLog: vi.fn(),
    lootLog: [] as unknown[], fetchMaterialLog: vi.fn(), materialLog: [] as unknown[],
  };
  return { useLootTrackingStore: dualFormStoreMock(state) };
});
vi.mock('../stores/mountFarmStore', () => ({ useMountFarmStore: { getState: () => ({ data: null }) } }));
vi.mock('../stores/settingsPanelStore', () => ({
  useSettingsPanelStore: { getState: () => ({ open: vi.fn(), close: vi.fn() }) },
}));

// ── Permissions (ShellContent → `canManageRoster(userRole).allowed`) ──
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner', isAdmin: false, isAdminAccess: false, isMember: true,
    canEdit: true, canManageInvitations: true,
  }),
}));

// ── Hooks (GroupViewContent + Roster share usePlayerActions) ──
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({ useGroupViewKeyboardShortcuts: vi.fn() }));
const playerActions = {
  handleUpdatePlayer: vi.fn(), handleRemovePlayer: vi.fn(), handleClaimPlayer: vi.fn(),
  handleReleasePlayer: vi.fn(), handleAdminAssignPlayer: vi.fn(), handleOwnerAssignPlayer: vi.fn(),
  handleConfigurePlayer: vi.fn(), handleAddPlayer: vi.fn(), handleDuplicatePlayer: vi.fn(),
  handleResetGear: vi.fn(), handleReorder: vi.fn(),
};
vi.mock('../hooks/usePlayerActions', () => ({ usePlayerActions: () => playerActions }));
vi.mock('../components/dnd/useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    sensors: [], handleDragStart: vi.fn(), handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(), handleDragCancel: vi.fn(),
  }),
}));
vi.mock('../hooks/useDevice', () => ({ useDevice: () => ({ isSmallScreen: false }) }));
vi.mock('../hooks/useSwipe', () => ({ useSwipe: () => ({}) }));
vi.mock('../hooks/useViewNavigation', () => ({
  useViewNavigation: () => ({
    handleNavigateToPlayer: vi.fn(), handleNavigateToLootEntry: vi.fn(),
    handleNavigateToMaterialEntry: vi.fn(), handleNavigateToBooksPanel: vi.fn(),
  }),
}));
vi.mock('../hooks/useVisibilityRefresh', () => ({ useVisibilityRefresh: vi.fn() }));
vi.mock('../hooks/useUrlTabState', () => ({ useUrlTabState: (_k: string, _v: unknown, d: string) => [d, vi.fn()] }));
vi.mock('../lib/eventBus', () => ({
  useEventBus: vi.fn(),
  eventBus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) },
  Events: { MEMBER_ROLE_CHANGED: 'membership:role-changed', MOUNT_FARM_SCHEDULE: 'mount-farm:schedule' },
}));

// ── GroupActions context — GVC signals + ShellContent's `useGroupActions()` ──
vi.mock('./groupActionsContext', () => ({
  useGroupActions: () => ({
    onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(),
    onRollover: vi.fn(), onDeleteTier: vi.fn(),
  }),
  useGroupActionModalOpen: () => false,
  useGroupAddedPlayer: () => null,
  useGroupClearAddedPlayer: () => vi.fn(),
}));

// ── Heavy leaves ──
// The overview slot's <Home/> is BUILT by ShellContent but never mounted at
// pageMode='roster' — stub it so its dep tree stays out of the test.
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
// Roster's character-management action bar pulls the character panel + stores.
vi.mock('../components/roster/CharacterManageBridge', () => ({
  CharacterManageBridge: () => <div data-testid="char-bridge" />,
}));
// Legacy roster body leaves (only mount without the slot; stubbed for the RED run).
vi.mock('../components/roster/RosterCharacterPanel', () => ({ RosterCharacterPanel: () => null }));
// Task 4: ShellContent now mounts AdminBanners/JoinRequestBanner above the roster
// slot (not under test here). Stub both — the real JoinRequestBanner subscribes
// to the un-mocked joinRequestStore, which isn't set up for this test.
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { ShellContent } from './NewShell';

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell — v2 Roster slot', () => {
  it('mounts the v2 <Roster/> as the roster slot and hides the legacy roster sub-tab chrome', () => {
    renderShell();

    // (a) v2 Roster header + its dynamic subtitle. The legacy roster PageHeader
    //     subtitle is "Manage members, roles, and characters." (no "raiders"),
    //     so this only matches when the v2 slot owns the region.
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
    expect(screen.getByText(/0 raiders/)).toBeInTheDocument();

    // (b) legacy roster sub-tab tablist gated off by the roster slot (Task 3).
    expect(screen.queryByRole('tablist', { name: /Roster view/i })).not.toBeInTheDocument();
  });
});
