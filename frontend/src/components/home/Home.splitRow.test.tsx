/**
 * Home's Split clears row (S2a-4b·B2 Task TB2; D-13, E-8, E-11, R-F-11). Home fetches it, so these
 * run the real split-clear store over a held `api.get`: a test decides when each response lands, in
 * which order, and asserts the row at every step. Home's other stores are mocked as `Home.test.tsx`
 * mocks them.
 *
 * Every hide case starts from something only the feature does (a request it must have sent, or a
 * row it must have shown), so none of them passes on a Home with no row at all.
 *
 * A member with no alt always has a warning (`getSplitClearWarnings`), so through the real helper n
 * is at least y - x, and n = 0 means x = y. The row's literal "3/8 · 2" is reached with the helper
 * stubbed; the real helper's cases use numbers it can produce.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  JoinRequest,
  SnapshotPlayer,
  SplitClearAssignment,
  SplitClearData,
  StaticGroup,
  TierSnapshot,
} from '../../types';
import type { SplitClearReadiness } from '../../utils/splitClear';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  groupRequests: [] as unknown[],
  user: { id: 'u1' } as { id: string } | null,
  userRole: 'member' as string | null | undefined,
  viewAsUser: null as { userId: string; role: string } | null,
  readinessStub: null as unknown,
  readinessCalls: [] as [players: { id: string }[], assignments: unknown[]][],
}));

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, api: { ...actual.api, get: mocks.apiGet } };
});
vi.mock('../../utils/splitClear', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/splitClear')>();
  return {
    ...actual,
    getSplitClearReadiness: (players: SnapshotPlayer[], assignments: SplitClearAssignment[]) => {
      mocks.readinessCalls.push([players, assignments]);
      return mocks.readinessStub ?? actual.getSplitClearReadiness(players, assignments);
    },
  };
});
vi.mock('../loot/FairnessSummary', () => ({ FairnessSummary: () => <div data-testid="fairness-summary" /> }));
vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ sessions: [], submitRsvp: vi.fn(), fetchSessions: vi.fn() }),
}));
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groupRequests: mocks.groupRequests, pendingCount: 0, groupRequestsGroupId: 'g1', fetchGroupRequests: vi.fn() }),
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

import { Button } from '../primitives/Button';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { Home } from './Home';

// ── Fixtures ────────────────────────────────────────────────────────────────

const groupOf = (id: string, userRole: string | null) =>
  ({ id, name: `Static ${id}`, shareCode: id, settings: {}, userRole }) as unknown as StaticGroup;
const G1 = groupOf('g1', 'member');
const G2 = groupOf('g2', 'member');

const WITH_BIS = [{ bisSource: 'raid' }];

function player(id: string, overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id,
    name: `Player ${id}`,
    job: 'PLD',
    role: 'tank',
    position: 'T1',
    configured: true,
    isSubstitute: false,
    sortOrder: 0,
    userId: `user-${id}`,
    gear: WITH_BIS,
    ...overrides,
  } as unknown as SnapshotPlayer;
}

/** Eight raiders, a substitute and an empty seat. The last two must not count (E-11). */
const RAIDERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((id) => player(id));
const ROSTER = [...RAIDERS, player('sub', { isSubstitute: true }), player('empty', { configured: false, userId: undefined })];

const tierOf = (tierId: string, isActive: boolean, players: SnapshotPlayer[] = ROSTER) =>
  ({ id: tierId, tierId, isActive, players }) as unknown as TierSnapshot;
const ACTIVE = tierOf('aac-cruiserweight', true);
const PAST = tierOf('aac-light-heavyweight', false);

