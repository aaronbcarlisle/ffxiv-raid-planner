/**
 * Ranking explanation — Phase D R-6's v2-owned derivation (D-29's
 * reasons/warnings/confidence layer; D-25's score breakdown is NOT carried
 * here — RecipientEntry has no breakdown, and where D-25 lands is an open
 * ruling).
 *
 * One caution layer for every surface that shows a ranking (picker candidates
 * now; D3 wires queue rows + matrix cells). The ranking ORDER and per-row
 * reason line stay utils/recipientRanking's job — this module answers the
 * question that module can't: does the RECORD (loot log, weapon-priority
 * list) disagree with the ranking?
 *
 * Mirrors utils/lootRecommendationService.ts BY READING (that file is
 * V1-reachable and frozen — phase-d-loot-plan.md §2.1): the warning taxonomy
 * follows playerAlreadyReceivedSlot, and deriveRankingConfidence translates
 * computeConfidence's cutoffs (:405-427) to v2's needers-only pool — v1's
 * `scoreDelta >= 40` (exactBisNeed 60 dominant) becomes "sole needer, or
 * every rival carries a warning". Two v1 cutoffs have no analogue here:
 * all-player_fallback → low (:417; this ranking reads no character
 * registrations) and weapon-coffer priorityRank 1 → high (:424; v2's weapon
 * ranking comes from getPriorityForItem, not the weapon-priority list).
 * The `warnings.length > 1` → low branch is a contract guard: today's two
 * warning kinds that could co-occur both force wouldAdvanceBis=false first.
 *
 * Weapon log matching is job-strict — the read matches what the picker
 * writes (weaponJob = recipient's job at submit), so read and write agree.
 */
import type { LootLogEntry, GearSlot } from '../types';
import { GEAR_SLOT_NAMES } from '../types';
import type { RecipientEntry } from './recipientRanking';

export interface CandidateExplanation {
  /** Why this candidate ranks where it does — the ranking's own reason line. */
  reasons: string[];
  /** Record cross-checks — already received, weapon-priority conflicts. */
  warnings: string[];
  /** Would giving them this item advance their raid BiS? */
  wouldAdvanceBis: boolean;
}

export type RankingConfidence = 'high' | 'medium' | 'low';

function slotLabel(slot: GearSlot | 'ring'): string {
  return slot === 'ring' ? 'Ring' : (GEAR_SLOT_NAMES[slot] ?? slot);
}

function matchesSlot(e: LootLogEntry, slot: GearSlot | 'ring', playerJob: string): boolean {
  if (slot === 'ring') {
    return e.itemSlot === 'ring' || e.itemSlot === 'ring1' || e.itemSlot === 'ring2';
  }
  if (slot === 'weapon') {
    return e.itemSlot === 'weapon' && e.weaponJob === playerJob;
  }
  return e.itemSlot === slot;
}

export function explainCandidate(
  entry: RecipientEntry,
  slot: GearSlot | 'ring',
  ctx: { lootLog: LootLogEntry[] },
): CandidateExplanation {
  const warnings: string[] = [];
  let wouldAdvanceBis = entry.needsItem;
  const label = slotLabel(slot);

  const received = ctx.lootLog.filter(
    (e) => e.recipientPlayerId === entry.player.id && matchesSlot(e, slot, entry.player.job),
  );
  if (received.length > 0) {
    const earliest = received.reduce((a, b) => (a.weekNumber < b.weekNumber ? a : b));
    warnings.push(`Already received ${label} in Week ${earliest.weekNumber}`);
    wouldAdvanceBis = false;
  }

  if (slot === 'weapon') {
    const wp = (entry.player.weaponPriorities ?? []).find((w) => w.job === entry.player.job);
    if (wp?.received) {
      warnings.push('Weapon already marked received in the priority list');
      wouldAdvanceBis = false;
    } else if (!wp) {
      warnings.push('Not on the weapon priority list');
    }
  }

  return { reasons: [entry.reason], warnings, wouldAdvanceBis };
}

export function deriveRankingConfidence(explained: CandidateExplanation[]): RankingConfidence {
  if (explained.length === 0) return 'low';
  const top = explained[0];
  if (!top.wouldAdvanceBis) return 'low';
  if (top.warnings.length > 1) return 'low';
  const rivals = explained.slice(1);
  if (
    top.warnings.length === 0 &&
    (rivals.length === 0 || rivals.every((c) => c.warnings.length >= 1))
  ) {
    return 'high';
  }
  return 'medium';
}
