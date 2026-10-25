/**
 * progressQueue — the lead's pin (S2a-3c·C2 Task TC2; design D-2, D-3, E-5, E-7; R-C-4).
 * The pin orders each state's entries among themselves: pinned first by rank (ties in the
 * automatic order), then the rest in the automatic order; Needs stay before Wants; ranks run
 * 1…n across the queue. New cases live here so `progressQueue.test.ts` stays unedited (R-S2-2).
 * Rows are built the way the matrix builds them: `cellFor` over store-shaped fixtures.
 */
import { describe, expect, it } from 'vitest';
import { farmRowOf, goal, type ColumnSpec } from '../components/progress/__fixtures__/progressFixtures';
import type { ParticipantStateEntry } from '../stores/collectionGoalStore';
import type { FarmRow } from './progressModel';
import { moveWithinState, orderedDraft, pinnedOrder, queueFor, queueIsManual, type QueueEntry } from './progressQueue';

type Spec = Partial<ParticipantStateEntry>;

const farm = (columns: ColumnSpec[], tokenCost: number | null = 99): FarmRow => farmRowOf(columns, goal('g1', { tokenCost }));

const need = (tokenCount: number | null, priorityRank: number | null = null): Spec => ({ state: 'need', tokenCount, priorityRank });
const want = (tokenCount: number | null, priorityRank: number | null = null): Spec => ({ state: 'want', tokenCount, priorityRank });

const ids = (q: readonly QueueEntry[]) => q.map((e) => e.cell.column.key);
const userIds = (q: readonly QueueEntry[]) => q.map((e) => e.cell.column.userId);

/** A (Need 50, #2), B (Need 10), C (Want 5, #1), D (Need 30, #2), E (Want 1), in that column order. */
const BASE: ColumnSpec[] = [
  { id: 'A', cell: need(50, 2) },
  { id: 'B', cell: need(10) },
  { id: 'C', cell: want(5, 1) },
  { id: 'D', cell: need(30, 2) },
  { id: 'E', cell: want(1) },
];

describe('queueFor with a pin, per state (D-2, E-5)', () => {
  it('orders the pinned Needs by rank (a tie in the automatic order), then the unpinned Need, then the Wants the same way', () => {
    const q = queueFor(farm(BASE), null);
    expect(ids(q)).toEqual(['D', 'A', 'B', 'C', 'E']);
    expect(q.map((e) => e.state)).toEqual(['need', 'need', 'need', 'want', 'want']);
  });

  it('numbers ranks 1…5 across the whole queue and marks D, A and C pinned', () => {
    const q = queueFor(farm(BASE), null);
    expect(q.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(q.map((e) => [e.cell.column.key, e.pinned])).toEqual([
      ['D', true],
      ['A', true],
      ['B', false],
      ['C', true],
      ['E', false],
    ]);
  });

  it('never lifts a pinned Want above an unpinned Need', () => {
    const q = queueFor(farm([{ id: 'w', cell: want(0, 1) }, { id: 'n', cell: need(98) }]), null);
    expect(ids(q)).toEqual(['n', 'w']);
    expect(q.map((e) => e.pinned)).toEqual([false, true]);
  });

  it('orders pinned entries on a drop-only farm by rank, ties in column order', () => {
    const q = queueFor(
      farm([{ id: 'x', cell: need(null, 2) }, { id: 'y', cell: need(null, 1) }, { id: 'z', cell: need(null, 2) }, { id: 'u', cell: need(null) }], null),
      null,
    );
    expect(ids(q)).toEqual(['y', 'x', 'z', 'u']);
  });

  it('orders a pinned hidden count by its rank, ahead of an unpinned known count', () => {
    const q = queueFor(
      farm([
        { id: 'known', cell: need(1) },
        { id: 'hidden', cell: { state: 'need', tokenCount: 5, countHidden: true, priorityRank: 1 } },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['hidden', 'known']);
    expect(q[0]).toMatchObject({ pinned: true, count: null, countHidden: true });
  });

  it('sorts a long pinned queue by rank (200 Needs ranked in reverse column order)', () => {
    const columns: ColumnSpec[] = Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, cell: need(i, 200 - i) }));
    const q = queueFor(farm(columns), null);
    expect(ids(q)).toEqual(columns.map((c) => c.id).reverse());
    expect(q.every((e) => e.pinned)).toBe(true);
    expect(q[199].rank).toBe(200);
  });
});

