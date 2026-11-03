/**
 * Find while the static's goals are missing (S2a-4a fix wave; R-F-5, R-F-6, D-7, E-4, A2-M2). Find
 * reads `goals` for what the static already tracks, and the from-suggestion route has no duplicate
 * guard, so:
 *
 * - a goals failure says so at the top of Find with a Retry, in Find's own line (Tracks' line stays
 *   Tracks', and so does its "Loading farms…");
 * - a lead has no Track and no custom row until THIS mount's fetch has brought this static's goals
 *   back clean: not during a cold load, not on a cached list while the refetch runs, and not after
 *   a failure, cached list or no. Track a farm stays: it writes only the URL.
 *
 * The real `fetchGoals` runs over the mocked `api`, so the store's flags move as they do live.
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
import { useCollectionGoalStore, type CollectionGoal } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore } from '../../stores/collectionIntentStore';
import { fetchGoals, fetchProgress, renderAt, search, seedPage, setUpPage, tearDownPage } from './__fixtures__/pageHarness';
import { apiGoal, goal } from './__fixtures__/progressFixtures';

const realFetchGoals = useCollectionGoalStore.getState().fetchGoals;

const GOALS_URL = '/api/static-groups/g1/collection-goals';
const CATALOG_URL = '/api/collection-catalog';
const SUGGESTIONS_URL = '/api/static-groups/g1/collection-suggestions';
const INTENTS_URL = '/api/me/collection-intent';

const LYNX = 'Lynx of Righteous Fire';
const STEED = 'Abyssal Steed';

const apiCat = (id: string, name: string) => ({
  id,
  external_source: 'ffxivcollect',
  external_id: null,
  name,
  category: 'mount',
  expansion: 'dt',
  patch: '7.0',
  icon_url: null,
  image_url: null,
  source_text: null,
  source_type: 'extreme',
  source_duty_name: `${name} duty`,
  source_duty_key: id,
  token_name: null,
  token_cost: null,
  token_item_id: null,
  game_mount_id: null,
  tradeable: false,
  rarity_owned_percent: null,
  is_curated: true,
  notes: null,
});
const CATALOG = [apiCat('cat-lynx', LYNX), apiCat('cat-steed', STEED)];

/** What the server says the static tracks: Lynx, so Steed alone may offer Track. */
const SERVER_GOALS = [apiGoal('lynx-goal', { title: LYNX, catalog_item_id: 'cat-lynx' })];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Routes the page's reads; `goals` is the goals fetch, which each test scripts. */
function serve(goals: () => Promise<unknown>) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith(CATALOG_URL)) return CATALOG;
    if (url.startsWith(SUGGESTIONS_URL)) return [];
    if (url === INTENTS_URL) return [];
    if (url === GOALS_URL) return goals();
    return [];
  });
}

/** The harness's seed, with the real `fetchGoals` in place of its spy. */
function seed(goals: CollectionGoal[], ready: boolean) {
  seedPage({}, goals, { ready });
  useCollectionGoalStore.setState({ fetchGoals: realFetchGoals });
}

const failThen = (...next: Array<() => Promise<unknown>>) => {
  const queue = [...next];
  return () => (queue.shift() ?? (() => Promise.resolve(SERVER_GOALS)))();
};
const boom = () => Promise.reject(new Error('goals down'));

const LEAD = {} as const;
const MEMBER = { userRole: 'member', canManage: false, currentUserId: 'u2' } as const;
const VIEWER = { userRole: 'viewer', canManage: false, currentUserId: 'u2' } as const;

const findRegion = () => screen.getByRole('region', { name: 'Find' });
const allRegion = async () => within(await screen.findByRole('region', { name: 'Find' })).findByRole('region', { name: /^All farm sources/ });
const rowOf = async (name: string) => {
  const rows = await within(await allRegion()).findAllByTestId('find-row');
  return rows.find((r) => within(r).queryByText(name, { exact: true }) !== null)!;
};
const trackButtons = () => within(findRegion()).queryAllByRole('button', { name: /^Track$/ });
const customRow = () => within(findRegion()).queryByRole('button', { name: /as a custom farm$/ });
const customHint = () => within(findRegion()).queryByText('Type a name to track a custom farm');
const goalsAlert = () => screen.findByTestId('find-goals-error');
const type = (text: string) => fireEvent.change(within(findRegion()).getByLabelText('Search farms'), { target: { value: text } });
const goalsCalls = () => vi.mocked(api.get).mock.calls.filter(([url]) => url === GOALS_URL).length;

function resetStores() {
  useCollectionGoalStore.setState({ catalog: [], catalogLoaded: false, catalogLoading: false, catalogError: null, error: null });
  useCollectionIntentStore.setState({ suggestions: {}, suggestionsLoading: {}, suggestionsError: {}, myIntents: {}, myIntentsLoaded: false });
}

beforeEach(() => {
  setUpPage();
  Element.prototype.scrollIntoView = vi.fn();
  resetStores();
});

afterEach(() => {
  tearDownPage();
  resetStores();
});

