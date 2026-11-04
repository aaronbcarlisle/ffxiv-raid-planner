/**
 * trackCardModel (S2a-4b·B1 Task TB1; R-F-9, D-11, S-9): what Home's TrackCard says. It has to
 * agree with Progress, so the agreement cases run the real `progressInputs`, `splitFarmRows` and
 * `queueFor` under two presets, and pin the answer as a literal too, so they can't agree on nothing.
 */
import { describe, expect, it } from 'vitest';
import { goal, row } from '../components/progress/__fixtures__/progressFixtures';
import type { CollectionGoal, ParticipantStateEntry, RecordOnlyCell } from '../stores/collectionGoalStore';
import type { SnapshotPlayer, SortPreset } from '../types';
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from './goalTypeMeta';
import { splitFarmRows, type ProgressData, type ProgressReader } from './progressModel';
import { queueFor } from './progressQueue';
import { progressInputs } from './progressView';
import { nextText, trackCardFor } from './trackCardModel';

const player = (id: string, name: string, position: string, role: string, userId: string | null) =>
  ({ id, name, job: 'PLD', role, position, configured: true, isSubstitute: false, sortOrder: 0, userId, gear: [] }) as unknown as SnapshotPlayer;

/** Standard order: Aya, Bo, Cy, Dee, Fay, Eli, Gus. DPS first: Cy, Dee, Aya, Bo, Eli, Gus, Fay. */
const players = [
  player('p1', 'Aya', 'T1', 'tank', 'u1'),
  player('p2', 'Bo', 'H1', 'healer', 'u2'),
  player('p3', 'Cy', 'M1', 'melee', 'u3'),
  player('p4', 'Dee', 'R1', 'caster', 'u4'),
  player('p5', 'Eli', 'M2', 'melee', null),
  player('p6', 'Fay', 'H2', 'healer', 'u6'),
  player('p7', 'Gus', 'R2', 'ranged', 'u7'),
];

const member: ProgressReader = { currentUserId: 'u1', userRole: 'member' };
const viewer: ProgressReader = { currentUserId: 'u1', userRole: 'viewer' };

/** Need Aya and Cy on the same count, Want Bo, Have Dee, Pass Fay, Gus blank, Eli unclaimed. */
const TOP: ParticipantStateEntry[] = [
  row('charlie', 'u1', { tokenCount: 40 }),
  row('charlie', 'u2', { state: 'want', tokenCount: 10 }),
  row('charlie', 'u3', { tokenCount: 40 }),
  row('charlie', 'u4', { state: 'have' }),
  row('charlie', 'u6', { state: 'pass' }),
];

