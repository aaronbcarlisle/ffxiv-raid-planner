/**
 * ProgressPage with the matrix (S2a-2·F3 Task TF5): what the page fetches and when,
 * its loading / error states, and the DOM order of tier row, farm rows and Finished.
 * The store's goals and cells are seeded directly and its two fetches are replaced by
 * spies, so the calls are the assertions; `ProgressPage.test.tsx` (F1) stays as it was.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn().mockResolvedValue([]),
      post: vi.fn().mockResolvedValue({}),
      put: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

import { api } from '../../services/api';
import {
  useCollectionGoalStore,
  type CollectionGoal,
  type ParticipantStateEntry,
} from '../../stores/collectionGoalStore';
import type { StaticGroup, TierSnapshot } from '../../types';
import { goal, row } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressPage } from './ProgressPage';

const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [] } as unknown as StaticGroup;

const player = (id: string, name: string, position: string, role: string, userId: string | null) => ({
  id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId,
});
const tier = {
  id: 't1',
  staticGroupId: 'g1',
  tierId: 'aac-cruiserweight',
  players: [
    player('p1', 'Aya', 'T1', 'tank', 'u1'),
    player('p2', 'Bo', 'H1', 'healer', 'u2'),
    player('p3', 'Cy', 'M1', 'melee', 'u3'),
    player('p4', 'Dee', 'R1', 'caster', 'u4'),
    player('p5', 'Eli', 'M2', 'melee', 'u5'),
    player('p6', 'Fay', 'H2', 'healer', 'u6'),
  ],
} as unknown as TierSnapshot;
const USERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();

interface Seed {
  goals?: CollectionGoal[];
  participants?: Record<string, ParticipantStateEntry[]>;
  ready?: boolean;
  progressError?: string | null;
  goalsError?: string | null;
}

function seed(s: Seed = {}) {
  useCollectionGoalStore.setState({
    goals: s.goals ?? [],
    participants: s.participants ?? {},
    recordOnly: {},
    loadedGroupId: s.ready === false ? null : 'g1',
    progressError: s.progressError ?? null,
    progressLoading: false,
    error: s.goalsError ?? null,
    fetchGoals,
    fetchProgress,
  });
}

function renderPage(props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
  return render(
    <MemoryRouter>
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
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
}

const farmIds = () => screen.queryAllByTestId('progress-farm-row').map((r) => r.getAttribute('data-goal-id'));
const rowOf = (id: string) => screen.getAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllGlobals());

describe('ProgressPage matrix: order and Finished', () => {
  const goals = [
    goal('calm', { title: 'Calm Farm' }),
    goal('hot', { title: 'Hot Farm', status: 'scheduled' }),
    goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
  ];
  const participants = {
    hot: [row('hot', 'u1'), row('hot', 'u2')],
    calm: [row('calm', 'u1', { state: 'want' })],
    done: [row('done', 'u1', { state: 'have' })],
  };

  it('stacks the tier row, the farm rows in need order, then a collapsed "Finished (1)"', async () => {
    seed({ goals, participants });
    renderPage();

    expect(await screen.findByTestId('progress-matrix')).toBeInTheDocument();
    const tierRow = screen.getByTestId('progress-tier-row');
    const matrix = screen.getByTestId('progress-matrix');
    expect(tierRow.compareDocumentPosition(matrix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(farmIds()).toEqual(['hot', 'calm']);
    const finished = screen.getByRole('button', { name: 'Finished (1)' });
    expect(finished).toHaveAttribute('aria-expanded', 'false');
    expect(rowOf('calm').compareDocumentPosition(finished) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Done Farm/)).not.toBeInTheDocument();
  });

  it('fetches the finished goal\'s cells on expand and shows its row, read-only', async () => {
    seed({ goals, participants });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Finished (1)' }));

    expect(fetchProgress).toHaveBeenCalledWith('g1', ['done']);
    expect(await screen.findByText('Done Farm · Mount')).toBeInTheDocument();
    expect(within(rowOf('done')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finished (1)' })).toHaveAttribute('aria-expanded', 'true');
    // The second expand is not a second fetch.
    const calls = fetchProgress.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    expect(fetchProgress.mock.calls).toHaveLength(calls);
  });

  it('asks for 51 finished goals in requests of 50 and 1 (the route 422s above 50)', async () => {
    const finished = Array.from({ length: 51 }, (_, i) =>
      goal(`f${String(i).padStart(2, '0')}`, { status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
    );
    seed({ goals: [goal('calm'), ...finished] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Finished (51)' }));

    const finishedCalls = fetchProgress.mock.calls.filter((c) => Array.isArray(c[1]));
    expect(finishedCalls.map((c) => (c[1] as string[]).length)).toEqual([50, 1]);
    expect(finishedCalls.flatMap((c) => c[1] as string[]).sort()).toEqual(finished.map((g) => g.id));
  });

  it('builds the columns from the active goals only: an off-roster holder of a finished goal adds none (TF5 ruling 2)', async () => {
    seed({
      goals,
      participants: { ...participants, done: [row('done', 'u1', { state: 'have' }), row('done', 'u-ghost', { displayName: 'Ghost', state: 'have' })] },
    });
    renderPage();
    // Farm, Status and the six players: the finished goal's holder is already in the store.
    expect(await screen.findAllByRole('columnheader')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    await screen.findByText('Done Farm · Mount');
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.queryByText('Ghost')).not.toBeInTheDocument();
  });

  it('keeps Finished open, and the matrix mounted, when the active goals change', async () => {
    seed({ goals, participants });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Finished (1)' }));
    await screen.findByText('Done Farm · Mount');
    const matrix = screen.getByTestId('progress-matrix');

    await act(async () => {
      useCollectionGoalStore.setState({ goals: [...goals, goal('fresh', { title: 'Fresh Farm' })] });
    });

    expect(screen.getByTestId('progress-matrix')).toBe(matrix);
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finished (1)' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Done Farm · Mount')).toBeInTheDocument();
    expect(farmIds()).toContain('fresh');
  });

  it('shows a finished-fetch failure on its own line and keeps the active rows (TF5 review)', async () => {
    seed({ goals, participants });
    renderPage();
    await screen.findByTestId('progress-matrix');
    fetchProgress.mockImplementation(async (_group: string, ids?: string[]) => {
      // The real store writes its one shared slot too; the page must read its own call's result.
      if (ids) useCollectionGoalStore.setState({ progressError: 'boom' });
      return { error: ids ? 'boom' : null };
    });

    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    const alert = await screen.findByTestId('progress-finished-error');
    expect(alert).toHaveTextContent('boom');
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
    expect(farmIds()).toEqual(['hot', 'calm']);

    fetchProgress.mockClear();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(fetchProgress).toHaveBeenCalledWith('g1', ['done']);
  });
});

describe('ProgressPage matrix: status and counts by role', () => {
  const goals = [goal('wings', { title: 'Wings of Resolve' })];
  const haveAll = { wings: USERS.map((u) => row('wings', u, { state: 'have' })) };
  const twoOfSix = { wings: [row('wings', 'u1', { state: 'have' }), row('wings', 'u2', { state: 'have' }), row('wings', 'u3', { state: 'need' })] };

  it('reads "2 of 6 have it"', async () => {
    seed({ goals, participants: twoOfSix });
    renderPage();
    expect(await screen.findByText('2 of 6 have it')).toBeInTheDocument();
  });

  it('tells a lead "Everyone has it" at n = m', async () => {
    seed({ goals, participants: haveAll });
    renderPage({ userRole: 'lead', canManage: true });
    expect(await screen.findByText('Everyone has it')).toBeInTheDocument();
  });

  it('tells a member "6 of 6 have it" at n = m', async () => {
    seed({ goals, participants: haveAll });
    renderPage({ userRole: 'member', canManage: false });
    expect(await screen.findByText('6 of 6 have it')).toBeInTheDocument();
    expect(screen.queryByText('Everyone has it')).not.toBeInTheDocument();
  });

  it('shows a viewer states with no count anywhere, their own cell included', async () => {
    seed({
      goals,
      participants: { wings: [row('wings', 'u2', { state: 'need', tokenCount: 62 }), row('wings', 'u3', { state: 'want', tokenCount: 30 })] },
    });
    renderPage({ userRole: 'viewer', canManage: false, currentUserId: 'u2' });
    const matrix = await screen.findByTestId('progress-matrix');
    expect(within(matrix).getByText('Need')).toBeInTheDocument();
    expect(matrix.textContent).not.toMatch(/62|30|\d+\/\d+/);
  });

  it('shows a member the counts on Need and Want', async () => {
    seed({ goals, participants: { wings: [row('wings', 'u2', { state: 'need', tokenCount: 62 })] } });
    renderPage({ userRole: 'member', canManage: false });
    expect(await screen.findByText('Need 62/99')).toBeInTheDocument();
  });
});

describe('ProgressPage matrix: fetching (R-S2-17, vet M-8)', () => {
  const goals = [goal('a'), goal('b')];

  it('loads the goals and the active cells on mount', async () => {
    seed({ goals, participants: { a: [row('a', 'u1')] } });
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(fetchGoals).toHaveBeenCalledWith('g1');
    expect(fetchProgress).toHaveBeenCalledTimes(1);
    expect(fetchProgress).toHaveBeenCalledWith('g1');
  });

  it('refetches progress once when a goal is added to the store', async () => {
    seed({ goals });
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(fetchProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      useCollectionGoalStore.setState({ goals: [...goals, goal('c')] });
    });
    await screen.findByTestId('progress-matrix');
    expect(fetchProgress).toHaveBeenCalledTimes(2);
  });

  it('refetches nothing when the goals come back as a new array with the same ids', async () => {
    seed({ goals });
    renderPage();
    await screen.findByTestId('progress-matrix');

    await act(async () => {
      useCollectionGoalStore.setState({ goals: goals.map((g) => ({ ...g, title: `${g.title}!` })).reverse() });
    });
    await act(async () => {
      useCollectionGoalStore.setState({ goals: [...useCollectionGoalStore.getState().goals] });
    });
    expect(fetchProgress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('progress-farm-row')).toHaveLength(2);
  });

  it('refetches once when a goal finishes, because the active set changed', async () => {
    seed({ goals });
    renderPage();
    await screen.findByTestId('progress-matrix');
    await act(async () => {
      useCollectionGoalStore.setState({ goals: [goals[0], { ...goals[1], status: 'complete' }] });
    });
    await screen.findByTestId('progress-matrix');
    expect(fetchProgress).toHaveBeenCalledTimes(2);
  });

  it('ignores another static\'s goals', async () => {
    seed({ goals: [goal('a'), goal('other', { staticGroupId: 'g2' })] });
    renderPage();
    await screen.findByTestId('progress-matrix');
    expect(farmIds()).toEqual(['a']);
  });

  it('fires no goals or progress request for a viewer with no role (R-S2-19)', () => {
    seed({ goals });
    renderPage({ userRole: null, canManage: false });
    expect(screen.getByTestId('members-only-card')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-matrix')).not.toBeInTheDocument();
    expect(fetchGoals).not.toHaveBeenCalled();
    expect(fetchProgress).not.toHaveBeenCalled();
    const requested = [api.get, api.post, api.put, api.patch, api.delete].flatMap((fn) =>
      (fn as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])),
    );
    expect(requested.filter((url) => url.includes('/collection-'))).toEqual([]);
  });

  it('shows no empty state for a static with no farms', async () => {
    seed({ goals: [] });
    renderPage();
    expect(await screen.findByTestId('progress-tier-row')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-matrix')).not.toBeInTheDocument();
    expect(fetchProgress).not.toHaveBeenCalled();
  });
});

describe('ProgressPage matrix: loading and error (TF5 ruling 3)', () => {
  const goals = [goal('wings')];
  const participants = { wings: USERS.map((u) => row('wings', u, { state: 'have' })) };

  it('shows no tally and no cell until the first fetch settles', async () => {
    let settle: () => void = () => {};
    fetchProgress.mockReturnValue(new Promise((resolve) => { settle = () => resolve({ error: null }); }));
    seed({ goals, participants });
    renderPage();

    expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
    expect(screen.queryByText(/ of \d+ have it|Everyone has it/)).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('progress-cell')).toHaveLength(0);

    await act(async () => settle());
    expect(await screen.findByText('Everyone has it')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
  });

  it('waits for the goals too, and shows no tally meanwhile', () => {
    seed({ goals, participants, ready: false });
    renderPage();
    expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-matrix')).not.toBeInTheDocument();
  });

  it('shows the error with a Retry that fetches again', async () => {
    fetchProgress.mockResolvedValueOnce({ error: 'boom' });
    seed({ goals, participants });
    renderPage();

    const alert = await screen.findByTestId('progress-error');
    expect(alert).toHaveTextContent('boom');
    expect(screen.queryByTestId('progress-matrix')).not.toBeInTheDocument();

    const before = fetchProgress.mock.calls.length;
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('progress-matrix')).toBeInTheDocument();
    expect(fetchProgress.mock.calls.length).toBe(before + 1);
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
  });

  it('does not show an active failure on the Finished section (one store slot, two callers)', async () => {
    seed({ goals: [goal('wings'), goal('done', { status: 'complete', completedAt: '2026-10-01T00:00:00Z' })], participants });
    renderPage();
    await screen.findByTestId('progress-matrix');

    // An active refetch fails, and the shared slot says so; then Finished loads fine.
    fetchProgress.mockImplementationOnce(async () => {
      useCollectionGoalStore.setState({ progressError: 'active boom' });
      return { error: 'active boom' };
    });
    await act(async () => {
      useCollectionGoalStore.setState({ goals: [...useCollectionGoalStore.getState().goals, goal('fresh')] });
    });
    expect(await screen.findByTestId('progress-error')).toHaveTextContent('active boom');

    fetchProgress.mockImplementation(async () => ({ error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Finished (1)' }));
    expect(await screen.findByText('done · Mount')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-finished-error')).not.toBeInTheDocument();
  });

  it('keeps the matrix, stale, behind the error line when a later active fetch fails, and through the retry', async () => {
    seed({ goals, participants });
    renderPage();
    const matrix = await screen.findByTestId('progress-matrix');

    fetchProgress.mockResolvedValueOnce({ error: 'boom' });
    await act(async () => {
      useCollectionGoalStore.setState({ goals: [...goals, goal('fresh', { title: 'Fresh Farm' })] });
    });
    const alert = await screen.findByTestId('progress-error');
    expect(alert).toHaveTextContent('boom');
    expect(screen.getByTestId('progress-matrix')).toBe(matrix);
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();

    // The retry runs behind the same matrix, which a pending fetch does not unmount.
    let settle: () => void = () => {};
    fetchProgress.mockReturnValueOnce(new Promise((resolve) => { settle = () => resolve({ error: null }); }));
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(screen.getByTestId('progress-matrix')).toBe(matrix);
    await act(async () => settle());
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('progress-matrix')).toBe(matrix);
  });

  it('ignores a stale progress error when no farm is active, so there is no dead Retry', async () => {
    seed({
      goals: [goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' })],
      progressError: 'boom',
    });
    renderPage();
    expect(await screen.findByTestId('progress-matrix')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
    expect(fetchProgress).not.toHaveBeenCalled();
  });

  it('shows a goals failure as an error, not as loading forever', async () => {
    seed({ goals: [], ready: false, goalsError: 'no goals' });
    renderPage();
    expect(await screen.findByTestId('progress-error')).toHaveTextContent('no goals');
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
  });
});
