/**
 * GroupViewContent — roster-slot chrome-gating test (F6c Task 3).
 *
 * Locks the enabling refactor that lets a future v2 `<Roster/>` own the entire
 * roster region via the `roster` slot: the legacy roster-only CHROME (the sticky
 * sub-tab toolbar, the mobile density FAB, and the roster block of the mobile
 * controls sheet) must NOT render when a `roster` slot is supplied — otherwise the
 * legacy sticky toolbar stacks above the v2 Roster.
 *
 * The body block already fallthroughs on `slots?.roster ?? <legacy>`
 * (`GroupViewContent.tsx:907`); this test guards the *chrome*. It renders the real
 * `GroupViewContent` at `pageMode='roster'` twice:
 *   - LEGACY (no slots): the sticky roster sub-tabs `role="tablist"`
 *     `aria-label="Roster view"` are present (byte-for-byte legacy render — the
 *     guard `!slots?.roster` is a no-op because `slots` is undefined);
 *   - V2 (`slots.roster` provided): the slot renders and the legacy tablist is
 *     ABSENT (the guard hides the chrome so the slot owns the region).
 *
 * Same mock shape as `GroupViewContent.test.tsx`; the heavy roster body leaves
 * (PlayerGrid / RosterDragOverlay / RosterCharacterPanel / SplitClearPlanner) are
 * stubbed since the legacy roster body actually mounts at `pageMode='roster'` —
 * the point is the chrome-gating contract, not full roster integration.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
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

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const renderContent = (props: Partial<React.ComponentProps<typeof GroupViewContent>> = {}) =>
  render(<MemoryRouter><GroupViewContent actions={actions} {...props} /></MemoryRouter>);

describe('GroupViewContent — roster slot chrome gating', () => {
  it('LEGACY (no slots): renders the legacy roster sticky toolbar sub-tabs', () => {
    renderContent();
    expect(screen.getByRole('tablist', { name: /Roster view/i })).toBeInTheDocument();
  });

  it('V2 (slots.roster provided): renders the slot and hides the legacy roster chrome', () => {
    renderContent({ slots: { roster: <div data-testid="v2-roster" /> } });
    expect(screen.getByTestId('v2-roster')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /Roster view/i })).not.toBeInTheDocument();
  });
});
