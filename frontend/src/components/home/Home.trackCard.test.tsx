/**
 * Home's farm card (S2a-4b·B1 Task TB1; E-8, E-9, D-11, D-12, R-F-10). Home does the fetching, so
 * these run the real goal store over a held `api.get`: a test decides when each response lands,
 * in which order, and asserts the card at every step. Home's other stores are mocked as
 * `Home.test.tsx` mocks them. `TrackCard.test.tsx` covers the card's text.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotPlayer, StaticGroup, TierSnapshot } from '../../types';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  fetchMountProgress: vi.fn(),
  mountData: null as unknown,
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
  useMountFarmStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ data: mocks.mountData, fetchProgress: mocks.fetchMountProgress }),
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
import { getAllTrialIds } from '../../gamedata';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { Home } from './Home';

// ── Fixtures ────────────────────────────────────────────────────────────────

const groupOf = (id: string, userRole: string | null) => ({ id, name: `Static ${id}`, shareCode: id, settings: {}, userRole }) as unknown as StaticGroup;
const G1 = groupOf('g1', 'member');
const G2 = groupOf('g2', 'member');

const player = (id: string, name: string, position: string, role: string, userId: string) =>
  ({ id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [] }) as unknown as SnapshotPlayer;
const tier = {
  id: 't1',
  tierId: 'aac-cruiserweight',
  players: [
    player('p1', 'Aya', 'T1', 'tank', 'u1'),
    player('p2', 'Bo', 'H1', 'healer', 'u2'),
    player('p3', 'Cy', 'M1', 'melee', 'u3'),
    player('p4', 'Dee', 'R1', 'caster', 'u4'),
  ],
} as unknown as TierSnapshot;

const goalsUrl = (groupId: string) => `/api/static-groups/${groupId}/collection-goals`;
const cellsUrl = (groupId: string) => `/api/static-groups/${groupId}/collection-participants`;

type CellSpec = [userId: string, state: string, tokenCount: number | null];

function apiCell(goalId: string, groupId: string, [userId, state, tokenCount]: CellSpec) {
  return {
    id: `${goalId}:${userId}`, goal_id: goalId, user_id: userId, static_group_id: groupId, state, token_count: tokenCount,
    priority_rank: null, source: 'manual', last_synced_at: null, notes: null, updated_at: '2026-10-01T00:00:00Z',
    display_name: userId, member_role: 'member', count_hidden: false, record: null,
  };
}
const apiCells = (goalId: string, groupId: string, cells: CellSpec[]) => ({
  goal_id: goalId,
  participants: cells.map((c) => apiCell(goalId, groupId, c)),
  record_only: [],
});

/** Static g1: "Zed Farm" has more Need, so it comes first even though "Alpha Farm" sorts first by name. */
const G1_GOALS = [apiGoal('alpha', { title: 'Alpha Farm' }), apiGoal('zed', { title: 'Zed Farm' })];
const G1_CELLS = [
  apiCells('alpha', 'g1', [['u1', 'need', 5]]),
  apiCells('zed', 'g1', [['u1', 'need', 70], ['u2', 'need', 62], ['u3', 'have', null], ['u4', 'pass', null]]),
];
const G2_GOALS = [apiGoal('bravo', { title: 'Bravo Farm', static_group_id: 'g2', token_cost: null })];
const G2_CELLS = [apiCells('bravo', 'g2', [['u3', 'want', 12]])];

// ── The held api ────────────────────────────────────────────────────────────

