/**
 * Split Clear Scoring Service
 *
 * Deterministic, testable functions that select the best Run A / Run B character
 * pair for a roster player.  All weights live in one config object.
 */

import type { SplitCharacterCandidate } from '../types';

// ── Scoring weights ────────────────────────────────────────────────────────────

export const SPLIT_SCORING_WEIGHTS = {
  DIFFERENT_CHARACTERS: 40,
  MAIN_PLUS_ALT: 30,
  JOB_MATCH: 20,
  WEAPON_PRIORITY: 20,
  RECENT_SYNC: 10,
  ROLE_BALANCE: 10,
  SAME_CHARACTER_PENALTY: -50,
  NO_ALT_PENALTY: -30,
  MISSING_PRIORITY_PENALTY: -20,
  STALE_SYNC_PENALTY: -15,
  MANUAL_ONLY_PENALTY: -10,
} as const;

const RECENT_MS = 2 * 24 * 60 * 60 * 1000;  // 2 days
const STALE_MS  = 7 * 24 * 60 * 60 * 1000;  // 7 days

// ── Sync helpers ───────────────────────────────────────────────────────────────

export function isSyncRecent(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - new Date(lastSyncedAt).getTime() < RECENT_MS;
}

export function isSyncStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > STALE_MS;
}

