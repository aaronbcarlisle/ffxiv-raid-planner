/**
 * The Objectives card on Home (S2a-5a·C2a Task C2-1; R-M-5, C-2, C-3, C-4, Review Focus 1–3). Home
 * does the fetching, so these run the real objective store over a held `api.get`: a test decides
 * when each response lands, in which order, and asserts the card at every step. The store is
 * unkeyed with no staleness guard, so a late or failed read leaves another static's list in it.
 * Home's other stores are mocked as `Home.test.tsx` mocks them. `ObjectivesCard.test.tsx` covers
 * the card's text.
 *
 * "fetchObjectives is called" is counted at its route, the one thing a held `api.get` can see.
 * Every hide case starts from something only the feature does (a request it must have sent, or a
 * card it must have shown), so none of them passes on a Home with no card at all.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaticGroup, TierSnapshot } from '../../types';
import type { StaticObjectiveGoal } from '../../stores/objectiveGoalStore';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  user: { id: 'u1' } as { id: string } | null,
  userRole: 'member' as string | null | undefined,
  viewAsUser: null as { userId: string; role: string } | null,
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, api: { ...actual.api, get: mocks.apiGet } };
});
vi.mock('../loot/FairnessSummary', () => ({ FairnessSummary: () => <div data-testid="fairness-summary" /> }));
vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ sessions: [], submitRsvp: vi.fn(), fetchSessions: vi.fn() }),
}));
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groupRequests: [], pendingCount: 0, groupRequestsGroupId: 'g1', fetchGroupRequests: vi.fn() }),
}));
vi.mock('../../stores/lootTrackingStore', () => {
  const resolved = async () => undefined;
  const state = {
    lootLog: [],
    materialLog: [],
    pageLedger: [],
    pageBalances: [],
    materialBalances: [],
    currentWeek: 3,
    fetchLootLog: resolved,
    fetchPageLedger: resolved,
    fetchMaterialLog: resolved,
    fetchPageBalances: resolved,
    fetchMaterialBalances: resolved,
  };
  return { useLootTrackingStore: (sel: (s: Record<string, unknown>) => unknown) => sel(state) };
});
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => [] }));
vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ data: null, fetchProgress: vi.fn() }),
}));
vi.mock('../../stores/staticCharacterStore', () => ({
  useStaticCharacterStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ registrationsByGroup: {}, fetchRegistrations: async () => undefined }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ user: mocks.user }),
}));
vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({ userRole: mocks.userRole }),
}));
vi.mock('../../stores/viewAsStore', () => ({
  useViewAsStore: (sel: (s: Record<string, unknown>) => unknown) => sel({ viewAsUser: mocks.viewAsUser }),
}));

import { apiGoal } from '../progress/__fixtures__/progressFixtures';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { Home } from './Home';

// ── Fixtures ────────────────────────────────────────────────────────────────

const groupOf = (id: string, userRole: string | null) =>
  ({ id, name: `Static ${id}`, shareCode: id, settings: {}, userRole }) as unknown as StaticGroup;
const G1 = groupOf('g1', 'member');
const G2 = groupOf('g2', 'member');

const tierOf = (tierId: string, isActive: boolean) => ({ id: tierId, tierId, isActive, players: [] }) as unknown as TierSnapshot;
const ACTIVE = tierOf('aac-cruiserweight', true);
const OTHER_ACTIVE = tierOf('aac-heavyweight', true);
const PAST = tierOf('aac-light-heavyweight', false);

/** As the server sends it: camelCase, with no mapper in the store. */
function objective(id: string, groupId: string, title: string, priority = 'required'): StaticObjectiveGoal {
  return {
    id,
    staticGroupId: groupId,
    createdById: null,
    category: 'savage_bis',
    title,
    description: null,
    priority,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };
}

const G1_ROW = 'First static objective';
const G2_ROW = 'Second static objective';
const G1_LIST = [objective('a', 'g1', G1_ROW)];
const G2_LIST = [objective('b', 'g2', G2_ROW)];