interface Held {
  url: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
let held: Held[] = [];
/** Answered at once. Anything else under `collection-` is held for `answer` or `refuse`. */
let served: [prefix: string, payload: unknown][] = [];

function apiGet(url: string): Promise<unknown> {
  if (!url.includes('/collection-')) return Promise.resolve([]);
  const hit = served.find(([prefix]) => url.startsWith(prefix));
  if (hit) return Promise.resolve(hit[1]);
  return new Promise((resolve, reject) => held.push({ url, resolve, reject }));
}

function serveStatic(groupId: string, goals: unknown[], cells: unknown[]) {
  served.push([goalsUrl(groupId), goals], [cellsUrl(groupId), cells]);
}

const requested = (prefix: string) => mocks.apiGet.mock.calls.filter(([url]) => String(url).startsWith(prefix)).length;

async function heldCall(prefix: string): Promise<Held> {
  await waitFor(() => expect(held.some((h) => h.url.startsWith(prefix))).toBe(true));
  const call = held.find((h) => h.url.startsWith(prefix))!;
  held = held.filter((h) => h !== call);
  return call;
}

async function answer(prefix: string, payload: unknown) {
  const call = await heldCall(prefix);
  await act(async () => call.resolve(payload));
}

async function refuse(prefix: string) {
  const call = await heldCall(prefix);
  await act(async () => call.reject(new Error('boom')));
}

function renderHome(group: StaticGroup = G1, homeTier: TierSnapshot | null = tier, effectiveRole?: string | null) {
  mocks.userRole = effectiveRole !== undefined ? effectiveRole : group.userRole;
  const onNavigate = vi.fn();
  const ui = (g: StaticGroup) => (
    <Home group={g} tier={homeTier} canManage={false} onNavigate={onNavigate} onOpenRequests={vi.fn()} />
  );
  const view = render(ui(group));
  return { onNavigate, unmount: view.unmount, switchTo: (g: StaticGroup) => view.rerender(ui(g)) };
}

const card = (title: string) => screen.queryByRole('button', { name: title });
const heading = () => screen.queryByRole('heading', { name: 'Farm' });

beforeEach(() => {
  held = [];
  served = [];
  mocks.apiGet.mockReset();
  mocks.apiGet.mockImplementation(apiGet);
  mocks.fetchMountProgress.mockReset();
  mocks.mountData = null;
  mocks.user = { id: 'u1' };
  mocks.viewAsUser = null;
  localStorage.clear();
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

// A held progress call left unanswered would keep the store's in-flight count up for the next test.
afterEach(async () => {
  const left = held;
  held = [];
  await act(async () => left.forEach((h) => h.resolve([])));
});

// ── The card on Home ────────────────────────────────────────────────────────

describe('the card on Home', () => {
  it('names the farm Progress lists first, with its tally, pips and next line', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome();
    expect(await screen.findByRole('button', { name: 'Zed Farm' })).toBeInTheDocument();
    expect(card('Alpha Farm')).toBeNull();
    expect(screen.getByText('1 of 3 have it')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Need: Aya, Bo; Have: Cy' })).toBeInTheDocument();
    expect(screen.getByText('Bo is next (62/99)')).toBeInTheDocument();
  });

  it('opens that farm from the title', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    const { onNavigate } = renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'Zed Farm' }));
    expect(onNavigate).toHaveBeenCalledWith('goals', { track: 'zed' });
  });

  it('sits under Recent activity, where the old card sat', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    const activity = headings.findIndex((t) => /recent activity/i.test(t ?? ''));
    expect(activity).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf('Farm')).toBeGreaterThan(activity);
  });

  it('retires the old mount-farm card and keeps the mount-farm fetch for the activity feed', async () => {
    mocks.mountData = { trials: [{ trialId: 'dt-valigarmanda', totalMembers: 8, membersComplete: 3, memberProgress: [] }] };
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });
    expect(screen.queryByText('Mount farm')).toBeNull();
    expect(screen.queryByText('Worqor Lar Dor (Extreme)')).toBeNull();
    expect(screen.queryByText(/3 of 8 have it/)).toBeNull();
    expect(mocks.fetchMountProgress).toHaveBeenCalledWith('g1', getAllTrialIds());
  });

  it('asks for the goals and the cells once each', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });
    expect(requested(goalsUrl('g1'))).toBe(1);
    expect(requested(cellsUrl('g1'))).toBe(1);
  });

  it('shows with no tier picked: the farms are the static\'s', async () => {
    // No roster means no claimed column, so no farm has a Need and Progress falls back to the title.
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome(G1, null);
    expect(await screen.findByRole('button', { name: 'Alpha Farm' })).toBeInTheDocument();
  });

  it('gives a viewer the tally and pips, and no next line or count', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome(groupOf('g1', 'viewer'));
    expect(await screen.findByRole('button', { name: 'Zed Farm' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3 have it')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Need: Aya, Bo; Have: Cy' })).toBeInTheDocument();
    expect(screen.queryByText(/is next/)).toBeNull();
    expect(screen.queryByText(/62/)).toBeNull();
  });

  it('gives an owner viewing as a viewer no next line, as the viewed role', async () => {
    mocks.viewAsUser = { userId: 'u2', role: 'viewer' };
    serveStatic('g1', G1_GOALS, G1_CELLS);
    renderHome(groupOf('g1', 'owner'), tier, 'viewer');
    expect(await screen.findByRole('button', { name: 'Zed Farm' })).toBeInTheDocument();
    expect(screen.queryByText(/is next/)).toBeNull();
  });
});

