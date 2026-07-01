import { describe, it, expect } from 'vitest';
import { enhancePriorityEntries } from './priorityEntries';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer, LootLogEntry } from '../types';
import type { PriorityEntry } from './priority';

function makePlayer(id: string, name: string): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}
function makeDrop(playerId: string, weekNumber: number): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber, floor: 'M9S', itemSlot: 'earring',
    recipientPlayerId: playerId, recipientPlayerName: 'x', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as LootLogEntry;
}
const settings = { ...DEFAULT_SETTINGS };

describe('enhancePriorityEntries', () => {
  const alice = makePlayer('a', 'Alice');
  const bob = makePlayer('b', 'Bob');
  const entries: PriorityEntry[] = [
    { player: alice, score: 100 },
    { player: bob, score: 100 },
  ];

  it('attaches breakdown and preserves order when inactive', () => {
    const out = enhancePriorityEntries(entries, {
      settings, lootLog: [], currentWeek: 3, averageDrops: 0, active: false,
    });
    expect(out.map((e) => e.player.id)).toEqual(['a', 'b']);
    expect(out[0].breakdown).toBeDefined();
    expect(out[0].enhancedScore).toBeUndefined();
  });

  it('re-sorts by enhanced score when active (drought bonus lifts the dry player)', () => {
    // Alice got a drop in week 3 (current); Bob never did → Bob gets drought bonus.
    const lootLog = [makeDrop('a', 3)];
    const out = enhancePriorityEntries(entries, {
      settings, lootLog, currentWeek: 3, averageDrops: 0.5, active: true,
    });
    expect(out[0].player.id).toBe('b');
    expect(out[0].enhancedScore).toBeGreaterThan(out[1].enhancedScore!);
    expect(out[0].droughtBonus).toBeGreaterThan(0);
  });

  it('breaks enhanced-score ties alphabetically', () => {
    const out = enhancePriorityEntries(entries, {
      settings, lootLog: [], currentWeek: 1, averageDrops: 0, active: true,
    });
    expect(out.map((e) => e.player.name)).toEqual(['Alice', 'Bob']);
  });
});
