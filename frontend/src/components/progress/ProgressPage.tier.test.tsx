/**
 * ProgressPage's tier row (S2a-3b·H3 Task TH3; design §3.2, §3.3; D-4, D-7, D-11, E-2, E-5,
 * E-7; R-T-3, R-T-5): who counts in the status total, the page ledger behind the floors part
 * (fetched for members only, copied locally and keyed by (static, tier)), and the matrix
 * shown whenever a tier is selected, guests included.
 *
 * The collection store's fetches and the loot store's `fetchPageLedger` are replaced by
 * spies; the ledger spy writes the store's one shared `pageLedger` slot before it resolves,
 * as the real action does, so a page that read the slot instead of its own copy would show.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
import { getTierById } from '../../gamedata';
import { useCollectionGoalStore, type CollectionGoal, type ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import { useToastStore } from '../../stores/toastStore';
import type { GearSlotStatus, PageLedgerEntry, StaticGroup, TierSnapshot, TransactionType } from '../../types';
import { gearOf, goal, row, SLOTS } from './__fixtures__/progressFixtures';
import { stubCanHover, TooltipWrapper } from './__fixtures__/tooltipEnv';
import { ProgressPage } from './ProgressPage';

// ── Fixtures ────────────────────────────────────────────────────────────────

const group = { id: 'g1', name: 'Dev Test Static', shareCode: 'DEVTST', settings: {}, userRole: 'owner', members: [] } as unknown as StaticGroup;
const otherGroup = { ...group, id: 'g2', name: 'Other Static', shareCode: 'OTHER1' } as unknown as StaticGroup;

const noTargets = () => SLOTS.map((slot) => ({ slot, bisSource: null, hasItem: true, isAugmented: false }) as GearSlotStatus);

const player = (id: string, name: string, job: string, role: string, position: string | null, userId: string | null, gear: GearSlotStatus[], isSubstitute = false) => ({
  id, name, job, role, position, configured: true, isSubstitute, sortOrder: 0, userId, gear,
});

/**
 * 2 claimed (6/11 with 2 to augment, 5/11), 1 unclaimed (3/11), 1 substitute (8/11), 1 claimed
 * with no targets. With a farm row for u9, one "Not on the roster" column trails. The total
 * counts 6 + 5 + 3 of 11 + 11 + 11 = 14/33.
 */
const PLAYERS = [
  player('p1', 'Aya', 'WAR', 'tank', 'T1', 'u1', gearOf(6, 2)),
  player('p2', 'Bo', 'WHM', 'healer', 'H1', 'u2', gearOf(5)),
  player('p3', 'Cy', 'SGE', 'healer', 'H2', null, gearOf(3)),
  player('p4', 'Dee', 'DRG', 'melee', null, 'u4', gearOf(8), true),
  player('p5', 'Eli', 'BLM', 'caster', 'R1', 'u5', noTargets()),
];

const CRUISER = 'aac-cruiserweight';
const HEAVY = 'aac-heavyweight';
const tierA = { id: 't1', staticGroupId: 'g1', tierId: CRUISER, players: PLAYERS } as unknown as TierSnapshot;
const tierB = { id: 't2', staticGroupId: 'g1', tierId: HEAVY, players: PLAYERS } as unknown as TierSnapshot;
const nameA = getTierById(CRUISER)!.name;
const floorsA = getTierById(CRUISER)!.floors;
const floorsB = getTierById(HEAVY)!.floors;

let nextId = 1;
function entry(floor: string, weekNumber: number, transactionType: TransactionType = 'earned'): PageLedgerEntry {
  return {
    id: nextId++, tierSnapshotId: 't1', playerId: 'p1', playerName: 'Aya', weekNumber, floor, bookType: 'I',
    transactionType, quantity: 1, createdAt: '2026-10-01T00:00:00Z', createdByUserId: 'u1', createdByUsername: null,
  };
}

// ── Stores ──────────────────────────────────────────────────────────────────

const fetchGoals = vi.fn();
const fetchProgress = vi.fn();
const fetchPageLedger = vi.fn();
const realFetchPageLedger = useLootTrackingStore.getState().fetchPageLedger;

/** A ledger fetch that writes the shared slot, then resolves, when `resolve` is called; or rejects. */
function deferredLedger() {
  let resolve: (entries: PageLedgerEntry[]) => void = () => {};
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = (entries) => {
      useLootTrackingStore.setState({ pageLedger: entries });
      res();
    };
    reject = rej;
  });
  return { promise, resolve: (e: PageLedgerEntry[]) => act(async () => resolve(e)), reject: (e: Error) => act(async () => { reject(e); await promise.catch(() => {}); }) };
}