function assignment(snapshotPlayerId: string, overrides: Partial<SplitClearAssignment> = {}): SplitClearAssignment {
  return {
    id: `a-${snapshotPlayerId}`,
    snapshotPlayerId,
    runACharacterLinkId: null,
    runBCharacterLinkId: null,
    mainCharacterName: `Main ${snapshotPlayerId}`,
    mainCharacterWorld: 'Gilgamesh',
    altCharacterName: `Alt ${snapshotPlayerId}`,
    altCharacterWorld: 'Gilgamesh',
    runACharacter: 'main',
    runBCharacter: 'alt',
    lootTarget: 'normal',
    lootTargetJob: null,
    runACleared: false,
    runBCleared: false,
    notes: null,
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const splitOn = (assignments: SplitClearAssignment[] = []): SplitClearData => ({ enabled: true, assignments });
const SPLIT_OFF: SplitClearData = { enabled: false, assignments: [] };

/** Every raider is complete, so nobody has a warning. */
const COMPLETE = RAIDERS.map((p) => assignment(p.id));

/**
 * Six raiders with alts, two with none, and the substitute and the empty seat with alts:
 * x = 6, y = 8, and two members with warnings (several each).
 */
const SIX_OF_EIGHT = [
  ...RAIDERS.slice(0, 6).map((p) => assignment(p.id)),
  assignment('sub'),
  assignment('empty'),
];

function joinRequest(id: string): JoinRequest {
  return {
    id,
    staticGroupId: 'g1',
    requesterUserId: `req-${id}`,
    status: 'pending',
    characterNameAtApply: `Applicant ${id}`,
    createdAt: '2026-10-01T00:00:00Z',
  } as unknown as JoinRequest;
}

// ── The held api ────────────────────────────────────────────────────────────

const splitUrl = (groupId: string) => `/api/static-groups/${groupId}/split-clear`;

interface Held {
  url: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
let held: Held[] = [];
/** Answered at once. Any other split-clear read is held for `answer` or `refuse`. */
let served: Record<string, SplitClearData> = {};

function apiGet(url: string): Promise<unknown> {
  if (!url.includes('/split-clear')) return Promise.resolve([]);
  const hit = served[url];
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => held.push({ url, resolve, reject }));
}

const serveSplit = (groupId: string, data: SplitClearData) => {
  served[splitUrl(groupId)] = data;
};

const splitRequests = (groupId?: string) =>
  mocks.apiGet.mock.calls.filter(([url]) => (groupId ? String(url) === splitUrl(groupId) : String(url).includes('/split-clear'))).length;

async function heldCall(url: string): Promise<Held> {
  await waitFor(() => expect(held.some((h) => h.url === url)).toBe(true));
  const call = held.find((h) => h.url === url)!;
  held = held.filter((h) => h !== call);
  return call;
}

async function answer(groupId: string, payload: SplitClearData) {
  const call = await heldCall(splitUrl(groupId));
  await act(async () => call.resolve(payload));
}

async function refuse(groupId: string) {
  const call = await heldCall(splitUrl(groupId));
  await act(async () => call.reject(new Error('boom')));
}

interface RenderOptions {
  group?: StaticGroup;
  tier?: TierSnapshot | null;
  canManage?: boolean;
  /** The effective role, when it isn't the group's own (View As). */
  role?: string | null;
}

function renderHome({ group = G1, tier = ACTIVE, canManage = false, role }: RenderOptions = {}) {
  mocks.userRole = role !== undefined ? role : group.userRole;
  const onNavigate = vi.fn();
  const ui = (g: StaticGroup, t: TierSnapshot | null) => (
    <Home group={g} tier={t} canManage={canManage} onNavigate={onNavigate} onOpenRequests={vi.fn()} />
  );
  const view = render(ui(group, tier));
  return {
    onNavigate,
    unmount: view.unmount,
    setTier: (t: TierSnapshot | null) => view.rerender(ui(group, t)),
    switchTo: (g: StaticGroup, t: TierSnapshot | null = tier) => view.rerender(ui(g, t)),
  };
}

const rowTitle = () => screen.queryByText('Split clears', { exact: true });
const openPlan = () => screen.queryByRole('button', { name: 'Open split plan' });
const metaLine = () => screen.queryByText(/^Alts assigned /);
const EMPTY_TITLE = "You're all caught up";

/** A settled render with the row on screen: what each hide case below starts from. */
async function expectRow() {
  expect(await screen.findByRole('button', { name: 'Open split plan' })).toBeInTheDocument();
}

/** The control for a "nothing was asked for" case: the same fixtures do ask, on the active tier. */
async function memberAsksFirst(group: StaticGroup = G1) {
  serveSplit(group.id, splitOn(COMPLETE));
  const first = renderHome({ group: { ...group, userRole: 'member' } as StaticGroup });
  await expectRow();
  first.unmount();
  mocks.apiGet.mockClear();
  useSplitClearStore.setState({ data: null, error: null, isLoading: false });
}

beforeEach(() => {
  held = [];
  served = {};
  mocks.apiGet.mockReset();
  mocks.apiGet.mockImplementation(apiGet);
  mocks.groupRequests = [];
  mocks.user = { id: 'u1' };
  mocks.viewAsUser = null;
  mocks.readinessStub = null;
  mocks.readinessCalls = [];
  localStorage.clear();
  useSplitClearStore.setState({ data: null, isLoading: false, isSaving: false, error: null });
});

// A held read left unanswered would land on the next test's store.
afterEach(async () => {
  const left = held;
  held = [];
  await act(async () => left.forEach((h) => h.resolve(SPLIT_OFF)));
  cleanup();
});

// ── The row ─────────────────────────────────────────────────────────────────

describe('the row', () => {
  it('reads "Alts assigned 3/8 · 2 need attention" from the readiness numbers', async () => {
    mocks.readinessStub = { altCount: 3, memberCount: 8, issueCount: 7, issueMemberCount: 2 } satisfies SplitClearReadiness;
    serveSplit('g1', splitOn(COMPLETE));
    renderHome();
    await expectRow();
    expect(rowTitle()).toBeInTheDocument();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 3\/8 · 2 need attention$/);
  });

  it('counts members in n, as legacy\'s card does, not warnings', async () => {
    // Each of the two has several warnings, so issueCount would read far above 2.
    serveSplit('g1', splitOn(SIX_OF_EIGHT));
    renderHome();
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 6\/8 · 2 need attention$/);
  });

  it('has no " · …" part with n = 0', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    renderHome();
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 8\/8$/);
    expect(screen.queryByText(/need attention/)).toBeNull();
  });

  it('counts configured non-substitutes only, and hands the helper the static\'s assignments (E-11)', async () => {
    serveSplit('g1', splitOn(SIX_OF_EIGHT));
    renderHome();
    await expectRow();
    const [players, assignments] = mocks.readinessCalls[mocks.readinessCalls.length - 1];
    expect(players.map((p) => p.id)).toEqual(RAIDERS.map((p) => p.id));
    expect(assignments).toEqual(SIX_OF_EIGHT);
  });

  it('reads 0/0 on an empty roster: split clears are on, so legacy\'s card shows and so does the row', async () => {
    serveSplit('g1', splitOn([]));
    renderHome({ tier: tierOf('aac-cruiserweight', true, []) });
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 0\/0$/);
  });

  it('counts everyone as missing with no assignment at all', async () => {
    serveSplit('g1', splitOn([]));
    renderHome();
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 0\/8 · 8 need attention$/);
  });

  it('opens the split plan: "Open split plan" navigates to the tier row', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { onNavigate } = renderHome();
    await expectRow();
    fireEvent.click(openPlan()!);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('goals', { track: 'tier' });
  });

  it('uses a secondary small Button, the ruled action (R-F-11)', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    renderHome();
    await expectRow();
    render(<Button variant="secondary" size="sm">Reference</Button>);
    expect(openPlan()!.className).toBe(screen.getByRole('button', { name: 'Reference' }).className);
  });

  it('asks once per mount, and a fresh tier object for the same tier does not ask again', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { setTier } = renderHome();
    await expectRow();
    setTier({ ...ACTIVE } as TierSnapshot);
    await act(async () => undefined);
    expect(splitRequests('g1')).toBe(1);
  });
});