const threeFarms: CollectionGoal[] = [
  goal('alpha', { title: 'Alpha' }),
  goal('bravo', { title: 'Bravo' }),
  goal('charlie', { title: 'Zed Wings' }),
  goal('done', { title: 'Done', status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
];
const threeFarmCells: Record<string, ParticipantStateEntry[]> = {
  alpha: [row('alpha', 'u1')],
  bravo: [row('bravo', 'u1'), row('bravo', 'u2')],
  charlie: TOP,
  // Most Need of all, finished, and one of them has no column anywhere else.
  done: [row('done', 'u1'), row('done', 'u2'), row('done', 'u3'), row('done', 'u4'), row('done', 'ghost', { displayName: 'Ghost' })],
};

function dataOf(
  goals: CollectionGoal[],
  participants: Record<string, ParticipantStateEntry[]>,
  recordOnly: Record<string, RecordOnlyCell[]> = {},
): ProgressData {
  return { goals, participants, recordOnly };
}

function columnsFor(data: ProgressData, sortPreset: SortPreset = 'standard') {
  return progressInputs({ goals: [...data.goals], groupId: 'g1', players, sortPreset, data }).columns;
}

function modelOf(data: ProgressData, reader: ProgressReader = member, sortPreset: SortPreset = 'standard', readerIsViewer = false) {
  return trackCardFor({ data, columns: columnsFor(data, sortPreset), reader, readerIsViewer });
}

/** One farm, by itself, with the mode and cost asked for. */
function oneFarm(cells: ParticipantStateEntry[], overrides: Partial<CollectionGoal> = {}) {
  return dataOf([goal('solo', { title: 'Solo', ...overrides })], { solo: cells });
}

describe.each<[SortPreset, { next: string; pips: string[] }]>([
  ['standard', { next: 'Aya', pips: ['Aya', 'Bo', 'Cy', 'Dee', 'Gus'] }],
  ['dps-first', { next: 'Cy', pips: ['Cy', 'Dee', 'Aya', 'Bo', 'Gus'] }],
])('agreement with Progress under %s', (sortPreset, expected) => {
  const data = dataOf(threeFarms, threeFarmCells);
  const columns = columnsFor(data, sortPreset);
  const first = splitFarmRows(data, columns, member).active[0];

  it('picks the farm Progress lists first, over a finished farm with more Need', () => {
    const model = trackCardFor({ data, columns, reader: member, readerIsViewer: false });
    expect(model?.goalId).toBe(first.goal.id);
    expect(model?.goalId).toBe('charlie');
    expect(model?.title).toBe('Zed Wings');
  });

  it('names the open row queue #1', () => {
    const model = trackCardFor({ data, columns, reader: member, readerIsViewer: false });
    expect(model?.next?.name).toBe(queueFor(first, first.goal.priorityMode)[0].cell.column.name);
    expect(model?.next?.name).toBe(expected.next);
  });

  it('puts the pips in column order', () => {
    const model = trackCardFor({ data, columns, reader: member, readerIsViewer: false });
    expect(model?.pips.map((p) => p.name)).toEqual(expected.pips);
  });

  it('adds no column and no pip for a member who is only on a finished farm', () => {
    const model = trackCardFor({ data, columns, reader: member, readerIsViewer: false });
    expect(columns.map((c) => c.name)).not.toContain('Ghost');
    expect(model?.pips.map((p) => p.name)).not.toContain('Ghost');
  });

  it('breaks a tie the way Progress does, by title then id', () => {
    const tied = dataOf([goal('z', { title: 'Same' }), goal('a', { title: 'same' })], {
      z: [row('z', 'u1')],
      a: [row('a', 'u1')],
    });
    const tiedColumns = columnsFor(tied, sortPreset);
    const model = trackCardFor({ data: tied, columns: tiedColumns, reader: member, readerIsViewer: false });
    expect(model?.goalId).toBe(splitFarmRows(tied, tiedColumns, member).active[0].goal.id);
    expect(model?.goalId).toBe('a');
  });
});

describe('the type', () => {
  it('reads the label and the icon from the goal type', () => {
    const model = modelOf(oneFarm([row('solo', 'u1')], { goalType: 'orchestrion' }));
    expect(model?.typeLabel).toBe(GOAL_TYPE_LABELS.orchestrion);
    expect(model?.typeIcon).toBe(GOAL_TYPE_ICONS.orchestrion);
  });
});

describe('the tally and the pips', () => {
  const data = dataOf(threeFarms, threeFarmCells);

  it('leaves Pass and unclaimed columns out of "n of m"', () => {
    const tally = modelOf(data)?.tally;
    expect(tally?.n).toBe(1);
    expect(tally?.m).toBe(5);
  });

  it('keeps each pip to its name, role and state, blank reading "none"', () => {
    expect(modelOf(data)?.pips).toEqual([
      { name: 'Aya', role: 'tank', state: 'need' },
      { name: 'Bo', role: 'healer', state: 'want' },
      { name: 'Cy', role: 'melee', state: 'need' },
      { name: 'Dee', role: 'caster', state: 'have' },
      { name: 'Gus', role: 'ranged', state: 'none' },
    ]);
  });

  it('has one pip for each column m counts', () => {
    const model = modelOf(data);
    expect(model?.pips).toHaveLength(model?.tally.m ?? -1);
  });

  it('leaves a trailing "not on the roster" member out of the pips and the tally', () => {
    const model = modelOf(oneFarm([row('solo', 'u1'), row('solo', 'trailing', { displayName: 'Trailing', state: 'have' })]));
    expect(model?.pips.map((p) => p.name)).not.toContain('Trailing');
    expect(model?.tally.n).toBe(0);
  });

  it('counts a record-only Have, as the matrix does', () => {
    const recordOnly: RecordOnlyCell = { userId: 'u1', state: 'have', tokenCount: null, countHidden: false } as unknown as RecordOnlyCell;
    const model = modelOf(dataOf([goal('solo')], { solo: [] }, { solo: [recordOnly] }));
    expect(model?.tally.n).toBe(1);
    expect(model?.pips[0]).toEqual({ name: 'Aya', role: 'tank', state: 'have' });
  });

  it('reads an active farm with no cells yet as all no-status, with no next', () => {
    const model = modelOf(dataOf([goal('solo')], {}));
    expect(model?.pips.every((p) => p.state === 'none')).toBe(true);
    expect(model?.tally.n).toBe(0);
    expect(model?.next).toBeNull();
  });

  it('keeps the model when every counted member is on Pass', () => {
    const everyonePasses = ['u1', 'u2', 'u3', 'u4', 'u6', 'u7'].map((u) => row('solo', u, { state: 'pass' }));
    const model = modelOf(oneFarm(everyonePasses));
    expect(model?.pips).toEqual([]);
    expect(model?.tally.m).toBe(0);
    expect(model?.next).toBeNull();
  });
});

describe('the next line', () => {
  it('takes the queue order, not the column order: fewest tokens first', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { tokenCount: 80 }), row('solo', 'u3', { tokenCount: 62 })]));
    expect(model?.next).toEqual({ name: 'Cy', count: 62, needed: 99 });
  });

  it('puts a Need ahead of a Want with fewer tokens', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { state: 'want', tokenCount: 1 }), row('solo', 'u3', { tokenCount: 62 })]));
    expect(model?.next?.name).toBe('Cy');
  });

  it('still has a next on a Want-only queue', () => {
    const model = modelOf(oneFarm([row('solo', 'u2', { state: 'want', tokenCount: 30 })]));
    expect(model?.next).toEqual({ name: 'Bo', count: 30, needed: 99 });
  });

  it('follows a lead pin, as the queue does', () => {
    const cells = [row('solo', 'u1', { tokenCount: 10 }), row('solo', 'u3', { tokenCount: 90, priorityRank: 1 })];
    expect(modelOf(oneFarm(cells))?.next?.name).toBe('Cy');
  });

  it('can name a member with no roster column, as the queue can', () => {
    const model = modelOf(oneFarm([row('solo', 'trailing', { displayName: 'Trailing', tokenCount: 5 })]));
    expect(model?.next).toEqual({ name: 'Trailing', count: 5, needed: 99 });
  });

  it('has no next under free_roll, and keeps the tally and pips', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { tokenCount: 62 })], { priorityMode: 'free_roll' }));
    expect(model?.next).toBeNull();
    expect(model?.tally.m).toBe(6);
    expect(model?.pips).toHaveLength(6);
  });

  it('has no next under desired_only on a Want-only queue', () => {
    const model = modelOf(oneFarm([row('solo', 'u2', { state: 'want' })], { priorityMode: 'desired_only' }));
    expect(model?.next).toBeNull();
  });

  it('has no next when nobody wants it', () => {
    expect(modelOf(oneFarm([row('solo', 'u1', { state: 'have' })]))?.next).toBeNull();
  });

  it('gives a viewer no next and no counts, and keeps the tally and pips', () => {
    const data = oneFarm([row('solo', 'u1', { tokenCount: 62 }), row('solo', 'u4', { state: 'have' })]);
    const model = modelOf(data, viewer, 'standard', true);
    expect(model?.next).toBeNull();
    expect(model?.tally).toMatchObject({ n: 1, m: 6 });
    expect(model?.pips).toHaveLength(6);
    expect(JSON.stringify(model)).not.toContain('62');
  });

  it('goes by readerIsViewer, whatever the reader role says', () => {
    const data = oneFarm([row('solo', 'u1', { tokenCount: 62 })]);
    expect(modelOf(data, member, 'standard', true)?.next).toBeNull();
  });

  it('gives a null count, with the cost kept, when the count is hidden', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { tokenCount: 62, countHidden: true })]));
    expect(model?.next).toEqual({ name: 'Aya', count: null, needed: 99 });
  });

  it('gives a null cost for a drop-only farm', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { tokenCount: 62 })], { tokenCost: null }));
    expect(model?.next).toEqual({ name: 'Aya', count: 62, needed: null });
  });

  it('keeps a count of zero', () => {
    const model = modelOf(oneFarm([row('solo', 'u1', { tokenCount: 0 })]));
    expect(model?.next).toEqual({ name: 'Aya', count: 0, needed: 99 });
  });
});

