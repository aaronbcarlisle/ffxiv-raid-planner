/**
 * NewShell — v2 Schedule slot integration (F6e Task 9).
 *
 * Locks that `ShellContent` mounts the real `<Schedule/>` as `GroupViewContent`'s
 * `schedule` slot at `pageMode='schedule'`, mirroring the F6b `overview` / F6c
 * `roster` / F6d `gear` slots. Renders the REAL chain ShellContent →
 * GroupViewContent → (mocked) Schedule and asserts:
 *   (a) the v2 Schedule screen mounts (the `schedule` slot is wired);
 *   (b) the legacy Upcoming|Calendar switcher chrome is ABSENT (the legacy
 *       schedule body — `ScheduleUpcomingPanel`/`ScheduleTab` — was deleted
 *       in flip-P3, so there is no fallback left to render).
 *
 * The mock surface mirrors `NewShell.gear.test.tsx` (real GroupViewContent at a
 * pinned pageMode, via the shared `./newShellTestScaffold` builders). `Schedule`
 * is stubbed — the point is the slot WIRING, not Schedule's internals (covered
 * by its own tests).
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// ── View state: pinned to the schedule tab ──
vi.mock('../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return { useGroupViewState: () => makeGroupViewStateMock({ pageMode: 'schedule' }) };
});

// ── Stores — dual-form (GroupViewContent reads whole object; ShellContent uses a selector). ──
vi.mock('../stores/tierStore', async () => {
  const { makeTierStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  const state = makeTierStoreState();
  return { useTierStore: dualFormStoreMock(state), useCurrentTier: () => state.currentTier };
});
vi.mock('../stores/staticGroupStore', async () => {
  const { makeStaticGroupStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useStaticGroupStore: dualFormStoreMock(makeStaticGroupStoreState()) };
});
vi.mock('../stores/authStore', async () => {
  const { makeAuthStoreState, dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useAuthStore: dualFormStoreMock(makeAuthStoreState()) };
});
vi.mock('../stores/viewAsStore', async () => {
  const { dualFormStoreMock } = await import('./newShellTestScaffold');
  return { useViewAsStore: dualFormStoreMock({ viewAsUser: null }) };
});
vi.mock('../stores/lootTrackingStore', async () => {
  const { dualFormStoreMock } = await import('./newShellTestScaffold');
  const state = {
    currentWeek: 1, maxWeek: 1, fetchCurrentWeek: vi.fn(), fetchLootLog: vi.fn(),
    lootLog: [] as unknown[], fetchMaterialLog: vi.fn(), materialLog: [] as unknown[],
  };
  return { useLootTrackingStore: dualFormStoreMock(state) };
});
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
// The overview/roster/gear slots are BUILT by ShellContent but never mounted at
// pageMode='schedule' — stub them so their dep trees stay out of the test.
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('../components/roster/Roster', () => ({ Roster: () => <div data-testid="roster" /> }));
vi.mock('../components/loot/Loot', () => ({ Loot: () => <div data-testid="v2-loot" /> }));
// The v2 schedule slot under test — assert it WIRES, not its internals.
vi.mock('../components/schedule/Schedule', () => ({ Schedule: () => <div data-testid="v2-schedule" /> }));
// Task 4: ShellContent now mounts AdminBanners/JoinRequestBanner above the
// schedule slot (not under test here). Stub both — the real JoinRequestBanner
// subscribes to the un-mocked joinRequestStore, which isn't set up for this test.
vi.mock('../components/admin/AdminBanners', () => ({ AdminBanners: () => null }));
vi.mock('../components/static-group/JoinRequestBanner', () => ({ JoinRequestBanner: () => null }));
vi.mock('../components/ui', async (orig) => {
  const actual = await orig<typeof import('../components/ui')>();
  return { ...actual, MobileBottomNav: () => <div data-testid="mobile-nav" /> };
});

import { ShellContent } from './NewShell';

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell — v2 Schedule slot', () => {
  it('mounts the v2 <Schedule/> as the schedule slot and hides the legacy switcher', () => {
    renderShell();
    expect(screen.getByTestId('v2-schedule')).toBeInTheDocument();
    // Legacy Upcoming|Calendar switcher + panels absent (the ?? fallback never renders):
    expect(screen.queryByRole('button', { name: 'Upcoming' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Calendar' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('legacy-upcoming')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legacy-schedule-tab')).not.toBeInTheDocument();
  });
});
