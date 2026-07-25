import { describe, it, expect } from 'vitest';
import { computeWeeklyLootSummary } from './useWeeklyLootSummary';
import type { LootLogEntry, PageLedgerEntry } from '../types';

const floors = ['M9S', 'M10S', 'M11S', 'M12S'];
const loot = [
  { floor: 'M9S', weekNumber: 3 }, { floor: 'M9S', weekNumber: 3 },
  { floor: 'M12S', weekNumber: 3 }, { floor: 'M9S', weekNumber: 2 /* other week */ },
] as unknown as LootLogEntry[];
const ledger = [
  { floor: 'M9S', weekNumber: 3, transactionType: 'earned' },
  { floor: 'M10S', weekNumber: 3, transactionType: 'earned' },
] as unknown as PageLedgerEntry[];

describe('computeWeeklyLootSummary', () => {
  it('marks cleared from earned ledger entries and counts drops this week', () => {
    const out = computeWeeklyLootSummary(floors, loot, ledger, 3);
    expect(out).toEqual([
      { fight: 'M9S', cleared: true, dropCount: 2 },
      { fight: 'M10S', cleared: true, dropCount: 0 },
      { fight: 'M11S', cleared: false, dropCount: 0 },
      { fight: 'M12S', cleared: false, dropCount: 1 },
    ]);
  });

  it('excludes loot and ledger entries from other weeks', () => {
    const out = computeWeeklyLootSummary(floors, loot, ledger, 2);
    expect(out).toEqual([
      { fight: 'M9S', cleared: false, dropCount: 1 },
      { fight: 'M10S', cleared: false, dropCount: 0 },
      { fight: 'M11S', cleared: false, dropCount: 0 },
      { fight: 'M12S', cleared: false, dropCount: 0 },
    ]);
  });

  it('only treats earned ledger entries as cleared (not spent/missed/adjustment)', () => {
    const mixed = [
      { floor: 'M9S', weekNumber: 3, transactionType: 'spent' },
      { floor: 'M10S', weekNumber: 3, transactionType: 'missed' },
      { floor: 'M11S', weekNumber: 3, transactionType: 'earned' },
    ] as unknown as PageLedgerEntry[];
    const out = computeWeeklyLootSummary(floors, [], mixed, 3);
    expect(out.map((f) => f.cleared)).toEqual([false, false, true, false]);
  });

  it('returns an empty array when there are no floors', () => {
    expect(computeWeeklyLootSummary([], loot, ledger, 3)).toEqual([]);
  });
});
