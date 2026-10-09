/**
 * progressModel (S2a-2·F2 Task TF4; R-S2-6, R-S2-7, R-S2-8, Q3): the Progress
 * matrix's columns, cells, row order, tallies and text, shared by the render and
 * S2a-4's TrackCard.
 */
import { describe, expect, it } from 'vitest';
import {
  buildColumns,
  cellAccessibleName,
  cellFor,
  cellText,
  compareFarmRows,
  haveTally,
  splitFarmRows,
  type ProgressColumn,
  type ProgressData,
  type ProgressReader,
} from './progressModel';
import { boardSections, sortPlayersByRole } from './calculations';
import { DEFAULT_SETTINGS, SORT_PRESETS } from './constants';
import type { CollectionGoal, ParticipantStateEntry, RecordOnlyCell } from '../stores/collectionGoalStore';
import type { SnapshotPlayer, SortPreset } from '../types';

// ── Fixtures ────────────────────────────────────────────────────────────────

function player(id: string, overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id,
    name: id,
    job: 'PLD',
    role: 'tank',
    position: null,
    configured: true,
    isSubstitute: false,
    sortOrder: 0,
    userId: null,
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function entry(goalId: string, userId: string, overrides: Partial<ParticipantStateEntry> = {}): ParticipantStateEntry {
  return {
    id: `${goalId}:${userId}`,
    goalId,
    userId,
    staticGroupId: 'static-1',
    state: 'need',
    tokenCount: null,
    priorityRank: null,
    source: 'manual',
    lastSyncedAt: null,
    notes: null,
    updatedAt: '2026-10-01T00:00:00Z',
    displayName: userId,
    memberRole: 'member',
    countHidden: false,
    record: null,
    ...overrides,
  };
}

const RECORD: RecordOnlyCell['record'] = {
  characterId: 'char-1',
  ownershipState: 'have',
  tokenCount: null,
  source: 'plugin',
  updatedByUserId: null,
  updatedVia: 'api_key',
  stateChangedAt: '2026-10-01T00:00:00Z',
  tokenCountUpdatedAt: null,
  lastSyncedAt: '2026-10-01T00:00:00Z',
};

function recordOnly(userId: string, overrides: Partial<RecordOnlyCell> = {}): RecordOnlyCell {
  return {
    userId,
    displayName: userId,
    memberRole: 'member',
    state: 'have',
    tokenCount: null,
    countHidden: false,
    record: { ...RECORD },
    ...overrides,
  };
}

function goal(id: string, overrides: Partial<CollectionGoal> = {}): CollectionGoal {
  return {
    id,
    staticGroupId: 'static-1',
    createdById: null,
    goalType: 'mount',
    contentType: null,
    contentKey: null,
    title: id,
    status: 'farming',
    priorityMode: null,
    summary: null,
    linkedDutyId: null,
    linkedRewardId: null,
    targetCount: null,
    currentCount: null,
    note: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    catalogItemId: null,
    tokenName: null,
    tokenCost: null,
    participantSummary: null,
    ...overrides,
  };
}

function data(
  goals: CollectionGoal[],
  participants: Record<string, ParticipantStateEntry[]> = {},
  recordOnlyCells: Record<string, RecordOnlyCell[]> = {},
): ProgressData {
  return { goals, participants, recordOnly: recordOnlyCells };
}

const LEAD: ProgressReader = { currentUserId: 'u-lead', userRole: 'lead' };

// Input order is scrambled (reversed) so every preset has to sort it.
const ROSTER: SnapshotPlayer[] = [
  player('t1', { name: 'Tank One', role: 'tank', position: 'T1', sortOrder: 3, userId: 'u-t1' }),
  player('h1', { name: 'Healer One', role: 'healer', position: 'H1', sortOrder: 2, userId: 'u-h1' }),
  player('m1', { name: 'Melee One', role: 'melee', position: 'M1', sortOrder: 1, userId: 'u-m1' }),
  player('c1', { name: 'Caster One', role: 'caster', position: 'R1', sortOrder: 0, userId: 'u-c1' }),
  player('t2', { name: 'Tank Two', role: 'tank', position: 'T2', sortOrder: 7, userId: null }),
  player('h2', { name: 'Healer Two', role: 'healer', position: 'H2', sortOrder: 6, userId: 'u-h2' }),
  player('m2', { name: 'Melee Two', role: 'melee', position: 'M2', sortOrder: 5, userId: 'u-m2' }),
  player('r2', { name: 'Ranged Two', role: 'ranged', position: 'R2', sortOrder: 4, userId: 'u-r2' }),
  player('flex', { name: 'Flex', role: 'melee', position: null, sortOrder: 8, userId: 'u-flex' }),
  player('sub', { name: 'Sub', role: 'caster', position: null, isSubstitute: true, sortOrder: 9, userId: 'u-sub' }),
  player('off', { name: 'Off', role: 'tank', position: 'T1', configured: false, sortOrder: 10, userId: null }),
].reverse();

const NO_ROWS = data([goal('g1')]);

/** The claimed column of the named roster player. */
function columnOf(columns: ProgressColumn[], playerId: string): ProgressColumn {
  const column = columns.find((c) => c.player?.id === playerId);
  if (!column) throw new Error(`no column for ${playerId}`);
  return column;
}

// ── Columns (R-S2-6) ────────────────────────────────────────────────────────

describe('buildColumns', () => {
  it.each<[SortPreset, string[]]>([
    ['standard', ['t1', 'h1', 'm1', 'c1', 't2', 'h2', 'm2', 'r2', 'flex', 'sub']],
    ['dps-first', ['m1', 'c1', 't1', 'h1', 'm2', 'r2', 't2', 'h2', 'flex', 'sub']],
    ['healer-first', ['h1', 't1', 'm1', 'c1', 'h2', 't2', 'm2', 'r2', 'flex', 'sub']],
    ['custom', ['c1', 'm1', 'h1', 't1', 'r2', 'm2', 'h2', 't2', 'flex', 'sub']],
  ])('orders the roster as the Board does under the %s preset', (preset, expected) => {
    const ids = buildColumns(ROSTER, preset, NO_ROWS).map((c) => c.player?.id);
    expect(ids).toEqual(expected);
    // The same order as boardSections over the preset's sort, flattened (vet M-6).
    const sorted = sortPlayersByRole(ROSTER, SORT_PRESETS[preset].order ?? DEFAULT_SETTINGS.displayOrder, preset);
    expect(ids).toEqual(boardSections(sorted).flatMap((s) => s.players.map((p) => p.id)));
  });

  it('marks a player with a userId claimed and one without unclaimed, and drops unconfigured players', () => {
    const columns = buildColumns(ROSTER, 'standard', NO_ROWS);
    expect(columnOf(columns, 'c1')).toMatchObject({ kind: 'claimed', userId: 'u-c1', name: 'Caster One' });
    expect(columnOf(columns, 't2')).toMatchObject({ kind: 'unclaimed', userId: null, name: 'Tank Two' });
    expect(columns.filter((c) => c.kind === 'unclaimed').map((c) => c.player?.id)).toEqual(['t2']);
    expect(columns.some((c) => c.player?.id === 'off')).toBe(false);
  });

  it('adds a trailing "Not on the roster" column per row-holder with no card, by display name', () => {
    const goals = [goal('g1'), goal('g2')];
    const columns = buildColumns(
      ROSTER,
      'standard',
      data(goals, {
        g1: [
          entry('g1', 'u-c1'), // has a card: no extra column
          entry('g1', 'u-zed', { displayName: 'Zed', memberRole: 'member' }),
          entry('g1', 'u-alice', { displayName: 'alice', memberRole: 'lead' }),
        ],
        g2: [entry('g2', 'u-zed', { displayName: 'Zed', memberRole: 'member' })],
      }),
    );
    const trailing = columns.filter((c) => c.kind === 'notOnRoster');
    expect(trailing.map((c) => [c.userId, c.name])).toEqual([
      ['u-alice', 'alice'],
      ['u-zed', 'Zed'],
    ]);
    expect(columns.slice(-2)).toEqual(trailing);
    expect(trailing.every((c) => c.player === null)).toBe(true);
    expect(trailing.map((c) => c.kind === 'notOnRoster' && c.reason)).toEqual(['notOnRoster', 'notOnRoster']);
  });

  it('labels a member whose claimed card is not set up "unconfigured", not "Not on the roster" (TF5 ruling 1)', () => {
    const roster = [
      ...ROSTER,
      player('draft', { name: 'Draft', configured: false, userId: 'u-draft', sortOrder: 11 }),
    ];
    const rows = {
      g1: [
        entry('g1', 'u-draft', { displayName: 'Dru', memberRole: 'member' }),
        entry('g1', 'u-away', { displayName: 'Abe', memberRole: 'member' }),
        entry('g1', 'u-zed', { displayName: 'Zed', memberRole: 'member' }),
      ],
    };
    const columns = buildColumns(roster, 'standard', data([goal('g1')], rows));
    const trailing = columns.filter((c) => c.kind === 'notOnRoster');
    // Same trailing position and name order for both reasons; the card is not placed as a column.
    expect(columns.slice(-3)).toEqual(trailing);
    expect(trailing.map((c) => [c.name, c.kind === 'notOnRoster' && c.reason])).toEqual([
      ['Abe', 'notOnRoster'],
      ['Dru', 'unconfigured'],
      ['Zed', 'notOnRoster'],
    ]);
    expect(columns.some((c) => c.player?.id === 'draft')).toBe(false);
    // Still counted in neither n nor m.
    const cells = columns.map((col) => cellFor(col, { participants: rows.g1 }, LEAD));
    expect(haveTally(cells)).toEqual({ n: 0, m: 9, everyone: false });
  });

  it('takes the display name from a later row when the first row had none', () => {
    const goals = [goal('g1'), goal('g2')];
    const columns = buildColumns(
      ROSTER,
      'standard',
      data(goals, {
        g1: [entry('g1', 'u-late', { displayName: null })],
        g2: [entry('g2', 'u-late', { displayName: 'Late' })],
      }),
    );
    expect(columns.at(-1)).toMatchObject({ kind: 'notOnRoster', userId: 'u-late', name: 'Late' });
  });

  it('names a row-holder with no display name on any row "Unknown"', () => {
    const columns = buildColumns(
      ROSTER,
      'standard',
      data([goal('g1')], { g1: [entry('g1', 'u-anon', { displayName: null })] }),
    );
    expect(columns.at(-1)).toMatchObject({ kind: 'notOnRoster', userId: 'u-anon', name: 'Unknown' });
  });

  it('orders two row-holders with the same name by user id', () => {
    const columns = buildColumns(
      ROSTER,
      'standard',
      data([goal('g1')], {
        g1: [
          entry('g1', 'u-2', { displayName: 'Sam' }),
          entry('g1', 'u-1', { displayName: 'sam' }),
        ],
      }),
    );
    expect(columns.slice(-2).map((c) => c.userId)).toEqual(['u-1', 'u-2']);
  });

  it('gives no column to a row-holder whose memberRole is null or viewer', () => {
    const columns = buildColumns(
      ROSTER,
      'standard',
      data([goal('g1')], {
        g1: [
          entry('g1', 'u-former', { displayName: 'Former', memberRole: null }),
          entry('g1', 'u-viewer', { displayName: 'Viewer', memberRole: 'viewer' }),
        ],
      }),
    );
    expect(columns.some((c) => c.kind === 'notOnRoster')).toBe(false);
  });

  it('gives no column to a record-only user with no card', () => {
    const columns = buildColumns(
      ROSTER,
      'standard',
      data([goal('g1')], {}, { g1: [recordOnly('u-rec', { displayName: 'Rec', state: 'have' })] }),
    );
    expect(columns.some((c) => c.userId === 'u-rec')).toBe(false);
    expect(columns).toHaveLength(10);
  });

  it('reads rows only from the goals it is given', () => {
    const columns = buildColumns(ROSTER, 'standard', {
      goals: [goal('g1')],
      participants: { other: [entry('other', 'u-elsewhere', { displayName: 'Elsewhere' })] },
      recordOnly: {},
    });
    expect(columns.some((c) => c.userId === 'u-elsewhere')).toBe(false);
  });
});

// ── Cells (R-S2-8; vet I-1) ─────────────────────────────────────────────────

describe('cellFor', () => {
  const columns = buildColumns(ROSTER, 'standard', NO_ROWS);
  const caster = columnOf(columns, 'c1');

  it('takes the row\'s merged state and count', () => {
    const cell = cellFor(caster, { participants: [entry('g1', 'u-c1', { state: 'want', tokenCount: 30 })] }, LEAD);
    expect(cell).toMatchObject({ state: 'want', count: 30, countHidden: false, own: false, recordOnly: null });
    expect(cell.entry?.userId).toBe('u-c1');
  });

  it('prefers the row over a record-only cell for the same user', () => {
    const cell = cellFor(
      caster,
      { participants: [entry('g1', 'u-c1', { state: 'need' })], recordOnly: [recordOnly('u-c1', { state: 'have' })] },
      LEAD,
    );
    expect(cell.state).toBe('need');
    expect(cell.recordOnly).toBeNull();
  });

  it('reads a record-only Have when there is no row (Q1)', () => {
    const cell = cellFor(caster, { participants: [], recordOnly: [recordOnly('u-c1', { state: 'have' })] }, LEAD);
    expect(cell).toMatchObject({ state: 'have', entry: null });
    expect(cell.recordOnly?.userId).toBe('u-c1');
    expect(cell.record).toEqual(RECORD);
  });

  it('is blank for a record-only cell whose state is null', () => {
    const cell = cellFor(caster, { recordOnly: [recordOnly('u-c1', { state: null, tokenCount: 30 })] }, LEAD);
    expect(cell.state).toBeNull();
  });

  it('is blank with no row and no record-only cell', () => {
    const cell = cellFor(caster, { participants: [entry('g1', 'u-h1')] }, LEAD);
    expect(cell).toMatchObject({ state: null, count: null, countHidden: false, entry: null, recordOnly: null, record: null });
  });

  it('hides the count when countHidden is true, even if a count came through', () => {
    const cell = cellFor(
      caster,
      { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62, countHidden: true })] },
      LEAD,
    );
    expect(cell).toMatchObject({ state: 'need', countHidden: true, count: null });
  });

  it('hides a record-only cell\'s count when its countHidden is true', () => {
    const cell = cellFor(caster, { recordOnly: [recordOnly('u-c1', { tokenCount: 62, countHidden: true })] }, LEAD);
    expect(cell).toMatchObject({ countHidden: true, count: null });
  });

  it('treats countHidden false with no count as not hidden, with no count yet (vet I-1)', () => {
    const cell = cellFor(
      caster,
      { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: null, countHidden: false })] },
      LEAD,
    );
    expect(cell).toMatchObject({ state: 'need', countHidden: false, count: null });
  });

  it('treats a row without the countHidden field as not hidden', () => {
    const legacy = entry('g1', 'u-c1', { tokenCount: null });
    delete legacy.countHidden;
    expect(cellFor(caster, { participants: [legacy] }, LEAD).countHidden).toBe(false);
  });

  it('withholds every count from a viewer', () => {
    const cell = cellFor(
      caster,
      { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62 })] },
      { currentUserId: 'u-viewer', userRole: 'viewer' },
    );
    expect(cell).toMatchObject({ state: 'need', countHidden: true, count: null });
  });

  it('shows a member, lead or owner their own count', () => {
    const rows = { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62 })] };
    for (const userRole of ['member', 'lead', 'owner'] as const) {
      const cell = cellFor(caster, rows, { currentUserId: 'u-c1', userRole });
      expect(cell, userRole).toMatchObject({ own: true, countHidden: false, count: 62 });
    }
  });

  it('withholds a viewer\'s own count too: viewers see states only (R-S2-8)', () => {
    const viewer: ProgressReader = { currentUserId: 'u-c1', userRole: 'viewer' };
    const cell = cellFor(caster, { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62 })] }, viewer);
    expect(cell).toMatchObject({ own: true, state: 'need', countHidden: true, count: null });
    expect(cellText(cell, { tokenCost: 99 })).toBe('Need');
    // A record-only cell is withheld the same way.
    const record = cellFor(caster, { recordOnly: [recordOnly('u-c1', { state: 'have', tokenCount: 5 })] }, viewer);
    expect(record).toMatchObject({ own: true, countHidden: true, count: null });
  });

  it('keeps the server\'s flag on one\'s own cell (View As reads stay gated as the admin, vet M-7)', () => {
    const cell = cellFor(
      caster,
      { participants: [entry('g1', 'u-c1', { tokenCount: null, countHidden: true })] },
      { currentUserId: 'u-c1', userRole: 'member' },
    );
    expect(cell).toMatchObject({ own: true, countHidden: true, count: null });
  });

  it('keeps countHidden false on a blank cell a viewer reads (TF5 ruling 5)', () => {
    const viewer: ProgressReader = { currentUserId: 'u-viewer', userRole: 'viewer' };
    expect(cellFor(caster, { participants: [entry('g1', 'u-h1')] }, viewer)).toMatchObject({
      state: null,
      countHidden: false,
      count: null,
    });
    // A record-only cell whose state is null is blank too.
    const blankRecord = cellFor(caster, { recordOnly: [recordOnly('u-c1', { state: null, tokenCount: 4, countHidden: true })] }, viewer);
    expect(blankRecord).toMatchObject({ state: null, countHidden: false });
  });

  it('has no cell on an unclaimed column', () => {
    const cell = cellFor(columnOf(columns, 't2'), { participants: [entry('g1', 'u-t1')] }, LEAD);
    expect(cell).toMatchObject({ state: null, count: null, own: false, entry: null });
  });

  it('fills a Not-on-the-roster column from that user\'s row', () => {
    const goals = [goal('g1')];
    const rows = { g1: [entry('g1', 'u-zed', { displayName: 'Zed', state: 'have' })] };
    const zed = buildColumns(ROSTER, 'standard', data(goals, rows)).find((c) => c.kind === 'notOnRoster');
    expect(zed).toBeDefined();
    expect(cellFor(zed!, { participants: rows.g1 }, { currentUserId: 'u-zed', userRole: 'member' })).toMatchObject({
      state: 'have',
      own: true,
    });
  });
});