/** The ledger fetch resolves at once with `entries`. */
function ledgerReturns(entries: PageLedgerEntry[]) {
  fetchPageLedger.mockImplementation(async () => {
    useLootTrackingStore.setState({ pageLedger: entries });
  });
}

function seedGoals({ goals = [], participants = {}, ready = true }: { goals?: CollectionGoal[]; participants?: Record<string, ParticipantStateEntry[]>; ready?: boolean } = {}) {
  useCollectionGoalStore.setState({
    goals, participants, recordOnly: {}, loadedGroupId: ready ? 'g1' : null, progressError: null, progressLoading: false, error: null,
    fetchGoals, fetchProgress,
  });
}

/** The shared week clock, resolved for (static, tier) or not. */
function seedWeek(week: number | null, tierId = CRUISER, groupId = 'g1') {
  useLootTrackingStore.setState(
    week === null ? { currentWeek: 1, weekClockKey: null } : { currentWeek: week, weekClockKey: weekClockKeyOf(groupId, tierId) },
  );
}

type Props = Parameters<typeof ProgressPage>[0];
function renderPage(props: Partial<Props> = {}) {
  const onNavigate = vi.fn();
  const base: Props = {
    group, tier: tierA, canManage: true, userRole: 'owner', currentUserId: 'u1', isViewingAs: false, onNavigate,
  };
  const tree = (p: Partial<Props>) => (
    <MemoryRouter>
      <ProgressPage {...base} {...p} />
    </MemoryRouter>
  );
  let current = props;
  const view = render(tree(current), { wrapper: TooltipWrapper });
  const update = (next: Partial<Props>) => {
    current = { ...current, ...next };
    view.rerender(tree(current));
  };
  return { onNavigate, update };
}

const tierRow = () => screen.getByTestId('progress-tier-row');
/** The status line: the text Open board is described by (R-T-12). */
function statusLine(): string {
  const openBoard = within(tierRow()).getByRole('button', { name: 'Open board' });
  const id = openBoard.getAttribute('aria-describedby');
  expect(id).toBeTruthy();
  return document.getElementById(id!)?.textContent ?? '';
}
const requestedUrls = () =>
  [api.get, api.post, api.put, api.patch, api.delete].flatMap((fn) =>
    (fn as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])),
  );
const following = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(() => {
  vi.clearAllMocks();
  stubCanHover();
  nextId = 1;
  fetchGoals.mockResolvedValue(undefined);
  fetchProgress.mockResolvedValue({ error: null });
  fetchPageLedger.mockImplementation(() => new Promise(() => {}));
  useLootTrackingStore.setState({ fetchPageLedger, pageLedger: [] });
  useToastStore.setState({ toasts: [] });
  seedGoals();
  seedWeek(11);
});

afterEach(() => {
  useLootTrackingStore.setState({ fetchPageLedger: realFetchPageLedger, pageLedger: [] });
  vi.unstubAllGlobals();
});

// ── Who counts (D-4, D-7, E-7) ──────────────────────────────────────────────

describe('ProgressPage tier row: the cells and the total', () => {
  it('counts claimed and unclaimed, not the substitute, the no-BiS card or Not on the roster: "14/33 BiS slots · Week 11"', async () => {
    seedGoals({ goals: [goal('wings')], participants: { wings: [row('wings', 'u1'), row('wings', 'u9', { displayName: 'Nia', memberRole: 'member' })] } });
    renderPage();
    await screen.findAllByTestId('progress-farm-row');
    const r = tierRow();
    expect(within(r).getByRole('button', { name: `Aya, ${nameA}, 6 of 11 BiS slots done, 2 need augment` })).toHaveTextContent('6/11');
    expect(within(r).getByRole('button', { name: `Bo, ${nameA}, 5 of 11 BiS slots done` })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: `Cy, ${nameA}, 3 of 11 BiS slots done` })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: `Dee, ${nameA}, 8 of 11 BiS slots done` })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: `Eli, ${nameA}, no BiS set` })).toHaveTextContent('No BiS set');
    expect(within(r).queryByRole('button', { name: /^Nia, / })).not.toBeInTheDocument();
    // The ledger is still pending: no floors part yet.
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
  });

  it('reads "No BiS set" when no counted card has targets', () => {
    renderPage({ tier: { ...tierA, players: [player('p5', 'Eli', 'BLM', 'caster', 'R1', 'u5', noTargets()), player('p4', 'Dee', 'DRG', 'melee', null, 'u4', gearOf(8), true)] } as unknown as TierSnapshot });
    expect(statusLine()).toBe('No BiS set · Week 11');
  });

  it('drops the week and the floors while the week is unknown, even once the ledger is in', async () => {
    seedWeek(null);
    ledgerReturns([entry(floorsA[0], 11)]);
    renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalled());
    await act(async () => {});
    expect(statusLine()).toBe('14/33 BiS slots');
  });
});