describe('queueFor: a later joiner (D-3)', () => {
  it('puts a new unranked Need after the pinned Needs and before every Want', () => {
    const q = queueFor(
      farm([
        { id: 'A', cell: need(50, 1) },
        { id: 'C', cell: want(5, 1) },
        { id: 'D', cell: need(30, 2) },
        { id: 'J', cell: need(1) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['A', 'D', 'J', 'C']);
    expect(q.map((e) => e.pinned)).toEqual([true, true, false, true]);
  });
});

describe('queueFor with a pin, by mode', () => {
  it('desired_only keeps the pinned Needs\' order and drops every Want', () => {
    const q = queueFor(farm(BASE), 'desired_only');
    expect(ids(q)).toEqual(['D', 'A', 'B']);
    expect(q.map((e) => e.rank)).toEqual([1, 2, 3]);
    // free_roll queues nobody, ranks or not.
    expect(queueFor(farm(BASE), 'free_roll')).toEqual([]);
  });
});

describe('queueFor: who a pin can queue', () => {
  it('never queues a ranked Have or Pass cell, and queueIsManual is false when only they hold a rank', () => {
    const q = queueFor(
      farm([
        { id: 'have', cell: { state: 'have', tokenCount: 99, priorityRank: 1 } },
        { id: 'pass', cell: { state: 'pass', priorityRank: 2 } },
        { id: 'blank' },
        { id: 'in', cell: need(4) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['in']);
    expect(q[0].pinned).toBe(false);
    expect(queueIsManual(q)).toBe(false);
  });

  it('places a ranked Not-on-the-roster member among its state\'s pinned (R-S3-14)', () => {
    const q = queueFor(
      farm([
        { id: 'N1', cell: need(10, 2) },
        { id: 'N2', cell: need(5) },
        { id: 'away', kind: 'notOnRoster', cell: need(40, 1) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['user:away', 'N1', 'N2']);
    expect(q[0]).toMatchObject({ pinned: true, rank: 1 });
  });
});

describe('queueIsManual', () => {
  it('is true when any queued entry is pinned', () => {
    expect(queueIsManual(queueFor(farm(BASE), null))).toBe(true);
    expect(queueIsManual(queueFor(farm([{ id: 'n', cell: need(1) }, { id: 'w', cell: want(1, 1) }]), null))).toBe(true);
  });

  it('is false with no ranks, and for an empty queue', () => {
    const q = queueFor(farm([{ id: 'n', cell: need(1) }, { id: 'w', cell: want(1) }]), null);
    expect(q.map((e) => e.pinned)).toEqual([false, false]);
    expect(queueIsManual(q)).toBe(false);
    expect(queueIsManual([])).toBe(false);
  });
});

describe('pinnedOrder (R-C-4, R-C-8\'s prior)', () => {
  it('lists every ranked member by rank, Have and Pass included, ties in column order, the unranked left out', () => {
    const row = farm([
      { id: 'A', cell: need(10, 3) },
      { id: 'B', cell: { state: 'have', tokenCount: 99, priorityRank: 1 } },
      { id: 'C', cell: want(4, 2) },
      { id: 'D', cell: need(2) },
      { id: 'E', cell: { state: 'pass', priorityRank: 2 } },
      { id: 'F', kind: 'notOnRoster', cell: need(7, 4) },
      { id: 'G' },
      { id: 'H', kind: 'unclaimed' },
    ]);
    expect(pinnedOrder(row)).toEqual(['B', 'C', 'E', 'A', 'F']);
  });

  it('is [] with no ranks', () => {
    expect(pinnedOrder(farm([{ id: 'A', cell: need(1) }, { id: 'B', cell: want(2) }]))).toEqual([]);
  });
});

// The draft helpers (E-7). A drop-only farm, so the automatic order is column order.
const dropOnly = (columns: ColumnSpec[]) => queueFor(farm(columns, null), null);

describe('orderedDraft (E-7)', () => {
  it('keeps the draft\'s order within each state', () => {
    const queue = dropOnly([{ id: 'n1', cell: need(null) }, { id: 'n2', cell: need(null) }, { id: 'w1', cell: want(null) }, { id: 'w2', cell: want(null) }]);
    expect(userIds(orderedDraft(['n2', 'n1', 'w2', 'w1'], queue))).toEqual(['n2', 'n1', 'w2', 'w1']);
  });

  it('drops a draft id that is no longer queued', () => {
    const queue = dropOnly([{ id: 'n1', cell: need(null) }, { id: 'n2', cell: need(null) }, { id: 'gone', cell: { state: 'have' } }]);
    expect(userIds(orderedDraft(['n2', 'gone', 'n1'], queue))).toEqual(['n2', 'n1']);
  });

  it('appends a newly queued id at the end of its state\'s group, before the next state', () => {
    const queue = dropOnly([{ id: 'n1', cell: need(null) }, { id: 'n2', cell: need(null) }, { id: 'new', cell: need(null) }, { id: 'w1', cell: want(null) }]);
    expect(userIds(orderedDraft(['n2', 'n1', 'w1'], queue))).toEqual(['n2', 'n1', 'new', 'w1']);
  });

  it('moves a member who switched Need → Want into the Want group, in draft order there', () => {
    // The draft was taken while `s` was a Need; `s` is a Want now.
    const queue = dropOnly([{ id: 'n1', cell: need(null) }, { id: 'n2', cell: need(null) }, { id: 'w1', cell: want(null) }, { id: 's', cell: want(null) }]);
    const order = orderedDraft(['n2', 's', 'n1', 'w1'], queue);
    expect(userIds(order)).toEqual(['n2', 'n1', 's', 'w1']);
    expect(order.map((e) => e.state)).toEqual(['need', 'need', 'want', 'want']);
  });

  it('is the queue itself for an empty draft, and [] for an empty queue', () => {
    const queue = dropOnly([{ id: 'n1', cell: need(null) }, { id: 'w1', cell: want(null) }]);
    expect(userIds(orderedDraft([], queue))).toEqual(['n1', 'w1']);
    expect(orderedDraft(['n1'], [])).toEqual([]);
  });
});

describe('moveWithinState (E-7)', () => {
  const order = () => dropOnly([{ id: 'n1', cell: need(null) }, { id: 'n2', cell: need(null) }, { id: 'w1', cell: want(null) }, { id: 'w2', cell: want(null) }]);

  it('swaps an entry with its neighbour within its state', () => {
    expect(moveWithinState(order(), 'n2', -1)).toEqual(['n2', 'n1', 'w1', 'w2']);
    expect(moveWithinState(order(), 'n1', 1)).toEqual(['n2', 'n1', 'w1', 'w2']);
    expect(moveWithinState(order(), 'w1', 1)).toEqual(['n1', 'n2', 'w2', 'w1']);
    expect(moveWithinState(order(), 'w2', -1)).toEqual(['n1', 'n2', 'w2', 'w1']);
  });

  it('leaves the order unchanged at either end of the list', () => {
    expect(moveWithinState(order(), 'n1', -1)).toEqual(['n1', 'n2', 'w1', 'w2']);
    expect(moveWithinState(order(), 'w2', 1)).toEqual(['n1', 'n2', 'w1', 'w2']);
  });

  it('leaves the order unchanged across the Need/Want boundary', () => {
    expect(moveWithinState(order(), 'n2', 1)).toEqual(['n1', 'n2', 'w1', 'w2']);
    expect(moveWithinState(order(), 'w1', -1)).toEqual(['n1', 'n2', 'w1', 'w2']);
  });

  it('leaves the order unchanged for an id not in it', () => {
    expect(moveWithinState(order(), 'nobody', 1)).toEqual(['n1', 'n2', 'w1', 'w2']);
  });
});
