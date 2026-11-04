/**
 * progressView (S2a-4b·B1 Task TB1; R-F-9, D-11, S-9): the one columns helper Progress and Home's
 * TrackCard share. Its expected values are what `ProgressPage` computes today: the static's goals
 * less the finished ones, and `buildColumns` over those active goals only.
 */
import { describe, expect, it } from 'vitest';
import { goal, row } from '../components/progress/__fixtures__/progressFixtures';
import type { CollectionGoal } from '../stores/collectionGoalStore';
import type { SnapshotPlayer, SortPreset } from '../types';
import { buildColumns, type ProgressData } from './progressModel';
import { progressInputs } from './progressView';

const player = (id: string, name: string, position: string, role: string, userId: string | null) =>
  ({ id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [] }) as unknown as SnapshotPlayer;

const players = [
  player('p1', 'Aya', 'T1', 'tank', 'u1'),
  player('p2', 'Bo', 'H1', 'healer', 'u2'),
  player('p3', 'Cy', 'M1', 'melee', 'u3'),
  player('p4', 'Dee', 'R1', 'caster', null),
];

const active = goal('active', { title: 'Active' });
const scheduled = goal('scheduled', { title: 'Scheduled', status: 'scheduled' });
const wanted = goal('wanted', { title: 'Wanted', status: 'wanted' });
const finished = goal('finished', { title: 'Finished', status: 'complete', completedAt: '2026-10-01T00:00:00Z' });
const foreign = goal('foreign', { title: 'Foreign', staticGroupId: 'g2' });
const goals: CollectionGoal[] = [finished, active, foreign, scheduled, wanted];

const data: ProgressData = {
  goals,
  participants: {
    active: [row('active', 'u1'), row('active', 'guest-on-active', { displayName: 'Trailing' })],
    finished: [row('finished', 'ghost-on-finished', { displayName: 'Ghost' })],
    foreign: [row('foreign', 'ghost-on-foreign', { displayName: 'Stranger' })],
  },
  recordOnly: {},
};

const names = (columns: readonly { name: string }[]) => columns.map((c) => c.name);

describe('progressInputs', () => {
  it('keeps the static goals that are not finished, in the order they came', () => {
    const { activeGoals } = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'standard', data });
    expect(activeGoals.map((g) => g.id)).toEqual(['active', 'scheduled', 'wanted']);
  });

  it.each<SortPreset>(['standard', 'dps-first', 'healer-first', 'custom'])(
    'builds the columns ProgressPage builds under %s',
    (sortPreset) => {
      const { columns } = progressInputs({ goals, groupId: 'g1', players, sortPreset, data });
      const activeOnly = { ...data, goals: [active, scheduled, wanted] };
      expect(columns).toEqual(buildColumns(players, sortPreset, activeOnly));
    },
  );

  it('orders the columns by the preset', () => {
    const standard = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'standard', data });
    const dpsFirst = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'dps-first', data });
    expect(names(standard.columns).slice(0, 4)).toEqual(['Aya', 'Bo', 'Cy', 'Dee']);
    expect(names(dpsFirst.columns).slice(0, 4)).toEqual(['Cy', 'Dee', 'Aya', 'Bo']);
  });

  it('adds a trailing column for an active farm member, none for a finished farm member', () => {
    const { columns } = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'standard', data });
    expect(names(columns)).toContain('Trailing');
    expect(names(columns)).not.toContain('Ghost');
  });

  it('adds no column for a member who holds a row only on another static', () => {
    const { columns } = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'standard', data });
    expect(names(columns)).not.toContain('Stranger');
  });

  it('gives the roster alone, with the active goals kept, when the cells have not been shown yet', () => {
    const noFarms: ProgressData = { goals: [], participants: {}, recordOnly: {} };
    const { activeGoals, columns } = progressInputs({ goals, groupId: 'g1', players, sortPreset: 'standard', data: noFarms });
    expect(activeGoals.map((g) => g.id)).toEqual(['active', 'scheduled', 'wanted']);
    expect(names(columns)).toEqual(['Aya', 'Bo', 'Cy', 'Dee']);
  });

  it('gives an empty answer for an empty static', () => {
    const empty: ProgressData = { goals: [], participants: {}, recordOnly: {} };
    expect(progressInputs({ goals: [], groupId: 'g1', players: [], sortPreset: 'standard', data: empty })).toEqual({
      activeGoals: [],
      columns: [],
    });
  });

  it('gives no active goals for a static whose goals are all in another static', () => {
    const { activeGoals } = progressInputs({ goals: [foreign], groupId: 'g1', players, sortPreset: 'standard', data });
    expect(activeGoals).toEqual([]);
  });
});
