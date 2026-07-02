import { describe, it, expect } from 'vitest';
import { deriveFloorWeekStatus, computeTierFairness } from './lootFairness';
import { DEFAULT_SETTINGS } from './constants';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry, PageLedgerEntry } from '../types';

function makeDrop(playerId: string, weekNumber: number): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber, floor: 'M9S', itemSlot: 'earring',
    recipientPlayerId: playerId, recipientPlayerName: 'x', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
  } as unknown as LootLogEntry;
}

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

describe('computeTierFairness', () => {
  const alice = makePlayer('a', 'Alice');                     // main
  const bob = makePlayer('b', 'Bob');                          // main
  const sub = { ...makePlayer('s', 'Subby'), isSubstitute: true } as SnapshotPlayer;
  const players = [alice, bob, sub];
  const tierBase = { players, settings, materialLog: [] as MaterialLogEntry[], pageLedger: [] as PageLedgerEntry[], floors: ['M9S', 'M10S', 'M11S', 'M12S'] };

  it('excludes substitutes and reports most/fewest with spread', () => {
    const lootLog = [
      makeDrop('a', 1), makeDrop('a', 2), makeDrop('a', 2),   // Alice 3
      makeDrop('b', 1),                                        // Bob 1
      makeDrop('s', 1), makeDrop('s', 1), makeDrop('s', 2),   // sub ignored
    ];
    const f = computeTierFairness({ ...tierBase, lootLog, currentWeek: 2 });
    expect(f.most).toEqual({ names: ['Alice'], count: 3 });
    expect(f.fewest).toEqual({ names: ['Bob'], count: 1 });
    expect(f.spread).toBe(2);
    expect(f.even).toBe(true);          // threshold is <= 2
    expect(f.weeksSpanned).toBe(2);
  });

  it('dropsThisTier counts only method=drop; ties list every name', () => {
    const lootLog = [
      makeDrop('a', 1),
      { ...makeDrop('b', 1), method: 'book' },   // counts for Bob's total, NOT dropsThisTier
    ] as LootLogEntry[];
    const f = computeTierFairness({ ...tierBase, lootLog, currentWeek: 1 });
    expect(f.dropsThisTier).toBe(1);
    expect(f.most).toEqual({ names: ['Alice', 'Bob'], count: 1 });
    expect(f.spread).toBe(0);
  });

  it('uneven when spread exceeds 2; thisWeek counts loot+materials in the current week only', () => {
    const lootLog = [makeDrop('a', 1), makeDrop('a', 1), makeDrop('a', 1), makeDrop('a', 2)]; // Alice 4, Bob 0
    const materialLog = [
      { id: 1, tierSnapshotId: 't1', weekNumber: 2, floor: 'M11S', materialType: 'twine',
        recipientPlayerId: 'b', recipientPlayerName: 'Bob', method: 'drop',
        createdAt: '2026-01-01T00:00:00Z', createdByUserId: 'u', createdByUsername: 'u' },
    ] as MaterialLogEntry[];
    const f = computeTierFairness({ ...tierBase, lootLog, materialLog, currentWeek: 2 });
    expect(f.even).toBe(false);
    expect(f.spread).toBe(4);
    expect(f.thisWeekCount).toBe(2);    // Alice's week-2 drop + Bob's week-2 twine
  });

  it('returns null stats and zero pending for an empty roster', () => {
    const f = computeTierFairness({ ...tierBase, players: [sub], lootLog: [], currentWeek: 1 });
    expect(f.most).toBeNull();
    expect(f.fewest).toBeNull();
    expect(f.even).toBe(true);
    expect(f.thisWeekPending).toBe(0);
  });

  it('spread of exactly 3 is not even (boundary at the <=2 threshold)', () => {
    const lootLog = [makeDrop('b', 1), makeDrop('b', 1), makeDrop('b', 1)]; // Bob 3, Alice 0
    const f = computeTierFairness({ ...tierBase, lootLog, currentWeek: 1 });
    expect(f.spread).toBe(3);
    expect(f.even).toBe(false);
  });

  it('thisWeekPending counts only the mains\' pending needs, ignoring substitute needs', () => {
    // Sub additionally needs a raid body drop (Floor 3 / M11S) — a need that
    // belongs only to a substitute and must not inflate the mains-only rollup.
    const subWithBodyNeed = {
      ...sub,
      gear: [...sub.gear, { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false }],
    } as unknown as SnapshotPlayer;
    // Clears Floor 1's earring pending for week 5, leaving only the Ring need
    // (still unclaimed by both mains) pending on Floor 1; Floor 3's body need
    // belongs to the sub and must not show up here.
    const lootLog = [makeDrop('a', 5)];
    const f = computeTierFairness({
      ...tierBase,
      players: [alice, bob, subWithBodyNeed],
      lootLog,
      currentWeek: 5,
    });
    expect(f.thisWeekPending).toBe(1);
  });
});
