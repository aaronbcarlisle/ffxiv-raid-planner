/**
 * ProgressPage and `?track=` (S2a-3a·G2 Task TG3; R-S3-3, D-8): the open row from the URL,
 * before and after the data, across a static switch, and written back in place. The store is
 * seeded and its fetches replaced, as `ProgressPage.matrix.test.tsx` does; the page runs under
 * a MemoryRouter whose location a probe reports. (The tab-memory cases are the hook's:
 * `hooks/useGroupViewState.progress.test.ts`.)
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
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
import type { StaticGroup, TierSnapshot } from '../../types';
import { goal, row } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressPage } from './ProgressPage';

const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [] } as unknown as StaticGroup;
const otherGroup = { ...group, id: 'g2', name: 'Other Static', shareCode: 'OTHER1' } as unknown as StaticGroup;

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

interface Seed {
  goals?: CollectionGoal[];
  participants?: Record<string, ParticipantStateEntry[]>;
  ready?: boolean;
  isLoading?: boolean;
}

const GOALS = [
  goal('hot', { title: 'Hot Farm' }),
  goal('calm', { title: 'Calm Farm' }),
  goal('done', { title: 'Done Farm', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
];
const PARTICIPANTS = {
  hot: [row('hot', 'u1'), row('hot', 'u2')],
  calm: [row('calm', 'u1', { state: 'want' })],
  done: [row('done', 'u1', { state: 'have' })],
};

function seed(s: Seed = {}) {
  useCollectionGoalStore.setState({
    goals: s.goals ?? GOALS,
    participants: s.participants ?? PARTICIPANTS,
    recordOnly: {},
    loadedGroupId: s.ready === false ? null : 'g1',
    isLoading: s.isLoading ?? false,
    progressError: null,
    progressLoading: false,
    error: null,
    fetchGoals,
    fetchProgress,
  });
}

/** The router's current search and last action, for the URL assertions. */
function LocationProbe() {
  const { search } = useLocation();
  const action = useNavigationType();
  return <output data-testid="location" data-action={action}>{search}</output>;
}

