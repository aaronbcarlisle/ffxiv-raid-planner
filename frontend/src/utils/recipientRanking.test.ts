import { describe, it, expect } from 'vitest';
import { buildRecipientEntries } from './recipientRanking';
import { DEFAULT_SETTINGS } from './constants';
import { getPriorityForItem } from './priority';
import { calculateAverageDrops } from './lootCoordination';
import { enhancePriorityEntries } from './priorityEntries';
import type { SnapshotPlayer, LootLogEntry } from '../types';

function makePlayer(id: string, name: string, opts: {
  sub?: boolean; hasEarring?: boolean; earringSource?: 'raid' | 'tome';
} = {}): SnapshotPlayer {
  return {
    id, tierSnapshotId: 't1', name, job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: opts.sub ?? false,
    gear: [{
      slot: 'earring', bisSource: opts.earringSource ?? 'raid',
      hasItem: opts.hasEarring ?? false, isAugmented: false,
    }],
    tomeWeapon: {}, weaponPriorities: [],
  } as unknown as SnapshotPlayer;
}
const settings = { ...DEFAULT_SETTINGS };
const base = { slot: 'earring' as const, settings, lootLog: [], currentWeek: 1, enhancedActive: false };

describe('buildRecipientEntries', () => {
  const needer = makePlayer('a', 'Alice');
  const haver = makePlayer('b', 'Bob', { hasEarring: true });
  const tomeBis = makePlayer('c', 'Cara', { earringSource: 'tome' });
  const sub = makePlayer('d', 'Dana', { sub: true });
  const players = [needer, haver, tomeBis, sub];

  it("scope 'priority' returns ranked main-roster needers only", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'priority' });
    expect(out.map((e) => e.player.id)).toEqual(['a']);
    expect(out[0]).toMatchObject({ rank: 1, needsItem: true, needTag: 'bis' });
    expect(out[0].reason).toContain('BiS');
  });

  it("scope 'all' includes everyone: needers ranked first, others alphabetical with tags", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'all' });
    expect(out[0].player.id).toBe('a');                       // needer first
    const ids = out.map((e) => e.player.id);
    expect(ids).toHaveLength(4);                              // subs included
    const bob = out.find((e) => e.player.id === 'b')!;
    expect(bob.needTag).toBe('free');                         // already has raid BiS
    const cara = out.find((e) => e.player.id === 'c')!;
    expect(cara.needTag).toBe('minor');                       // tome BiS in slot
  });

  it("scope 'offspec' returns everyone alphabetical, tagged free", () => {
    const out = buildRecipientEntries({ ...base, players, scope: 'offspec' });
    expect(out.map((e) => e.player.name)).toEqual(['Alice', 'Bob', 'Cara', 'Dana']);
    expect(out.every((e) => e.needTag === 'free' && e.rank === null)).toBe(true);
  });
});

// Deterministic default ids (PR review): random ids make fixtures
// non-reproducible if anything ever keys on them. Explicit `id` overrides
// in individual tests are unaffected.
let nextLootEntryId = 90000;

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: nextLootEntryId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'M9S',
    itemSlot: 'body',
    recipientPlayerId: 'a',
    recipientPlayerName: '',
    recipientCharacterRegistrationId: null,
    recipientCharacterName: null,
    method: 'drop',
    notes: '',
    weaponJob: undefined,
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'user',
    ...overrides,
  };
}

