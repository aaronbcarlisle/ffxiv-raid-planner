/**
 * GroupViewContent — slot-contract test.
 *
 * Locks the F6a contract that lets NewShell (Task 4) and F6b–F6e reuse the
 * content region:
 *   - with no slot for the active tab, the legacy body renders;
 *   - with a slot for the active tab, the slot renders INSTEAD of the legacy body;
 *   - the GroupActions context's `isActionModalOpen` (read via
 *     `useGroupActionModalOpen`, replacing the Task-3 `chromeModalOpen` prop)
 *     disables the content keyboard shortcuts, so Task 8 keeps the byte-for-byte
 *     shortcut/DnD gating.
 *
 * Heavy hooks/stores/leaf-components are mocked — the point is the override
 * contract, not full integration.
 */
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: a controllable, fully-shaped useGroupViewState ──
const setPageMode = vi.fn();
let mockPageMode = 'overview';
const noop = vi.fn();
function useMockGroupViewState() {
  // The REAL hook sources these from react-router (`useGroupViewState.ts:157`),
  // and `GroupViewContent`'s `?player=`/`?slot=` deep-link effect both reads
  // and writes them. Delegating keeps that effect driveable from
  // `MemoryRouter`'s `initialEntries` and makes its 2500ms strip observable in
  // the location itself, rather than as a call recorded against a spy.
  // Every other test in this file renders at `/` with no params, where this is
  // indistinguishable from the fixed empty snapshot it replaces.
  const [searchParams, setSearchParams] = useSearchParams();
  return {
    searchParams,
    setSearchParams,
    pageMode: mockPageMode,
    setPageMode,
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
  useGroupViewState: () => useMockGroupViewState(),
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

// ── Leaf bodies: identify the legacy overview body ──
vi.mock('../components/static-group/StaticHomeTab', () => ({
  StaticHomeTab: () => <div data-testid="legacy-overview" />,
}));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { GroupViewContent } from './GroupViewContent';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };

/** Surfaces the live search string so a URL write is assertable. */
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-search={loc.search} />;
}

const renderContent = (
  props: Partial<React.ComponentProps<typeof GroupViewContent>> = {},
  initialEntries: string[] = ['/'],
) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <GroupViewContent actions={actions} {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );

describe('GroupViewContent — slot contract', () => {
  beforeEach(() => {
    mockPageMode = 'overview';
    mockActionModalOpen = false;
    mockAddedPlayer = null;
    keyboardSpy.mockClear();
    clearAddedPlayerSpy.mockClear();
  });
  afterEach(() => { mockAddedPlayer = null; });

  it('renders the legacy overview body when no slot is provided', () => {
    renderContent();
    expect(screen.getByTestId('legacy-overview')).toBeInTheDocument();
  });

  it('renders the slot instead of the legacy body when a slot is provided', () => {
    renderContent({ slots: { overview: <div data-testid="slot-overview" /> } });
    expect(screen.getByTestId('slot-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-overview')).toBeNull();
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
    // Provide a non-null signal — the highlight effect should call clearAddedPlayer
    // right away so a remount with no new add does NOT re-fire the highlight.
    mockAddedPlayer = { playerId: 'p-new', nonce: 1 };
    renderContent();
    await waitFor(() => expect(clearAddedPlayerSpy).toHaveBeenCalledTimes(1));
  });
});

// ── D12: the `?player=`/`?slot=` strip ───────────────────────────────────
// This effect is the SHARED file's only D12 hunk — both shells render it — and
// it had no coverage at all before D12: neither the deep-link resolution nor
// the 2500ms strip. `?slot=` rides with `?player=` on one timer because the v2
// `Roster` must not write the URL (two writers on one boundary race), so the
// delete has to be here, in the frozen shell's own effect. V1 writes no `slot`
// param anywhere, so on every legacy path it removes nothing.
describe('GroupViewContent — D12 the ?player=/?slot= strip', () => {
  let realScrollIntoView: typeof Element.prototype.scrollIntoView;

  beforeEach(() => {
    mockPageMode = 'overview';
    mockActionModalOpen = false;
    mockAddedPlayer = null;
    // The effect resolves `?player=` against the tier's OWN players and bails
    // when it finds none — the shared fixture ships an empty roster, so
    // without this seed the whole effect (and its strip) never runs.
    currentTier.players = [{ id: 'p1' }];
    // jsdom implements no scrollIntoView; the effect's 100ms card scroll calls
    // it as soon as the anchor exists.
    realScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    currentTier.players = [];
    Element.prototype.scrollIntoView = realScrollIntoView;
    vi.useRealTimers();
  });

  it('strips BOTH player and slot at 2500ms, leaving sibling params alone', () => {
    vi.useFakeTimers();
    renderContent({}, ['/group/G1?tab=roster&player=p1&slot=head&tier=T1']);

    // Still present before the timer — otherwise "stripped" proves nothing.
    expect(screen.getByTestId('loc').dataset.search).toContain('player=p1');
    expect(screen.getByTestId('loc').dataset.search).toContain('slot=head');

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    const search = screen.getByTestId('loc').dataset.search ?? '';
    expect(search).not.toContain('player=');
    expect(search).not.toContain('slot=');
    // The strip is targeted, not a reset: siblings survive it.
    expect(search).toContain('tier=T1');
    expect(search).toContain('tab=roster');
  });

  it('keeps both params for the whole 2500ms window', () => {
    vi.useFakeTimers();
    renderContent({}, ['/group/G1?tab=roster&player=p1&slot=head']);

    act(() => {
      vi.advanceTimersByTime(2499);
    });

    const search = screen.getByTestId('loc').dataset.search ?? '';
    expect(search).toContain('player=p1');
    expect(search).toContain('slot=head');
  });

  it('switches to the Roster tab and scrolls the card for a resolvable ?player=', () => {
    vi.useFakeTimers();
    const card = document.createElement('div');
    card.id = 'player-card-p1';
    document.body.appendChild(card);
    try {
      renderContent({}, ['/group/G1?tab=roster&player=p1&slot=head']);
      expect(setPageMode).toHaveBeenCalledWith('roster');

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(card.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    } finally {
      card.remove();
    }
  });

  it('does nothing at all when ?player= resolves to no one', () => {
    vi.useFakeTimers();
    renderContent({}, ['/group/G1?tab=roster&player=nobody&slot=head']);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // No resolution → no strip: the params are left exactly as they arrived.
    const search = screen.getByTestId('loc').dataset.search ?? '';
    expect(search).toContain('player=nobody');
    expect(search).toContain('slot=head');
  });
});
