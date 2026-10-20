/**
 * progressQueue — the farm queue (S2a-3a·G1 Task 1; design §3.1, R-S3-14, D-1,
 * D-19, D-20). Rows are built from the same pieces the matrix uses: `cellFor` over
 * store-shaped fixtures, so a hidden count is whatever `cellFor` makes of it.
 */
import { describe, expect, it } from 'vitest';
import { farmRowOf, goal, type ColumnSpec } from '../components/progress/__fixtures__/progressFixtures';
import type { CollectionPriorityMode, ParticipantStateEntry } from '../stores/collectionGoalStore';
import type { FarmRow } from './progressModel';
import { queueEntryText, queueFor, type QueueEntry } from './progressQueue';

type Spec = Partial<ParticipantStateEntry> | null;

const farm = (columns: ColumnSpec[], tokenCost: number | null = 99): FarmRow => farmRowOf(columns, goal('g1', { tokenCost }));

const need = (tokenCount: number | null, extra: Partial<ParticipantStateEntry> = {}): Spec => ({ state: 'need', tokenCount, ...extra });
const want = (tokenCount: number | null, extra: Partial<ParticipantStateEntry> = {}): Spec => ({ state: 'want', tokenCount, ...extra });
const hiddenNeed: Spec = { state: 'need', tokenCount: 5, countHidden: true };
const hiddenWant: Spec = { state: 'want', tokenCount: 5, countHidden: true };

const ids = (q: QueueEntry[]) => q.map((e) => e.cell.column.key);