describe('buildRecipientEntries — D-25 score transparency (D3 restore)', () => {
  const needer = makePlayer('a', 'Alice');
  const haver = makePlayer('b', 'Bob', { hasEarring: true });
  const tomeBis = makePlayer('c', 'Cara', { earringSource: 'tome' });
  const sub = makePlayer('d', 'Dana', { sub: true });
  const players = [needer, haver, tomeBis, sub];

  it('needers (scope priority) carry score + a breakdown object with the documented keys; rank-null rows in scope all and every offspec row have no breakdown', () => {
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };

    const priorityOut = buildRecipientEntries({
      ...base, players, scope: 'priority', settings: enhancedSettings, enhancedActive: true,
    });
    expect(priorityOut).toHaveLength(1);
    expect(typeof priorityOut[0].score).toBe('number');
    expect(priorityOut[0].breakdown).toMatchObject({
      score: expect.any(Number),
      rolePriority: expect.any(Number),
      weightedNeed: expect.any(Number),
      weightedNeedBonus: expect.any(Number),
      lootAdjustmentBonus: expect.any(Number),
      jobModifier: expect.any(Number),
      playerModifier: expect.any(Number),
    });

    const allOut = buildRecipientEntries({
      ...base, players, scope: 'all', settings: enhancedSettings, enhancedActive: true,
    });
    const rankNullRows = allOut.filter((e) => e.rank === null);
    expect(rankNullRows.length).toBeGreaterThan(0);
    expect(rankNullRows.every((e) => e.breakdown === undefined)).toBe(true);

    const offspecOut = buildRecipientEntries({
      ...base, players, scope: 'offspec', settings: enhancedSettings, enhancedActive: true,
    });
    expect(offspecOut.length).toBeGreaterThan(0);
    expect(offspecOut.every((e) => e.breakdown === undefined)).toBe(true);
  });

  // Order-identity proof for Task 5's FloorCard swap (director M-5): with
  // enableEnhancedScoring ON and a non-trivial lootLog, buildRecipientEntries
  // must yield the SAME order as the raw enhancePriorityEntries/
  // getPriorityForItem pipeline it wraps — same pools, same gate, same week.
  // Deliberately calls the REAL functions (no mocks) so a future divergence
  // between the two derivations is caught here, not silently in FloorCard.
  it('order-identity: buildRecipientEntries matches enhancePriorityEntries(getPriorityForItem(...)) exactly', () => {
    const n1 = makePlayer('n1', 'Nora');
    const n2 = makePlayer('n2', 'Oscar');
    const n3 = makePlayer('n3', 'Priya');
    const orderPlayers = [n1, n2, n3];
    const currentWeek = 3;
    // Nora got two recent drops (raises her totalDrops above average and
    // shortens her drought) — a non-trivial log that should reorder the
    // enhanced ranking relative to the tied base-score/alphabetical order.
    const lootLog: LootLogEntry[] = [
      makeLootEntry({ id: 1, recipientPlayerId: 'n1', weekNumber: 1, itemSlot: 'body' }),
      makeLootEntry({ id: 2, recipientPlayerId: 'n1', weekNumber: 2, itemSlot: 'head' }),
    ];
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };

    const out = buildRecipientEntries({
      players: orderPlayers, slot: 'earring', scope: 'priority',
      settings: enhancedSettings, lootLog, currentWeek, enhancedActive: true,
    });

    const poolIds = orderPlayers.map((p) => p.id);
    const reference = enhancePriorityEntries(
      getPriorityForItem(orderPlayers, 'earring', enhancedSettings),
      {
        settings: enhancedSettings,
        lootLog,
        currentWeek,
        averageDrops: calculateAverageDrops(poolIds, lootLog),
        active: true,
      },
    );

    expect(out.map((e) => e.player.id)).toEqual(reference.map((e) => e.player.id));
    // Sanity: the log actually reordered the ranking away from the tied
    // base-score/alphabetical order — otherwise this test wouldn't exercise
    // the enhancement logic at all.
    expect(out.map((e) => e.player.id)).not.toEqual(['n1', 'n2', 'n3']);
  });

  // Review fix round 1, Finding 2: the headline `score` must be the ENHANCED
  // final (drought + balance folded in — priorityEntries.ts:67-68's own sort
  // key), not the pre-adjustment base (`breakdown.score`). Legacy parity:
  // LootPriorityPanel.tsx:53's displayScore is
  // `hasEnhanced ? enhancedScore : score`. Reuses the order-identity
  // fixture's log, which already gives Nora a nonzero drought bonus AND a
  // nonzero balance penalty (two recent drops → excess above the pool
  // average), so `enhancedScore` provably differs from the base score.
  it('score headline is the enhanced final, not the base breakdown.score, when drought/balance are nonzero', () => {
    const n1 = makePlayer('n1', 'Nora');
    const n2 = makePlayer('n2', 'Oscar');
    const n3 = makePlayer('n3', 'Priya');
    const orderPlayers = [n1, n2, n3];
    const currentWeek = 3;
    const lootLog: LootLogEntry[] = [
      makeLootEntry({ id: 1, recipientPlayerId: 'n1', weekNumber: 1, itemSlot: 'body' }),
      makeLootEntry({ id: 2, recipientPlayerId: 'n1', weekNumber: 2, itemSlot: 'head' }),
    ];
    const enhancedSettings = { ...DEFAULT_SETTINGS, enableEnhancedScoring: true };

    const out = buildRecipientEntries({
      players: orderPlayers, slot: 'earring', scope: 'priority',
      settings: enhancedSettings, lootLog, currentWeek, enhancedActive: true,
    });
    const nora = out.find((e) => e.player.id === 'n1')!;
    expect(nora.droughtBonus).toBeGreaterThan(0);
    expect(nora.balancePenalty).toBeGreaterThan(0);
    expect(nora.score).not.toBe(nora.breakdown!.score);
    expect(nora.score).toBe(
      Math.round(nora.breakdown!.score + (nora.droughtBonus ?? 0) - (nora.balancePenalty ?? 0)),
    );
  });
});