// ── Who sees it ─────────────────────────────────────────────────────────────

describe('who sees it', () => {
  it('shows to a viewer, who gets the same action', async () => {
    serveSplit('g1', splitOn(SIX_OF_EIGHT));
    const { onNavigate } = renderHome({ group: groupOf('g1', 'viewer') });
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 6\/8 · 2 need attention$/);
    fireEvent.click(openPlan()!);
    expect(onNavigate).toHaveBeenCalledWith('goals', { track: 'tier' });
  });

  it('shows to a lead', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    renderHome({ group: groupOf('g1', 'lead'), canManage: true });
    await expectRow();
  });

  it('shows to an owner viewing as a viewer, as the viewed role would see it', async () => {
    mocks.viewAsUser = { userId: 'u2', role: 'viewer' };
    serveSplit('g1', splitOn(COMPLETE));
    renderHome({ group: groupOf('g1', 'owner'), role: 'viewer' });
    await expectRow();
  });

  it('hides from a guest, who sends no split-clear request', async () => {
    await memberAsksFirst();
    renderHome({ group: groupOf('g1', null) });
    await act(async () => undefined);
    expect(openPlan()).toBeNull();
    expect(splitRequests()).toBe(0);
  });
});

// ── When it hides ───────────────────────────────────────────────────────────

