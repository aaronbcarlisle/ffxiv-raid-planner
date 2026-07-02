/**
 * NewShell — v2 Loot slot integration (F6d Task 10).
 *
 * Locks that `ShellContent` mounts the real `<Loot/>` as `GroupViewContent`'s
 * `gear` slot at `pageMode='gear'`, mirroring the F6b `overview` / F6c `roster`
 * slots. Renders the REAL chain ShellContent → GroupViewContent → (mocked) Loot
 * and asserts:
 *   (a) the v2 Loot screen mounts (the `gear` slot is wired);
 *   (b) the legacy gear sub-tab chrome (the Log/Priority/Sync/Summary buttons,
 *       gated in Task 10 on `!slots?.gear`) is ABSENT.
 *
 * The mock surface mirrors `NewShell.roster.test.tsx` (real GroupViewContent at a
 * pinned pageMode). `Loot` is stubbed — the point is the slot WIRING, not Loot's
 * internals (covered by its own tests). The legacy gear body leaf (GearSyncDashboard,
 * mounts at gearSubTab='sync' in the RED run) is stubbed.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ── View state: pinned to the gear tab ──
const noop = vi.fn();
function makeState() {
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: 'gear',
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

// ── Stores — dual-form (GroupViewContent reads whole object; ShellContent uses a selector). ──
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
  useLootTrackingStore: () => ({
    currentWeek: 1, maxWeek: 1, fetchCurrentWeek: vi.fn(), fetchLootLog: vi.fn(),
    lootLog: [], fetchMaterialLog: vi.fn(), materialLog: [],
  }),
}));
vi.mock('../stores/mountFarmStore', () => ({ useMountFarmStore: { getState: () => ({ data: null }) } }));
vi.mock('../stores/splitClearStore', () => ({
  useSplitClearStore: () => ({ fetchData: vi.fn(), clearData: vi.fn() }),
}));
vi.mock('../stores/settingsPanelStore', () => ({
  useSettingsPanelStore: { getState: () => ({ open: vi.fn(), close: vi.fn() }) },
}));

// ── Permissions (ShellContent → canEdit/canManage + canManageRoster). ──
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner', isAdmin: false, isAdminAccess: false, isMember: true,
    canEdit: true, canManageInvitations: true,
  }),
}));

// ── Hooks ──
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({ useGroupViewKeyboardShortcuts: vi.fn() }));
vi.mock('../hooks/usePlayerActions', () => ({ usePlayerActions: () => ({ handleAddPlayer: vi.fn() }) }));
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

// ── GroupActions context — GVC signals + ShellContent's useGroupActions(). ──
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
// The overview/roster slots are BUILT by ShellContent but never mounted at
// pageMode='gear' — stub them so their dep trees stay out of the test.
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/roster/Roster', () => ({ Roster: () => <div data-testid="roster" /> }));
// The v2 gear slot under test — assert it WIRES, not its internals.
vi.mock('../components/loot/Loot', () => ({ Loot: () => <div data-testid="v2-loot" /> }));
// Legacy gear body leaf (mounts at gearSubTab='sync' in the RED run, pre-wiring).
vi.mock('../components/group/GearSyncDashboard', () => ({ GearSyncDashboard: () => <div data-testid="legacy-gear-sync" /> }));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { ShellContent } from './NewShell';

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell — v2 Loot slot', () => {
  it('mounts the v2 <Loot/> as the gear slot and hides the legacy gear sub-tab chrome', () => {
    renderShell();

    // (a) v2 Loot mounts via the gear slot.
    expect(screen.getByTestId('v2-loot')).toBeInTheDocument();

    // (b) legacy gear sub-tab buttons gated off by the gear slot (Task 10).
    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument();
  });
});