// ── The held api ────────────────────────────────────────────────────────────

const objectivesUrl = (groupId: string) => `/api/static-groups/${groupId}/objective-goals`;

interface Held {
  url: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
let held: Held[] = [];
/** Answered at once. Any other objectives read is held for `answer` or `refuse`. */
let served: Record<string, unknown> = {};

function apiGet(url: string): Promise<unknown> {
  if (!url.includes('/objective-goals')) {
    const prefix = Object.keys(served).find((key) => url.startsWith(key));
    return Promise.resolve(prefix ? served[prefix] : []);
  }
  if (url in served) return Promise.resolve(served[url]);
  return new Promise((resolve, reject) => held.push({ url, resolve, reject }));
}

const serve = (groupId: string, list: StaticObjectiveGoal[]) => {
  served[objectivesUrl(groupId)] = list;
};
const stopServing = (groupId: string) => {
  delete served[objectivesUrl(groupId)];
};

const asked = (groupId?: string) =>
  mocks.apiGet.mock.calls.filter(([url]) => (groupId ? String(url) === objectivesUrl(groupId) : String(url).includes('/objective-goals'))).length;

async function heldCall(groupId: string): Promise<Held> {
  const url = objectivesUrl(groupId);
  await waitFor(() => expect(held.some((h) => h.url === url)).toBe(true));
  const call = held.find((h) => h.url === url)!;
  held = held.filter((h) => h !== call);
  return call;
}

async function answer(groupId: string, list: StaticObjectiveGoal[]) {
  const call = await heldCall(groupId);
  await act(async () => call.resolve(list));
}

async function refuse(groupId: string) {
  const call = await heldCall(groupId);
  await act(async () => call.reject(new Error('boom')));
  await waitFor(() => expect(useObjectiveGoalStore.getState().objectivesError).toBe('boom'));
}

// ── Rendering ───────────────────────────────────────────────────────────────

interface RenderOptions {
  group?: StaticGroup;
  tier?: TierSnapshot | null;
  canManage?: boolean;
  /** The effective role, when it isn't the group's own (masked admin, View As). */
  role?: string | null;
  onEditObjectives?: () => void;
}

function renderHome({ group = G1, tier = ACTIVE, canManage = false, role, onEditObjectives }: RenderOptions = {}) {
  mocks.userRole = role !== undefined ? role : group.userRole;
  const ui = (g: StaticGroup, t: TierSnapshot | null) => (
    <Home group={g} tier={t} canManage={canManage} onNavigate={vi.fn()} onOpenRequests={vi.fn()} onEditObjectives={onEditObjectives} />
  );
  const view = render(ui(group, tier));
  return {
    unmount: view.unmount,
    setTier: (t: TierSnapshot | null) => view.rerender(ui(group, t)),
    switchTo: (g: StaticGroup) => {
      mocks.userRole = g.userRole;
      view.rerender(ui(g, tier));
    },
  };
}

const heading = () => screen.queryByRole('heading', { name: 'Objectives' });
const rowTitle = (title: string) => screen.queryByText(title);

/** The card on screen, with this static's row. */
async function expectCard(title: string) {
  expect(await screen.findByRole('heading', { name: 'Objectives' })).toBeInTheDocument();
  expect(rowTitle(title)).toBeInTheDocument();
}

/** The request was sent and has settled, so an absent card means hidden, not early. */
async function settledAfterAsking(groupId: string) {
  await waitFor(() => expect(asked(groupId)).toBe(1));
  await act(async () => undefined);
}

function clearStore() {
  useObjectiveGoalStore.setState({ objectives: [], loading: false, error: null, objectivesError: null });
}

beforeEach(() => {
  held = [];
  served = {};
  mocks.apiGet.mockReset();
  mocks.apiGet.mockImplementation(apiGet);
  mocks.user = { id: 'u1' };
  mocks.viewAsUser = null;
  localStorage.clear();
  clearStore();
  useCollectionGoalStore.setState({
    goals: [],
    participants: {},
    recordOnly: {},
    loadedGroupId: null,
    isLoading: false,
    error: null,
    progressLoading: false,
    progressError: null,
  });
});

// A held read left unanswered would land on the next test's store.
afterEach(async () => {
  const left = held;
  held = [];
  await act(async () => left.forEach((h) => h.resolve([])));
  cleanup();
});

// ── Who asks ────────────────────────────────────────────────────────────────

describe('the fetch', () => {
  it('asks once for a member, and the card shows what lands', async () => {
    renderHome();
    await answer('g1', G1_LIST);
    await expectCard(G1_ROW);
    expect(asked('g1')).toBe(1);
    expect(asked()).toBe(1);
  });

  it('asks once for a viewer, and the card shows to them (C-3)', async () => {
    renderHome({ group: groupOf('g1', 'viewer') });
    await answer('g1', G1_LIST);
    await expectCard(G1_ROW);
    expect(asked('g1')).toBe(1);
  });

  it('never asks for a guest, who sees no card', async () => {
    // The control: a member on the same fixtures gets the card.
    serve('g1', G1_LIST);
    const member = renderHome();
    await expectCard(G1_ROW);
    member.unmount();

    mocks.apiGet.mockClear();
    clearStore();
    renderHome({ group: groupOf('g1', null) });
    await act(async () => undefined);
    expect(asked()).toBe(0);
    expect(heading()).toBeNull();
  });

  it('shows a guest no card even when the store still holds this static\'s rows', async () => {
    serve('g1', G1_LIST);
    const member = renderHome();
    await expectCard(G1_ROW);
    member.unmount();

    renderHome({ group: groupOf('g1', null) });
    await act(async () => undefined);
    expect(heading()).toBeNull();
  });

  it('asks when the role arrives on the same static', async () => {
    serve('g1', G1_LIST);
    const { switchTo } = renderHome({ group: groupOf('g1', null) });
    await act(async () => undefined);
    expect(asked()).toBe(0);
    switchTo(groupOf('g1', 'member'));
    await expectCard(G1_ROW);
    expect(asked('g1')).toBe(1);
  });

  it('uses the actual role: a masked admin\'s request goes out, and they see no card', async () => {
    serve('g1', G1_LIST);
    renderHome({ group: groupOf('g1', 'owner'), role: null });
    await settledAfterAsking('g1');
    expect(heading()).toBeNull();
    expect(rowTitle(G1_ROW)).toBeNull();
  });

  it('asks again on a static switch', async () => {
    serve('g1', G1_LIST);
    serve('g2', G2_LIST);
    const { switchTo } = renderHome();
    await expectCard(G1_ROW);
    switchTo(G2);
    await expectCard(G2_ROW);
    expect(asked('g1')).toBe(1);
    expect(asked('g2')).toBe(1);
  });

  it('does not ask again on a tier switch, and the card stays', async () => {
    serve('g1', G1_LIST);
    const { setTier } = renderHome();
    await expectCard(G1_ROW);

    setTier(OTHER_ACTIVE);
    await act(async () => undefined);
    setTier(PAST);
    await act(async () => undefined);
    setTier(null);
    await act(async () => undefined);
    expect(asked('g1')).toBe(1);
    expect(rowTitle(G1_ROW)).toBeInTheDocument();
  });

  it('does not ask again for a fresh object of the same static', async () => {
    serve('g1', G1_LIST);
    const { switchTo } = renderHome();
    await expectCard(G1_ROW);
    switchTo({ ...G1 } as StaticGroup);
    await act(async () => undefined);
    expect(asked('g1')).toBe(1);
  });
});

// ── Tiers and place ─────────────────────────────────────────────────────────

describe('the card on Home', () => {
  it('shows with no tier picked: objectives are the static\'s', async () => {
    serve('g1', G1_LIST);
    renderHome({ tier: null });
    await expectCard(G1_ROW);
  });

  it('shows on a past tier', async () => {
    serve('g1', G1_LIST);
    renderHome({ tier: PAST });
    await expectCard(G1_ROW);
  });

  it('comes after the Farm card in the DOM, in the same column, and after Recent activity (C-2)', async () => {
    serve('g1', G1_LIST);
    served['/api/static-groups/g1/collection-goals'] = [apiGoal('zed', { title: 'Zed Farm' })];
    served['/api/static-groups/g1/collection-participants'] = [{ goal_id: 'zed', participants: [], record_only: [] }];
    renderHome();
    const farm = await screen.findByRole('heading', { name: 'Farm' });
    await expectCard(G1_ROW);

    const objectives = heading()!;
    expect(farm.compareDocumentPosition(objectives) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const activity = screen.getByRole('heading', { name: /recent activity/i });
    expect(activity.compareDocumentPosition(farm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The smallest block holding both is the right column: it has the activity feed, not Home's left side.
    let column: HTMLElement = farm;
    while (!column.contains(objectives)) column = column.parentElement!;
    expect(column).toContainElement(activity);
    expect(column).not.toContainElement(screen.getByText("You're all caught up"));
  });

  it('shows with no farm at all: it does not depend on the Farm card', async () => {
    serve('g1', G1_LIST);
    renderHome();
    await expectCard(G1_ROW);
    expect(screen.queryByRole('heading', { name: 'Farm' })).toBeNull();
  });

  it('gives a manager Edit, which calls onEditObjectives once', async () => {
    serve('g1', G1_LIST);
    const onEditObjectives = vi.fn();
    renderHome({ group: groupOf('g1', 'owner'), canManage: true, onEditObjectives });
    await expectCard(G1_ROW);
    fireEvent.click(screen.getByRole('button', { name: 'Edit objectives' }));
    expect(onEditObjectives).toHaveBeenCalledTimes(1);
  });

  it('gives a member the same card with no Edit', async () => {
    serve('g1', G1_LIST);
    renderHome({ onEditObjectives: vi.fn() });
    await expectCard(G1_ROW);
    expect(screen.queryByRole('button', { name: 'Edit objectives' })).toBeNull();
  });

  it('gives an owner viewing as a viewer the card with no Edit, as canManage says', async () => {
    mocks.viewAsUser = { userId: 'u2', role: 'viewer' };
    serve('g1', G1_LIST);
    renderHome({ group: groupOf('g1', 'owner'), role: 'viewer', canManage: false, onEditObjectives: vi.fn() });
    await expectCard(G1_ROW);
    expect(screen.queryByRole('button', { name: 'Edit objectives' })).toBeNull();
  });
});

// ── Review Focus 1: another static's objectives ─────────────────────────────

describe('another static\'s objectives', () => {
  it('drops the old rows at once on a switch, and stays hidden until the new static answers', async () => {
    serve('g1', G1_LIST);
    const { switchTo } = renderHome();
    await expectCard(G1_ROW);

    switchTo(G2);
    expect(rowTitle(G1_ROW)).toBeNull();
    expect(heading()).toBeNull();

    await waitFor(() => expect(asked('g2')).toBe(1));
    expect(rowTitle(G1_ROW)).toBeNull();
    expect(heading()).toBeNull();

    await answer('g2', G2_LIST);
    await expectCard(G2_ROW);
    expect(rowTitle(G1_ROW)).toBeNull();
  });

  it('shows nothing of the old static when the new static\'s fetch fails', async () => {
    serve('g1', G1_LIST);
    const { switchTo } = renderHome();
    await expectCard(G1_ROW);

    switchTo(G2);
    await refuse('g2');
    expect(useObjectiveGoalStore.getState().objectives).toEqual(G1_LIST);
    expect(rowTitle(G1_ROW)).toBeNull();
    expect(heading()).toBeNull();
  });

  it('shows nothing when the old read lands during the new one, then the new one fails', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(asked('g1')).toBe(1));
    switchTo(G2);
    await waitFor(() => expect(asked('g2')).toBe(1));

    await answer('g1', G1_LIST);
    expect(rowTitle(G1_ROW)).toBeNull();
    await refuse('g2');
    expect(useObjectiveGoalStore.getState().objectives).toEqual(G1_LIST);
    expect(rowTitle(G1_ROW)).toBeNull();
    expect(heading()).toBeNull();
  });

  it('never lists the old static when its read lands after the new one', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(asked('g1')).toBe(1));
    switchTo(G2);
    await answer('g2', G2_LIST);
    await expectCard(G2_ROW);

    await answer('g1', G1_LIST);
    expect(rowTitle(G1_ROW)).toBeNull();
  });

  it('shows the new rows when the old read lands first', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(asked('g1')).toBe(1));
    switchTo(G2);
    await waitFor(() => expect(asked('g2')).toBe(1));

    await answer('g1', G1_LIST);
    await answer('g2', G2_LIST);
    await expectCard(G2_ROW);
    expect(rowTitle(G1_ROW)).toBeNull();
  });

  it('ignores what another static left in the store on a fresh mount', async () => {
    useObjectiveGoalStore.setState({ objectives: G2_LIST });
    renderHome();
    await waitFor(() => expect(asked('g1')).toBe(1));
    expect(rowTitle(G2_ROW)).toBeNull();
    expect(heading()).toBeNull();
    await answer('g1', G1_LIST);
    await expectCard(G1_ROW);
  });
});