describe('when it hides', () => {
  it('hides with split clears off, once they are known to be off', async () => {
    renderHome();
    await answer('g1', SPLIT_OFF);
    expect(rowTitle()).toBeNull();
    expect(openPlan()).toBeNull();
    expect(splitRequests('g1')).toBe(1);
  });

  it('hides while the read is on its way', async () => {
    renderHome();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    expect(openPlan()).toBeNull();
    await answer('g1', splitOn(COMPLETE));
    await expectRow();
  });

  it('hides on a failed read, and the rest of Home still renders', async () => {
    renderHome();
    await refuse('g1');
    await waitFor(() => expect(useSplitClearStore.getState().error).toMatch(/boom/));
    expect(openPlan()).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument();
  });

  it('hides when the payload has no enabled flag', async () => {
    renderHome();
    await answer('g1', { assignments: COMPLETE } as unknown as SplitClearData);
    expect(openPlan()).toBeNull();
  });

  it('never reads what the shared store already holds: Progress may have left another static\'s plan there', async () => {
    useSplitClearStore.setState({ data: splitOn(COMPLETE) });
    renderHome();
    expect(openPlan()).toBeNull();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    expect(openPlan()).toBeNull();
    await answer('g1', SPLIT_OFF);
    expect(openPlan()).toBeNull();
  });
});

// ── Past tiers and tier switches ────────────────────────────────────────────

describe('tiers', () => {
  it('on a past tier shows no row and makes no split-clear request', async () => {
    await memberAsksFirst();
    renderHome({ tier: PAST });
    await act(async () => undefined);
    expect(openPlan()).toBeNull();
    expect(splitRequests()).toBe(0);
  });

  it('with no tier picked shows no row and makes no split-clear request', async () => {
    await memberAsksFirst();
    renderHome({ tier: null });
    await act(async () => undefined);
    expect(openPlan()).toBeNull();
    expect(splitRequests()).toBe(0);
  });

  it('asks when a past tier switches to the active one', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { setTier } = renderHome({ tier: PAST });
    await act(async () => undefined);
    expect(splitRequests('g1')).toBe(0);

    setTier(ACTIVE);
    await expectRow();
    expect(splitRequests('g1')).toBe(1);
  });

  it('hides at once when the active tier switches to a past one, and asks nothing more', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { setTier } = renderHome();
    await expectRow();

    setTier(PAST);
    expect(openPlan()).toBeNull();
    await act(async () => undefined);
    expect(openPlan()).toBeNull();
    expect(splitRequests('g1')).toBe(1);
  });

  it('shows no row when the active tier\'s read lands after a switch to a past tier', async () => {
    const { setTier } = renderHome();
    const late = await heldCall(splitUrl('g1'));
    setTier(PAST);
    await act(async () => late.resolve(splitOn(COMPLETE)));
    expect(openPlan()).toBeNull();
  });

  it('asks when the tier on screen becomes the active one', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { setTier } = renderHome({ tier: tierOf('aac-cruiserweight', false) });
    await act(async () => undefined);
    expect(splitRequests('g1')).toBe(0);

    setTier(ACTIVE);
    await expectRow();
    expect(splitRequests('g1')).toBe(1);
  });
});

// ── A static switch ─────────────────────────────────────────────────────────

