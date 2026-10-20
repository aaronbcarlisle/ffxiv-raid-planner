/**
 * ProgressPage and `?track=` (S2a-3a·G2 Task TG3; R-S3-3, D-8): the open row from the URL,
 * before and after the data, across a static switch, and written back in place. The store is
 * seeded and its fetches replaced, as `ProgressPage.matrix.test.tsx` does; the page runs under
 * a MemoryRouter whose location a probe reports. (The tab-memory cases are the hook's:
 * `hooks/useGroupViewState.progress.test.ts`.)
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { useToastStore } from '../../stores/toastStore';
import {
  actionOf,
  fetchGoals,
  fetchProgress,
  loadedMatrix,
  nameOf,
  otherGroup,
  panel,
  renderAt,
  rowOf,
  search,
  seedPage,
  setUpPage,
  tearDownPage,
  trackOf,
} from './__fixtures__/pageHarness';
import { apiDrop, goal, row } from './__fixtures__/progressFixtures';

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

// The real writes stay: these tests run `logDrop`, `deleteDrop` and the refresh over the mocked `api`.
const seed = (s: Seed = {}) => seedPage(s.participants ?? PARTICIPANTS, s.goals ?? GOALS, { ready: s.ready !== false, writes: false });

const scrollIntoView = vi.fn();

beforeEach(() => {
  setUpPage();
  // jsdom has none; the row calls it once per open (R-S3-3).
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  tearDownPage();
  vi.unstubAllGlobals();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});


describe('ProgressPage ?track= on load', () => {
  it('opens the active row it names and scrolls the row, then its panel, into view once', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=calm');
    await loadedMatrix();

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
    await loadedMatrix();

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
    await loadedMatrix();
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
    await loadedMatrix();
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
    await loadedMatrix();
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
    await loadedMatrix();
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
    await loadedMatrix();
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
    await loadedMatrix();
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
    await loadedMatrix();
    expect(panel()).toBeNull();
    expect(trackOf()).toBeNull();
  });
});

// ── The open row's drops (S2a-3a·G3 Task TG5) ───────────────────────────────

describe('ProgressPage open row: Escape in the Log a drop picker (R-S3-4, vet I-2)', () => {
  it('closes only the portalled picker: the panel stays open, ?track is unchanged and focus returns to the ▾', async () => {
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await loadedMatrix();
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

describe('ProgressPage open row: Escape in the delete-drop confirm (R-S3-4, vet I-2; S2a-3a·G4 TG6)', () => {
  it('closes only the portalled confirm: the panel stays open, ?track is unchanged and focus returns to the delete button', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve((url.endsWith('/drops') ? [apiDrop('d1', 'u1', { goal_id: 'hot', recipient_display_name: 'Aya' })] : []) as never),
    );
    seed();
    renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await loadedMatrix();
    const trash = await within(panel()!).findByRole('button', { name: /^Delete drop for Aya, / });
    act(() => trash.focus());
    fireEvent.click(trash);
    const confirm = await screen.findByRole('dialog', { name: 'Delete Drop' });
    // The confirm renders through a portal: outside the panel row in the DOM.
    expect(panel()!.contains(confirm)).toBe(false);

    fireEvent.keyDown(confirm, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(panel()).not.toBeNull();
    expect(nameOf('hot')).toHaveAttribute('aria-expanded', 'true');
    expect(trackOf()).toBe('hot');
    await waitFor(() => expect(trash).toHaveFocus());
  });
});

describe('ProgressPage: a drop\'s Undo after a static switch (G3 fix wave)', () => {
  const G2_GOALS = [goal('far', { title: 'Far Farm', staticGroupId: 'g2' })];

  it('leaves the static on screen loaded: the Undo\'s refetch of the old static\'s goals is put back', async () => {
    // The store's own fetchGoals replaces goals and loadedGroupId wholesale; so does this one.
    fetchGoals.mockImplementation(async (groupId: string) => {
      useCollectionGoalStore.setState({ goals: groupId === 'g2' ? G2_GOALS : GOALS, loadedGroupId: groupId });
    });
    vi.mocked(api.post).mockResolvedValueOnce(apiDrop('d1', 'u1', { goal_id: 'hot' }));
    useToastStore.getState().clearAll();
    seed();
    const { rerender } = renderAt('/group/DEVTST?shell=v2&tab=progress&track=hot');
    await loadedMatrix();
    fireEvent.click(await within(panel()!).findByRole('button', { name: 'Log drop for Aya' }));
    await waitFor(() => expect(useToastStore.getState().toasts.map((t) => t.action?.label)).toContain('Undo'));

    rerender({ group: otherGroup });
    expect(await screen.findByRole('button', { name: 'Far Farm' })).toBeInTheDocument();
    expect(useCollectionGoalStore.getState().loadedGroupId).toBe('g2');

    act(() => useToastStore.getState().toasts.find((t) => t.action?.label === 'Undo')?.action?.onClick());
    await waitFor(() => expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Undone'));
    await act(async () => {});
    expect(fetchGoals).toHaveBeenCalledWith('g1');
    expect(useCollectionGoalStore.getState().loadedGroupId).toBe('g2');
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('progress-matrix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Far Farm' })).toBeInTheDocument();
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
    await loadedMatrix();
    // The line itself: the row also holds the delete button's hidden name.
    return (await within(screen.getByTestId('progress-expansion-drops')).findByRole('listitem')).firstElementChild?.textContent;
  }

  it('reads "Week n" when THIS tier\'s clock is resolved', async () => {
    expect(await dropLine(weekClockKeyOf('g1', 'aac-cruiserweight'))).toBe('Week 2 · Aya · ×1');
  });

  it('reads a date while the clock belongs to another tier (weekStartDate is withheld with the week)', async () => {
    expect(await dropLine(weekClockKeyOf('g1', 'other-tier'))).toMatch(/^9 Sept?( 2026)? · Aya · ×1$/);
  });
});
