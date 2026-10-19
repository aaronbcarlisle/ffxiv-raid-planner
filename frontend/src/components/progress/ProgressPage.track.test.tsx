/**
 * ProgressPage and `?track=` (S2a-3a·G2 Task TG3; R-S3-3, D-8): the open row from the URL,
 * before and after the data, across a static switch, and written back in place. The store is
 * seeded and its fetches replaced, as `ProgressPage.matrix.test.tsx` does; the page runs under
 * a MemoryRouter whose location a probe reports. (The tab-memory cases are the hook's:
 * `hooks/useGroupViewState.progress.test.ts`.)
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

import { api } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import type { StaticGroup, TierSnapshot } from '../../types';
import { apiDrop, goal, row } from './__fixtures__/progressFixtures';
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
    isLoading: false,
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
  it('opens the active row it names and scrolls the row, then its panel, into view once', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=calm');
    await screen.findByTestId('progress-matrix');

    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'true');
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'false');
    expect(rowOf('calm').nextElementSibling).toBe(panel());
    // Once per open: the row, then the panel under it, so both come into view at the fold.
    expect(scrollIntoView.mock.calls).toEqual([[{ block: 'nearest' }], [{ block: 'nearest' }]]);
    expect(scrollIntoView.mock.instances).toEqual([rowOf('calm'), panel()]);
    expect(trackOf()).toBe('calm');

    // A re-render with the row still open scrolls nothing again.
    await act(async () => {
      useCollectionGoalStore.setState({ participants: { ...PARTICIPANTS } });
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
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

  it('waits for this mount\'s goals fetch before dropping an id the cached goals lack (a warm cache)', async () => {
    // The cache says loaded and idle, and lacks the farm; the mount's own refetch (which flips the
    // store's isLoading only once it runs, after the first render) brings it.
    seed({ goals: [GOALS[0]] });
    let resolveGoals: () => void = () => {};
    fetchGoals.mockImplementation(() => {
      useCollectionGoalStore.setState({ isLoading: true });
      return new Promise<void>((resolve) => {
        resolveGoals = () => {
          useCollectionGoalStore.setState({ goals: GOALS, isLoading: false, loadedGroupId: 'g1' });
          resolve();
        };
      });
    });
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=calm');
    await screen.findByTestId('progress-matrix');
    expect(fetchGoals).toHaveBeenCalledWith('g1');
    expect(trackOf()).toBe('calm');
    expect(panel()).toBeNull();

    await act(async () => resolveGoals());
    expect(trackOf()).toBe('calm');
    expect(nameOf('calm')).toHaveAttribute('aria-expanded', 'true');
    expect(rowOf('calm').nextElementSibling).toBe(panel());
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

// ── The open row's drops (S2a-3a·G3 Task TG5) ───────────────────────────────

describe('ProgressPage open row: Escape in the Log a drop picker (R-S3-4, vet I-2)', () => {
  it('closes only the portalled picker: the panel stays open, ?track is unchanged and focus returns to the ▾', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await screen.findByTestId('progress-matrix');
    const more = within(panel()!).getByRole('button', { name: 'More recipients' });
    fireEvent.click(more);
    const picker = screen.getByRole('dialog', { name: 'Log a drop for Hot Farm' });
    // The picker renders through a portal: outside the panel row in the DOM.
    expect(panel()!.contains(picker)).toBe(false);
    const checked = within(picker).getByRole('radio', { checked: true });
    expect(checked).toHaveFocus();

    fireEvent.keyDown(checked, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(panel()).not.toBeNull();
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
    expect(trackOf()).toBe('hot');
    await waitFor(() => expect(more).toHaveFocus());
  });
});

describe('ProgressPage open row: the drops\' week labels follow the week clock (R-S3-9)', () => {
  afterEach(() => {
    useLootTrackingStore.setState({ weekClockKey: null, weekStartDate: null, currentWeek: 1 });
    vi.mocked(api.get).mockResolvedValue([]);
  });

  async function dropLine(clockKey: string) {
    useLootTrackingStore.setState({ weekClockKey: clockKey, currentWeek: 3, weekStartDate: '2026-09-01T00:00:00Z' });
    vi.mocked(api.get).mockResolvedValue([apiDrop('d1', 'u1', { recipient_display_name: 'Aya', dropped_at: '2026-09-09T10:00:00Z' })]);
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await screen.findByTestId('progress-matrix');
    return (await within(screen.getByTestId('progress-expansion-drops')).findByRole('listitem')).textContent;
  }

  it('reads "Week n" when THIS tier\'s clock is resolved', async () => {
    expect(await dropLine(weekClockKeyOf('g1', 'aac-cruiserweight'))).toBe('Week 2 · Aya · ×1');
  });

  it('reads a date while the clock belongs to another tier (weekStartDate is withheld with the week)', async () => {
    expect(await dropLine(weekClockKeyOf('g1', 'other-tier'))).toMatch(/^9 Sept?( 2026)? · Aya · ×1$/);
  });
});
