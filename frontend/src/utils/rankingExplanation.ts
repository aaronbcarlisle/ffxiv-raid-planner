/**
 * Ranking explanation — Phase D R-6's v2-owned derivation (D-29's
 * reasons/warnings/confidence layer; D-25's score breakdown lives in the
 * sibling `ScoreBreakdown` leaf (D3) — this module stays reasons/warnings/
 * confidence).
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
 * A missing weapon-priority row is likewise NOT warned: WeaponPriorityList.tsx's
 * `allJobs` derivation (:1020-1027, "Every player's main job is a default
 * weapon priority") treats a player's main job as an implicit priority row —
 * explicit `weaponPriorities` rows are additions/receipt records, sparse by
 * design — so row absence carries no signal in v2. v1's `weapon_coffer`
 * scorer assumed a ranking DERIVED FROM the wp list, where absence meant
 * something; that premise doesn't transfer here (v2's weapon ranking comes
 * from getPriorityForItem, per the :424 note above), and live browser
 * validation confirmed a mirrored "not on the list" warning fired on nearly
 * every weapon row, sinking the confidence header to Medium tier-wide. Only
 * `wp.received` — an actual receipt record — still warns.
 * Two-raid-ring refinement (same correction class as the weapon-list removal
 * above — PR #225 review): a ring receipt does NOT force `wouldAdvanceBis`
 * false when the candidate still has a second unfilled raid ring. A player
 * who's received ONE ring but still needs the other stays in the needers
 * pool by construction (recipientRanking.ts's getPriorityForRing keeps them
 * while needsRing1||needsRing2), so a rank-1 case among them genuinely still
 * advances BiS — v1's coarse "received this bucket" check forced false even
 * then. The warning line still fires (the receipt is real and
 * fairness-relevant); only `wouldAdvanceBis` is refined by checking whether
 * a raid-BiS, not-yet-held ring slot remains.
 * Non-syncing-receipt refinement (same correction class, PR #225 round 2): a
 * receipt only carries BiS signal when it could have marked gear. A
 * tome/purchase-method or isExtra receipt never syncs gear
 * (lootCoordination.ts:78 gates the mark on `method === 'drop' || 'book'`
 * and `!isExtra`), so the player REMAINS a needer despite the log entry —
 * R-24 made tome/purchase reachable from create mode, so this is now a live
 * case, not a hypothetical. The warning line still fires for ANY matching
 * receipt (still real, still fairness-relevant); `wouldAdvanceBis` is only
 * cleared when at least one matching receipt was actually gear-syncing.
 * The `warnings.length > 1` → low branch is a contract guard. The only
 * reachable two-warning combo today is the weapon double-warning (logged as
 * received AND separately marked received in the priority list) — both
 * forcing, so wouldAdvanceBis already went false via the check one line
 * earlier. The ring and non-syncing refinements above mean "Already
 * received" is not ALWAYS forcing on its own, but neither non-forcing case
 * can reach two warnings (a ring row never carries a second warning kind,
 * and a non-syncing receipt is still just the one "Already received" line).
 * This branch exists for a future non-forcing warning kind that could stack
 * a second warning onto a forcing one.
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
    // Two-raid-ring refinement: don't force wouldAdvanceBis=false when the
    // candidate still has a second unfilled raid ring — they received ONE
    // ring but the other assign is still genuinely BiS-advancing.
    const stillNeedsRing = slot === 'ring' && entry.player.gear.some(
      (g) => (g.slot === 'ring1' || g.slot === 'ring2') && g.bisSource === 'raid' && !g.hasItem,
    );
    // Non-syncing-receipt refinement: a receipt only carries BiS signal when
    // it could have marked gear — tome/purchase and isExtra receipts never
    // sync (lootCoordination.ts:78), so the player REMAINS a needer despite
    // the log entry. Only a receipt that was actually gear-syncing forces
    // the flag, and only once the ring refinement above doesn't apply.
    const anySyncing = received.some((e) => (e.method === 'drop' || e.method === 'book') && !e.isExtra);
    if (anySyncing && !stillNeedsRing) wouldAdvanceBis = false;
  }

  if (slot === 'weapon') {
    // A missing row is NOT warned — every player's main job is an implicit
    // default weapon priority (WeaponPriorityList.tsx:1020-1027's `allJobs`
    // derivation); explicit rows are sparse addition/receipt records, so
    // absence carries no signal. Only an actual receipt (`wp.received`) does.
    const wp = (entry.player.weaponPriorities ?? []).find((w) => w.job === entry.player.job);
    if (wp?.received) {
      warnings.push('Weapon already marked received in the priority list');
      wouldAdvanceBis = false;
    }
  }

  return { reasons: [entry.reason], warnings, wouldAdvanceBis };
}

/**
 * Precondition: `explained` must be the priority-scope (needers-only) list,
 * already in rank order — index 0 is treated as the top-ranked candidate and
 * the rest as its rivals. A mixed pool (e.g. "all members") or an unordered
 * list yields meaningless results.
 */
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
