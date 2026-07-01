/**
 * GroupViewContent — canManageRoster gate regression test (Task 2 carry-fix).
 *
 * `GroupViewContent.tsx:1315` used `canManageRoster(userRole)` (a
 * `PermissionCheck` object — always truthy) directly in a boolean context to
 * gate the mobile "Controls Sheet" → Gear tab → Log sub-tab "Reset Data"
 * actions (Reset Loot Log / Reset Book Balances / Reset Everything). Every
 * OTHER call site in the file already reads `.allowed`; this one didn't, so a
 * non-manager ('member') wrongly saw destructive reset controls in the UI
 * (the backend still validated the actual request, but the affordance itself
 * was a UI bug).
 *
 * This test reaches the real branch — not a re-implemented predicate — by
 * rendering the full `GroupViewContent` with heavy stores/hooks mocked (same
 * shape as `GroupViewContent.test.tsx`), forcing mobile layout so the real
 * `MobileBottomNav` + `Modal` mount, clicking the real "Controls" button to
 * open the sheet, and asserting the "Reset Data" controls are present/absent
 * for 'owner' vs 'member'.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: pageMode/gearSubTab pinned to the gear→history branch ──
const noop = vi.fn();
function makeState() {
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: 'gear',
    setPageMode: noop,
    gearSubTab: 'history', setGearSubTab: noop,
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

// ── Stores — userRole is the axis under test (mutated per-test via a getter) ──
const currentTier = { id: 'snap1', tierId: 'm5s', contentType: 'savage', players: [] as unknown[] };
let mockUserRole: 'member' | 'owner' = 'member';
const currentGroup = {
  id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {},
  get userRole() { return mockUserRole; },
};
vi.mock('../stores/tierStore', () => ({
  useTierStore: () => ({ currentTier, tiers: [currentTier], isSaving: false, fetchTier: vi.fn() }),
}));
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({ currentGroup, groups: [currentGroup] }),
}));
vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', isAdmin: false } }) }));
vi.mock('../stores/viewAsStore', () => ({ useViewAsStore: () => ({ viewAsUser: null }) }));
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

// ── Hooks ──
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({
  useGroupViewKeyboardShortcuts: vi.fn(),
}));
vi.mock('../hooks/usePlayerActions', () => ({ usePlayerActions: () => ({ handleAddPlayer: vi.fn() }) }));
vi.mock('../components/dnd/useDragAndDrop', () => ({
  useDragAndDrop: () => ({ sensors: [], handleDragStart: vi.fn(), handleDragOver: vi.fn(), handleDragEnd: vi.fn(), handleDragCancel: vi.fn() }),
}));
// isSmallScreen: true — the real MobileBottomNav only renders on small screens,
// and the Controls Sheet auto-selects the 'sheet' Modal variant from it too.
// (MobileBottomNav and Modal are intentionally NOT mocked — the "Controls"
// button click must open the sheet through real component wiring so the
// canManageRoster branch renders exactly as shipped.)
vi.mock('../hooks/useDevice', () => ({ useDevice: () => ({ isSmallScreen: true }) }));
vi.mock('../hooks/useSwipe', () => ({ useSwipe: () => ({}) }));
vi.mock('../hooks/useViewNavigation', () => ({
  useViewNavigation: () => ({ handleNavigateToPlayer: vi.fn(), handleNavigateToLootEntry: vi.fn(), handleNavigateToMaterialEntry: vi.fn(), handleNavigateToBooksPanel: vi.fn() }),
}));
vi.mock('../hooks/useVisibilityRefresh', () => ({ useVisibilityRefresh: vi.fn() }));
vi.mock('../hooks/useUrlTabState', () => ({ useUrlTabState: (_k: string, _v: unknown, d: string) => [d, vi.fn()] }));
vi.mock('../lib/eventBus', () => ({
  useEventBus: vi.fn(),
  eventBus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) },
  Events: { MEMBER_ROLE_CHANGED: 'membership:role-changed', MOUNT_FARM_SCHEDULE: 'mount-farm:schedule' },
}));

// ── GroupActions context ──
vi.mock('./groupActionsContext', () => ({
  useGroupActionModalOpen: () => false,
  useGroupAddedPlayer: (): AddedPlayerSignal | null => null,
  useGroupClearAddedPlayer: () => vi.fn(),
}));

// ── Leaf bodies not relevant to this branch (kept out to avoid unrelated deps) ──
vi.mock('../components/static-group/StaticHomeTab', () => ({
  StaticHomeTab: () => <div data-testid="legacy-overview" />,
}));
vi.mock('../components/history/HistoryView', () => ({
  HistoryView: () => <div data-testid="history-view" />,
}));

import { GroupViewContent } from './GroupViewContent';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const renderAndOpenControlsSheet = () => {
  render(<MemoryRouter><GroupViewContent actions={actions} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /controls/i }));
};

describe('GroupViewContent — canManageRoster gate on gear-log Reset Data (mobile Controls Sheet)', () => {
  beforeEach(() => {
    mockUserRole = 'member';
  });

  it('hides Reset Data controls for a member (canManageRoster().allowed is false)', () => {
    mockUserRole = 'member';
    renderAndOpenControlsSheet();
    expect(screen.queryByText('Reset Data')).toBeNull();
    expect(screen.queryByText('Reset Loot Log')).toBeNull();
  });

  it('shows Reset Data controls for an owner (canManageRoster().allowed is true)', () => {
    mockUserRole = 'owner';
    renderAndOpenControlsSheet();
    expect(screen.getByText('Reset Data')).toBeInTheDocument();
    expect(screen.getByText('Reset Loot Log')).toBeInTheDocument();
  });
});