// ── Tally (R-S2-7 status column; vet M12) ───────────────────────────────────

describe('haveTally', () => {
  const small = [
    player('a', { position: 'T1', userId: 'u-a' }),
    player('b', { position: 'H1', userId: 'u-b' }),
    player('c', { position: 'M1', userId: 'u-c' }),
    player('d', { position: 'R1', userId: null }),
  ];
  const offRow = entry('g1', 'u-e', { displayName: 'Elle', state: 'have' });

  function tallyOf(participants: ParticipantStateEntry[], recordOnlyCells: RecordOnlyCell[] = []) {
    const goals = [goal('g1')];
    const columns = buildColumns(small, 'standard', data(goals, { g1: [...participants, offRow] }));
    expect(columns.map((c) => c.kind)).toEqual(['claimed', 'claimed', 'claimed', 'unclaimed', 'notOnRoster']);
    const cells = columns.map((col) => cellFor(col, { participants: [...participants, offRow], recordOnly: recordOnlyCells }, LEAD));
    return haveTally(cells);
  }

  it('counts a record-only Have in n and leaves Pass, unclaimed and Not on the roster out of m', () => {
    const tally = tallyOf([entry('g1', 'u-a', { state: 'have' }), entry('g1', 'u-c', { state: 'pass' })], [
      recordOnly('u-b', { state: 'have' }),
    ]);
    expect(tally).toEqual({ n: 2, m: 2, everyone: true });
  });

  it('counts a Want and a blank in m but not in n, beside a Have', () => {
    const tally = tallyOf([entry('g1', 'u-a', { state: 'have' }), entry('g1', 'u-b', { state: 'want' })]);
    expect(tally).toEqual({ n: 1, m: 3, everyone: false });
  });

  it('is m = 0, and not everyone, when every claimed column is on Pass', () => {
    const tally = tallyOf([
      entry('g1', 'u-a', { state: 'pass' }),
      entry('g1', 'u-b', { state: 'pass' }),
      entry('g1', 'u-c', { state: 'pass' }),
    ]);
    expect(tally).toEqual({ n: 0, m: 0, everyone: false });
  });

  it('is m = 0 with no claimed column at all', () => {
    expect(haveTally([])).toEqual({ n: 0, m: 0, everyone: false });
  });
});

