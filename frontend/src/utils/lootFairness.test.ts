import { describe, it, expect } from 'vitest';
import { deriveFloorWeekStatus } from './lootFairness';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../types';

function makePlayer(id: string, name: string, opts: {
  sub?: boolean;
  earringHas?: boolean; earringSource?: 'raid' | 'tome';
  ring1Has?: boolean; ring1Source?: 'raid' | 'tome';
  ring2Has?: boolean; ring2Source?: 'raid' | 'tome';
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [
      { slot: 'earring', bisSource: opts.earringSource ?? 'raid', hasItem: opts.earringHas ?? false, isAugmented: false },
      { slot: 'ring1', bisSource: opts.ring1Source ?? 'raid', hasItem: opts.ring1Has ?? false, isAugmented: false },
      { slot: 'ring2', bisSource: opts.ring2Source ?? 'raid', hasItem: opts.ring2Has ?? false, isAugmented: false },
    ],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}

const settings = { ...DEFAULT_SETTINGS };
const base = {
  floorNumber: 1 as const, floorName: 'M9S', week: 3,
  settings, lootLog: [] as LootLogEntry[], materialLog: [] as MaterialLogEntry[], pageLedger: [] as PageLedgerEntry[],
};

describe('deriveFloorWeekStatus', () => {
  it('floor 1 with an earring-needer and no logged entries → pending, not cleared', () => {
    const players = [makePlayer('a', 'Alice')];
    const status = deriveFloorWeekStatus({ ...base, players });
    expect(status.pendingCount).toBeGreaterThanOrEqual(1);
    expect(status.loggedCount).toBe(0);
    expect(status.cleared).toBe(false);
  });

  it('a logged loot entry for the needed slot clears that item from pending', () => {
    const players = [makePlayer('a', 'Alice')];
    const withoutLog = deriveFloorWeekStatus({ ...base, players });
    const lootLog: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M9S', itemSlot: 'earring',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    const status = deriveFloorWeekStatus({ ...base, players, lootLog });
    expect(status.loggedCount).toBe(1);
    expect(status.pendingCount).toBe(withoutLog.pendingCount - 1);
  });

  it('a page-ledger "earned" book entry for this floor/week marks the floor cleared for that week only', () => {
    const players = [makePlayer('a', 'Alice')];
    const pageLedger: PageLedgerEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', playerId: 'a', playerName: 'Alice',
        weekNumber: 3, floor: 'M9S', bookType: 'I', transactionType: 'earned', quantity: 1,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    const week3 = deriveFloorWeekStatus({ ...base, players, pageLedger });
    expect(week3.cleared).toBe(true);
    const week2 = deriveFloorWeekStatus({ ...base, players, pageLedger, week: 2 });
    expect(week2.cleared).toBe(false);
  });

  it('ring pending counts once (ring1 + ring2 needers consolidate); a logged ring1 or ring entry clears it', () => {
    // Two players who each need only a ring slot (no earring/necklace/bracelet need)
    const players = [
      makePlayer('a', 'Alice', { earringHas: true, ring1Has: false, ring2Has: true }),
      makePlayer('b', 'Bob', { earringHas: true, ring1Has: true, ring2Has: false }),
    ];
    const withoutLog = deriveFloorWeekStatus({ ...base, players });
    // Only the Ring item should be pending (earring/necklace/bracelet all satisfied or absent needers)
    expect(withoutLog.pendingCount).toBe(1);

    const lootLogRing1: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M9S', itemSlot: 'ring1',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    const clearedByRing1 = deriveFloorWeekStatus({ ...base, players, lootLog: lootLogRing1 });
    expect(clearedByRing1.pendingCount).toBe(0);

    const lootLogRing: LootLogEntry[] = [
      {
        id: 1, tierSnapshotId: 't1', weekNumber: 3, floor: 'M9S', itemSlot: 'ring',
        recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop', isExtra: false,
        createdAt: '', createdByUserId: 'u1', createdByUsername: 'u',
      },
    ];
    const clearedByRing = deriveFloorWeekStatus({ ...base, players, lootLog: lootLogRing });
    expect(clearedByRing.pendingCount).toBe(0);
  });

  it('no needers at all → pendingCount 0', () => {
    const players = [makePlayer('a', 'Alice', {
      earringHas: true, ring1Has: true, ring2Has: true,
    })];
    // necklace/bracelet aren't tracked on this fixture player's gear array, so
    // getPriorityForItem finds no gear entry for them → not counted as needing.
    const status = deriveFloorWeekStatus({ ...base, players });
    expect(status.pendingCount).toBe(0);
  });
});