describe('null', () => {
  it('is null with no goals', () => {
    expect(modelOf(dataOf([], {}))).toBeNull();
  });

  it('is null when every farm is finished', () => {
    expect(modelOf(dataOf([threeFarms[3]], { done: threeFarmCells.done }))).toBeNull();
  });
});

describe('literal text and size', () => {
  it('keeps a title with quotes, a backslash and a dollar as it is', () => {
    const title = `Ifrit's "Wings" \\u0041 $& 100%…`;
    expect(modelOf(oneFarm([row('solo', 'u1')], { title }))?.title).toBe(title);
  });

  it('finds the top farm among two hundred', () => {
    const goals = Array.from({ length: 200 }, (_, i) => goal(`g${i}`, { title: `Farm ${i}` }));
    const cells = Object.fromEntries(goals.map((g) => [g.id, [row(g.id, 'u1')]]));
    cells.g137 = [row('g137', 'u1'), row('g137', 'u2')];
    expect(modelOf(dataOf(goals, cells))?.goalId).toBe('g137');
  });
});

describe('nextText', () => {
  it.each([
    [{ name: 'Aya', count: 62, needed: 99 }, 'Aya is next (62/99)'],
    [{ name: 'Aya', count: 62, needed: null }, 'Aya is next (62)'],
    [{ name: 'Aya', count: null, needed: 99 }, 'Aya is next'],
    [{ name: 'Aya', count: null, needed: null }, 'Aya is next'],
    [{ name: 'Aya', count: 0, needed: 99 }, 'Aya is next (0/99)'],
    [{ name: 'Aya', count: 0, needed: null }, 'Aya is next (0)'],
  ])('%o reads "%s"', (next, text) => {
    expect(nextText(next)).toBe(text);
  });

  it('keeps a name with quotes, a backslash, a dollar and non-Latin text as it is', () => {
    const name = `O'Neil "$&" \\u0041 ひかり`;
    expect(nextText({ name, count: 62, needed: 99 })).toBe(`${name} is next (62/99)`);
  });
});