// ── Row order (R-S2-7, Q3) ──────────────────────────────────────────────────

describe('splitFarmRows and compareFarmRows', () => {
  const four = [
    player('a', { position: 'T1', userId: 'u-a' }),
    player('b', { position: 'H1', userId: 'u-b' }),
    player('c', { position: 'M1', userId: 'u-c' }),
    player('d', { position: 'R1', userId: 'u-d' }),
  ];

  function split(goals: CollectionGoal[], rows: Record<string, ParticipantStateEntry[]>) {
    const input = data(goals, rows);
    return splitFarmRows(input, buildColumns(four, 'standard', input), LEAD);
  }

  const states = (goalId: string, list: Array<ParticipantStateEntry['state'] | null>) =>
    list.flatMap((state, i) => (state ? [entry(goalId, `u-${'abcd'[i]}`, { state })] : []));

  it('puts the farm with 3 Need before the one with 1 Need, whatever the titles', () => {
    const { active } = split([goal('few', { title: 'Alpha' }), goal('many', { title: 'Zulu' })], {
      few: states('few', ['need', 'want', 'want', 'want']),
      many: states('many', ['need', 'need', 'need', null]),
    });
    expect(active.map((r) => r.goal.id)).toEqual(['many', 'few']);
    expect(active.map((r) => [r.need, r.want])).toEqual([
      [3, 0],
      [1, 3],
    ]);
  });

  it('breaks equal Need by more Want first', () => {
    const { active } = split([goal('lessWant', { title: 'Alpha' }), goal('moreWant', { title: 'Zulu' })], {
      lessWant: states('lessWant', ['need', 'want', null, 'have']),
      moreWant: states('moreWant', ['need', 'want', 'want', 'pass']),
    });
    expect(active.map((r) => r.goal.id)).toEqual(['moreWant', 'lessWant']);
  });

  it('breaks equal Need and Want by title, case-insensitively', () => {
    const { active } = split(
      [goal('g-charlie', { title: 'charlie' }), goal('g-beta', { title: 'Beta' }), goal('g-alpha', { title: 'alpha' })],
      {},
    );
    expect(active.map((r) => r.goal.title)).toEqual(['alpha', 'Beta', 'charlie']);
  });

  it('breaks equal Need and Want by title at base sensitivity, then by id', () => {
    // Default collation would order these alpha, Alpha, álpha; at base sensitivity
    // they tie, so the id decides.
    const { active } = split(
      [goal('g3', { title: 'alpha' }), goal('g1', { title: 'Alpha' }), goal('g2', { title: 'álpha' })],
      {},
    );
    expect(active.map((r) => r.goal.id)).toEqual(['g1', 'g2', 'g3']);
  });

  it('counts only claimed columns toward the order', () => {
    const goals = [goal('claimedNeed', { title: 'Zulu' }), goal('offNeed', { title: 'Alpha' })];
    const rows = {
      claimedNeed: states('claimedNeed', ['need', 'need', null, null]),
      offNeed: [
        ...states('offNeed', ['need', null, null, null]),
        entry('offNeed', 'u-x', { displayName: 'X', state: 'need' }),
        entry('offNeed', 'u-y', { displayName: 'Y', state: 'need' }),
      ],
    };
    const { active } = split(goals, rows);
    expect(active.map((r) => r.goal.id)).toEqual(['claimedNeed', 'offNeed']);
    expect(active.map((r) => r.need)).toEqual([2, 1]);
  });

  it('keeps wanted, farming and scheduled active, and sends complete to finished, newest completedAt first', () => {
    const { active, finished } = split(
      [
        goal('wanted', { status: 'wanted', title: 'A' }),
        goal('old', { status: 'complete', completedAt: '2026-09-01T00:00:00Z' }),
        goal('farming', { status: 'farming', title: 'B' }),
        goal('undated', { status: 'complete', completedAt: null }),
        goal('new', { status: 'complete', completedAt: '2026-10-01T00:00:00Z' }),
        goal('scheduled', { status: 'scheduled', title: 'C' }),
      ],
      {},
    );
    expect(active.map((r) => r.goal.id)).toEqual(['wanted', 'farming', 'scheduled']);
    expect(finished.map((r) => r.goal.id)).toEqual(['new', 'old', 'undated']);
  });

  it('gives each row one cell per column, in column order, and its tally', () => {
    const goals = [goal('g1')];
    const input = data(goals, { g1: states('g1', ['have', 'pass', null, 'need']) });
    const columns = buildColumns(four, 'standard', input);
    const [row] = splitFarmRows(input, columns, LEAD).active;
    expect(row.cells.map((c) => c.column)).toEqual(columns);
    expect(row.cells.map((c) => c.state)).toEqual(['have', 'pass', null, 'need']);
    expect(row.tally).toEqual({ n: 1, m: 3, everyone: false });
  });

  it('exposes the comparator for TrackCard (S2-12)', () => {
    const a = { goal: goal('a', { title: 'a' }), need: 1, want: 0 };
    const b = { goal: goal('b', { title: 'b' }), need: 1, want: 2 };
    expect([a, b].sort(compareFarmRows)).toEqual([b, a]);
  });
});