describe('when it hides on Home', () => {
  it('hides before the goals have landed', async () => {
    renderHome();
    await waitFor(() => expect(requested(goalsUrl('g1'))).toBe(1));
    expect(heading()).toBeNull();
    await answer(goalsUrl('g1'), G1_GOALS);
    await answer(cellsUrl('g1'), G1_CELLS);
    expect(await screen.findByRole('button', { name: 'Zed Farm' })).toBeInTheDocument();
  });

  it('hides with the goals in and the cells on their way, so no half-empty card shows', async () => {
    renderHome();
    await answer(goalsUrl('g1'), G1_GOALS);
    await waitFor(() => expect(requested(cellsUrl('g1'))).toBe(1));
    expect(heading()).toBeNull();
    expect(card('Zed Farm')).toBeNull();
    expect(card('Alpha Farm')).toBeNull();
  });

  it('hides on a failed cells fetch', async () => {
    renderHome();
    await answer(goalsUrl('g1'), G1_GOALS);
    await refuse(cellsUrl('g1'));
    await waitFor(() => expect(useCollectionGoalStore.getState().progressError).toBe('boom'));
    expect(heading()).toBeNull();
  });

  it('hides on a failed goals fetch, and the rest of Home still renders', async () => {
    renderHome();
    await refuse(goalsUrl('g1'));
    await waitFor(() => expect(useCollectionGoalStore.getState().error).toBe('boom'));
    expect(heading()).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument();
  });

  it('hides with no active farm', async () => {
    serveStatic('g1', [apiGoal('done', { status: 'complete', completed_at: '2026-10-01T00:00:00Z' })], []);
    renderHome();
    await waitFor(() => expect(useCollectionGoalStore.getState().loadedGroupId).toBe('g1'));
    await act(async () => undefined);
    expect(heading()).toBeNull();
  });

  it('hides for a guest, who sends no request of their own', async () => {
    // The control: a member on the same fixtures gets the card and sends both.
    serveStatic('g1', G1_GOALS, G1_CELLS);
    const member = renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });
    member.unmount();

    mocks.apiGet.mockClear();
    mocks.fetchMountProgress.mockClear();
    useCollectionGoalStore.setState({ goals: [], participants: {}, recordOnly: {}, loadedGroupId: null });
    renderHome(groupOf('g1', null));
    await act(async () => undefined);
    expect(heading()).toBeNull();
    expect(mocks.apiGet.mock.calls.filter(([url]) => String(url).includes('/collection-'))).toEqual([]);
    expect(mocks.fetchMountProgress).not.toHaveBeenCalled();
  });
});

describe('a static switch', () => {
  it('hides the old static\'s card at once, and keeps it hidden until the new static\'s cells land', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    const { switchTo } = renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });

    switchTo(G2);
    expect(card('Zed Farm')).toBeNull();
    expect(heading()).toBeNull();

    await answer(goalsUrl('g2'), G2_GOALS);
    await waitFor(() => expect(requested(cellsUrl('g2'))).toBe(1));
    expect(card('Zed Farm')).toBeNull();
    expect(card('Bravo Farm')).toBeNull();
    expect(heading()).toBeNull();

    await answer(cellsUrl('g2'), G2_CELLS);
    expect(await screen.findByRole('button', { name: 'Bravo Farm' })).toBeInTheDocument();
    expect(screen.getByText('Cy is next (12)')).toBeInTheDocument();
  });

  it('never shows the old static when its goals land late', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(requested(goalsUrl('g1'))).toBe(1));

    serveStatic('g2', G2_GOALS, G2_CELLS);
    switchTo(G2);
    await screen.findByRole('button', { name: 'Bravo Farm' });

    await answer(goalsUrl('g1'), G1_GOALS);
    expect(card('Zed Farm')).toBeNull();
    expect(card('Alpha Farm')).toBeNull();
  });

  it('hides when the new static\'s cells fail, and shows nothing of the old one', async () => {
    serveStatic('g1', G1_GOALS, G1_CELLS);
    const { switchTo } = renderHome();
    await screen.findByRole('button', { name: 'Zed Farm' });

    switchTo(G2);
    await answer(goalsUrl('g2'), G2_GOALS);
    await refuse(cellsUrl('g2'));
    await waitFor(() => expect(useCollectionGoalStore.getState().progressError).toBe('boom'));
    expect(heading()).toBeNull();
  });
});
