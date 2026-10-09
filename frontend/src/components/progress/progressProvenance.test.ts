/**
 * cellProvenance (S2a-2·F4 Task TF6, R-S2-9): every row of the label table, the
 * record-vs-row side, the relative time, the second count line and the hidden count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParticipantRecordView, RecordOnlyCell } from '../../stores/collectionGoalStore';
import { cellFor, type ProgressCell, type ProgressColumn } from '../../utils/progressModel';
import { row } from './__fixtures__/progressFixtures';
import { cellProvenance } from './progressProvenance';

const NOW = new Date('2026-10-09T12:00:00Z');
const DAYS_AGO_2 = '2026-10-07T12:00:00Z';
const DAYS_AGO_1 = '2026-10-08T12:00:00Z';

const COLUMN = { kind: 'claimed', key: 'p1', name: 'Aya', userId: 'member', player: {} } as unknown as ProgressColumn;
const NAMES: Record<string, string> = { lead: 'Lead One', member: 'Aya', viewer: 'Vi' };
const ctx = (viewerUserId: string | null = 'viewer') => ({ viewerUserId, nameOf: (id: string) => NAMES[id] ?? null });

function record(overrides: Partial<ParticipantRecordView> = {}): ParticipantRecordView {
  return {
    characterId: 'c1', ownershipState: 'owned', tokenCount: null, source: 'manual', updatedByUserId: null,
    updatedVia: null, stateChangedAt: null, tokenCountUpdatedAt: null, lastSyncedAt: null, ...overrides,
  };
}

function cell(overrides: Parameters<typeof row>[2] = {}, role: 'member' | 'viewer' = 'member'): ProgressCell {
  return cellFor(COLUMN, { participants: [row('g', 'member', overrides)] }, { currentUserId: 'viewer', userRole: role });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('cellProvenance: the label table (R-S2-9)', () => {
  it('reads "plugin, {time}" for an api_key write, ahead of every other rule', () => {
    // The writer is also the member and the viewer here; the channel still wins.
    const c = cell({ updatedVia: 'api_key', updatedByUserId: 'member', stateChangedAt: DAYS_AGO_2 });
    expect(cellProvenance(c, ctx('member'))).toEqual({ state: 'plugin, 2d ago', count: null });
  });

  it('reads "you" when the writer is the viewer', () => {
    const c = cell({ updatedByUserId: 'viewer', updatedVia: 'web' });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe('you');
  });

  it('reads "self-reported" when the writer is the member', () => {
    const c = cell({ updatedByUserId: 'member', updatedVia: 'web' });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe('self-reported');
  });

  it('reads "set by {name}" for a correction by someone else', () => {
    const c = cell({ updatedByUserId: 'lead', updatedVia: 'web' });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe('set by Lead One');
  });

  it('names a writer it cannot resolve without inventing a name', () => {
    const c = cell({ updatedByUserId: 'gone', updatedVia: 'web' });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe('set by another member');
  });

  it('reads "added when tracked" with a channel and no writer (Track\'s seed)', () => {
    const c = cell({ updatedByUserId: null, updatedVia: 'web' });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe('added when tracked');
  });

  it.each([
    ['plugin', 'plugin'],
    ['player_hub', 'from the Hub'],
    ['manual', 'recorded earlier'],
  ] as const)('falls back to the source "%s" when writer and channel are both NULL', (source, label) => {
    const c = cell({ source, updatedByUserId: null, updatedVia: null });
    expect(cellProvenance(c, ctx('viewer'))?.state).toBe(label);
  });

  it('has nothing to say about a blank cell or an unclaimed column', () => {
    const blank = cellFor(COLUMN, { participants: [] }, { currentUserId: 'viewer', userRole: 'member' });
    expect(cellProvenance(blank, ctx())).toBeNull();
    const unclaimed = cellFor(
      { kind: 'unclaimed', key: 'p9', name: 'Cy', userId: null, player: {} } as unknown as ProgressColumn,
      { participants: [] },
      { currentUserId: 'viewer', userRole: 'member' },
    );
    expect(cellProvenance(unclaimed, ctx())).toBeNull();
  });
});

describe('cellProvenance: the side and the time', () => {
  it('reads the record side when the state came from the record', () => {
    const c = cell({
      stateFromRecord: true,
      updatedByUserId: 'lead',
      updatedVia: 'web',
      record: record({ updatedVia: 'api_key', stateChangedAt: DAYS_AGO_2 }),
    });
    // The row was set by a lead, but the displayed state is the record's.
    expect(cellProvenance(c, ctx())?.state).toBe('plugin, 2d ago');
  });

  it('reads the row side when the state did not come from the record', () => {
    const c = cell({
      stateFromRecord: false,
      updatedByUserId: 'lead',
      updatedVia: 'web',
      record: record({ updatedVia: 'api_key', stateChangedAt: DAYS_AGO_2 }),
    });
    expect(cellProvenance(c, ctx())?.state).toBe('set by Lead One');
  });

  it('times a plugin label by state_changed_at, never updated_at or token_count_updated_at', () => {
    const c = cell({
      updatedVia: 'api_key',
      stateChangedAt: DAYS_AGO_2,
      tokenCountUpdatedAt: DAYS_AGO_1,
      updatedAt: '2026-10-09T11:59:00Z',
    });
    expect(cellProvenance(c, ctx())?.state).toBe('plugin, 2d ago');
  });

  it('falls back to the record\'s last_synced_at when its state_changed_at is NULL', () => {
    const c = cell({
      stateFromRecord: true,
      record: record({ updatedVia: 'api_key', stateChangedAt: null, lastSyncedAt: DAYS_AGO_1 }),
    });
    expect(cellProvenance(c, ctx())?.state).toBe('plugin, 1d ago');
  });

  it('drops the time, keeping the label, when the side has none', () => {
    const c = cell({ updatedVia: 'api_key', stateChangedAt: null });
    expect(cellProvenance(c, ctx())?.state).toBe('plugin');
  });

  it('reads a record-only Have from its record', () => {
    const recordOnly: RecordOnlyCell = {
      userId: 'member', displayName: 'Aya', memberRole: 'member', state: 'have', tokenCount: null,
      countHidden: false, record: record({ updatedVia: 'api_key', stateChangedAt: DAYS_AGO_2 }),
    };
    const c = cellFor(COLUMN, { recordOnly: [recordOnly] }, { currentUserId: 'viewer', userRole: 'member' });
    expect(cellProvenance(c, ctx())).toEqual({ state: 'plugin, 2d ago', count: null });
  });

  it('under View As, "you" is the viewed user', () => {
    const c = cell({ updatedByUserId: 'lead', updatedVia: 'web' });
    expect(cellProvenance(c, ctx('lead'))?.state).toBe('you');
  });
});

describe('cellProvenance: the count line', () => {
  const split = {
    state: 'need' as const,
    tokenCount: 62,
    stateFromRecord: false,
    countFromRecord: true,
    updatedByUserId: 'member',
    updatedVia: 'web',
    record: record({ updatedVia: 'api_key', tokenCountUpdatedAt: DAYS_AGO_1, tokenCount: 62 }),
  };

  it('adds a second line for the count\'s side only when the sides differ', () => {
    expect(cellProvenance(cell(split), ctx())).toEqual({ state: 'self-reported', count: 'plugin, 1d ago' });
    // Same side: one line.
    expect(cellProvenance(cell({ ...split, countFromRecord: false }), ctx())?.count).toBeNull();
    expect(
      cellProvenance(cell({ ...split, stateFromRecord: true, countFromRecord: true }), ctx())?.count,
    ).toBeNull();
  });

  it('times the count line by token_count_updated_at', () => {
    const c = cell({ ...split, record: record({ updatedVia: 'api_key', stateChangedAt: DAYS_AGO_2, tokenCountUpdatedAt: DAYS_AGO_1 }) });
    expect(cellProvenance(c, ctx())?.count).toBe('plugin, 1d ago');
  });

  it('has no count line where the text shows no count (Have, Pass)', () => {
    expect(cellProvenance(cell({ ...split, state: 'have' }), ctx())?.count).toBeNull();
    expect(cellProvenance(cell({ ...split, state: 'pass' }), ctx())?.count).toBeNull();
  });

  it('has no count line and no count time for a hidden count', () => {
    const hidden = cell({ ...split, countHidden: true });
    expect(cellProvenance(hidden, ctx())).toEqual({ state: 'self-reported', count: null });
    // A viewer's reads hide every count the same way.
    const viewerRead = cell(split, 'viewer');
    expect(cellProvenance(viewerRead, ctx())).toEqual({ state: 'self-reported', count: null });
  });
});
