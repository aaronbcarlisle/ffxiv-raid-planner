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