// ── The ledger (R-T-5, E-7) ─────────────────────────────────────────────────

describe('ProgressPage tier row: the floors part', () => {
  it('fetches the page ledger once, for (static, tier), for a member', async () => {
    renderPage({ userRole: 'member', canManage: false });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    expect(fetchPageLedger.mock.calls[0][0]).toBe('g1');
    expect(fetchPageLedger.mock.calls[0][1]).toBe(CRUISER);
    expect(fetchPageLedger.mock.calls[0][2]).toBeUndefined();
  });

  it('fetches it for a viewer too (the ledger carries no count)', async () => {
    renderPage({ userRole: 'viewer', canManage: false });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
  });

  it('shows "1 of 4 floors cleared" once it resolves with one earned entry this week', async () => {
    ledgerReturns([
      entry(floorsA[0], 11),
      entry(floorsA[0], 11), // A second earned entry on the same floor is still one floor.
      entry(floorsA[1], 11, 'spent'),
      entry(floorsA[2], 10),
    ]);
    renderPage();
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 1 of 4 floors cleared'));
  });

  it('shows no floors part while the fetch is pending', async () => {
    const d = deferredLedger();
    fetchPageLedger.mockReturnValue(d.promise);
    renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    expect(statusLine()).not.toMatch(/floors/);
    await d.resolve([]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 0 of 4 floors cleared'));
  });

  it('omits the floors part after a rejection, with no toast and no error on screen', async () => {
    const d = deferredLedger();
    fetchPageLedger.mockReturnValue(d.promise);
    renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    await d.reject(new Error('ledger down'));
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    expect(useToastStore.getState().toasts).toEqual([]);
    expect(screen.queryByText(/ledger down/)).not.toBeInTheDocument();
  });

  it('never shows a ledger already in the store from another tier', async () => {
    useLootTrackingStore.setState({ pageLedger: floorsA.map((f) => entry(f, 11)) });
    const d = deferredLedger();
    fetchPageLedger.mockReturnValue(d.promise);
    renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    await d.resolve([]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 0 of 4 floors cleared'));
  });

  it('refetches when the tier changes, and not on a re-render with the same tier', async () => {
    const { update } = renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    update({ tier: { ...tierA } as TierSnapshot });
    await act(async () => {});
    expect(fetchPageLedger).toHaveBeenCalledTimes(1);
    seedWeek(11, HEAVY);
    update({ tier: tierB });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));
    expect(fetchPageLedger.mock.calls[1].slice(0, 2)).toEqual(['g1', HEAVY]);
  });

  it('refetches when the static changes', async () => {
    const { update } = renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    seedWeek(11, CRUISER, 'g2');
    update({ group: otherGroup, tier: { ...tierA, staticGroupId: 'g2' } as TierSnapshot });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));
    expect(fetchPageLedger.mock.calls[1].slice(0, 2)).toEqual(['g2', CRUISER]);
  });

  it('ignores the previous tier\'s response when it lands after the current one', async () => {
    const a = deferredLedger();
    const b = deferredLedger();
    fetchPageLedger.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { update } = renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    seedWeek(11, HEAVY);
    update({ tier: tierB });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));

    await b.resolve([]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 0 of 4 floors cleared'));
    // A's late response writes the shared slot with entries that would count on B's floors.
    await a.resolve([entry(floorsB[0], 11), entry(floorsB[1], 11)]);
    expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 0 of 4 floors cleared');
  });

  it('ignores the previous tier\'s response when it lands while the current one is pending', async () => {
    const a = deferredLedger();
    const b = deferredLedger();
    fetchPageLedger.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { update } = renderPage();
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    seedWeek(11, HEAVY);
    update({ tier: tierB });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));

    await a.resolve([entry(floorsB[0], 11), entry(floorsB[1], 11), entry(floorsB[2], 11)]);
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    await b.resolve([entry(floorsB[3], 11)]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 1 of 4 floors cleared'));
  });

  it('drops the floors part once the tier changes, while the new tier\'s ledger is pending', async () => {
    ledgerReturns([entry(floorsA[0], 11)]);
    const { update } = renderPage();
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 1 of 4 floors cleared'));
    const b = deferredLedger();
    fetchPageLedger.mockImplementation(() => b.promise);
    seedWeek(11, HEAVY);
    update({ tier: tierB });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));
    // Tier A's copy is still held; it must not count on B's floors.
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    await b.resolve([entry(floorsB[0], 11), entry(floorsB[1], 11)]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 2 of 4 floors cleared'));
  });

  it('drops the floors part once the static changes on the same tier, while the new static\'s ledger is pending', async () => {
    ledgerReturns([entry(floorsA[0], 11)]);
    const { update } = renderPage();
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 1 of 4 floors cleared'));
    const g2 = deferredLedger();
    fetchPageLedger.mockImplementation(() => g2.promise);
    seedWeek(11, CRUISER, 'g2');
    update({ group: otherGroup, tier: { ...tierA, staticGroupId: 'g2' } as TierSnapshot });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(2));
    // g1's copy is for the same tier id; only the static in the key tells it apart.
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    await g2.resolve([]);
    await waitFor(() => expect(statusLine()).toBe('14/33 BiS slots · Week 11 · 0 of 4 floors cleared'));
  });

  it('omits the floors part for a tier the game data does not know, never "0 of 0"', async () => {
    seedWeek(11, 'unknown-tier');
    ledgerReturns([entry(floorsA[0], 11)]);
    renderPage({ tier: { ...tierA, tierId: 'unknown-tier' } as TierSnapshot });
    await waitFor(() => expect(fetchPageLedger).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
  });
});