export function formatSyncLabel(lastSyncedAt: string | null, syncSource: string | null): string {
  if (!lastSyncedAt) return 'No sync';
  const diffMs = Date.now() - new Date(lastSyncedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const prefix = syncSource === 'plugin' ? 'Plugin' : 'Synced';
  if (diffHours < 1) return `${prefix} recently`;
  if (diffHours < 24) return `${prefix} ${diffHours}h ago`;
  return `${prefix} ${diffDays}d ago`;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

export interface RunPairScore {
  score: number;
  reasons: string[];
}

export function scoreRunPair(
  candidates: SplitCharacterCandidate[],
  runA: SplitCharacterCandidate | null,
  runB: SplitCharacterCandidate | null,
  hasWeaponPriority: boolean,
  weaponReceived: boolean,
): RunPairScore {
  const reasons: string[] = [];
  let score = 0;

  if (candidates.length === 0) {
    reasons.push('No linked characters — manual entry required');
    score += SPLIT_SCORING_WEIGHTS.MANUAL_ONLY_PENALTY;
    return { score, reasons };
  }

  if (candidates.length === 1) {
    score += SPLIT_SCORING_WEIGHTS.NO_ALT_PENALTY;
    reasons.push('Only one linked character found');
    return { score, reasons };
  }

  if (!runA || !runB) return { score: 0, reasons: ['No pair selected'] };

  if (runA.id === runB.id) {
    score += SPLIT_SCORING_WEIGHTS.SAME_CHARACTER_PENALTY;
    reasons.push('Same character assigned to both runs');
    return { score, reasons };
  }

  score += SPLIT_SCORING_WEIGHTS.DIFFERENT_CHARACTERS;
  reasons.push('Uses different characters for Run A and Run B');

  if (runA.isMain !== runB.isMain) {
    score += SPLIT_SCORING_WEIGHTS.MAIN_PLUS_ALT;
    const aLabel = runA.isMain ? 'Main' : 'Alt';
    const bLabel = runB.isMain ? 'Main' : 'Alt';
    reasons.push(`${aLabel} in Run A, ${bLabel} in Run B`);
  }

  if (hasWeaponPriority && !weaponReceived) {
    score += SPLIT_SCORING_WEIGHTS.WEAPON_PRIORITY;
    reasons.push('Weapon priority: main assigned to funneled run');
  }

  if (isSyncRecent(runA.lastSyncedAt) || isSyncRecent(runB.lastSyncedAt)) {
    score += SPLIT_SCORING_WEIGHTS.RECENT_SYNC;
    reasons.push('Character data recently synced');
  } else if (isSyncStale(runA.lastSyncedAt) || isSyncStale(runB.lastSyncedAt)) {
    score += SPLIT_SCORING_WEIGHTS.STALE_SYNC_PENALTY;
    reasons.push('One or more characters have stale sync data');
  }

  if (!hasWeaponPriority) {
    score += SPLIT_SCORING_WEIGHTS.MISSING_PRIORITY_PENALTY;
    reasons.push('Priority missing — loot target left normal');
  }

  return { score, reasons };
}

// ── Selection ──────────────────────────────────────────────────────────────────

export interface RunPairSelection {
  runA: SplitCharacterCandidate | null;
  runALinkId: string | null;
  runAIsMain: boolean;
  runB: SplitCharacterCandidate | null;
  runBLinkId: string | null;
  runBIsMain: boolean;
  score: number;
  reasons: string[];
}

/**
 * Choose the best Run A / Run B character pair for a player.
 *
 * @param preferMainInRunA  When true the main character goes to Run A; when
 *   false it goes to Run B.  Callers alternate this flag across players to
 *   produce a balanced split (roughly half mains in each run).
 */
export function selectBestRunPair(
  candidates: SplitCharacterCandidate[],
  hasWeaponPriority: boolean,
  weaponReceived: boolean,
  preferMainInRunA: boolean,
): RunPairSelection {
  const empty = (reasons: string[]): RunPairSelection => ({
    runA: null, runALinkId: null, runAIsMain: false,
    runB: null, runBLinkId: null, runBIsMain: false,
    score: 0, reasons,
  });

  if (candidates.length === 0) {
    return { ...empty(['No linked characters — manual entry required']), score: SPLIT_SCORING_WEIGHTS.MANUAL_ONLY_PENALTY };
  }

  const main = candidates.find(c => c.isMain) ?? candidates[0];
  const alts = candidates.filter(c => !c.isMain);
  const bestAlt = alts[0] ?? null;

  if (!bestAlt) {
    // Only one character — assign to Run A, leave Run B empty
    return {
      runA: main, runALinkId: main.id, runAIsMain: main.isMain,
      runB: null, runBLinkId: null, runBIsMain: false,
      score: SPLIT_SCORING_WEIGHTS.NO_ALT_PENALTY,
      reasons: ['Only one linked character found'],
    };
  }

  // Alternate: half the roster sends main to Run A, half to Run B
  const runA = preferMainInRunA ? main : bestAlt;
  const runB = preferMainInRunA ? bestAlt : main;

  const { score, reasons } = scoreRunPair(candidates, runA, runB, hasWeaponPriority, weaponReceived);

  return {
    runA, runALinkId: runA.id, runAIsMain: runA.isMain,
    runB, runBLinkId: runB.id, runBIsMain: runB.isMain,
    score, reasons,
  };
}

// ── Source summary helpers ─────────────────────────────────────────────────────

export interface CharacterSourceSummary {
  rosterCount: number;
  linkedCount: number;
  altCount: number;
  recentSyncCount: number;
  staleSyncCount: number;
  manualCount: number;
}

export function computeCharacterSourceSummary(
  playerIds: string[],
  playerCharacters: Record<string, SplitCharacterCandidate[]> = {},
): CharacterSourceSummary {
  let linkedCount = 0;
  let altCount = 0;
  let recentSyncCount = 0;
  let staleSyncCount = 0;
  let manualCount = 0;

  for (const pid of playerIds) {
    const chars = playerCharacters[pid] ?? [];
    if (chars.length === 0) {
      manualCount++;
      continue;
    }
    linkedCount++;
    if (chars.some(c => !c.isMain)) altCount++;
    const anyRecent = chars.some(c => isSyncRecent(c.lastSyncedAt));
    const anyStale  = chars.every(c => isSyncStale(c.lastSyncedAt));
    if (anyRecent) recentSyncCount++;
    else if (anyStale) staleSyncCount++;
  }

  return {
    rosterCount: playerIds.length,
    linkedCount,
    altCount,
    recentSyncCount,
    staleSyncCount,
    manualCount,
  };
}