function page(props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
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

function renderAt(url: string, props: Partial<Parameters<typeof ProgressPage>[0]> = {}) {
  const view = render(
    <MemoryRouter initialEntries={[url]}>
      {page(props)}
      <LocationProbe />
    </MemoryRouter>,
    { wrapper: TooltipWrapper },
  );
  const rerender = (next: Partial<Parameters<typeof ProgressPage>[0]>) =>
    view.rerender(
      <MemoryRouter initialEntries={[url]}>
        {page(next)}
        <LocationProbe />
      </MemoryRouter>,
    );
  return { rerender };
}

const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const trackOf = () => search().get('track');
const actionOf = () => screen.getByTestId('location').getAttribute('data-action');
const rowOf = (id: string) => screen.getAllByTestId('progress-farm-row').find((r) => r.getAttribute('data-goal-id') === id)!;
const nameOf = (id: string) => within(within(rowOf(id)).getByRole('rowheader')).getByRole('button');
const panel = () => screen.queryByTestId('progress-expansion');

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  // jsdom has none; the row calls it once per open (R-S3-3).
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('ProgressPage ?track= on load', () => {
  it('opens the active row it names and scrolls it into view once', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=calm');
    await screen.findByTestId('progress-matrix');

    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'true');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'false');
    expect(rowOf('calm').nextElementSibling).toBe(panel());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scrollIntoView.mock.instances[0]).toBe(rowOf('calm'));
    expect(trackOf()).toBe('calm');
  });

  it('expands Finished (n) first for a finished id, fetches its cells, then opens that row', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=done');
    await screen.findByTestId('progress-matrix');

    expect(screen.getByRole('button', { name: 'Finished (1)' })).toHaveAttribute('aria-expanded', 'true');
    expect(fetchProgress).toHaveBeenCalledWith('g1', ['done']);
    expect(await screen.findByRole('button', { name: 'Done Farm' })).toHaveAttribute('aria-expanded', 'true');
    expect(rowOf('done').nextElementSibling).toBe(panel());
    expect(screen.getAllByTestId('progress-expansion')).toHaveLength(1);
    expect(trackOf()).toBe('done');
  });

  it('keeps the id while the goals load, then opens the row once they arrive', async () => {
    seed({ ready: false });
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
    await act(async () => {});
    expect(trackOf()).toBe('hot');
    expect(panel()).toBeNull();

    await act(async () => {
      useCollectionGoalStore.setState({ loadedGroupId: 'g1' });
    });
    await screen.findByTestId('progress-matrix');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
    expect(rowOf('hot').nextElementSibling).toBe(panel());
  });

  it('drops an unknown id only after the goals have loaded, opening nothing', async () => {
    seed({ ready: false });
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=nope');
    await act(async () => {});
    expect(trackOf()).toBe('nope');

    await act(async () => {
      useCollectionGoalStore.setState({ loadedGroupId: 'g1' });
    });
    await screen.findByTestId('progress-matrix');
    expect(trackOf()).toBeNull();
    expect(search().get('tab')).toBe('progress');
    expect(panel()).toBeNull();
    expect(screen.queryByRole('button', { expanded: true })).not.toBeInTheDocument();
  });

  it('waits for an in-flight goals fetch before dropping an id the cached goals lack', async () => {
    seed({ goals: [GOALS[0]], isLoading: true });
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=calm');
    await screen.findByTestId('progress-matrix');
    expect(trackOf()).toBe('calm');
    expect(panel()).toBeNull();

    await act(async () => {
      useCollectionGoalStore.setState({ goals: GOALS, isLoading: false });
    });
    expect(trackOf()).toBe('calm');
    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('ProgressPage ?track= writes', () => {
  it('writes the opened row in place and removes it on close', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress');
    await screen.findByTestId('progress-matrix');
    expect(trackOf()).toBeNull();

    fireEvent.click(nameOf('hot'));
    expect(trackOf()).toBe('hot');
    expect(actionOf()).toBe('REPLACE');
    expect(search().get('tab')).toBe('progress');
    expect(rowOf('hot').nextElementSibling).toBe(panel());

    fireEvent.click(nameOf('calm'));
    expect(trackOf()).toBe('calm');
    expect(screen.getAllByTestId('progress-expansion')).toHaveLength(1);

    fireEvent.click(nameOf('calm'));
    expect(trackOf()).toBeNull();
    expect(actionOf()).toBe('REPLACE');
    expect(panel()).toBeNull();
  });

  it('removes it on Escape in the panel too, and focus returns to the name', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await screen.findByTestId('progress-matrix');
    fireEvent.keyDown(within(panel()!).getByRole('heading', { name: 'About' }), { key: 'Escape' });
    expect(trackOf()).toBeNull();
    expect(panel()).toBeNull();
    expect(nameOf('hot')).toHaveFocus();
  });
});

describe('ProgressPage ?track= across a static switch (R-S3-3)', () => {
  it('clears the id at once when the static changes under the page, opening nothing while the new goals load', async () => {
    seed();
    const { rerender } = renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await screen.findByTestId('progress-matrix');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');

    // The store still holds g1's goals (loadedGroupId 'g1'): g2's are loading.
    rerender({ group: otherGroup });
    expect(panel()).toBeNull();
    expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
    await act(async () => {});
    expect(trackOf()).toBeNull();
    expect(search().get('tab')).toBe('progress');

    // Even once g2's goals land (with a goal of the same id, which cannot happen, but pins the clear), nothing reopens.
    await act(async () => {
      useCollectionGoalStore.setState({ goals: [goal('hot', { title: 'Hot Farm', staticGroupId: 'g2' })], loadedGroupId: 'g2' });
    });
    await screen.findByTestId('progress-matrix');
    expect(panel()).toBeNull();
    expect(trackOf()).toBeNull();
  });
});
