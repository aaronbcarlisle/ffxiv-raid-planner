import { describe, it, expect } from 'vitest';
import { explainCandidate, deriveRankingConfidence } from './rankingExplanation';
import type { RecipientEntry } from './recipientRanking';
import type { SnapshotPlayer, LootLogEntry } from '../types';

function player(over: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'a', tierSnapshotId: 't1', name: 'Alice', job: 'PLD', role: 'tank',
    configured: true, sortOrder: 0, isSubstitute: false,
    gear: [], tomeWeapon: {}, weaponPriorities: [],
    ...over,
  } as unknown as SnapshotPlayer;
}

function entry(p: SnapshotPlayer, over: Partial<RecipientEntry> = {}): RecipientEntry {
  return {
    player: p, rank: 1, needsItem: true, needTag: 'bis',
    reason: 'Head is BiS · 0 drops this tier',
    ...over,
  };
}

function logEntry(over: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1, tierSnapshotId: 't1', weekNumber: 1, floor: 'M9S', itemSlot: 'head',
    recipientPlayerId: 'a', recipientPlayerName: 'Alice', method: 'drop',
    isExtra: false, createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1', createdByUsername: 'gm',
    ...over,
  };
}

describe('explainCandidate', () => {
  it('carries the ranking reason through and stays clean with an empty log', () => {
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: [] });
    expect(ex.reasons).toEqual(['Head is BiS · 0 drops this tier']);
    expect(ex.warnings).toEqual([]);
    expect(ex.wouldAdvanceBis).toBe(true);
  });

  it('warns with the EARLIEST week when the log already has this slot for the player', () => {
    const log = [
      logEntry({ id: 1, itemSlot: 'head', weekNumber: 3 }),
      logEntry({ id: 2, itemSlot: 'head', weekNumber: 2 }),
    ];
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: log });
    expect(ex.warnings).toEqual(['Already received Head in Week 2']);
    expect(ex.wouldAdvanceBis).toBe(false);
  });

  it("does not warn about another player's entries or another slot", () => {
    const log = [
      logEntry({ recipientPlayerId: 'p2', itemSlot: 'head' }),
      logEntry({ id: 2, itemSlot: 'body' }),
    ];
    const ex = explainCandidate(entry(player({})), 'head', { lootLog: log });
    expect(ex.warnings).toEqual([]);
  });

  it('ring matches ring, ring1 and ring2 itemSlots', () => {
    for (const itemSlot of ['ring', 'ring1', 'ring2'] as const) {
      const ex = explainCandidate(
        entry(player({})), 'ring',
        { lootLog: [logEntry({ itemSlot, weekNumber: 4 })] },
      );
      expect(ex.warnings).toEqual(['Already received Ring in Week 4']);
    }
  });

  it('weapon log match is job-strict (read agrees with the picker write)', () => {
    const p = player({ job: 'WAR' });
    const mine = explainCandidate(entry(p), 'weapon',
      { lootLog: [logEntry({ itemSlot: 'weapon', weaponJob: 'WAR', weekNumber: 1 })] });
    expect(mine.warnings).toContain('Already received Weapon in Week 1');
    const other = explainCandidate(entry(p), 'weapon',
      { lootLog: [logEntry({ itemSlot: 'weapon', weaponJob: 'DRG', weekNumber: 1 })] });
    expect(other.warnings).toEqual(expect.not.arrayContaining(['Already received Weapon in Week 1']));
  });

  it('flags a received weapon-priority row and a missing one', () => {
    const received = explainCandidate(
      entry(player({ job: 'WAR', weaponPriorities: [{ job: 'WAR', received: true }] })),
      'weapon', { lootLog: [] },
    );
    expect(received.warnings).toContain('Weapon already marked received in the priority list');
    expect(received.wouldAdvanceBis).toBe(false);

    const missing = explainCandidate(entry(player({ job: 'WAR', weaponPriorities: [] })), 'weapon', { lootLog: [] });
    expect(missing.warnings).toContain('Not on the weapon priority list');
  });

  it('a non-needer never claims to advance BiS', () => {
    const ex = explainCandidate(
      entry(player({}), { needsItem: false, needTag: 'minor', reason: 'Not raid BiS in this slot', rank: null }),
      'head', { lootLog: [] },
    );
    expect(ex.wouldAdvanceBis).toBe(false);
    expect(ex.reasons).toEqual(['Not raid BiS in this slot']);
  });
});

describe('deriveRankingConfidence', () => {
  const clean = { reasons: ['r'], warnings: [], wouldAdvanceBis: true };
  const warned = (n: number) => ({ reasons: ['r'], warnings: Array.from({ length: n }, (_, i) => `w${i}`), wouldAdvanceBis: true });

  it('empty pool → low', () => expect(deriveRankingConfidence([])).toBe('low'));
  it('top does not advance BiS → low', () =>
    expect(deriveRankingConfidence([{ ...clean, wouldAdvanceBis: false }, clean])).toBe('low'));
  // Contract test: unreachable through explainCandidate today (see header note) —
  // pins the v1 `warnings.length > 1` cutoff for future warning kinds.
  it('top with two warnings → low', () =>
    expect(deriveRankingConfidence([warned(2), clean])).toBe('low'));
  it('sole clean needer → high', () => expect(deriveRankingConfidence([clean])).toBe('high'));
  it('clean top and every rival warned → high', () =>
    expect(deriveRankingConfidence([clean, warned(1), warned(1)])).toBe('high'));
  it('clean top with a clean rival → medium', () =>
    expect(deriveRankingConfidence([clean, clean])).toBe('medium'));
  it('top with exactly one warning → medium (mirrors v1 "> 1" cutoff)', () =>
    expect(deriveRankingConfidence([warned(1)])).toBe('medium'));
});
