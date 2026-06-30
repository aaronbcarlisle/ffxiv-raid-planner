/**
 * GroupViewContent — slot-contract test.
 *
 * Locks the F6a contract that lets NewShell (Task 4) and F6b–F6e reuse the
 * content region:
 *   - with no slot for the active tab, the legacy body renders;
 *   - with a slot for the active tab, the slot renders INSTEAD of the legacy body;
 *   - `chromeModalOpen` (the Task-3 bridge for chrome-owned modal state into the
 *     content's `isAnyModalOpen`) disables the content keyboard shortcuts, so
 *     Task 8 can't silently regress the byte-for-byte behavior.
 *
 * Heavy hooks/stores/leaf-components are mocked — the point is the override
 * contract, not full integration.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  Events: { MEMBER_ROLE_CHANGED: 'membership:role-changed', MOUNT_FARM_SCHEDULE: 'mount-farm:schedule', PLAYER_ADDED: 'player:added' },
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
const renderContent = (props: Partial<React.ComponentProps<typeof GroupViewContent>> = {}) =>
  render(<MemoryRouter><GroupViewContent actions={actions} {...props} /></MemoryRouter>);

describe('GroupViewContent — slot contract', () => {
  beforeEach(() => { mockPageMode = 'overview'; keyboardSpy.mockClear(); });

  it('renders the legacy overview body when no slot is provided', () => {
    renderContent();
    expect(screen.getByTestId('legacy-overview')).toBeInTheDocument();
  });

  it('renders the slot instead of the legacy body when a slot is provided', () => {
    renderContent({ slots: { overview: <div data-testid="slot-overview" /> } });
    expect(screen.getByTestId('slot-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-overview')).toBeNull();
  });

  it('disables the content keyboard shortcuts when chromeModalOpen is true', () => {
    renderContent({ chromeModalOpen: false });
    expect(keyboardSpy).toHaveBeenLastCalledWith(false);
    keyboardSpy.mockClear();
    renderContent({ chromeModalOpen: true });
    expect(keyboardSpy).toHaveBeenLastCalledWith(true);
  });
});
