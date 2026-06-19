/**
 * Loot Recommendation Service
 *
 * Pure functions — no store imports. Callers pass in all needed data so this
 * module is straightforwardly testable and composable.
 *
 * Reuses existing priority utilities (priority.ts, lootCoordination.ts) for
 * base scoring and layers character registration context on top.
 */

import type {
  GearSlot,
  LootLogEntry,
  SnapshotPlayer,
  StaticCharacterRegistration,
  StaticSettings,
} from '../types';
import {
  getPrimaryRegistration,
  getRegistrationForJob,
} from './staticCharacterContextService';
import {
  getEnhancedPriorityForSlot,
  calculateAverageDrops,
} from './lootCoordination';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DropType =
  | 'direct_drop'
  | 'weapon_coffer'
  | 'upgrade_item'
  | 'book_page'
  | 'manual';

export interface LootDropInput {
  /** Gear slot being distributed (or 'ring' for unspecified ring) */
  slot: GearSlot | 'ring';
  dropType: DropType;
  /** For weapon coffers — job restriction (e.g. 'DRG', 'WHM') */
  weaponJob?: string;
  floor?: string;
  week: number;
}

/** A single candidate in the ranked list. */
export interface RankedCandidate {
  rosterPlayerId: string;
  characterRegistrationId: string | null;
  playerName: string;
  characterName: string | null;
  job: string | null;
  score: number;
  reasons: string[];
  warnings: string[];
  wouldAdvanceBis: boolean | 'unknown';
  priorityRank: number | null;
  alreadyReceivedRelevantLoot: boolean | 'unknown';
  source: 'character_registration' | 'player_fallback';
}

