// D7 (R-16) — resolveResetActions is the one place a ResetConfig's blast
// radius is computed. Pins the frozen legacy semantics (SectionedLogView.tsx
// :450-538 — reference, not a dependency) as a pure, unit-provable planner:
// every scope × target combination, book-op precedence (playerId beats floor
// beats week beats all), and the fail-closed/no-fallthrough hardening.
import { describe, expect, it } from 'vitest';

import { resolveResetActions, describeResetToast } from './resetActions';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];
const loot = (id: number, weekNumber: number, floor: string): LootLogEntry =>
  ({ id, weekNumber, floor } as LootLogEntry);
const mat = (id: number, weekNumber: number, floor: string): MaterialLogEntry =>
  ({ id, weekNumber, floor } as MaterialLogEntry);
const LOOT = [loot(1, 1, 'M9S'), loot(2, 1, 'M10S'), loot(3, 3, 'M9S'), loot(4, 3, 'M12S')];
const MATS = [mat(11, 1, 'M10S'), mat(12, 3, 'M10S'), mat(13, 3, 'M9S')];
const INPUT = { lootLog: LOOT, materialLog: MATS, floors: FLOORS };

describe('resolveResetActions (D7 R-16)', () => {
  // scope matrix — loot/material halves
  it('week+loot selects exactly that week, all floors', () => {
    const p = resolveResetActions({ scope: 'week', target: 'loot', week: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([1, 2]);
    expect(p.materialEntries.map((e) => e.id)).toEqual([11]);
    expect(p.bookOp).toEqual({ kind: 'none' });
  });

  it('floor+week+loot selects exactly that floor AND that week', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', week: 3, floor: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([3]); // NOT 1 (week 1), NOT 4 (M12S)
    expect(p.materialEntries.map((e) => e.id)).toEqual([13]);
  });

  it('all+loot selects everything, books untouched', () => {
    const p = resolveResetActions({ scope: 'all', target: 'loot' }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(p.materialEntries.map((e) => e.id)).toEqual([11, 12, 13]);
    expect(p.bookOp).toEqual({ kind: 'none' });
  });

  it('floor WITHOUT week filters by floor across all weeks — never falls through to everything (legacy-hardening)', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', floor: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([1, 3]);
  });

  it('an out-of-range floor selects nothing (fails closed)', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'loot', week: 3, floor: 9 }, INPUT);
    expect(p.lootEntries).toEqual([]);
    expect(p.materialEntries).toEqual([]);
  });

  // books op routing — legacy precedence: playerId FIRST, then floor, then week, then all
  it('books week → {kind:week}', () => {
    const p = resolveResetActions({ scope: 'week', target: 'books', week: 3 }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'week', week: 3 });
    expect(p.lootEntries).toEqual([]);
    expect(p.materialEntries).toEqual([]);
  });

  it('books all → {kind:all}', () => {
    const p = resolveResetActions({ scope: 'all', target: 'books' }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'all' });
    expect(p.lootEntries).toEqual([]);
    expect(p.materialEntries).toEqual([]);
  });

  it('books floor+week → {kind:floor-week}', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'books', week: 3, floor: 2 }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'floor-week', floor: 2, week: 3 });
  });

  it('books floor all-time → {kind:floor-all}', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'books', floor: 2 }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'floor-all', floor: 2 });
  });

  it('books player+week → {kind:player-week} — playerId wins over scope (precedence trace target)', () => {
    const p = resolveResetActions(
      { scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Tank One' }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'player-week', playerId: 'p1', week: 3 });
  });

  it('books player all-time → {kind:player-all}', () => {
    const p = resolveResetActions(
      { scope: 'all', target: 'books', playerId: 'p1', playerName: 'Tank One' }, INPUT);
    expect(p.bookOp).toEqual({ kind: 'player-all', playerId: 'p1' });
  });

  it('data+floor+week scopes BOTH halves to the floor+week', () => {
    const p = resolveResetActions({ scope: 'floor', target: 'data', week: 3, floor: 1 }, INPUT);
    expect(p.lootEntries.map((e) => e.id)).toEqual([3]);
    expect(p.materialEntries.map((e) => e.id)).toEqual([13]);
    expect(p.bookOp).toEqual({ kind: 'floor-week', floor: 1, week: 3 });
  });
});

describe('describeResetToast (D7 R-16)', () => {
  it('keeps the two shipped shapes verbatim and names the new scopes', () => {
    expect(describeResetToast({ scope: 'week', target: 'loot', week: 3 })).toBe('Reset Week 3 loot complete');
    expect(describeResetToast({ scope: 'all', target: 'books' })).toBe('Reset all books complete');
    expect(describeResetToast({ scope: 'floor', target: 'books', week: 3, floor: 2 })).toBe('Reset Floor 2 books for Week 3 complete');
    expect(describeResetToast({ scope: 'floor', target: 'books', floor: 2 })).toBe('Reset Floor 2 books complete');
    expect(describeResetToast({ scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Tank One' })).toBe("Reset Tank One's Week 3 books complete");
    expect(describeResetToast({ scope: 'all', target: 'books', playerId: 'p1', playerName: 'Tank One' })).toBe("Reset Tank One's books complete");
  });
});
