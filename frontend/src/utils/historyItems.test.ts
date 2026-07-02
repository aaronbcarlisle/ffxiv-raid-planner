import { describe, it, expect } from 'vitest';
import {
  buildHistoryItems,
  filterHistoryItems,
  historyWeeks,
  DEFAULT_HISTORY_FILTERS,
  type HistoryFilterState,
} from './historyItems';
import type { LootLogEntry, MaterialLogEntry } from '../types';

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

describe('buildHistoryItems', () => {
  it('merges loot + material entries', () => {
    const loot = [makeLootEntry({ id: 1 })];
    const material = [makeMaterialEntry({ id: 2 })];
    const items = buildHistoryItems(loot, material);
    expect(items).toHaveLength(2);
    expect(items.some((i) => i.kind === 'loot' && i.entry.id === 1)).toBe(true);
    expect(items.some((i) => i.kind === 'material' && i.entry.id === 2)).toBe(true);
  });

  it('sorts weeks desc', () => {
    const loot = [
      makeLootEntry({ id: 1, weekNumber: 1, createdAt: '2026-06-01T00:00:00Z' }),
      makeLootEntry({ id: 2, weekNumber: 3, createdAt: '2026-06-15T00:00:00Z' }),
      makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-08T00:00:00Z' }),
    ];
    const items = buildHistoryItems(loot, []);
    expect(items.map((i) => i.entry.weekNumber)).toEqual([3, 2, 1]);
  });

  it('sorts createdAt desc within a week', () => {
    const loot = [
      makeLootEntry({ id: 1, weekNumber: 2, createdAt: '2026-06-08T00:00:00Z' }),
      makeLootEntry({ id: 2, weekNumber: 2, createdAt: '2026-06-09T12:00:00Z' }),
      makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-08T18:00:00Z' }),
    ];
    const items = buildHistoryItems(loot, []);
    expect(items.map((i) => i.entry.id)).toEqual([2, 3, 1]);
  });

  it('merges loot and material within the same week by createdAt desc', () => {
    const loot = [makeLootEntry({ id: 1, weekNumber: 1, createdAt: '2026-06-01T10:00:00Z' })];
    const material = [makeMaterialEntry({ id: 2, weekNumber: 1, createdAt: '2026-06-01T12:00:00Z' })];
    const items = buildHistoryItems(loot, material);
    expect(items[0]).toEqual({ kind: 'material', entry: material[0] });
    expect(items[1]).toEqual({ kind: 'loot', entry: loot[0] });
  });
});

describe('filterHistoryItems', () => {
  const raidDrop = makeLootEntry({ id: 1, method: 'drop', weekNumber: 1, recipientPlayerId: 'p1' });
  const tomeDrop = makeLootEntry({ id: 2, method: 'tome', weekNumber: 1, recipientPlayerId: 'p2' });
  const purchaseDrop = makeLootEntry({ id: 3, method: 'purchase', weekNumber: 2, recipientPlayerId: 'p1' });
  const bookDrop = makeLootEntry({ id: 4, method: 'book', weekNumber: 2, recipientPlayerId: 'p2' });
  const material = makeMaterialEntry({ id: 5, weekNumber: 2, recipientPlayerId: 'p1' });

  const items = buildHistoryItems([raidDrop, tomeDrop, purchaseDrop, bookDrop], [material]);

  it('DEFAULT_HISTORY_FILTERS passes everything through', () => {
    expect(filterHistoryItems(items, DEFAULT_HISTORY_FILTERS)).toHaveLength(items.length);
  });

  it('source=raid picks only method=drop loot', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, source: 'raid' });
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(1);
  });

  it('source=tome picks method=tome and method=purchase loot', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, source: 'tome' });
    expect(result.map((i) => i.entry.id).sort()).toEqual([2, 3]);
  });

  it('source=book picks only method=book loot', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, source: 'book' });
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(4);
  });

  it('source=material picks only material items', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, source: 'material' });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('material');
  });

  it('week filter narrows to the matching weekNumber', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, week: 2 });
    expect(result.map((i) => i.entry.id).sort()).toEqual([3, 4, 5]);
  });

  it('player filter narrows to the matching recipientPlayerId', () => {
    const result = filterHistoryItems(items, { ...DEFAULT_HISTORY_FILTERS, playerId: 'p2' });
    expect(result.map((i) => i.entry.id).sort()).toEqual([2, 4]);
  });

  it('week + player + source compose (AND)', () => {
    const filters: HistoryFilterState = { week: 2, playerId: 'p1', source: 'tome' };
    const result = filterHistoryItems(items, filters);
    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe(3);
  });

  it('returns an empty array when nothing matches', () => {
    const filters: HistoryFilterState = { week: 1, playerId: 'p1', source: 'material' };
    expect(filterHistoryItems(items, filters)).toEqual([]);
  });
});

describe('historyWeeks', () => {
  it('returns distinct weeks desc', () => {
    const loot = [
      makeLootEntry({ id: 1, weekNumber: 1 }),
      makeLootEntry({ id: 2, weekNumber: 3 }),
      makeLootEntry({ id: 3, weekNumber: 2 }),
      makeLootEntry({ id: 4, weekNumber: 3 }),
    ];
    const items = buildHistoryItems(loot, []);
    expect(historyWeeks(items)).toEqual([3, 2, 1]);
  });

  it('returns an empty array for an empty log', () => {
    expect(historyWeeks([])).toEqual([]);
  });
});