describe('a static switch', () => {
  it('hides the old static\'s row at once, and keeps it hidden until the new static answers', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    const { switchTo } = renderHome();
    await expectRow();

    switchTo(G2);
    expect(openPlan()).toBeNull();
    await waitFor(() => expect(splitRequests('g2')).toBe(1));
    expect(openPlan()).toBeNull();

    await answer('g2', splitOn(SIX_OF_EIGHT));
    await expectRow();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 6\/8 · 2 need attention$/);
  });

  it('shows no row when the old static\'s result lands after the switch', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    switchTo(G2);
    await waitFor(() => expect(splitRequests('g2')).toBe(1));

    await answer('g1', splitOn(COMPLETE));
    expect(openPlan()).toBeNull();
    await answer('g2', SPLIT_OFF);
    expect(openPlan()).toBeNull();
  });

  it('keeps the new static\'s row when the old static\'s result lands last', async () => {
    const { switchTo } = renderHome();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    switchTo(G2);
    await waitFor(() => expect(splitRequests('g2')).toBe(1));

    await answer('g2', splitOn(COMPLETE));
    await expectRow();
    await answer('g1', SPLIT_OFF);
    expect(openPlan()).toBeInTheDocument();
    expect(metaLine()).toHaveTextContent(/^Alts assigned 8\/8$/);
  });

  it('shows nothing of the old static when the new static\'s read fails after the old one landed', async () => {
    // The store is unkeyed: the late g1 result sits in `data` when g2's failure leaves `data` alone.
    const { switchTo } = renderHome();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    switchTo(G2);
    await waitFor(() => expect(splitRequests('g2')).toBe(1));

    await answer('g1', splitOn(COMPLETE));
    await refuse('g2');
    await waitFor(() => expect(useSplitClearStore.getState().error).toMatch(/boom/));
    expect(openPlan()).toBeNull();
  });
});

// ── With the other attention rows ───────────────────────────────────────────

describe('with the other rows', () => {
  const ROW_ACTIONS = /^(Import BiS|Assign|Review|Open split plan)$/;

  it('goes after every existing row, keeps their order and caps, and is not capped itself', async () => {
    mocks.groupRequests = ['r1', 'r2', 'r3', 'r4', 'r5'].map(joinRequest);
    const noBis = ['a', 'b', 'c', 'd', 'e'].map((id) => player(id, { gear: [] as SnapshotPlayer['gear'] }));
    const unclaimed = ['f', 'g', 'h', 'i', 'j'].map((id) => player(id, { userId: undefined }));
    serveSplit('g1', splitOn([]));
    renderHome({ group: groupOf('g1', 'owner'), canManage: true, tier: tierOf('aac-cruiserweight', true, [...noBis, ...unclaimed]) });
    await expectRow();

    const actions = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((name) => ROW_ACTIONS.test(name));
    expect(actions).toEqual([
      'Import BiS', 'Import BiS', 'Import BiS',
      'Assign', 'Assign', 'Assign',
      'Review', 'Review', 'Review',
      'Open split plan',
    ]);
  });

  it('counts as a listed item: with the row alone, the empty copy goes', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    renderHome();
    await expectRow();
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
    expect(screen.queryByText('Nothing needs you right now.')).toBeNull();
  });

  it('lets a manager\'s empty copy go too', async () => {
    serveSplit('g1', splitOn(COMPLETE));
    renderHome({ group: groupOf('g1', 'owner'), canManage: true, tier: tierOf('aac-cruiserweight', true, RAIDERS) });
    await expectRow();
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
    expect(screen.queryByText('No BiS, roster, or recruitment items need you right now.')).toBeNull();
  });

  it('keeps the empty copy with split clears off, when nothing else is listed', async () => {
    renderHome();
    await answer('g1', SPLIT_OFF);
    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('keeps the empty copy on a past tier', async () => {
    await memberAsksFirst();
    renderHome({ tier: PAST });
    await act(async () => undefined);
    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
  });

  it('swaps the empty copy for the row when the read lands', async () => {
    renderHome();
    await waitFor(() => expect(splitRequests('g1')).toBe(1));
    expect(screen.getByText(EMPTY_TITLE)).toBeInTheDocument();
    await answer('g1', splitOn(COMPLETE));
    await expectRow();
    expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
  });
});
