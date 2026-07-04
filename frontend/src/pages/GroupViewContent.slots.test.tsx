/**
 * GroupViewContent — post-surgery slots contract (flip-P3 Task 2, dead-tree
 * deletion in Task 4).
 *
 * Pins the v2-only contract after the legacy fallback bodies were deleted:
 *   1. `slots` is REQUIRED — each spine tab renders its slot, and no legacy
 *      leaf (StaticHomeTab, PlayerGrid, SplitClearPlanner, TeamSummaryEnhanced,
 *      HistoryView, ScheduleTab, … — all deleted in Task 4) renders anywhere.
 *      GearSyncDashboard/RosterCharacterPanel are KEPT files re-homed
 *      elsewhere; still mocked here so they stay out of this tab's tree.
 *   2. Slotless pageModes (goals / more / plugin) render their bodies
 *      unconditionally.
 *   3. The legacy sticky roster toolbar is gone (no roster sub-tab tablist),
 *      and no legacy data-fetching side effects fire (LogWeekWizard mount).
 *   4. Shared wiring survives: MobileBottomNav mounts, the GroupActions
 *      context still gates keyboard shortcuts, the added-player highlight
 *      signal is consumed one-shot.
 *
 * Heavy hooks/stores/leaf-components are mocked — the point is the contract,
 * not full integration. (Scaffold adapted from the deleted GroupViewContent.test.tsx.)
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: a controllable, fully-shaped useGroupViewState ──
const setPageMode = vi.fn();
let mockPageMode = 'overview';
const noop = vi.fn();
function makeState() {
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: mockPageMode,
    setPageMode,
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
// Switchable: the tier LIST stays non-empty (ShellContentStates branch-5 semantics)
// while the SNAPSHOT (currentTier) can be nulled to simulate the in-flight fetch.
let mockCurrentTier: typeof currentTier | null = currentTier;
vi.mock('../stores/tierStore', () => ({
  useTierStore: () => ({ currentTier: mockCurrentTier, tiers: [currentTier], isSaving: false, fetchTier: vi.fn() }),
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
const settingsPanelOpenSpy = vi.fn();
vi.mock('../stores/settingsPanelStore', () => ({
  useSettingsPanelStore: { getState: () => ({ open: settingsPanelOpenSpy, close: vi.fn() }) },
}));

// ── Hooks ──
const keyboardSpy = vi.fn();
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({
  useGroupViewKeyboardShortcuts: (_params: unknown, isAnyModalOpen: boolean) => keyboardSpy(isAnyModalOpen),
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

// ── GroupActions context: control modal-open + addedPlayer signal ──
let mockActionModalOpen = false;
let mockAddedPlayer: AddedPlayerSignal | null = null;
const clearAddedPlayerSpy = vi.fn();
vi.mock('./groupActionsContext', () => ({
  useGroupActionModalOpen: () => mockActionModalOpen,
  useGroupAddedPlayer: () => mockAddedPlayer,
  useGroupClearAddedPlayer: () => clearAddedPlayerSpy,
}));

// ── Legacy leaves: mocked with testids so their ABSENCE is assertable.
//    (RosterCharacterPanel and GearSyncDashboard are KEEP files — task 4 only
//    re-homed/left them in place, so they're still mocked here to keep them
//    out of this contract test's render tree.) ──
vi.mock('../components/roster/RosterCharacterPanel', () => ({
  RosterCharacterPanel: () => <div data-testid="legacy-character-panel" />,
}));
vi.mock('../components/group/GearSyncDashboard', () => ({
  GearSyncDashboard: () => <div data-testid="legacy-gear-sync" />,
}));
const logWeekWizardSpy = vi.fn();
vi.mock('../components/loot', () => ({
  LogWeekWizard: () => { logWeekWizardSpy(); return null; },
}));

// ── Slotless page bodies (kept, spec §4) ──
vi.mock('../components/group/GoalsPage', () => ({
  GoalsPage: () => <div data-testid="goals-page" />,
}));
vi.mock('../components/group/MorePage', () => ({
  MorePage: (props: { onOpenIntegrations: () => void; onOpenLootHistory: () => void }) => (
    <div data-testid="more-page">
      <button onClick={() => props.onOpenIntegrations()}>open-integrations</button>
      <button onClick={() => props.onOpenLootHistory()}>open-loot-history</button>
    </div>
  ),
}));
vi.mock('../components/group/PluginPage', () => ({
  PluginPage: () => <div data-testid="plugin-page" />,
}));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { GroupViewContent } from './GroupViewContent';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const slots = {
  overview: <div data-testid="s-o" />,
  roster: <div data-testid="s-r" />,
  gear: <div data-testid="s-g" />,
  schedule: <div data-testid="s-s" />,
};
const renderContent = () =>
  render(<MemoryRouter><GroupViewContent actions={actions} slots={slots} /></MemoryRouter>);

// Only the still-mocked KEEP leaves (RosterCharacterPanel/GearSyncDashboard,
// see lines ~126-131) can ever render here — every other legacy id's backing
// mock was deleted in Task 4, so checking for them would be a vacuous no-op.
const LEGACY_TESTIDS = ['legacy-character-panel', 'legacy-gear-sync'];
function expectNoLegacyLeaves() {
  for (const id of LEGACY_TESTIDS) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
}

describe('GroupViewContent — unconditional slots (post flip-P3 Task 2)', () => {
  beforeEach(() => {
    mockPageMode = 'overview';
    mockActionModalOpen = false;
    mockAddedPlayer = null;
    mockCurrentTier = currentTier;
    keyboardSpy.mockClear();
    clearAddedPlayerSpy.mockClear();
    logWeekWizardSpy.mockClear();
    settingsPanelOpenSpy.mockClear();
  });
  afterEach(() => { mockAddedPlayer = null; });

  // ── 1. Each spine tab renders its slot; no legacy leaf anywhere ──
  it.each([
    ['overview', 's-o'],
    ['roster', 's-r'],
    ['gear', 's-g'],
    ['schedule', 's-s'],
  ] as const)('pageMode %s renders its slot and no legacy leaves', (mode, testid) => {
    mockPageMode = mode;
    renderContent();
    expect(screen.getByTestId(testid)).toBeInTheDocument();
    expectNoLegacyLeaves();
    // No legacy gear sub-tab buttons or schedule view-switcher buttons.
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Summary' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upcoming' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Calendar' })).toBeNull();
    expect(screen.queryByText('Split Planner')).toBeNull();
  });

  // ── 1b. Tier snapshot still in flight → skeleton, never a blank pane ──
  it('renders a loading skeleton (not blank) while the tier snapshot fetch is in flight', () => {
    mockCurrentTier = null; // group loaded, tier list non-empty, snapshot pending
    renderContent();
    expect(screen.getByTestId('content-tier-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('s-o')).toBeNull();
  });

  // ── 2/3. Slotless pageModes render their bodies unconditionally ──
  it("pageMode 'goals' renders the GoalsPage body", () => {
    mockPageMode = 'goals';
    renderContent();
    expect(screen.getByTestId('goals-page')).toBeInTheDocument();
    expectNoLegacyLeaves();
  });

  it("pageMode 'more' renders the MorePage body", () => {
    mockPageMode = 'more';
    renderContent();
    expect(screen.getByTestId('more-page')).toBeInTheDocument();
  });

  // ── Integrations re-route (flip-P3 Task 4 fold-in): the More page's
  //    Integrations card must open the Settings panel directly on the
  //    integrations tab, not navigate to the deleted legacy schedule tab. ──
  it("wires MorePage's onOpenIntegrations to open the settings panel on the integrations tab", () => {
    mockPageMode = 'more';
    renderContent();
    screen.getByText('open-integrations').click();
    expect(settingsPanelOpenSpy).toHaveBeenCalledTimes(1);
    expect(settingsPanelOpenSpy).toHaveBeenCalledWith({ tab: 'integrations' });
    expect(setPageMode).not.toHaveBeenCalled();
  });

  // ── Loot History re-route (Bugbot finding, flip-P3): the More page's Loot
  //    History card must target `lview` — the URL param the v2 Loot screen
  //    actually reads (useUrlTabState('lview', ...)) — not the legacy
  //    gearSubTab, which v2 Loot never consumes. ──
  it("wires MorePage's onOpenLootHistory to setPageMode('gear', { lview: 'history' })", () => {
    mockPageMode = 'more';
    renderContent();
    screen.getByText('open-loot-history').click();
    expect(setPageMode).toHaveBeenCalledTimes(1);
    expect(setPageMode).toHaveBeenCalledWith('gear', { lview: 'history' });
  });

  it("pageMode 'plugin' renders the PluginPage body", () => {
    mockPageMode = 'plugin';
    renderContent();
    expect(screen.getByTestId('plugin-page')).toBeInTheDocument();
  });

  // ── 4. Legacy sticky roster toolbar is gone ──
  it('renders no roster sub-tab tablist on the roster tab', () => {
    mockPageMode = 'roster';
    renderContent();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  // ── Legacy side effects are gone ──
  it('never mounts the legacy LogWeekWizard', () => {
    mockPageMode = 'gear';
    renderContent();
    expect(logWeekWizardSpy).not.toHaveBeenCalled();
  });

  // ── Shared wiring survives ──
  it('mounts the MobileBottomNav', () => {
    renderContent();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('disables the content keyboard shortcuts when an action modal is open (from context)', () => {
    mockActionModalOpen = false;
    renderContent();
    expect(keyboardSpy).toHaveBeenLastCalledWith(false);
    keyboardSpy.mockClear();
    mockActionModalOpen = true;
    renderContent();
    expect(keyboardSpy).toHaveBeenLastCalledWith(true);
  });

  it('clears the addedPlayer signal immediately after consuming it (one-shot)', async () => {
    mockAddedPlayer = { playerId: 'p-new', nonce: 1 };
    renderContent();
    await waitFor(() => expect(clearAddedPlayerSpy).toHaveBeenCalledTimes(1));
  });
});
