import { describe, it, expect } from 'vitest';
import {
  buildHistoryItems,
  sortHistoryItems,
  slotNameOf,
  methodLabelOf,
  nextHistorySort,
  HISTORY_SORT_FIELDS,
  DEFAULT_HISTORY_SORT,
  type HistorySortState,
  type HistorySortField,
  type HistorySortDirection,
  type HistorySortContext,
} from './historyItems';
import type { HistoryItem } from '../components/loot/logWeekGridData';
import type { LootLogEntry, LootMethod, MaterialLogEntry } from '../types';

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    createdAt: '2026-06-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

// Sort-fixture helpers (brief's sketch): loot(id, week, createdAt, extra?) / mat(id, week, createdAt, materialType?)
function loot(
  id: number,
  week: number,
  createdAt: string,
  extra: Partial<LootLogEntry> = {},
): HistoryItem {
  return { kind: 'loot', entry: makeLootEntry({ id, weekNumber: week, createdAt, ...extra }) };
}

function mat(
  id: number,
  week: number,
  createdAt: string,
  materialType: MaterialLogEntry['materialType'] = 'twine',
): HistoryItem {
  return { kind: 'material', entry: makeMaterialEntry({ id, weekNumber: week, createdAt, materialType }) };
}

const NAMES: Record<string, string> = { p1: 'Zeta', p2: 'Amy' };
const ctx: HistorySortContext = {
  floors: ['M9S', 'M10S', 'M11S', 'M12S'],
  playerNameOf: (i) => NAMES[i.entry.recipientPlayerId] ?? i.entry.recipientPlayerName,
};

describe('buildHistoryItems', () => {
  it("merges loot then material in INPUT order (ordering is sortHistoryItems's job)", () => {
    const loot1 = makeLootEntry({ id: 1, weekNumber: 3 });
    const loot2 = makeLootEntry({ id: 2, weekNumber: 1 });
    const mat1 = makeMaterialEntry({ id: 3, weekNumber: 2 });
    const mat2 = makeMaterialEntry({ id: 4, weekNumber: 5 });
    const items = buildHistoryItems([loot1, loot2], [mat1, mat2]);
    expect(items).toEqual([
      { kind: 'loot', entry: loot1 },
      { kind: 'loot', entry: loot2 },
      { kind: 'material', entry: mat1 },
      { kind: 'material', entry: mat2 },
    ]);
  });
});

describe('slotNameOf / methodLabelOf', () => {
  it('ring → "Ring", body → "Body", unknown → raw; materials → display name', () => {
    expect(slotNameOf(loot(1, 1, '2026-06-01T00:00:00Z', { itemSlot: 'ring' }))).toBe('Ring');
    expect(slotNameOf(loot(2, 1, '2026-06-01T00:00:00Z', { itemSlot: 'body' }))).toBe('Body');
    expect(slotNameOf(loot(3, 1, '2026-06-01T00:00:00Z', { itemSlot: 'unknownslot' }))).toBe('unknownslot');
    expect(slotNameOf(mat(4, 1, '2026-06-01T00:00:00Z', 'solvent'))).toBe('Solvent');
  });

  it('drop → "Drop", tome → "Tome", unknown "xyz" → "xyz"', () => {
    expect(methodLabelOf(loot(1, 1, '2026-06-01T00:00:00Z', { method: 'drop' }))).toBe('Drop');
    expect(methodLabelOf(loot(2, 1, '2026-06-01T00:00:00Z', { method: 'tome' }))).toBe('Tome');
    expect(
      methodLabelOf(loot(3, 1, '2026-06-01T00:00:00Z', { method: 'xyz' as unknown as LootMethod })),
    ).toBe('xyz');
  });
});