export interface LootRecommendation {
  recommendedRecipient: RankedCandidate | null;
  rankedCandidates: RankedCandidate[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
  sourceSummary: string;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Scoring weights — single config object so weights never scatter into components
// ---------------------------------------------------------------------------

export const LOOT_SCORING_WEIGHTS = {
  exactBisNeed: 60,        // character/job needs this exact BiS piece
  weaponPriorityFirst: 50, // weapon priority rank #1
  weaponPriorityTop3: 40,  // weapon priority rank #2-3
  mainCharacterTarget: 30, // registration roleInStatic = 'main' or isPrimary
  upgradeMatNeed: 20,      // needs upgrade material for BiS
  hasCharacterReg: 15,     // has reliable character registration
  alreadyComplete: -60,    // slot already marked hasItem
  alreadyReceivedLoot: -40, // loot log shows they already got this
  missingBisData: -30,     // no gear data for slot
  missingWeaponPriority: -20, // not in weapon priority list
  playerOnlyFallback: -10, // no character registration linked
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function effectiveGearSlot(slot: GearSlot | 'ring', player: SnapshotPlayer): GearSlot {
  if (slot !== 'ring') return slot;
  const gear = player.gear ?? [];
  const needsRing1 = gear.some(
    (g) => g.slot === 'ring1' && g.bisSource === 'raid' && !g.hasItem,
  );
  return needsRing1 ? 'ring1' : 'ring2';
}

function playerAlreadyReceivedSlot(
  playerId: string,
  slot: GearSlot | 'ring',
  lootLog: LootLogEntry[],
  weaponJob?: string,
): { received: boolean; weekNumber: number | null } {
  const matches = lootLog.filter((e) => {
    if (e.recipientPlayerId !== playerId) return false;
    if (slot === 'ring') {
      return e.itemSlot === 'ring' || e.itemSlot === 'ring1' || e.itemSlot === 'ring2';
    }
    if (slot === 'weapon' && weaponJob) {
      return e.itemSlot === 'weapon' && e.weaponJob === weaponJob;
    }
    return e.itemSlot === slot;
  });
  if (matches.length === 0) return { received: false, weekNumber: null };
  const earliest = matches.reduce((a, b) => (a.weekNumber < b.weekNumber ? a : b));
  return { received: true, weekNumber: earliest.weekNumber };
}

function resolveRegistration(
  regs: StaticCharacterRegistration[],
  player: SnapshotPlayer,
  drop: LootDropInput,
): StaticCharacterRegistration | null {
  if (regs.length === 0) return null;
  // For weapon coffers with a job restriction, prefer a registration for that job
  if (drop.dropType === 'weapon_coffer' && drop.weaponJob) {
    const jobReg = getRegistrationForJob(regs, drop.weaponJob);
    if (jobReg) return jobReg;
  }
  // Otherwise fall back to primary registration
  return getPrimaryRegistration(regs) ?? regs[0];
}

function resolveCharacterName(reg: StaticCharacterRegistration | null): string | null {
  if (!reg) return null;
  return reg.resolvedName ?? reg.manualCharacterName ?? null;
}

// ---------------------------------------------------------------------------
// Score a single candidate
// ---------------------------------------------------------------------------

function scoreWeaponCoffer(
  player: SnapshotPlayer,
  reg: StaticCharacterRegistration | null,
  drop: LootDropInput,
  lootLog: LootLogEntry[],
  weaponPriorityRank: number | null,
): { score: number; reasons: string[]; warnings: string[]; wouldAdvanceBis: boolean | 'unknown'; alreadyReceived: boolean | 'unknown' } {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Weapon priority rank
  if (weaponPriorityRank === 1) {
    score += LOOT_SCORING_WEIGHTS.weaponPriorityFirst;
    reasons.push('Weapon priority #1');
  } else if (weaponPriorityRank !== null && weaponPriorityRank <= 3) {
    score += LOOT_SCORING_WEIGHTS.weaponPriorityTop3;
    reasons.push(`Weapon priority #${weaponPriorityRank}`);
  } else if (weaponPriorityRank === null) {
    score += LOOT_SCORING_WEIGHTS.missingWeaponPriority;
    warnings.push('Not in weapon priority list');
  }

  // Check if weapon is already received in weapon priority list
  const weaponJob = drop.weaponJob ?? player.job;
  const wp = (player.weaponPriorities ?? []).find((w) => w.job === weaponJob);
  if (wp?.received) {
    score += LOOT_SCORING_WEIGHTS.alreadyReceivedLoot;
    warnings.push('Weapon already marked as received in priority list');
    return { score, reasons, warnings, wouldAdvanceBis: false, alreadyReceived: true };
  }

  // BiS weapon check
  const weaponGear = (player.gear ?? []).find((g) => g.slot === 'weapon');
  let wouldAdvanceBis: boolean | 'unknown' = 'unknown';
  if (!weaponGear) {
    score += LOOT_SCORING_WEIGHTS.missingBisData;
    warnings.push('No gear data for weapon slot');
  } else if (weaponGear.bisSource !== 'raid') {
    warnings.push('BiS weapon is not from savage raid');
  } else if (weaponGear.hasItem) {
    score += LOOT_SCORING_WEIGHTS.alreadyComplete;
    warnings.push('Weapon slot already completed');
    wouldAdvanceBis = false;
  } else {
    score += LOOT_SCORING_WEIGHTS.exactBisNeed;
    reasons.push('Still needs raid weapon for BiS');
    wouldAdvanceBis = true;
  }

  // Loot log history for weapon
  const { received, weekNumber } = playerAlreadyReceivedSlot(player.id, 'weapon', lootLog, weaponJob);
  if (received) {
    score += LOOT_SCORING_WEIGHTS.alreadyReceivedLoot;
    warnings.push(`Weapon logged in Week ${weekNumber}`);
    return { score, reasons, warnings, wouldAdvanceBis: false, alreadyReceived: true };
  }

  return { score, reasons, warnings, wouldAdvanceBis, alreadyReceived: false };
}

function scoreDirectDrop(
  player: SnapshotPlayer,
  drop: LootDropInput,
  lootLog: LootLogEntry[],
): { score: number; reasons: string[]; warnings: string[]; wouldAdvanceBis: boolean | 'unknown'; alreadyReceived: boolean | 'unknown' } {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const effectiveSlot = effectiveGearSlot(drop.slot, player);
  const gearStatus = (player.gear ?? []).find((g) => g.slot === effectiveSlot);

  let wouldAdvanceBis: boolean | 'unknown' = 'unknown';
  if (!gearStatus) {
    score += LOOT_SCORING_WEIGHTS.missingBisData;
    warnings.push(`No BiS data for ${effectiveSlot}`);
  } else if (gearStatus.bisSource !== 'raid') {
    warnings.push(`BiS for ${effectiveSlot} is not from savage`);
  } else if (gearStatus.hasItem) {
    score += LOOT_SCORING_WEIGHTS.alreadyComplete;
    warnings.push(`${effectiveSlot} slot already completed`);
    wouldAdvanceBis = false;
  } else {
    score += LOOT_SCORING_WEIGHTS.exactBisNeed;
    reasons.push(`Needs ${effectiveSlot} for BiS`);
    wouldAdvanceBis = true;
  }

  // Loot log history for this slot
  const { received, weekNumber } = playerAlreadyReceivedSlot(player.id, drop.slot, lootLog);
  if (received) {
    score += LOOT_SCORING_WEIGHTS.alreadyReceivedLoot;
    warnings.push(`Already received ${effectiveSlot} in Week ${weekNumber}`);
    return { score, reasons, warnings, wouldAdvanceBis: wouldAdvanceBis === true ? false : wouldAdvanceBis, alreadyReceived: true };
  }

  return { score, reasons, warnings, wouldAdvanceBis, alreadyReceived: false };
}

// ---------------------------------------------------------------------------
// Build weapon priority rank map from SnapshotPlayer data
// ---------------------------------------------------------------------------

function buildWeaponPriorityRankMap(
  players: SnapshotPlayer[],
  weaponJob?: string,
): Map<string, number> {
  // Collect players that have weapon priority entries for this job
  type Entry = { playerId: string; order: number; received: boolean };
  const entries: Entry[] = [];

  for (const p of players) {
    const priorities = p.weaponPriorities ?? [];
    const wp = weaponJob
      ? priorities.find((w) => w.job === weaponJob)
      : priorities[0];
    if (wp && !wp.received) {
      entries.push({ playerId: p.id, order: wp.order ?? priorities.indexOf(wp), received: false });
    }
  }

  // Sort by order ascending → rank 1 = lowest order (highest priority)
  entries.sort((a, b) => a.order - b.order);
  const map = new Map<string, number>();
  entries.forEach((e, i) => map.set(e.playerId, i + 1));
  return map;
}

// ---------------------------------------------------------------------------
// Main ranking function
// ---------------------------------------------------------------------------

/**
 * Rank all configured (non-substitute) players as candidates for a loot drop.
 *
 * Returns candidates sorted by descending score. The caller should select
 * the top result as the recommendation, with the remainder as alternates.
 */
export function rankLootCandidates(
  drop: LootDropInput,
  players: SnapshotPlayer[],
  settings: StaticSettings,
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
  lootLog: LootLogEntry[],
  currentWeek: number,
): RankedCandidate[] {
  // Eligible = configured, non-substitute players
  const eligible = players.filter((p) => p.configured && !p.isSubstitute);
  if (eligible.length === 0) return [];

  const playerIds = eligible.map((p) => p.id);
  const averageDrops = calculateAverageDrops(playerIds, lootLog);

  // Build base priority rank map from existing priority system
  let basePriorityRankMap = new Map<string, number>();
  let weaponPriorityRankMap = new Map<string, number>();

  if (drop.dropType === 'weapon_coffer') {
    weaponPriorityRankMap = buildWeaponPriorityRankMap(eligible, drop.weaponJob);
  } else if (drop.dropType === 'direct_drop' || drop.dropType === 'manual') {
    // Use existing enhanced priority to get base ranking
    const enhanced = getEnhancedPriorityForSlot(eligible, drop.slot, settings, lootLog, currentWeek);
    enhanced.forEach((e, idx) => basePriorityRankMap.set(e.player.id, idx + 1));
  }

  const candidates: RankedCandidate[] = eligible.map((player) => {
    const regs = registrationsByPlayer[player.id] ?? [];
    const reg = resolveRegistration(regs, player, drop);
    const characterName = resolveCharacterName(reg);
    const hasReg = reg !== null;
    const isMain = hasReg && regs.some((r) => r.roleInStatic === 'main');

    let score = 0;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // ── Registration context ──
    if (hasReg) {
      score += LOOT_SCORING_WEIGHTS.hasCharacterReg;
      if (isMain) {
        score += LOOT_SCORING_WEIGHTS.mainCharacterTarget;
        reasons.push('Main character target');
      }
    } else {
      score += LOOT_SCORING_WEIGHTS.playerOnlyFallback;
      warnings.push('No registered character — using player-level data');
    }

    // ── Drop-type specific scoring ──
    let wouldAdvanceBis: boolean | 'unknown' = 'unknown';
    let alreadyReceived: boolean | 'unknown' = 'unknown';
    let priorityRank: number | null = null;

    if (drop.dropType === 'weapon_coffer') {
      priorityRank = weaponPriorityRankMap.get(player.id) ?? null;
      const result = scoreWeaponCoffer(player, reg, drop, lootLog, priorityRank);
      score += result.score;
      reasons.push(...result.reasons);
      warnings.push(...result.warnings);
      wouldAdvanceBis = result.wouldAdvanceBis;
      alreadyReceived = result.alreadyReceived;
    } else {
      priorityRank = basePriorityRankMap.get(player.id) ?? null;
      // Incorporate enhanced fairness score as a tiebreaker addend
      const enhancedEntries = getEnhancedPriorityForSlot(eligible, drop.slot, settings, lootLog, currentWeek);
      const myEntry = enhancedEntries.find((e) => e.player.id === player.id);
      if (myEntry) {
        // Scale enhanced score to a smaller contribution so it doesn't overwhelm the character bonuses
        score += myEntry.enhancedScore * 0.1;
      }
      const result = scoreDirectDrop(player, drop, lootLog);
      score += result.score;
      reasons.push(...result.reasons);
      warnings.push(...result.warnings);
      wouldAdvanceBis = result.wouldAdvanceBis;
      alreadyReceived = result.alreadyReceived;
    }

    return {
      rosterPlayerId: player.id,
      characterRegistrationId: reg?.id ?? null,
      playerName: player.name,
      characterName,
      job: player.job,
      score,
      reasons,
      warnings,
      wouldAdvanceBis,
      priorityRank,
      alreadyReceivedRelevantLoot: alreadyReceived,
      source: hasReg ? 'character_registration' : 'player_fallback',
    };
  });

  // Sort by descending score, then by player name as stable tiebreaker
  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.playerName.localeCompare(b.playerName);
  });
}

// ---------------------------------------------------------------------------
// Confidence and explanation
// ---------------------------------------------------------------------------

function computeConfidence(
  candidates: RankedCandidate[],
  drop: LootDropInput,
): 'high' | 'medium' | 'low' {
  if (candidates.length === 0) return 'low';
  const top = candidates[0];
  const second = candidates[1];

  // Low confidence if top candidate already received loot or slot is complete
  if (top.alreadyReceivedRelevantLoot === true) return 'low';
  if (top.wouldAdvanceBis === false) return 'low';
  // Low if no registration data at all
  if (candidates.every((c) => c.source === 'player_fallback')) return 'low';
  // Low if top has warnings (missing BiS data, etc.)
  if (top.warnings.length > 1) return 'low';

  // High confidence: top candidate clearly leads
  const scoreDelta = second ? top.score - second.score : top.score;
  if (scoreDelta >= 40 && top.wouldAdvanceBis === true && top.warnings.length === 0) return 'high';
  if (drop.dropType === 'weapon_coffer' && top.priorityRank === 1 && !top.warnings.length) return 'high';

  return 'medium';
}

function buildExplanation(top: RankedCandidate, drop: LootDropInput): string {
  const charLabel = top.characterName
    ? `${top.playerName} / ${top.characterName}`
    : top.playerName;

  if (top.reasons.length === 0 && top.warnings.length > 0) {
    return `${charLabel}: needs review — ${top.warnings[0]}`;
  }

  const reasonText = top.reasons.slice(0, 2).join(' and ');
  return `Recommended: ${charLabel} — ${reasonText || 'see details'}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Compute a full loot recommendation for a given drop.
 *
 * Returns ranked candidates, overall confidence, and a human-readable
 * explanation. Missing/stale data lowers confidence rather than crashing.
 */
export function recommendRecipientForDrop(
  drop: LootDropInput,
  players: SnapshotPlayer[],
  settings: StaticSettings,
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
  lootLog: LootLogEntry[],
  currentWeek: number,
): LootRecommendation {
  const rankedCandidates = rankLootCandidates(
    drop,
    players,
    settings,
    registrationsByPlayer,
    lootLog,
    currentWeek,
  );

  const globalWarnings: string[] = [];
  const hasAnyReg = Object.values(registrationsByPlayer).some((r) => r.length > 0);
  if (!hasAnyReg) {
    globalWarnings.push('No character registrations found — link characters in Roster → Characters for better recommendations');
  }

  if (rankedCandidates.length === 0) {
    return {
      recommendedRecipient: null,
      rankedCandidates: [],
      warnings: ['No eligible players found'],
      confidence: 'low',
      sourceSummary: 'No data',
      explanation: 'No eligible players to recommend',
    };
  }

  const top = rankedCandidates[0];
  const confidence = computeConfidence(rankedCandidates, drop);
  const explanation = buildExplanation(top, drop);

  const sourceTypes = new Set(rankedCandidates.map((c) => c.source));
  const sourceSummary = sourceTypes.has('character_registration')
    ? 'Character registrations + priority data'
    : 'Player-level priority data only';

  return {
    recommendedRecipient: confidence !== 'low' ? top : null,
    rankedCandidates,
    warnings: globalWarnings,
    confidence,
    sourceSummary,
    explanation,
  };
}
