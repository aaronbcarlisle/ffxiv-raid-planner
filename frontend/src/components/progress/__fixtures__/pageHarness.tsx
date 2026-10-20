/**
 * The ProgressPage test harness (S2a-3a·G5b, lifted from the three page tests that each kept a
 * copy: `.rowMenu`, `.edit` and `.track`): one static with two claimed players, the store seeded
 * with spies in place of its fetches and writes, the page under a MemoryRouter whose location a
 * probe reports, and the row/panel/menu lookups the tests share. `updateGoal` and `deleteGoal`
 * are fakes that edit the seeded goals the way the real actions do (their requests are
 * `FarmRowMenu.test.tsx`'s and `FarmEditBlock.test.tsx`'s).
 *
 * Each test file keeps its own `vi.mock('../../services/api', …)` (hoisted per file) and calls
 * `setUpPage()` from `beforeEach` and `tearDownPage()` from `afterEach`.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../../stores/collectionGoalStore';
import { useToastStore } from '../../../stores/toastStore';
import type { StaticGroup, TierSnapshot } from '../../../types';
import { ProgressPage } from '../ProgressPage';
import { LocationProbe } from './LocationProbe';
import { goal, row } from './progressFixtures';
import { stubCanHover, TooltipWrapper } from './tooltipEnv';

const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [] } as unknown as StaticGroup;
export const otherGroup = { ...group, id: 'g2', name: 'Other Static', shareCode: 'OTHER1' } as unknown as StaticGroup;

const player = (id: string, name: string, position: string, role: string, userId: string | null) => ({
  id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [],
});
const tier = {
  id: 't1',
  staticGroupId: 'g1',
  tierId: 'aac-cruiserweight',
  players: [player('p1', 'Aya', 'T1', 'tank', 'u1'), player('p2', 'Bo', 'H1', 'healer', 'u2')],
} as unknown as TierSnapshot;

export const fetchGoals = vi.fn();
export const fetchProgress = vi.fn();
export const refreshGoalProgress = vi.fn();
export const updateGoal = vi.fn();
export const deleteGoal = vi.fn();

/** `hot` is needed by both players and `calm` wanted by one; in EVERYONE both have `hot`. */
export const NEEDY: Record<string, ParticipantStateEntry[]> = { hot: [row('hot', 'u1'), row('hot', 'u2')], calm: [row('calm', 'u1', { state: 'want' })] };
export const EVERYONE: Record<string, ParticipantStateEntry[]> = { hot: [row('hot', 'u1', { state: 'have' }), row('hot', 'u2', { state: 'have' })], calm: NEEDY.calm };

export const DEFAULT_GOALS = [goal('hot', { title: 'Hot Farm' }), goal('calm', { title: 'Calm Farm' })];

const real = useCollectionGoalStore.getState();

/**
 * Seeds the store. `ready: false` leaves the goals unloaded (a deep link before the data);
 * `writes: false` keeps the store's own `refreshGoalProgress`, `updateGoal` and `deleteGoal` (the
 * tests that run a real write over the mocked `api`).
 */
export function seedPage(
  participants: Record<string, ParticipantStateEntry[]> = NEEDY,
  goals: CollectionGoal[] = DEFAULT_GOALS,
  { ready = true, writes = true }: { ready?: boolean; writes?: boolean } = {},
) {
  useCollectionGoalStore.setState({
    goals,
    participants,
    recordOnly: {},
    loadedGroupId: ready ? 'g1' : null,
    isLoading: false,
    progressError: null,
    progressLoading: false,
    error: null,
    fetchGoals,
    fetchProgress,
    ...(writes ? { refreshGoalProgress, updateGoal, deleteGoal } : {}),
  });
}

/** Call from `beforeEach`. Leaves `Element.prototype.scrollIntoView` to the file (jsdom has none). */
export function setUpPage() {
  vi.clearAllMocks();
  stubCanHover();
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  refreshGoalProgress.mockResolvedValue(undefined);
  updateGoal.mockImplementation(async (_groupId: string, id: string, data: Partial<CollectionGoal>) => {
    useCollectionGoalStore.setState((s) => ({
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, ...data, completedAt: data.status === 'complete' ? '2026-10-10T00:00:00Z' : null } : g,
      ),
    }));
  });
  deleteGoal.mockImplementation(async (_groupId: string, id: string) => {
    useCollectionGoalStore.setState((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  });
  useToastStore.getState().clearAll();
}

/** Call from `afterEach`. */
export function tearDownPage() {
  useCollectionGoalStore.setState({
    fetchGoals: real.fetchGoals,
    fetchProgress: real.fetchProgress,
    refreshGoalProgress: real.refreshGoalProgress,
    updateGoal: real.updateGoal,
    deleteGoal: real.deleteGoal,
    goals: [],
    participants: {},
    drops: {},
    loadedGroupId: null,
  });
  document.body.removeAttribute('style');
}

type PageProps = Partial<Parameters<typeof ProgressPage>[0]>;

function page(props: PageProps) {
  return (
    <ProgressPage
      group={group}
      tier={tier}
      canManage={true}
      userRole="owner"
      currentUserId="u1"
      isViewingAs={false}
      onNavigate={vi.fn()}
      {...props}
    />
  );
}

/** `extra` renders beside the page inside the router (a test's own navigation control). */
export function renderAt(url: string, props: PageProps = {}, extra: ReactNode = null) {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      {page(props)}
      <LocationProbe />
      {extra}
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
  const rerender = (next: PageProps) =>
    view.rerender(
      <MemoryRouter initialEntries={[url]}>
        {page(next)}
        <LocationProbe />
        {extra}
      </MemoryRouter>,
    );
  return { rerender };
}

export const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
export const trackOf = () => search().get('track');
export const actionOf = () => screen.getByTestId('location').getAttribute('data-action');
export const rowOf = (id: string) => screen.getAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === id)!;
/** The matrix once its farm rows are in: since S2a-3b·H3 the matrix (its tier row) shows while farms load. */
export async function loadedMatrix(): Promise<HTMLElement> {
  await screen.findAllByTestId('progress-farm-row');
  return screen.getByTestId('progress-matrix');
}
export const nameOf = (id: string) => within(within(rowOf(id)).getByRole('rowheader')).getByRole('button');
export const panel = () => screen.queryByTestId('progress-expansion');
export const inFinished = (el: HTMLElement | null) => el !== null && el.closest('[data-testid="progress-finished"]') !== null;
export const menuOf = (title: string) => screen.getByRole('button', { name: `Actions for ${title}` });
export const pick = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }));
