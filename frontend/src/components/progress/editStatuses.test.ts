/**
 * editStatuses (S2a-2·F6 Task TF8): which cell this reader may write and where the write
 * goes (R-S2-10), and which cells the bulk Need sends (R-S2-12, Q1, Q2). Pure, over the
 * model's own columns and rows.
 */
import { describe, expect, it } from 'vitest';
import type { ParticipantState } from '../../stores/collectionGoalStore';
import type { SnapshotPlayer } from '../../types';
import { buildColumns, splitFarmRows, type ProgressCell, type ProgressColumn, type ProgressData } from '../../utils/progressModel';
import { goal, row } from './__fixtures__/progressFixtures';
import { blankClaimedCells, cellWriteTarget, type EditContext } from './editStatuses';

const player = (id: string, name: string, position: string, role: string, userId: string | null) =>
  ({ id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId }) as unknown as SnapshotPlayer;

const PLAYERS = [
  player('p1', 'Aya', 'T1', 'tank', 'u1'),
  player('p2', 'Bo', 'H1', 'healer', 'u2'),
  player('p3', 'Cy', 'R1', 'caster', null),
  player('p4', 'Dee', 'M1', 'melee', 'u4'),
];

const claimed = (userId: string): ProgressColumn => ({ kind: 'claimed', key: `p-${userId}`, name: userId, userId, player: PLAYERS[0] });
const unclaimed: ProgressColumn = { kind: 'unclaimed', key: 'p3', name: 'Cy', userId: null, player: PLAYERS[2] };
const offRoster = (userId: string): ProgressColumn => ({ kind: 'notOnRoster', key: `user:${userId}`, name: userId, userId, player: null, reason: 'notOnRoster' });
const cell = (column: ProgressColumn, own: boolean, state: ParticipantState | null = null): ProgressCell =>
  ({ column, state, count: null, countHidden: false, own, entry: null, recordOnly: null, record: null });
const ctx = (over: Partial<EditContext> = {}): EditContext =>
  ({ groupId: 'g1', currentUserId: 'u1', userRole: 'lead', isViewingAs: false, editing: false, ...over });

describe('cellWriteTarget (R-S2-10)', () => {
  it('outside the mode: the own cell goes through the self route, Not on the roster included', () => {
    expect(cellWriteTarget(cell(claimed('u1'), true, 'need'), ctx())).toEqual({ groupId: 'g1' });
    expect(cellWriteTarget(cell(offRoster('u1'), true), ctx({ userRole: 'member' }))).toEqual({ groupId: 'g1' });
  });

  it('outside the mode: no one else\'s cell is written, a lead\'s included', () => {
    expect(cellWriteTarget(cell(claimed('u2'), false, 'have'), ctx())).toBeUndefined();
    expect(cellWriteTarget(cell(claimed('u2'), false), ctx({ userRole: 'owner' }))).toBeUndefined();
    expect(cellWriteTarget(cell(unclaimed, false), ctx())).toBeUndefined();
  });

  it('under View As the own cell goes through the lead route aimed at the viewed user', () => {
    expect(cellWriteTarget(cell(claimed('u2'), true), ctx({ currentUserId: 'u2', isViewingAs: true }))).toEqual({ groupId: 'g1', targetUserId: 'u2' });
  });

  it('a viewer, a guest and an unknown user write nothing, in the mode too', () => {
    for (const over of [{ userRole: 'viewer' as const }, { userRole: null }, { currentUserId: null }]) {
      expect(cellWriteTarget(cell(claimed('u1'), true, 'need'), ctx({ ...over, editing: true }))).toBeUndefined();
      expect(cellWriteTarget(cell(claimed('u2'), false, 'need'), ctx({ ...over, editing: true }))).toBeUndefined();
    }
  });

  it('in the mode: another member\'s claimed cell, blank or not, goes through the lead route aimed at them', () => {
    expect(cellWriteTarget(cell(claimed('u2'), false, 'have'), ctx({ editing: true }))).toEqual({ groupId: 'g1', targetUserId: 'u2' });
    expect(cellWriteTarget(cell(claimed('u4'), false), ctx({ editing: true }))).toEqual({ groupId: 'g1', targetUserId: 'u4' });
  });

  it('in the mode: the lead\'s own cell keeps the self route', () => {
    expect(cellWriteTarget(cell(claimed('u1'), true, 'need'), ctx({ editing: true }))).toEqual({ groupId: 'g1' });
    expect(cellWriteTarget(cell(offRoster('u1'), true), ctx({ editing: true }))).toEqual({ groupId: 'g1' });
  });

  it('in the mode: others\' Not-on-the-roster cells and unclaimed cells stay read-only', () => {
    expect(cellWriteTarget(cell(offRoster('u9'), false, 'want'), ctx({ editing: true }))).toBeUndefined();
    expect(cellWriteTarget(cell(unclaimed, false), ctx({ editing: true }))).toBeUndefined();
  });

  it('in the mode under View As, the viewed user\'s own cell is the lead route aimed at them', () => {
    expect(cellWriteTarget(cell(claimed('u2'), true, 'pass'), ctx({ currentUserId: 'u2', isViewingAs: true, editing: true }))).toEqual({ groupId: 'g1', targetUserId: 'u2' });
  });
});