// ── Text (R-S2-8) ───────────────────────────────────────────────────────────

describe('cellText', () => {
  const columns = buildColumns(ROSTER, 'standard', NO_ROWS);
  const caster = columnOf(columns, 'c1');
  const withCost = { tokenCost: 99 };
  const noCost = { tokenCost: null };

  it.each<[string, Partial<ParticipantStateEntry> | null, { tokenCost: number | null }, string]>([
    ['Have', { state: 'have', tokenCount: 62 }, withCost, '✓ Have'],
    ['Need with a cost', { state: 'need', tokenCount: 62 }, withCost, 'Need 62/99'],
    ['Need with no cost', { state: 'need', tokenCount: 62 }, noCost, 'Need 62'],
    ['Need with a count of 0', { state: 'need', tokenCount: 0 }, withCost, 'Need 0/99'],
    ['Want with no count', { state: 'want', tokenCount: null }, withCost, '★ Want'],
    ['Want with a count', { state: 'want', tokenCount: 30 }, withCost, '★ Want 30/99'],
    ['Pass', { state: 'pass', tokenCount: 62 }, withCost, '– Pass'],
    ['blank', null, withCost, ''],
    ['a hidden count', { state: 'need', tokenCount: 62, countHidden: true }, withCost, 'Need'],
    ['Need with no count yet', { state: 'need', tokenCount: null, countHidden: false }, withCost, 'Need'],
  ])('%s', (_label, fields, g, expected) => {
    const participants = fields ? [entry('g1', 'u-c1', fields)] : [];
    expect(cellText(cellFor(caster, { participants }, LEAD), g)).toBe(expected);
  });

  it('shows a viewer no counts, on their own cell or others\'', () => {
    const viewer: ProgressReader = { currentUserId: 'u-viewer', userRole: 'viewer' };
    const need = cellFor(caster, { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62 })] }, viewer);
    const want = cellFor(caster, { participants: [entry('g1', 'u-c1', { state: 'want', tokenCount: 30 })] }, viewer);
    const own = cellFor(caster, { participants: [entry('g1', 'u-c1', { state: 'need', tokenCount: 62 })] }, { currentUserId: 'u-c1', userRole: 'viewer' });
    expect(cellText(need, withCost)).toBe('Need');
    expect(cellText(want, withCost)).toBe('★ Want');
    expect(cellText(own, withCost)).toBe('Need');
  });

  it('is empty on an unclaimed column', () => {
    expect(cellText(cellFor(columnOf(columns, 't2'), {}, LEAD), withCost)).toBe('');
  });
});