describe('a goals failure in Find', () => {
  it('says so above the list, as an alert, with Tracks\' lines still out of Find', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', LEAD);
    const alert = await goalsAlert();
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Couldn\'t load what your static tracks: goals down');
    const box = within(findRegion()).getByLabelText('Search farms');
    expect(alert.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();
  });

  it('a lead has no Track on any row and no custom row, while the catalog rows still list', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', LEAD);
    await goalsAlert();
    expect(await rowOf(LYNX)).toBeInTheDocument();
    expect(await rowOf(STEED)).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();
    type('A custom name');
    expect(customRow()).not.toBeInTheDocument();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('Retry refetches: the line goes, the tracked row reads Tracking and only the other offers Track', async () => {
    serve(failThen(boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', LEAD);
    const alert = await goalsAlert();
    const before = goalsCalls();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(goalsCalls()).toBe(before + 1));
    await waitFor(() => expect(screen.queryByTestId('find-goals-error')).not.toBeInTheDocument());
    expect(await within(await rowOf(LYNX)).findByText('Tracking ✓')).toBeInTheDocument();
    expect(within(await rowOf(LYNX)).queryByRole('button', { name: /^Track$/ })).not.toBeInTheDocument();
    expect(await within(await rowOf(STEED)).findByRole('button', { name: /^Track$/ })).toBeInTheDocument();
    expect(customHint()).toBeInTheDocument();
  });

  it('a Retry that fails again shows the line again, and the controls stay away', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', LEAD);
    fireEvent.click(within(await goalsAlert()).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(goalsCalls()).toBeGreaterThanOrEqual(2));
    expect(await goalsAlert()).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();
  });

  it('a member reads the line and keeps I want this, which reads no goals', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', MEMBER);
    await goalsAlert();
    const row = await rowOf(STEED);
    expect(await within(row).findByRole('button', { name: 'I want this' })).toBeInTheDocument();
  });

  it('a viewer reads the line too: their rows read untracked for the same reason', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress&pview=find', VIEWER);
    expect(await goalsAlert()).toBeInTheDocument();
  });

  it('a failure behind a cached list is still a failure: the line shows and Track stays away', async () => {
    serve(failThen(boom, boom));
    seed([goal('cached')], true);
    renderAt('/?tab=progress&pview=find', LEAD);
    await goalsAlert();
    expect(await rowOf(STEED)).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();
  });

  it('Track a farm from Tracks only opens Find: no write, and no Track control waiting there', async () => {
    serve(failThen(boom, boom));
    seed([], false);
    renderAt('/?tab=progress', LEAD);
    await screen.findByTestId('progress-error');
    fireEvent.click(screen.getByRole('button', { name: 'Track a farm' }));
    await waitFor(() => expect(search().get('pview')).toBe('find'));
    await goalsAlert();
    await rowOf(STEED);
    expect(trackButtons()).toHaveLength(0);
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });
});

describe('what is not a goals failure', () => {
  it('failed cells stay Tracks\' business: no line in Find, and a lead keeps Track', async () => {
    serve(() => Promise.resolve(SERVER_GOALS));
    seed([], false);
    fetchProgress.mockResolvedValue({ error: 'cells down' });
    renderAt('/?tab=progress&pview=find', LEAD);
    expect(await within(await rowOf(STEED)).findByRole('button', { name: /^Track$/ })).toBeInTheDocument();
    expect(screen.queryByTestId('find-goals-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-error')).not.toBeInTheDocument();
  });

  it('an earlier mount\'s error stays out while this mount\'s fetch runs: the line is this fetch\'s answer', async () => {
    const held = deferred<void>();
    serve(() => Promise.resolve([]));
    seedPage({}, [], { ready: false });
    fetchGoals.mockReturnValue(held.promise);
    useCollectionGoalStore.setState({ error: 'an old failure' });
    renderAt('/?tab=progress&pview=find', LEAD);
    await rowOf(STEED);
    expect(screen.queryByTestId('find-goals-error')).not.toBeInTheDocument();
    held.resolve();
    expect(await goalsAlert()).toHaveTextContent('an old failure');
  });
});

describe('a normal load', () => {
  it('cold: the rows list while the goals load, with no control that reads them, then Track only where it is true', async () => {
    const held = deferred<unknown>();
    serve(() => held.promise);
    seed([], false);
    renderAt('/?tab=progress&pview=find', LEAD);
    const lynx = await rowOf(LYNX);
    expect(lynx).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();
    expect(screen.queryByTestId('find-goals-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress-loading')).not.toBeInTheDocument();

    held.resolve(SERVER_GOALS);
    expect(await within(await rowOf(STEED)).findByRole('button', { name: /^Track$/ })).toBeInTheDocument();
    expect(await within(await rowOf(LYNX)).findByText('Tracking ✓')).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(1);
    expect(customHint()).toBeInTheDocument();
  });

  it('warm: a cached list that lacks a farm never offers Track on it while the refetch runs', async () => {
    const held = deferred<unknown>();
    serve(() => held.promise);
    // The cache predates the Lynx farm: on it alone, Lynx reads untracked.
    seed([goal('cached')], true);
    renderAt('/?tab=progress&pview=find', LEAD);
    expect(await rowOf(LYNX)).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();

    held.resolve(SERVER_GOALS);
    expect(await within(await rowOf(LYNX)).findByText('Tracking ✓')).toBeInTheDocument();
    expect(trackButtons()).toHaveLength(1);
  });

  it('a list that belongs to another static offers nothing, though this mount\'s fetch has returned', async () => {
    // The store holds one static's goals: a slower response for the last static can land after ours.
    serve(() => Promise.resolve([]));
    seedPage({}, [], { ready: false });
    useCollectionGoalStore.setState({ loadedGroupId: 'g2' });
    renderAt('/?tab=progress&pview=find', LEAD);
    await waitFor(() => expect(fetchGoals).toHaveBeenCalled());
    await rowOf(STEED);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(trackButtons()).toHaveLength(0);
    expect(customHint()).not.toBeInTheDocument();
  });
});