describe('blankClaimedCells (R-S2-12, Q1, Q2)', () => {
  const recordHave = {
    userId: 'u2', displayName: 'Bo', memberRole: 'member', state: 'have' as const, tokenCount: null, countHidden: false,
    record: { characterId: 'c1', ownershipState: 'have', tokenCount: null, source: 'plugin', updatedByUserId: null, updatedVia: 'api_key', stateChangedAt: null, tokenCountUpdatedAt: null, lastSyncedAt: null },
  };

  function activeRows(participants: ProgressData['participants'], recordOnly: ProgressData['recordOnly'] = {}) {
    const goals = [goal('wings'), goal('tomes'), goal('done', { status: 'complete', completedAt: '2026-10-01T00:00:00Z' })];
    const data: ProgressData = { goals, participants, recordOnly };
    const columns = buildColumns(PLAYERS, 'standard', { ...data, goals: goals.filter((g) => g.status !== 'complete') });
    return splitFarmRows(data, columns, { currentUserId: 'u1', userRole: 'lead' });
  }

  it('names every blank cell of a claimed column on the given rows, rows then columns, and nothing else', () => {
    const { active } = activeRows(
      {
        wings: [row('wings', 'u1', { state: 'need' })],
        // Lead Nine has no card: an off-roster column whose wings cell is blank.
        tomes: [row('tomes', 'u2', { state: 'have' }), row('tomes', 'u9', { displayName: 'Lead Nine', state: 'want', memberRole: 'lead' })],
      },
      // Bo's record says Have on wings with no row: a record-only Have is not blank (Q1).
      { wings: [recordHave] },
    );
    expect(active.map((r) => r.goal.id)).toEqual(['wings', 'tomes']);
    expect(blankClaimedCells(active)).toEqual([
      { goalId: 'wings', userId: 'u4' },
      { goalId: 'tomes', userId: 'u1' },
      { goalId: 'tomes', userId: 'u4' },
    ]);
  });

  it('is empty when every claimed cell has a state, Finished rows aside', () => {
    const states = (goalId: string) => ['u1', 'u2', 'u4'].map((u) => row(goalId, u, { state: 'pass' }));
    const { active, finished } = activeRows({ wings: states('wings'), tomes: states('tomes'), done: [] });
    expect(blankClaimedCells(active)).toEqual([]);
    // The finished row's cells are all blank, and the caller never passes it.
    expect(finished.map((r) => r.goal.id)).toEqual(['done']);
  });
});
