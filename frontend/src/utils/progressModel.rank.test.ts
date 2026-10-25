/**
 * progressModel.cellFor — a viewer reader never gets a pin (S2a-3c·C2 Task TC2; design E-5,
 * R-C-4). The server nulls ranks for a real viewer; under View As reads come back as the admin,
 * so `cellFor` drops the rank for a viewer reader the way it withholds counts. A lead or member
 * reader keeps it; an entry with no rank keeps its identity.
 */
import { describe, expect, it } from 'vitest';
import { farmRowOf, goal, row } from '../components/progress/__fixtures__/progressFixtures';
import type { MemberRole, SnapshotPlayer } from '../types';
import { cellFor, type ProgressColumn } from './progressModel';
import { queueFor } from './progressQueue';

const claimed = (id: string): ProgressColumn => ({ kind: 'claimed', key: id, name: id, userId: id, player: {} as SnapshotPlayer });
const reader = (userRole: MemberRole) => ({ currentUserId: 'me', userRole });

describe('cellFor and priority_rank (E-5)', () => {
  it('drops the rank for a viewer reader, on a copy: the store\'s entry is untouched', () => {
    const ranked = row('g1', 'A', { state: 'need', tokenCount: 10, priorityRank: 1 });
    const cell = cellFor(claimed('A'), { participants: [ranked] }, reader('viewer'));
    expect(cell.entry).not.toBeNull();
    expect(cell.entry?.priorityRank).toBeNull();
    expect(cell.entry).toMatchObject({ userId: 'A', state: 'need', goalId: 'g1' });
    expect(ranked.priorityRank).toBe(1);
  });

  it('keeps an unranked entry as the same object for a viewer reader', () => {
    const ranked = row('g1', 'A', { state: 'need', priorityRank: 1 });
    const plain = row('g1', 'B', { state: 'want' });
    const participants = [ranked, plain];
    expect(cellFor(claimed('A'), { participants }, reader('viewer')).entry?.priorityRank).toBeNull();
    expect(cellFor(claimed('B'), { participants }, reader('viewer')).entry).toBe(plain);
  });
});

describe('queueFor over a viewer reader\'s cells (E-5)', () => {
  // A Need with no rank sits before a ranked Need in column order; a viewer sees no counts,
  // so their automatic order is column order.
  const columns = [
    { id: 'A', cell: { state: 'need' as const, tokenCount: 10 } },
    { id: 'B', cell: { state: 'need' as const, tokenCount: 50, priorityRank: 1 } },
    { id: 'C', cell: { state: 'want' as const, tokenCount: 1, priorityRank: 2 } },
  ];

  it('gives a viewer no pinned entry and today\'s order', () => {
    const q = queueFor(farmRowOf(columns, goal('g1'), 'viewer'), null);
    expect(q.map((e) => e.cell.column.key)).toEqual(['A', 'B', 'C']);
    expect(q.map((e) => e.pinned)).toEqual([false, false, false]);
    expect(q.map((e) => e.cell.entry?.priorityRank)).toEqual([null, null, null]);
  });

  it.each<MemberRole>(['owner', 'lead', 'member'])('gives a %s reader the pin, the rank kept on the entry', (role) => {
    const q = queueFor(farmRowOf(columns, goal('g1'), role), null);
    expect(q.map((e) => e.cell.column.key)).toEqual(['B', 'A', 'C']);
    expect(q.map((e) => e.pinned)).toEqual([true, false, true]);
    expect(q.map((e) => e.cell.entry?.priorityRank)).toEqual([1, null, 2]);
  });
});