// ── Accessible name (R-S2-8) ────────────────────────────────────────────────

describe('cellAccessibleName', () => {
  const columns = buildColumns(ROSTER, 'standard', NO_ROWS);
  const caster = columnOf(columns, 'c1');
  const wings: Pick<CollectionGoal, 'title' | 'tokenCost' | 'tokenName'> = {
    title: 'Wings of Resolve',
    tokenCost: 99,
    tokenName: 'totems',
  };
  const name = (fields: Partial<ParticipantStateEntry> | null, g = wings, reader = LEAD) =>
    cellAccessibleName(cellFor(caster, { participants: fields ? [entry('g1', 'u-c1', fields)] : [] }, reader), g);

  it('names the player, the track, the state and the count of the cost', () => {
    expect(name({ state: 'need', tokenCount: 62 })).toBe('Caster One, Wings of Resolve, Need, 62 of 99 totems');
  });

  it('names a blank cell "no status"', () => {
    expect(name(null)).toBe('Caster One, Wings of Resolve, no status');
  });

  it('names an unclaimed column\'s cell "unclaimed"', () => {
    expect(cellAccessibleName(cellFor(columnOf(columns, 't2'), {}, LEAD), wings)).toBe(
      'Tank Two, Wings of Resolve, unclaimed',
    );
  });

  it('names the state alone when the count is hidden, absent, or not a Need or Want', () => {
    expect(name({ state: 'need', tokenCount: 62, countHidden: true })).toBe('Caster One, Wings of Resolve, Need');
    expect(name({ state: 'want', tokenCount: null })).toBe('Caster One, Wings of Resolve, Want');
    expect(name({ state: 'have', tokenCount: 62 })).toBe('Caster One, Wings of Resolve, Have');
    expect(name({ state: 'pass', tokenCount: 62 })).toBe('Caster One, Wings of Resolve, Pass');
    expect(name({ state: 'want', tokenCount: 30 }, wings, { currentUserId: 'u-v', userRole: 'viewer' })).toBe(
      'Caster One, Wings of Resolve, Want',
    );
  });

  it('drops the cost or the token name when the goal has none', () => {
    expect(name({ state: 'want', tokenCount: 30 }, { ...wings, tokenCost: null })).toBe(
      'Caster One, Wings of Resolve, Want, 30 totems',
    );
    expect(name({ state: 'need', tokenCount: 62 }, { ...wings, tokenName: null })).toBe(
      'Caster One, Wings of Resolve, Need, 62 of 99',
    );
  });
});
