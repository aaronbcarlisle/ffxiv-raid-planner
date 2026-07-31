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

  // Default `player({})` has `gear: []` — no tracked raid ring at all, so
  // `stillNeedsRing` is false and this exercises the "normal" (non-refined)
  // path: both rings already accounted for (none raid-BiS-and-missing) means
  // the receipt genuinely forces wouldAdvanceBis=false. Pinned explicitly so
  // this test stays meaningful under the ring refinement below, rather than
  // accidentally relying on the empty-gear fixture's degenerate case.
  it('ring matches ring, ring1 and ring2 itemSlots (fully-accounted-for candidate stays forced false)', () => {
    const bothRingsFilled = player({
      gear: [
        { slot: 'ring1', bisSource: 'raid', hasItem: true, isAugmented: true },
        { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: true },
      ] as SnapshotPlayer['gear'],
    });
    for (const itemSlot of ['ring', 'ring1', 'ring2'] as const) {
      const ex = explainCandidate(
        entry(bothRingsFilled), 'ring',
        { lootLog: [logEntry({ itemSlot, weekNumber: 4 })] },
      );
      expect(ex.warnings).toEqual(['Already received Ring in Week 4']);
      expect(ex.wouldAdvanceBis).toBe(false);
    }
  });

  // PR #225 review, Finding 1: a candidate with a raid-BiS ring already
  // received but a SECOND unfilled raid ring still genuinely advances BiS —
  // getPriorityForRing keeps them in the needers pool for exactly this
  // reason (needsRing1||needsRing2), so a rank-1 case among them must not
  // sink the confidence header via a falsely-forced wouldAdvanceBis.
  it('a two-raid-ring candidate with one ring already received still advances BiS via the other (ring refinement)', () => {
    const oneRingLeft = player({
      gear: [
        { slot: 'ring1', bisSource: 'raid', hasItem: true, isAugmented: true },
        { slot: 'ring2', bisSource: 'raid', hasItem: false, isAugmented: false },
      ] as SnapshotPlayer['gear'],
    });
    const ex = explainCandidate(
      entry(oneRingLeft), 'ring',
      { lootLog: [logEntry({ itemSlot: 'ring1', weekNumber: 2 })] },
    );
    // The warning still fires — the receipt is real and fairness-relevant.
    expect(ex.warnings).toEqual(['Already received Ring in Week 2']);
    // But it does not falsely sink wouldAdvanceBis — the second ring is a
    // genuine BiS-advancing assign.
    expect(ex.wouldAdvanceBis).toBe(true);
  });

  // PR #225 review round 2, Finding 1: a receipt only carries BiS signal
  // when it could have marked gear (lootCoordination.ts:78 gates the mark
  // on `method === 'drop' || 'book'` AND `!isExtra`). R-24 made tome/
  // purchase create-reachable, so a needer can now genuinely hold a
  // tome/purchase receipt for the same slot while STILL needing the
  // raid-BiS piece — the warning must stay, but wouldAdvanceBis must not
  // be falsely forced.
  it('a tome-method receipt still warns but does not force wouldAdvanceBis false (non-syncing refinement)', () => {
    const ex = explainCandidate(
      entry(player({})), 'head',
      { lootLog: [logEntry({ itemSlot: 'head', method: 'tome', weekNumber: 2 })] },
    );
    expect(ex.warnings).toEqual(['Already received Head in Week 2']);
    expect(ex.wouldAdvanceBis).toBe(true);
  });

  it('an isExtra drop receipt still warns but does not force wouldAdvanceBis false (non-syncing refinement)', () => {
    const ex = explainCandidate(
      entry(player({})), 'head',
      { lootLog: [logEntry({ itemSlot: 'head', method: 'drop', isExtra: true, weekNumber: 2 })] },
    );
    expect(ex.warnings).toEqual(['Already received Head in Week 2']);
    expect(ex.wouldAdvanceBis).toBe(true);
  });

  // Contrast case: a genuinely gear-syncing receipt (method drop, not extra
  // — the logEntry() factory default) still forces false, same as the
  // pre-refinement tests above (line 41 et al.) all implicitly rely on.
  it('a syncing drop receipt still forces wouldAdvanceBis false', () => {
    const ex = explainCandidate(
      entry(player({})), 'head',
      { lootLog: [logEntry({ itemSlot: 'head', weekNumber: 2 })] },
    );
    expect(ex.wouldAdvanceBis).toBe(false);
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

  it('flags a received weapon-priority row', () => {
    const received = explainCandidate(
      entry(player({ job: 'WAR', weaponPriorities: [{ job: 'WAR', received: true }] })),
      'weapon', { lootLog: [] },
    );
    expect(received.warnings).toContain('Weapon already marked received in the priority list');
    expect(received.wouldAdvanceBis).toBe(false);
  });

  // Live browser validation finding: every player's main job is an implicit
  // default weapon priority (WeaponPriorityList.tsx:1020-1027's `allJobs`
  // derivation) — explicit weaponPriorities rows are sparse addition/receipt
  // records, so a MISSING row for the candidate's own job carries no signal
  // and must not warn (the mirrored v1 "not on the list" warning fired on
  // nearly every weapon row in the running app and sank confidence tier-wide).
  it('does not warn when there is no weapon-priority row for the candidate\'s job (main job is the default)', () => {
    const noRow = explainCandidate(entry(player({ job: 'WAR', weaponPriorities: [] })), 'weapon', { lootLog: [] });
    expect(noRow.warnings).toEqual([]);
    expect(noRow.wouldAdvanceBis).toBe(true);

    const otherJobOnly = explainCandidate(
      entry(player({ job: 'WAR', weaponPriorities: [{ job: 'DRG', received: true }] })),
      'weapon', { lootLog: [] },
    );
    expect(otherJobOnly.warnings).toEqual([]);
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