// ── The matrix condition (R-T-3, E-5, D-11) ─────────────────────────────────

describe('ProgressPage tier row: the matrix shows whenever a tier is selected', () => {
  it('shows a member with no goals the matrix holding the tier row alone', async () => {
    renderPage({ userRole: 'member', canManage: false });
    const matrix = await screen.findByTestId('progress-matrix');
    expect(within(matrix).getByTestId('progress-tier-row')).toBe(tierRow());
    expect(screen.queryAllByTestId('progress-farm-row')).toHaveLength(0);
    expect(fetchProgress).not.toHaveBeenCalled();
  });

  it('shows the tier row while goals load, with "Loading farms…" below the matrix', () => {
    seedGoals({ goals: [goal('wings')], ready: false });
    renderPage();
    const matrix = screen.getByTestId('progress-matrix');
    expect(within(matrix).getByTestId('progress-tier-row')).toBeInTheDocument();
    expect(within(tierRow()).getByRole('button', { name: `Aya, ${nameA}, 6 of 11 BiS slots done, 2 need augment` })).toBeInTheDocument();
    const loading = screen.getByTestId('progress-loading');
    expect(loading).toHaveTextContent('Loading farms…');
    expect(following(matrix, loading)).toBe(true);
    expect(matrix).not.toContainElement(loading);
  });

  it('shows the tier row after a first-load failure, with the error line below the matrix', async () => {
    fetchProgress.mockResolvedValue({ error: 'boom' });
    seedGoals({ goals: [goal('wings')], participants: { wings: [row('wings', 'u1')] } });
    renderPage();
    const alert = await screen.findByTestId('progress-error');
    const matrix = screen.getByTestId('progress-matrix');
    expect(within(matrix).getByTestId('progress-tier-row')).toBeInTheDocument();
    expect(screen.queryAllByTestId('progress-farm-row')).toHaveLength(0);
    expect(following(matrix, alert)).toBe(true);
  });

  it('shows a guest the cells and "14/33 BiS slots · Week 11" (no floors), above the members-only card, with no new request (D-11)', async () => {
    seedGoals({ goals: [goal('wings')] });
    renderPage({ userRole: null, canManage: false, currentUserId: null });
    const matrix = screen.getByTestId('progress-matrix');
    expect(within(matrix).getByTestId('progress-tier-row')).toBe(tierRow());
    expect(within(tierRow()).getByRole('button', { name: `Aya, ${nameA}, 6 of 11 BiS slots done, 2 need augment` })).toHaveTextContent('6/11');
    expect(screen.queryAllByTestId('progress-farm-row')).toHaveLength(0);
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
    expect(following(matrix, screen.getByTestId('members-only-card'))).toBe(true);

    await act(async () => {});
    expect(fetchPageLedger).not.toHaveBeenCalled();
    expect(fetchGoals).not.toHaveBeenCalled();
    expect(fetchProgress).not.toHaveBeenCalled();
    expect(requestedUrls().filter((u) => /page-ledger|split-clear|\/collection-/.test(u))).toEqual([]);
    expect(statusLine()).toBe('14/33 BiS slots · Week 11');
  });
});