describe('queueFor order', () => {
  it('puts Need before Want, and the fewest count first within each', () => {
    const q = queueFor(
      farm([
        { id: 'w-low', cell: want(1) },
        { id: 'n-high', cell: need(60) },
        { id: 'w-high', cell: want(40) },
        { id: 'n-low', cell: need(10) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['n-low', 'n-high', 'w-low', 'w-high']);
    expect(q.map((e) => e.state)).toEqual(['need', 'need', 'want', 'want']);
  });

  it('keeps column order on a tie', () => {
    const q = queueFor(farm([{ id: 'b', cell: need(7) }, { id: 'a', cell: need(7) }, { id: 'c', cell: need(3) }]), null);
    expect(ids(q)).toEqual(['c', 'b', 'a']);
  });

  it('ranks a hidden or unknown count after every known count in its state, keeping column order among them', () => {
    const q = queueFor(
      farm([
        { id: 'hidden-1', cell: hiddenNeed },
        { id: 'unknown', cell: need(null) },
        { id: 'known-high', cell: need(98) },
        { id: 'hidden-2', cell: hiddenNeed },
        { id: 'known-zero', cell: need(0) },
        { id: 'want-known', cell: want(2) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['known-zero', 'known-high', 'hidden-1', 'unknown', 'hidden-2', 'want-known']);
  });

  it('numbers ranks from 1 with no gaps', () => {
    const q = queueFor(farm([{ id: 'a', cell: want(1) }, { id: 'b', cell: need(2) }, { id: 'c', cell: need(3) }]), null);
    expect(q.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it('carries the cell, its count and whether the count is hidden', () => {
    const q = queueFor(farm([{ id: 'a', cell: need(12) }, { id: 'b', cell: hiddenWant }]), null);
    expect(q[0]).toMatchObject({ rank: 1, state: 'need', count: 12, countHidden: false });
    expect(q[0].cell.column.key).toBe('a');
    expect(q[1]).toMatchObject({ rank: 2, state: 'want', count: null, countHidden: true });
  });

  it('marks an unknown (not hidden) count null and not hidden', () => {
    const [entry] = queueFor(farm([{ id: 'a', cell: need(null) }]), null);
    expect(entry).toMatchObject({ count: null, countHidden: false });
  });

  it('ignores priority_rank (D-1)', () => {
    const ranked = farm([
      { id: 'a', cell: need(30, { priorityRank: 1 }) },
      { id: 'b', cell: need(10, { priorityRank: 9 }) },
      { id: 'c', cell: need(10, { priorityRank: 2 }) },
    ]);
    expect(ids(queueFor(ranked, 'priority_order'))).toEqual(['b', 'c', 'a']);
  });
});

describe('queueFor who', () => {
  it('leaves out Have, Pass, blank and unclaimed columns', () => {
    const q = queueFor(
      farm([
        { id: 'have', cell: { state: 'have', tokenCount: 99 } },
        { id: 'pass', cell: { state: 'pass' } },
        { id: 'blank' },
        { id: 'ghost', kind: 'unclaimed' },
        { id: 'in', cell: need(4) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['in']);
  });

  it('returns [] when nobody needs or wants it', () => {
    expect(queueFor(farm([{ id: 'a', cell: { state: 'have' } }, { id: 'b' }]), null)).toEqual([]);
  });

  it('queues a Not-on-the-roster member fully (R-S3-14): Need 3/99 ahead of a claimed Need 10/99', () => {
    const q = queueFor(
      farm([
        { id: 'claimed', cell: need(10) },
        { id: 'away', kind: 'notOnRoster', cell: need(3) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['user:away', 'claimed']);
    expect(q[0].cell.column.kind).toBe('notOnRoster');
  });

  it('queues a Card-not-set-up member among the Wants by count', () => {
    const q = queueFor(
      farm([
        { id: 'w-claimed', cell: want(50) },
        { id: 'w-card', kind: 'unconfigured', cell: want(20) },
        { id: 'n-claimed', cell: need(90) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['n-claimed', 'user:w-card', 'w-claimed']);
  });

  it('ranks a Not-on-the-roster hidden count last in its state', () => {
    const q = queueFor(
      farm([
        { id: 'away', kind: 'notOnRoster', cell: hiddenNeed },
        { id: 'claimed', cell: need(90) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['claimed', 'user:away']);
    expect(q[1].countHidden).toBe(true);
  });

  it('never lists an unclaimed column that sits among members', () => {
    const q = queueFor(
      farm([
        { id: 'a', cell: need(1) },
        { id: 'ghost', kind: 'unclaimed', cell: need(0) },
        { id: 'away', kind: 'notOnRoster', cell: need(2) },
      ]),
      null,
    );
    expect(ids(q)).toEqual(['a', 'user:away']);
  });
});

describe('queueFor by mode', () => {
  const mixed = () =>
    farm([
      { id: 'w', cell: want(1) },
      { id: 'n', cell: need(50) },
    ]);

  it('free_roll has no queue', () => {
    expect(queueFor(mixed(), 'free_roll')).toEqual([]);
  });

  it('desired_only keeps Need only', () => {
    expect(ids(queueFor(mixed(), 'desired_only'))).toEqual(['n']);
  });

  it('desired_only with only Wants is empty', () => {
    expect(queueFor(farm([{ id: 'w', cell: want(1) }]), 'desired_only')).toEqual([]);
  });

  it.each<CollectionPriorityMode | null>(['everyone_gets_one', 'priority_order', 'custom', null])(
    'applies the full rule under %s',
    (mode) => {
      expect(ids(queueFor(mixed(), mode))).toEqual(['n', 'w']);
    },
  );
});

describe('queueFor on a drop-only farm', () => {
  it('orders by column order within each state, ignoring counts, trailing columns in place', () => {
    const q = queueFor(
      farm(
        [
          { id: 'w1', cell: want(1) },
          { id: 'n-high', cell: need(90) },
          { id: 'n-low', cell: need(1) },
          { id: 'n-hidden', cell: hiddenNeed },
          { id: 'away-n', kind: 'notOnRoster', cell: need(0) },
          { id: 'away-w', kind: 'unconfigured', cell: want(0) },
        ],
        null,
      ),
      null,
    );
    expect(ids(q)).toEqual(['n-high', 'n-low', 'n-hidden', 'user:away-n', 'w1', 'user:away-w']);
  });
});

describe('queueEntryText', () => {
  const entry = (state: 'need' | 'want', count: number | null, countHidden = false): QueueEntry => {
    const [e] = queueFor(farm([{ id: 'a', cell: { state, tokenCount: count } }]), null);
    return { ...e, count, countHidden };
  };

  it('reads "Need 12/99" and "Want 80/99" with a cost', () => {
    expect(queueEntryText(entry('need', 12), 99)).toBe('Need 12/99');
    expect(queueEntryText(entry('want', 80), 99)).toBe('Want 80/99');
  });

  it('reads the state alone when the count is hidden or unknown', () => {
    expect(queueEntryText(entry('need', null, true), 99)).toBe('Need');
    expect(queueEntryText(entry('want', null), 99)).toBe('Want');
  });

  it('reads "Need 12" and "Want 30" when the farm has no cost', () => {
    expect(queueEntryText(entry('need', 12), null)).toBe('Need 12');
    expect(queueEntryText(entry('want', 30), null)).toBe('Want 30');
  });
});
