/**
 * ProgressPage and the row menu (S2a-3a·G4 Task TG7; D-9, D-10, D-11, D-22, R-S3-4, R-S3-17): the
 * open row follows its goal when the menu or the action bar changes its status (into Finished,
 * which expands, and back out), and closes with `?track` cleared when the goal is deleted; an
 * Escape inside the Delete confirm closes only the confirm. The store is seeded as
 * `ProgressPage.track.test.tsx` does, with `updateGoal` and `deleteGoal` replaced by fakes that
 * edit the seeded goals the way the real ones do (their requests are `FarmRowMenu.test.tsx`'s).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';
import type { StaticGroup, TierSnapshot } from '../../types';
import { ToastContainer } from '../layout/ToastContainer';
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
  players: [player('p1', 'Aya', 'T1', 'tank', 'u1'), player('p2', 'Bo', 'H1', 'healer', 'u2')],
} as unknown as TierSnapshot;

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();
const refreshGoalProgress = vi.fn();
const updateGoal = vi.fn();
const deleteGoal = vi.fn();

const GOALS = [goal('hot', { title: 'Hot Farm' }), goal('calm', { title: 'Calm Farm' })];
const NEEDY = { hot: [row('hot', 'u1'), row('hot', 'u2')], calm: [row('calm', 'u1', { state: 'want' })] };
const EVERYONE = { hot: [row('hot', 'u1', { state: 'have' }), row('hot', 'u2', { state: 'have' })], calm: NEEDY.calm };

const real = useCollectionGoalStore.getState();

function seed(participants: Record<string, ParticipantStateEntry[]> = NEEDY, goals: CollectionGoal[] = GOALS) {
  useCollectionGoalStore.setState({
    goals,
    participants,
    recordOnly: {},
    loadedGroupId: 'g1',
    isLoading: false,
    progressError: null,
    progressLoading: false,
    error: null,
    fetchGoals,
    fetchProgress,
    refreshGoalProgress,
    updateGoal,
    deleteGoal,
  });
}

function LocationProbe() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderAt(url: string, props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
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
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
}

const trackOf = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '').get('track');
const rowOf = (id: string) => screen.getAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === id)!;
const nameOf = (id: string) => within(within(rowOf(id)).getByRole('rowheader')).getByRole('button');
const panel = () => screen.queryByTestId('progress-expansion');
const inFinished = (el: HTMLElement | null) => el !== null && el.closest('[data-testid="progress-finished"]') !== null;
const menuOf = (title: string) => screen.getByRole('button', { name: `Actions for ${title}` });
const pick = (name: string) => fireEvent.click(screen.getByRole('menuitem', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  Element.prototype.scrollIntoView = vi.fn();
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
});

afterEach(() => {
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
});

describe('the open row follows its status (D-9, D-10)', () => {
  it('stays open as Mark finished moves it into Finished, which expands, and back out on Reopen', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    expect(inFinished(panel())).toBe(false);
    expect(screen.queryByTestId('progress-finished')).not.toBeInTheDocument();

    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(inFinished(panel())).toBe(true));
    expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { status: 'complete' });
    expect(refreshGoalProgress).toHaveBeenCalledWith('g1', 'hot', { lists: true });
    expect(trackOf()).toBe('hot');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
    // Finished (1) is expanded: its row is on screen without a click.
    expect(screen.getByRole('button', { name: 'Finished (1)' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(menuOf('Hot Farm'));
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Reopen', 'Delete']);
    pick('Reopen');
    await waitFor(() => expect(inFinished(panel())).toBe(false));
    expect(updateGoal).toHaveBeenLastCalledWith('g1', 'hot', { status: 'farming' });
    expect(trackOf()).toBe('hot');
    expect(panel()).toBeInTheDocument();
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts the open row back among the active ones when the toast\'s Undo is used', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(inFinished(panel())).toBe(true));

    await act(async () => {
      useToastStore.getState().toasts.find((t) => t.action)!.action!.onClick();
    });
    await waitFor(() => expect(inFinished(panel())).toBe(false));
    expect(updateGoal).toHaveBeenLastCalledWith('g1', 'hot', { status: 'farming' });
    expect(trackOf()).toBe('hot');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe("Mark finished in the open panel's action bar (D-22)", () => {
  it('shows on a farm everyone has, with "Everyone has it" alone in the status cell, and moves the row to Finished', async () => {
    seed(EVERYONE);
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    const status = within(rowOf('hot')).getByTestId('progress-status');
    expect(status.textContent).toBe('Everyone has it');
    expect(within(status).queryAllByRole('button')).toHaveLength(0);

    fireEvent.click(within(within(panel()!).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Mark finished' }));
    await waitFor(() => expect(inFinished(panel())).toBe(true));
    expect(updateGoal).toHaveBeenCalledWith('g1', 'hot', { status: 'complete' });
    expect(trackOf()).toBe('hot');
  });

  it('is not offered on a farm somebody still needs', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    expect(within(panel()!).queryByRole('button', { name: 'Mark finished' })).not.toBeInTheDocument();
  });
});

describe('Delete (D-11)', () => {
  it('closes the open row\'s panel and clears ?track when its goal is deleted', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');

    fireEvent.click(menuOf('Hot Farm'));
    pick('Delete');
    const dialog = screen.getByRole('dialog', { name: 'Delete Goal' });
    expect(deleteGoal).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(deleteGoal).toHaveBeenCalledWith('g1', 'hot');
    expect(trackOf()).toBeNull();
    expect(screen.queryByText('Hot Farm')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Calm Farm')).toBeInTheDocument();
  });

  it('leaves the open row alone when another row\'s goal is deleted', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Calm Farm'));
    pick('Delete');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Goal' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteGoal).toHaveBeenCalledWith('g1', 'calm'));
    await waitFor(() => expect(screen.queryByText('Calm Farm')).not.toBeInTheDocument());
    expect(trackOf()).toBe('hot');
    expect(panel()).toBeInTheDocument();
  });

  it('closes only the confirm on Escape, leaving the open row\'s panel and ?track', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Delete');
    const dialog = screen.getByRole('dialog', { name: 'Delete Goal' });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
    expect(deleteGoal).not.toHaveBeenCalled();
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes only the menu on Escape, leaving the open row\'s panel', async () => {
    seed();
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Hot Farm'));
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Mark finished' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
    expect(trackOf()).toBe('hot');
  });
});

describe('who has the menu (R-S3-17)', () => {
  it.each([
    ['a member', 'member', false],
    ['a viewer', 'viewer', false],
  ] as const)('gives %s no menu button and no Actions column', async (_label, userRole, canManage) => {
    seed();
    renderAt('/?track=hot', { userRole, canManage });
    await screen.findByTestId('progress-expansion');
    expect(screen.queryAllByRole('button', { name: /^Actions for / })).toHaveLength(0);
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });
});

// ── Focus follows the farm (G4 fix wave) ─────────────────────────────────────

describe('focus after a write that moves or removes the row', () => {
  const finishedToggle = () => screen.getByRole('button', { name: /^Finished \(/ });
  const DONE = goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' });
  const withDone = { ...NEEDY, done: [row('done', 'u1', { state: 'have' })] };

  it('Mark finished from the menu lands on Finished (n) while it is collapsed, never on another row', async () => {
    seed();
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    // Every element that takes focus on the way: the grid's own fallback would pass over calm's name.
    const seen: string[] = [];
    const record = (event: FocusEvent) => seen.push((event.target as HTMLElement).id);
    document.addEventListener('focusin', record);
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
    document.removeEventListener('focusin', record);
    expect(seen).not.toContain('progress-expansion-calm-name');
    expect(nameOf('calm')).not.toHaveFocus();
    expect(refreshGoalProgress).toHaveBeenCalledWith('g1', 'hot', { lists: true });
  });

  it("Mark finished lands on the moved row's own name once Finished is open and settled", async () => {
    seed();
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
    fireEvent.click(finishedToggle());
    await screen.findByRole('button', { name: 'Hot Farm' });

    fireEvent.click(menuOf('Calm Farm'));
    pick('Mark finished');
    await waitFor(() => expect(nameOf('calm')).toHaveFocus());
    expect(inFinished(rowOf('calm'))).toBe(true);
  });

  it("Mark finished from the open panel's action bar lands on Finished (n), not <body>", async () => {
    seed(EVERYONE);
    renderAt('/?track=hot');
    await screen.findByTestId('progress-expansion');
    const button = within(within(panel()!).getByTestId('progress-expansion-actions')).getByRole('button', { name: 'Mark finished' });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(inFinished(panel())).toBe(true));
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
  });

  it("Reopen lands on the reopened row's name in the active rows", async () => {
    seed(withDone, [...GOALS, DONE]);
    renderAt('/?track=done');
    await screen.findByTestId('progress-expansion');
    fireEvent.click(menuOf('Done Farm'));
    pick('Reopen');
    await waitFor(() => expect(inFinished(rowOf('done'))).toBe(false));
    expect(nameOf('done')).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  // Three rows, so the neighbour is not also the grid's own fallback (the first row).
  const COLD = goal('cold', { title: 'Cold Farm' });
  const three = { ...NEEDY, cold: [row('cold', 'u1', { state: 'want' })] };
  const deleteFarm = async (title: string) => {
    fireEvent.click(menuOf(title));
    pick('Delete');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Goal' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(title)).not.toBeInTheDocument());
  };

  it("Delete lands on the next farm's name, not the first row's", async () => {
    seed(three, [...GOALS, COLD]);
    renderAt('/?track=calm');
    await screen.findByTestId('progress-expansion');
    expect(screen.getAllByTestId('progress-farm-row').map((r) => r.getAttribute('data-goal-id'))).toEqual(['hot', 'calm', 'cold']);
    await deleteFarm('Calm Farm');
    expect(nameOf('cold')).toHaveFocus();
  });

  it("Delete of the last row lands on the previous farm's name, past the open panel between them", async () => {
    seed(three, [...GOALS, COLD]);
    renderAt('/?track=calm');
    await screen.findByTestId('progress-expansion');
    await deleteFarm('Cold Farm');
    expect(nameOf('calm')).toHaveFocus();
  });

  it("Delete of the only finished farm lands on the grid's stop (the first active row's name), not <body>", async () => {
    seed(withDone, [...GOALS, DONE]);
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(finishedToggle());
    await screen.findByRole('button', { name: 'Done Farm' });
    await deleteFarm('Done Farm');
    expect(screen.queryByRole('button', { name: /^Finished \(/ })).not.toBeInTheDocument();
    expect(nameOf('hot')).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("Undo through the real toast puts focus on the restored row's name once the toast's exit has run", async () => {
    seed();
    renderAt('/');
    render(<ToastContainer />);
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());

    // The user presses the toast's Undo: it takes the focus, and stays in the DOM through its exit.
    const undo = await screen.findByRole('button', { name: 'Undo' });
    undo.focus();
    fireEvent.click(undo);
    await waitFor(() => expect(inFinished(screen.queryAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === 'hot') ?? null)).toBe(false));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument(), { timeout: 3000 });
    expect(nameOf('hot')).toHaveFocus();
  });

  it('a failed write moves nothing and leaves nothing owed', async () => {
    seed();
    updateGoal.mockRejectedValueOnce(new Error('boom'));
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true));
    // Nothing was claimed, so the next write's row is the only one owed.
    fireEvent.click(menuOf('Calm Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
  });

  it("Undo puts focus on the restored row's name when it was lost to <body>, and leaves a focus that is somewhere else", async () => {
    seed();
    renderAt('/');
    await screen.findAllByTestId('progress-farm-row');
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());

    finishedToggle().blur();
    expect(document.body).toHaveFocus();
    await act(async () => {
      useToastStore.getState().toasts.find((t) => t.action)!.action!.onClick();
    });
    await waitFor(() => expect(inFinished(rowOf('hot'))).toBe(false));
    await waitFor(() => expect(nameOf('hot')).toHaveFocus());

    // A second round, with focus parked on another control: Undo does not take it.
    fireEvent.click(menuOf('Hot Farm'));
    pick('Mark finished');
    await waitFor(() => expect(finishedToggle()).toHaveFocus());
    nameOf('calm').focus();
    await act(async () => {
      useToastStore.getState().toasts.filter((t) => t.action).at(-1)!.action!.onClick();
    });
    await waitFor(() => expect(inFinished(screen.queryAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === 'hot') ?? null)).toBe(false));
    expect(nameOf('calm')).toHaveFocus();
  });
});
