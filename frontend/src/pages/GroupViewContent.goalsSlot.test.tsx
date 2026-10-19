/**
 * GroupViewContent — the `goals` slot (S2a-2·F1 TF2, R-S2-2 / R-S2-4).
 *
 * The goals branch is `slots?.goals ?? <legacy header + GoalsPage>`:
 *   - V2 passes `slots.goals` (the ProgressPage): the slot renders, and neither
 *     GoalsPage nor the old "Tracking" header does;
 *   - the legacy shell passes no slots: Goals & Farms renders as today;
 *   - a slots object without `goals` falls back to the same body, titled
 *     "Goals & Farms" — the old `slots ? 'Tracking'` arm is gone.
 *
 * New cases live here so `GroupViewContent.slots.test.tsx` and
 * `GroupViewContent.canManageRoster.test.tsx` stay unedited (vet M-2). Same mock
 * family as those files; GoalsPage is a testid stub.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { AddedPlayerSignal } from './groupActionsContext';

vi.mock('../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return { useGroupViewState: () => makeGroupViewStateMock({ pageMode: 'goals' }) };
});

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
vi.mock('../hooks/useGroupViewKeyboardShortcuts', () => ({ useGroupViewKeyboardShortcuts: vi.fn() }));
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

// ── The legacy goals body ──
vi.mock('../components/group/GoalsPage', () => ({
  GoalsPage: () => <div data-testid="goals-page" />,
}));
vi.mock('../components/loot', () => ({
  LootPriorityPanel: () => <div data-testid="legacy-loot-priority" />,
  LogWeekWizard: () => null,
}));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { GroupViewContent, type GroupViewContentProps } from './GroupViewContent';

const actions = { onTierChange: vi.fn(), onAddPlayer: vi.fn(), onNewTier: vi.fn(), onRollover: vi.fn(), onDeleteTier: vi.fn() };
const fourSlots = {
  overview: <div data-testid="s-o" />,
  roster: <div data-testid="s-r" />,
  gear: <div data-testid="s-g" />,
  schedule: <div data-testid="s-s" />,
};
const renderWith = (slots?: GroupViewContentProps['slots']) =>
  render(<MemoryRouter><GroupViewContent actions={actions} slots={slots} /></MemoryRouter>);

describe('GroupViewContent — the goals slot (S2a-2)', () => {
  it('V2: renders the goals slot, and no GoalsPage and no "Tracking" header', () => {
    renderWith({ ...fourSlots, goals: <div data-testid="s-p" /> });
    expect(screen.getByTestId('s-p')).toBeInTheDocument();
    expect(screen.queryByTestId('goals-page')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tracking' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Goals & Farms' })).toBeNull();
  });

  it('legacy (no slots): the Goals & Farms header and GoalsPage, as today', () => {
    renderWith(undefined);
    expect(screen.getByRole('heading', { name: 'Goals & Farms' })).toBeInTheDocument();
    expect(screen.getByTestId('goals-page')).toBeInTheDocument();
  });

  it('slots without goals fall back to the same body, titled "Goals & Farms", never "Tracking"', () => {
    renderWith(fourSlots);
    expect(screen.getByRole('heading', { name: 'Goals & Farms' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tracking' })).toBeNull();
    expect(screen.getByTestId('goals-page')).toBeInTheDocument();
  });
});
