/**
 * GroupViewContent — split-clear fetch slot gating (Phase A, A13a).
 *
 * The legacy split-clear fetch must fire on the roster tab ONLY when the
 * legacy roster body owns the region (no `slots.roster`). This suite clones
 * the mock scaffolding of `GroupViewContent.rosterSlot.test.tsx` — that suite
 * is part of the f45a241 byte-frozen restore set and must not be edited, so
 * the gating tests live here with a hoisted `splitClearStore` mock instead.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: pageMode pinned to 'roster' ──
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

// ── Stores ──
const currentTier = { id: 'snap1', tierId: 'm5s', contentType: 'savage', players: [] as unknown[] };
const currentGroup = { id: 'g1', name: 'Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner' };
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
// A13: hoisted to shared vi.fn()s so the gating tests below can assert call
// counts (the restored GroupViewContent suites keep their inline mocks).
const splitClearFetchData = vi.fn();
const splitClearClearData = vi.fn();
vi.mock('../stores/splitClearStore', () => ({
  useSplitClearStore: () => ({ fetchData: splitClearFetchData, clearData: splitClearClearData }),
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
vi.mock('../hooks/useDevice', () => ({ useDevice: () => ({ isSmallScreen: false }) }));
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

// ── Heavy roster body leaves — the legacy roster body actually mounts at
//    pageMode='roster', so stub them out (their internals aren't under test). ──
vi.mock('../components/player/PlayerGrid', () => ({
  PlayerGrid: () => <div data-testid="legacy-player-grid" />,
}));
vi.mock('../components/player/RosterDragOverlay', () => ({
  RosterDragOverlay: () => null,
}));
vi.mock('../components/roster/RosterCharacterPanel', () => ({
  RosterCharacterPanel: () => null,
}));
vi.mock('../components/split-clear/SplitClearPlanner', () => ({
  SplitClearPlanner: () => null,
}));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { GroupViewContent } from './GroupViewContent';
import { useVisibilityRefresh } from '../hooks/useVisibilityRefresh';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const renderContent = (props: Partial<React.ComponentProps<typeof GroupViewContent>> = {}) =>
  render(<MemoryRouter><GroupViewContent actions={actions} {...props} /></MemoryRouter>);

describe('GroupViewContent — split-clear fetch slot gating (A13)', () => {
  beforeEach(() => {
    splitClearFetchData.mockClear();
  });

  it('LEGACY (no slots): the roster tab fires the split-clear fetch', () => {
    renderContent();
    expect(splitClearFetchData).toHaveBeenCalledWith('g1');
  });

  it('V2 (slots.roster provided): the split-clear fetch does NOT fire', () => {
    renderContent({ slots: { roster: <div data-testid="v2-roster" /> } });
    expect(splitClearFetchData).not.toHaveBeenCalled();
  });

  it('visibility refresh honors the same gate (legacy fires, v2 does not)', () => {
    renderContent();
    const legacyRefresh = vi.mocked(useVisibilityRefresh).mock.calls.at(-1)![0];
    splitClearFetchData.mockClear();
    legacyRefresh();
    expect(splitClearFetchData).toHaveBeenCalledWith('g1');

    renderContent({ slots: { roster: <div data-testid="v2-roster" /> } });
    const v2Refresh = vi.mocked(useVisibilityRefresh).mock.calls.at(-1)![0];
    splitClearFetchData.mockClear();
    v2Refresh();
    expect(splitClearFetchData).not.toHaveBeenCalled();
  });
});