describe('sortHistoryItems', () => {
  it('week desc (the default) puts the newest week first', () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z'),
      loot(2, 3, '2026-06-15T00:00:00Z'),
      loot(3, 2, '2026-06-08T00:00:00Z'),
    ];
    const sorted = sortHistoryItems(items, DEFAULT_HISTORY_SORT, ctx);
    expect(sorted.map((i) => i.entry.weekNumber)).toEqual([3, 2, 1]);
  });

  it('createdAt desc within a week', () => {
    const items = [
      loot(1, 2, '2026-06-08T00:00:00Z'),
      loot(2, 2, '2026-06-09T12:00:00Z'),
      loot(3, 2, '2026-06-08T18:00:00Z'),
    ];
    const sorted = sortHistoryItems(items, DEFAULT_HISTORY_SORT, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([2, 3, 1]);
  });

  it('merges loot and material within a week by createdAt desc', () => {
    const items = [
      loot(1, 1, '2026-06-01T10:00:00Z'),
      mat(2, 1, '2026-06-01T12:00:00Z'),
    ];
    const sorted = sortHistoryItems(items, DEFAULT_HISTORY_SORT, ctx);
    expect(sorted[0]).toEqual(mat(2, 1, '2026-06-01T12:00:00Z'));
    expect(sorted[1]).toEqual(loot(1, 1, '2026-06-01T10:00:00Z'));
  });

  it('week asc reverses the weeks but keeps ties newest-first (R-D9a-B)', () => {
    const items = [
      loot(1, 2, '2026-06-08T00:00:00Z'),
      loot(2, 1, '2026-06-01T00:00:00Z'),
      loot(3, 1, '2026-06-03T00:00:00Z'),
    ];
    const asc = sortHistoryItems(items, { field: 'week', direction: 'asc' }, ctx);
    expect(asc.map((i) => i.entry.id)).toEqual([3, 2, 1]); // week1 first (asc); W1 tie still id3(06-03) before id2(06-01)
    const desc = sortHistoryItems(items, { field: 'week', direction: 'desc' }, ctx);
    expect(desc.map((i) => i.entry.id)).toEqual([1, 3, 2]); // week2 first (desc); W1 tie UNCHANGED — id3 before id2
  });

  it('player asc/desc by resolved name with localeCompare; fallback to recipientPlayerName', () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z', { recipientPlayerId: 'p1', recipientPlayerName: 'Aria' }), // → 'Zeta'
      loot(2, 1, '2026-06-02T00:00:00Z', { recipientPlayerId: 'p2', recipientPlayerName: 'Bella' }), // → 'Amy'
      loot(3, 1, '2026-06-03T00:00:00Z', { recipientPlayerId: 'p3', recipientPlayerName: 'Mallory' }), // no roster name → fallback
    ];
    const asc = sortHistoryItems(items, { field: 'player', direction: 'asc' }, ctx);
    expect(asc.map((i) => i.entry.id)).toEqual([2, 3, 1]); // Amy, Mallory, Zeta
    const desc = sortHistoryItems(items, { field: 'player', direction: 'desc' }, ctx);
    expect(desc.map((i) => i.entry.id)).toEqual([1, 3, 2]);
  });

  it("player asc keeps one player's rows newest-first — tiebreak never flips", () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z', { recipientPlayerId: 'p1' }),
      loot(2, 1, '2026-06-03T00:00:00Z', { recipientPlayerId: 'p1' }),
      loot(3, 1, '2026-06-02T00:00:00Z', { recipientPlayerId: 'p1' }),
    ];
    const sorted = sortHistoryItems(items, { field: 'player', direction: 'asc' }, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([2, 3, 1]);
  });

  it('floor sorts by tier index, unknown/empty floor last', () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z', { floor: 'M12S' }),
      loot(2, 1, '2026-06-02T00:00:00Z', { floor: 'M9S' }),
      loot(3, 1, '2026-06-03T00:00:00Z', { floor: 'XYZ' }),
      loot(4, 1, '2026-06-04T00:00:00Z', { floor: '' }),
    ];
    const sorted = sortHistoryItems(items, { field: 'floor', direction: 'asc' }, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([2, 1, 4, 3]);
  });

  it('slot sorts by displayed name — ring → "Ring", weapon → "Weapon", material → display name', () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z', { itemSlot: 'weapon' }),
      loot(2, 1, '2026-06-02T00:00:00Z', { itemSlot: 'ring' }),
      mat(3, 1, '2026-06-03T00:00:00Z', 'glaze'),
    ];
    const sorted = sortHistoryItems(items, { field: 'slot', direction: 'asc' }, ctx);
    expect(sorted.map((i) => slotNameOf(i))).toEqual(['Glaze', 'Ring', 'Weapon']);
  });

  it('method sorts by the displayed label (Book < Drop < Purchase < Tome)', () => {
    const items = [
      loot(1, 1, '2026-06-01T00:00:00Z', { method: 'tome' }),
      loot(2, 1, '2026-06-02T00:00:00Z', { method: 'drop' }),
      loot(3, 1, '2026-06-03T00:00:00Z', { method: 'book' }),
      loot(4, 1, '2026-06-04T00:00:00Z', { method: 'purchase' }),
    ];
    const sorted = sortHistoryItems(items, { field: 'method', direction: 'asc' }, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([3, 2, 4, 1]);
  });

  it('type ranks loot-BiS < loot-Extra < material', () => {
    const items = [
      mat(1, 1, '2026-06-01T00:00:00Z'),
      loot(2, 1, '2026-06-02T00:00:00Z', { isExtra: true }),
      loot(3, 1, '2026-06-03T00:00:00Z', { isExtra: false }),
    ];
    const sorted = sortHistoryItems(items, { field: 'type', direction: 'asc' }, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([3, 2, 1]);
  });

  it('date sorts on createdAt across weeks', () => {
    const items = [
      loot(1, 5, '2026-06-10T00:00:00Z'),
      loot(2, 1, '2026-06-20T00:00:00Z'),
      loot(3, 3, '2026-06-01T00:00:00Z'),
    ];
    const sorted = sortHistoryItems(items, { field: 'date', direction: 'desc' }, ctx);
    expect(sorted.map((i) => i.entry.id)).toEqual([2, 1, 3]);
  });

  it('identical createdAt: loot before material, then higher id first', () => {
    const createdAt = '2026-06-01T00:00:00Z';
    const items = [mat(7, 1, createdAt), loot(3, 1, createdAt), loot(9, 1, createdAt)];
    const sorted = sortHistoryItems(items, DEFAULT_HISTORY_SORT, ctx);
    expect(sorted.map((i) => `${i.kind}${i.entry.id}`)).toEqual(['loot9', 'loot3', 'material7']);
  });

  it('does not mutate its input', () => {
    const items = [loot(1, 1, '2026-06-01T00:00:00Z'), loot(2, 2, '2026-06-02T00:00:00Z')];
    const before = [...items];
    const sorted = sortHistoryItems(items, DEFAULT_HISTORY_SORT, ctx);
    expect(items).toEqual(before);
    expect(sorted).not.toBe(items);
  });
});

describe('nextHistorySort', () => {
  it('flips the active field', () => {
    expect(nextHistorySort('week', { field: 'week', direction: 'desc' })).toEqual({
      field: 'week',
      direction: 'asc',
    });
    expect(nextHistorySort('player', { field: 'player', direction: 'asc' })).toEqual({
      field: 'player',
      direction: 'desc',
    });
  });

  it('week and date start desc; floor/slot/player/method/type start asc', () => {
    const NATURAL: Record<HistorySortField, HistorySortDirection> = {
      week: 'desc',
      date: 'desc',
      floor: 'asc',
      slot: 'asc',
      player: 'asc',
      method: 'asc',
      type: 'asc',
    };
    HISTORY_SORT_FIELDS.forEach((field, i) => {
      const otherField = HISTORY_SORT_FIELDS[(i + 1) % HISTORY_SORT_FIELDS.length];
      const current: HistorySortState = { field: otherField, direction: 'asc' };
      expect(nextHistorySort(field, current)).toEqual({ field, direction: NATURAL[field] });
    });
  });
});
