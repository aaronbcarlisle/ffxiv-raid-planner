import { describe, it, expect } from 'vitest';
import { computeNextUpgradePriorities } from './nextUpgradePriority';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer, LootLogEntry, GearSlot } from '../types';

/**
 * Build a SnapshotPlayer with a `gear` array. Each gear entry is
 * `{ slot, bisSource, hasItem }` — the only fields the priority need-predicates
 * (`getPriorityForItem`/`getPriorityForRing`) actually read.
 */
function makePlayer(
  id: string,
  name: string,
  role: string,
  gear: Array<{ slot: GearSlot; bisSource?: 'raid' | 'tome'; hasItem?: boolean }>,
): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role,
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: gear.map((g) => ({
      slot: g.slot,
      bisSource: g.bisSource ?? 'raid',
      hasItem: g.hasItem ?? false,
      isAugmented: false,
    })),
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

function makeDrop(playerId: string, weekNumber: number): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber, floor: 'M11S', itemSlot: 'body',
    recipientPlayerId: playerId, recipientPlayerName: 'x', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as LootLogEntry;
}

describe('computeNextUpgradePriorities', () => {
  it('marks the #1 needer per gear slot', () => {
    // Two players need 'body' (floor 3). Melee (score 125+) beats Healer (25+),
    // so the melee player owns the 'body' mark and the healer owns nothing.
    const melee = makePlayer('a', 'Alice', 'melee', [{ slot: 'body' }]);
    const healer = makePlayer('b', 'Bob', 'healer', [{ slot: 'body' }]);
    const map = computeNextUpgradePriorities({
      players: [melee, healer], settings: { ...DEFAULT_SETTINGS }, lootLog: [], currentWeek: 1,
    });
    expect(map.get('a')?.has('body')).toBe(true);
    expect(map.get('b')?.has('body') ?? false).toBe(false);
  });

  it("resolves the ring drop to the top needer's needed ring slot", () => {
    // Player has ring1 (raid, owned) but still needs ring2 (raid, missing).
    // getPriorityForRing includes them; the mark must land on 'ring2', not 'ring1'.
    const player = makePlayer('a', 'Alice', 'melee', [
      { slot: 'ring1', bisSource: 'raid', hasItem: true },
      { slot: 'ring2', bisSource: 'raid', hasItem: false },
    ]);
    const map = computeNextUpgradePriorities({
      players: [player], settings: { ...DEFAULT_SETTINGS }, lootLog: [], currentWeek: 1,
    });
    expect(map.get('a')?.has('ring2')).toBe(true);
    expect(map.get('a')?.has('ring1') ?? false).toBe(false);
  });

  it('returns an empty map when priority is disabled', () => {
    const player = makePlayer('a', 'Alice', 'melee', [{ slot: 'body' }]);
    const map = computeNextUpgradePriorities({
      players: [player],
      settings: { ...DEFAULT_SETTINGS, priorityMode: 'disabled' },
      lootLog: [], currentWeek: 1,
    });
    expect(map.size).toBe(0);
  });

  it('enhanced scoring reorders the top exactly like FloorCard', () => {
    // Equal base score (same role, same single 'body' need). Without enhancement
    // the tie breaks alphabetically → Alice (a). With enhancement, Alice got a
    // week-3 drop while Bob is dry → Bob's drought bonus flips the top to Bob.
    const alice = makePlayer('a', 'Alice', 'melee', [{ slot: 'body' }]);
    const bob = makePlayer('b', 'Bob', 'melee', [{ slot: 'body' }]);
    const settings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };
    const lootLog = [makeDrop('a', 3)]; // active requires lootLog.length > 0
    const map = computeNextUpgradePriorities({
      players: [alice, bob], settings, lootLog, currentWeek: 3,
    });
    expect(map.get('b')?.has('body')).toBe(true);
    expect(map.get('a')?.has('body') ?? false).toBe(false);
  });

  it('accumulates multiple slots into one player set (union, not overwrite)', () => {
    // A lone melee needs BOTH Floor-3 drops (body + legs), so they are the #1
    // needer for each. The player's set must contain BOTH slots — a
    // `map.set(id, new Set([resolved]))` overwrite would drop the first.
    const player = makePlayer('a', 'Alice', 'melee', [
      { slot: 'body', bisSource: 'raid', hasItem: false },
      { slot: 'legs', bisSource: 'raid', hasItem: false },
    ]);
    const map = computeNextUpgradePriorities({
      players: [player], settings: { ...DEFAULT_SETTINGS }, lootLog: [], currentWeek: 1,
    });
    expect(map.get('a')?.has('body')).toBe(true);
    expect(map.get('a')?.has('legs')).toBe(true);
  });

  it('a slot with zero needers marks no one', () => {
    // Player needs 'body' only; nobody needs 'head'. No set may contain 'head'.
    const player = makePlayer('a', 'Alice', 'melee', [
      { slot: 'body', bisSource: 'raid', hasItem: false },
      { slot: 'head', bisSource: 'raid', hasItem: true },
    ]);
    const map = computeNextUpgradePriorities({
      players: [player], settings: { ...DEFAULT_SETTINGS }, lootLog: [], currentWeek: 1,
    });
    for (const set of map.values()) {
      expect(set.has('head')).toBe(false);
    }
    // Sanity: the body need is still marked (map isn't vacuously empty).
    expect(map.get('a')?.has('body')).toBe(true);
  });
});
