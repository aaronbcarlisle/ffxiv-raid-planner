// R-10 (Phase D) — "Queues opens at the newest in-progress floor".
// Pins the concrete rule: one past the highest floor with any recorded
// activity (loot, material, or earned book), capped at 4; fresh tier → 1.
import { describe, it, expect } from 'vitest';

import { newestInProgressFloor } from './priorityScope';
import type { LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../../types';

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

const loot = (floor: string): LootLogEntry =>
  ({ id: 1, weekNumber: 1, floor, itemSlot: 'body' }) as unknown as LootLogEntry;
const material = (floor: string): MaterialLogEntry =>
  ({ id: 1, weekNumber: 1, floor, materialType: 'twine' }) as unknown as MaterialLogEntry;
const earnedBook = (bookType: string): PageLedgerEntry =>
  ({ id: 1, weekNumber: 1, transactionType: 'earned', bookType }) as unknown as PageLedgerEntry;
const spentBook = (bookType: string): PageLedgerEntry =>
  ({ id: 1, weekNumber: 1, transactionType: 'spent', bookType }) as unknown as PageLedgerEntry;

function derive(over: Partial<Parameters<typeof newestInProgressFloor>[0]> = {}) {
  return newestInProgressFloor({ lootLog: [], materialLog: [], pageLedger: [], floors: FLOORS, ...over });
}

describe('newestInProgressFloor (R-10)', () => {
  it('opens a fresh tier on Floor 1', () => {
    expect(derive()).toBe(1);
  });

  it('is one past the highest floor with loot evidence', () => {
    expect(derive({ lootLog: [loot('M9S'), loot('M10S')] })).toBe(3);
  });

  it('caps at Floor 4 — a farm static stays on the floor it acts on', () => {
    expect(derive({ lootLog: [loot('M12S')] })).toBe(4);
  });

  it('counts material entries as evidence', () => {
    expect(derive({ materialLog: [material('M9S')] })).toBe(2);
  });

  it('counts earned books as evidence (a clear with no drop taken)', () => {
    // Floor 2's book is II (FLOOR_LOOT_TABLES).
    expect(derive({ pageLedger: [earnedBook('II')] })).toBe(3);
  });

  it('ignores spent-book ledger rows — spending proves nothing about progression', () => {
    expect(derive({ pageLedger: [spentBook('IV')] })).toBe(1);
  });

  it('uses the highest evidenced floor, not the count of evidenced floors', () => {
    // Evidence on F3 alone (skipped-floor data) → prog target is F4.
    expect(derive({ lootLog: [loot('M11S')] })).toBe(4);
  });

  it('falls back to Floor 1 when the floors list is empty (no tier gamedata)', () => {
    expect(derive({ floors: [], lootLog: [loot('M9S')] })).toBe(1);
  });
});
