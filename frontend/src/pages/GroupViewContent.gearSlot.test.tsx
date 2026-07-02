/**
 * GroupViewContent — gear-slot chrome-gating test (F6d Task 10).
 *
 * Locks the enabling refactor that lets the v2 `<Loot/>` own the entire gear
 * region via the `gear` slot: the legacy gear-only CHROME (the mobile controls
 * sheet's gear view selector — "Who Needs It" / "Gear Priority" / "Weapon
 * Priority" — and the gear reset actions — "Reset Loot Log") must NOT render when
 * a `gear` slot is supplied, otherwise the legacy sheet controls stack under the
 * v2 Loot screen.
 *
 * The body block already fallthroughs on `slots?.gear ?? <legacy>`
 * (`GroupViewContent.tsx:947`); this test guards the *chrome* and the body swap.
 * It renders the real `GroupViewContent` at `pageMode='gear'`:
 *   - LEGACY (no slots): the four gear sub-tab buttons (Log/Priority/Sync/Summary)
 *     render, and the mobile sheet's gear controls render (the `!slots?.gear`
 *     guards are no-ops because `slots` is undefined);
 *   - V2 (`slots.gear` provided): the slot renders, the legacy sub-tab bar is
 *     ABSENT, and the mobile sheet's gear controls are gated off.
 *
 * Same mock shape as `GroupViewContent.rosterSlot.test.tsx`; `gearSubTab` is
 * pinned to `history` so the reset-actions block (gated on `history` + manage)
 * is exercised. Heavy gear-body leaves are stubbed. The mobile controls sheet is
 * driven by a `MobileBottomNav` mock that surfaces its `onControlsClick`.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

// ── Mock the state hook: pageMode pinned to 'gear', gearSubTab 'history' ──
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

// ── Heavy gear-body leaves — the legacy gear body actually mounts at
//    pageMode='gear' (no slot), so stub them (their internals aren't under test). ──
vi.mock('../components/history/HistoryView', () => ({
  HistoryView: () => <div data-testid="legacy-history-view" />,
}));
vi.mock('../components/group/GearSyncDashboard', () => ({
  GearSyncDashboard: () => <div data-testid="legacy-gear-sync" />,
}));
vi.mock('../components/team/TeamSummaryEnhanced', () => ({
  TeamSummaryEnhanced: () => <div data-testid="legacy-team-summary" />,
}));
vi.mock('../components/loot', async (orig) => {
  const actual = await orig<typeof import('../components/loot')>();
  return {
    ...actual,
    LootPriorityPanel: () => <div data-testid="legacy-loot-priority" />,
    LogWeekWizard: () => null,
  };
});
// MobileBottomNav mock surfaces onControlsClick so a test can open the sheet.
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return {
    ...actual,
    MobileBottomNav: ({ onControlsClick }: { onControlsClick: () => void }) => (
      <button type="button" data-testid="open-controls" aria-label="Open controls" onClick={onControlsClick} />
    ),
  };
});

import { GroupViewContent } from './GroupViewContent';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const renderContent = (props: Partial<React.ComponentProps<typeof GroupViewContent>> = {}) =>
  render(<MemoryRouter><GroupViewContent actions={actions} {...props} /></MemoryRouter>);

describe('GroupViewContent — gear slot chrome gating', () => {
  it('LEGACY (no slots): renders the legacy gear sub-tab bar', () => {
    renderContent();
    // The four gear sub-tabs are the discriminator for the legacy gear body.
    expect(screen.getByRole('button', { name: 'Log' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priority' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summary' })).toBeInTheDocument();
  });

  it('V2 (slots.gear provided): renders the slot and hides the legacy gear sub-tabs', () => {
    renderContent({ slots: { gear: <div data-testid="gear-slot" /> } });
    expect(screen.getByTestId('gear-slot')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Summary' })).not.toBeInTheDocument();
  });

  it('LEGACY (no slots): the mobile controls sheet shows the gear view selector + reset actions', () => {
    renderContent();
    fireEvent.click(screen.getByTestId('open-controls'));
    expect(screen.getByRole('button', { name: 'Who Needs It' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gear Priority' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weapon Priority' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Loot Log/ })).toBeInTheDocument();
  });

  it('V2 (slots.gear provided): the mobile controls sheet hides the gear view selector + reset actions', () => {
    renderContent({ slots: { gear: <div data-testid="gear-slot" /> } });
    fireEvent.click(screen.getByTestId('open-controls'));
    expect(screen.queryByRole('button', { name: 'Who Needs It' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gear Priority' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weapon Priority' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset Loot Log/ })).not.toBeInTheDocument();
  });
});
