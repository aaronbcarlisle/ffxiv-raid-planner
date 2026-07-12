/**
 * GroupViewContent — v2 (all-slots) contract in the dual shell (Phase R).
 *
 * `slots` is OPTIONAL again (f45a241 contract, restored in Phase R): the legacy
 * route renders GroupViewContent with no slots → the restored legacy bodies
 * (pinned by the GroupViewContent.test.tsx / *.rosterSlot / *.gearSlot /
 * *.canManageRoster characterization suites). THIS suite pins the other half:
 * with all four slots passed (how NewShell always renders it), v2 output is
 * unchanged from flip-P3:
 *   1. Each spine tab renders its slot, and no legacy leaf or legacy chrome
 *      (gear sub-tab bar, schedule view switcher, roster sticky toolbar)
 *      renders anywhere — every legacy region is gated on its slot's absence.
 *      GearSyncDashboard/RosterCharacterPanel are mocked with testids so their
 *      absence is assertable.
 *   2. Slotless pageModes (goals / more / plugin) render their bodies
 *      unconditionally.
 *   3. Shared wiring survives: MobileBottomNav mounts, the GroupActions
 *      context still gates keyboard shortcuts, the added-player highlight
 *      signal is consumed one-shot.
 *
 * A second describe at the bottom pins the legacy (slotless) More-page wiring
 * — the `!slots?.roster` / `slots?.gear` shell-branch gates themselves, which
 * no render-output assertion above can catch if inverted.
 *
 * Heavy hooks/stores/leaf-components are mocked — the point is the contract,
 * not full integration. (Same scaffold family as GroupViewContent.test.tsx.)
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: a controllable, fully-shaped useGroupViewState ──
const setPageMode = vi.fn();
// Dedicated spy (not the shared noop) so the legacy loot-history shell branch
// below can assert setGearSubTab('history') specifically.
const setGearSubTab = vi.fn();
let mockPageMode = 'overview';
const noop = vi.fn();
function makeState() {
  return {
    searchParams: new URLSearchParams(),
    setSearchParams: noop,
    pageMode: mockPageMode,
    setPageMode,
    gearSubTab: 'sync', setGearSubTab,
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
vi.mock('../stores/splitClearStore', () => ({
  useSplitClearStore: () => ({ fetchData: vi.fn(), clearData: vi.fn() }),
}));
const settingsPanelOpenSpy = vi.fn();
vi.mock('../stores/settingsPanelStore', () => ({
  useSettingsPanelStore: { getState: () => ({ open: settingsPanelOpenSpy, close: vi.fn() }) },
}));

// ── Hooks ──
const keyboardSpy = vi.fn();
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({
  useGroupViewKeyboardShortcuts: (_params: unknown, isAnyModalOpen: boolean) => keyboardSpy(isAnyModalOpen),
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

// ── GroupActions context: control modal-open + addedPlayer signal ──
let mockActionModalOpen = false;
let mockAddedPlayer: AddedPlayerSignal | null = null;
const clearAddedPlayerSpy = vi.fn();
vi.mock('./groupActionsContext', () => ({
  useGroupActionModalOpen: () => mockActionModalOpen,
  useGroupAddedPlayer: () => mockAddedPlayer,
  useGroupClearAddedPlayer: () => clearAddedPlayerSpy,
}));

// ── Legacy leaves: mocked with testids so their ABSENCE is assertable. ──
vi.mock('../components/roster/RosterCharacterPanel', () => ({
  RosterCharacterPanel: () => <div data-testid="legacy-character-panel" />,
}));
vi.mock('../components/group/GearSyncDashboard', () => ({
  GearSyncDashboard: () => <div data-testid="legacy-gear-sync" />,
}));
// The restored GroupViewContent imports both from the loot barrel; neither
// mounts here (all slots passed + the fixture tierId resolves no tierInfo).
vi.mock('../components/loot', () => ({
  LootPriorityPanel: () => <div data-testid="legacy-loot-priority" />,
  LogWeekWizard: () => null,
}));

// ── Slotless page bodies (kept, spec §4) ──
vi.mock('../components/group/GoalsPage', () => ({
  GoalsPage: () => <div data-testid="goals-page" />,
}));
// Capture mock: surfaces the handlers as buttons, and renders the
// split-planner button ONLY when the optional prop is passed — so the
// shell-branch tests below can assert the prop's presence/absence AND
// invoke the handler GroupViewContent wired.
vi.mock('../components/group/MorePage', () => ({
  MorePage: (props: {
    onOpenIntegrations: () => void;
    onOpenLootHistory: () => void;
    onOpenSplitPlanner?: () => void;
  }) => (
    <div data-testid="more-page">
      <button onClick={() => props.onOpenIntegrations()}>open-integrations</button>
      <button onClick={() => props.onOpenLootHistory()}>open-loot-history</button>
      {props.onOpenSplitPlanner && (
        <button onClick={props.onOpenSplitPlanner}>open-split-planner</button>
      )}
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

// Only the mocked leaves (RosterCharacterPanel/GearSyncDashboard/
// LootPriorityPanel) carry assertable testids — the other restored legacy
// leaves are real components here, and none should mount with slots passed.
const LEGACY_TESTIDS = ['legacy-character-panel', 'legacy-gear-sync', 'legacy-loot-priority'];
function expectNoLegacyLeaves() {
  for (const id of LEGACY_TESTIDS) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
}

describe('GroupViewContent — v2 all-slots contract (dual shell, Phase R)', () => {
  beforeEach(() => {
    mockPageMode = 'overview';
    mockActionModalOpen = false;
    mockAddedPlayer = null;
    mockCurrentTier = currentTier;
    keyboardSpy.mockClear();
    clearAddedPlayerSpy.mockClear();
    setPageMode.mockClear();
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

  // ── Split Planner prop gate, v2 half: with a roster slot present, MorePage
  //    must NOT receive onOpenSplitPlanner (the capture mock only renders the
  //    button when the prop is passed). The legacy half is pinned below. ──
  it('does NOT pass onOpenSplitPlanner to MorePage when slots are present', () => {
    mockPageMode = 'more';
    renderContent();
    expect(screen.queryByText('open-split-planner')).toBeNull();
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

  // ── 4. Legacy sticky roster toolbar is gated off by the roster slot ──
  it('renders no roster sub-tab tablist on the roster tab', () => {
    mockPageMode = 'roster';
    renderContent();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
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

// ── Legacy (slotless) More-page wiring — the other half of the Phase R shell
//    branch. GroupViewContent owns two gates on the More page:
//      · `!slots?.roster` → passes onOpenSplitPlanner (Split Planner card);
//      · `slots?.gear` → v2 lview form vs legacy setGearSubTab('history').
//    An inverted gate would pass every render-output test above (the capture
//    mock renders either way), so these pin the wiring itself: which handlers
//    MorePage receives with NO slots, and which setters they call. ──
describe('GroupViewContent — legacy (slotless) More-page wiring (Phase R)', () => {
  beforeEach(() => {
    mockPageMode = 'more';
    mockActionModalOpen = false;
    mockAddedPlayer = null;
    mockCurrentTier = currentTier;
    setPageMode.mockClear();
    setGearSubTab.mockClear();
    settingsPanelOpenSpy.mockClear();
  });

  const renderSlotless = () =>
    render(<MemoryRouter><GroupViewContent actions={actions} /></MemoryRouter>);

  it('passes onOpenSplitPlanner to MorePage and wires it to the roster Split Planner sub-tab (one history entry)', () => {
    renderSlotless();
    // Prop present → the capture mock renders its button; invoking the handler
    // must switch to Roster with the split-planner sub-tab in the same entry.
    screen.getByText('open-split-planner').click();
    expect(setPageMode).toHaveBeenCalledTimes(1);
    expect(setPageMode).toHaveBeenCalledWith('roster', { rsub: 'split-planner' });
  });

  it("wires onOpenLootHistory to the legacy gear History sub-tab (setGearSubTab('history') + setPageMode('gear')), not the v2 lview form", () => {
    renderSlotless();
    screen.getByText('open-loot-history').click();
    expect(setGearSubTab).toHaveBeenCalledTimes(1);
    expect(setGearSubTab).toHaveBeenCalledWith('history');
    expect(setPageMode).toHaveBeenCalledTimes(1);
    // Exactly one argument — the lview extra-params form belongs to v2 only.
    expect(setPageMode).toHaveBeenCalledWith('gear');
  });
});