// ── Review Focus 2: a failed fetch ──────────────────────────────────────────

describe('a failed fetch', () => {
  it('keeps a warm list on return to Home, then hides it when the refetch fails', async () => {
    serve('g1', G1_LIST);
    const first = renderHome();
    await expectCard(G1_ROW);
    first.unmount();

    stopServing('g1');
    renderHome();
    await waitFor(() => expect(asked('g1')).toBe(2));
    expect(useObjectiveGoalStore.getState().loading).toBe(true);
    expect(rowTitle(G1_ROW)).toBeInTheDocument();

    await refuse('g1');
    expect(useObjectiveGoalStore.getState().objectives).toEqual(G1_LIST);
    expect(rowTitle(G1_ROW)).toBeNull();
    expect(heading()).toBeNull();
  });

  it('hides with no line and no Retry, and the rest of Home still renders (C-4)', async () => {
    renderHome();
    await refuse('g1');
    expect(heading()).toBeNull();
    expect(screen.queryByText(/couldn.t load objectives/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument();
  });

  it('comes back on the next successful mount', async () => {
    const failed = renderHome();
    await refuse('g1');
    failed.unmount();

    serve('g1', G1_LIST);
    renderHome();
    await expectCard(G1_ROW);
  });
});

// ── Review Focus 3 and the empty cases ──────────────────────────────────────

describe('nothing to show', () => {
  it('has no card, no heading and no empty copy when every objective is Not Doing', async () => {
    serve('g1', [objective('n', 'g1', 'Skipped thing', 'not_doing')]);
    renderHome();
    await settledAfterAsking('g1');
    expect(useObjectiveGoalStore.getState().objectives).toHaveLength(1);
    expect(heading()).toBeNull();
    expect(rowTitle('Skipped thing')).toBeNull();
    expect(screen.queryByText(/no objectives/i)).toBeNull();
  });

  it('has no card with an empty list', async () => {
    serve('g1', []);
    renderHome();
    await settledAfterAsking('g1');
    expect(heading()).toBeNull();
    expect(screen.queryByText(/no objectives/i)).toBeNull();
  });

  it('has no card while the first read is on its way, then shows', async () => {
    renderHome();
    await waitFor(() => expect(asked('g1')).toBe(1));
    expect(heading()).toBeNull();
    await answer('g1', G1_LIST);
    await expectCard(G1_ROW);
  });
});
