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
 * reads). The heavy leaves that neither assertion inspects (Home behind the
 * overview slot, CharacterManageBridge, the legacy roster body components) are
 * stubbed. Interaction (unused here) would use `fireEvent`, never
 * `@testing-library/user-event` (not a dependency of this project).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ── View state: pinned to the roster tab, with every field GVC + Roster read ──
const noop = vi.fn();
function makeState() {
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: 'roster',
    setPageMode: noop,
    gearSubTab: 'sync', setGearSubTab: noop,
    lootSubTab: 'gear', setLootSubTab: noop,
    viewMode: 'compact', setViewMode: noop,
    groupView: false, setGroupView: noop, setGroupViewState: noop,
    subsView: false, setSubsView: noop,
    selectedFloor: 1, setSelectedFloor: noop,
    sortPreset: 'standard', setSortPreset: noop, setSortPresetState: noop,
    editingPlayerId: null, setEditingPlayerId: noop,
    clipboardPlayer: null, setClipboardPlayer: noop,
    showCreateTierModal: false, setShowCreateTierModal: noop,
    showSettingsModal: false, setShowSettingsModal: noop,
    showRolloverDialog: false, setShowRolloverDialog: noop,
    showDeleteTierConfirm: false, setShowDeleteTierConfirm: noop,
    showKeyboardHelp: false, setShowKeyboardHelp: noop,
    showLogLootModal: false, setShowLogLootModal: noop,
    showLogMaterialModal: false, setShowLogMaterialModal: noop,
    showMarkFloorClearedModal: false, setShowMarkFloorClearedModal: noop,
    showLogWeekWizard: false, setShowLogWeekWizard: noop,
    logWeekWizardFloor: null, setLogWeekWizardFloor: noop,
    logWeekWizardWeek: null, setLogWeekWizardWeek: noop,
    playerModalCount: 0, setPlayerModalCount: noop,
    highlightedPlayerId: null, setHighlightedPlayerId: noop,
    highlightedSlot: null, setHighlightedSlot: noop,
    highlightedEntry: null, setHighlightedEntry: noop,
    highlightedBookPlayerId: null, setHighlightedBookPlayerId: noop,
  };
}
vi.mock('../hooks/useGroupViewState', () => ({
  useGroupViewState: () => makeState(),
}));

// ── Fixtures ──
const currentTier = { id: 'snap1', tierId: 'm5s', contentType: 'savage', players: [] as unknown[] };
const currentGroup = {
  id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {},
  userRole: 'owner', isAdminAccess: false,
};

// ── Stores — dual-form: GroupViewContent reads the whole object (`useStore()`),
//    while ShellContent / Roster use a selector (`useStore((s) => …)`). ──
vi.mock('../stores/tierStore', () => ({
  useTierStore: () => ({ currentTier, tiers: [currentTier], isSaving: false, fetchTier: vi.fn() }),
  useCurrentTier: () => currentTier,
}));
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel?: (s: { currentGroup: unknown; groups: unknown[] }) => unknown) => {
    const state = { currentGroup, groups: [currentGroup] };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (sel?: (s: { user: { id: string; isAdmin: boolean } }) => unknown) => {
    const state = { user: { id: 'u1', isAdmin: false } };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../stores/viewAsStore', () => ({
  useViewAsStore: (sel?: (s: { viewAsUser: null }) => unknown) => {
    const state = { viewAsUser: null };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../stores/lootTrackingStore', () => ({
  // Dual-form: GroupViewContent reads the whole object (`useStore()`), while
  // Roster uses selectors (`useStore((s) => s.lootLog)` etc.) for its Board
  // next-upgrade highlight + mount fetch.
  useLootTrackingStore: (sel?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      currentWeek: 1, maxWeek: 1, fetchCurrentWeek: vi.fn(), fetchLootLog: vi.fn(),
      lootLog: [], fetchMaterialLog: vi.fn(), materialLog: [],
    };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../stores/mountFarmStore', () => ({ useMountFarmStore: { getState: () => ({ data: null }) } }));
vi.mock('../stores/splitClearStore', () => ({
  useSplitClearStore: () => ({ fetchData: vi.fn(), clearData: vi.fn() }),
}));
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
vi.mock('../components/player/PlayerGrid', () => ({ PlayerGrid: () => <div data-testid="legacy-player-grid" /> }));
vi.mock('../components/player/RosterDragOverlay', () => ({ RosterDragOverlay: () => null }));
vi.mock('../components/roster/RosterCharacterPanel', () => ({ RosterCharacterPanel: () => null }));
vi.mock('../components/split-clear/SplitClearPlanner', () => ({ SplitClearPlanner: () => null }));
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
