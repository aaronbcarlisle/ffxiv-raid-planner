import type {
  SnapshotPlayer,
  SplitClearAssignment,
  SplitCharacterCandidate,
  SplitLootTarget,
  SplitRunSlot,
} from '../types';
import {
  computeCharacterSourceSummary,
  selectBestRunPair,
} from './splitClearScoringService';

// ── Public types ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DraftPlayerAssignment {
  playerId: string;
  // Character link IDs — set when Player Hub characters are available
  runACharacterLinkId: string | null;
  runBCharacterLinkId: string | null;
  // Resolved display info for the draft review panel
  runACharacterName: string | null;
  runACharacterWorld: string | null;
  runAIsMain: boolean;
  runALastSyncedAt: string | null;
  runBCharacterName: string | null;
  runBCharacterWorld: string | null;
  runBIsMain: boolean;
  runBLastSyncedAt: string | null;
  // Legacy run-slot labels ('main' | 'alt' | null) kept for backward compat
  runACharacter: SplitRunSlot;
  runBCharacter: SplitRunSlot;
  // Loot
  lootTarget: SplitLootTarget;
  lootTargetJob: string | null;
  // Scoring
  reasons: string[];
  score: number;
}

/** What data sources the draft was built from. */
export interface DraftSourceSummary {
  rosterCount: number;
  linkedCount: number;
  altCount: number;
  priorityCount: number;
  recentSyncCount: number;
  staleSyncCount: number;
  /** @deprecated use linkedCount — kept so EmptyState chips still render */
  altCount_legacy: number;
  lootLogUsed: boolean;
  pluginUsed: boolean;
}

export interface SplitClearDraft {
  generatedAt: string;
  assignments: DraftPlayerAssignment[];
  sourceSummary: DraftSourceSummary;
  confidence: ConfidenceLevel;
  /** Players in the draft with at least one unresolved run character. */
  issueCount: number;
}

/** Counts of fields that will change when the draft is applied. */
export interface DraftChangeSummary {
  totalAffected: number;
  runAssignments: number;
  characterLinksSet: number;
  lootTargetsChanged: number;
  /** @deprecated retained for older code paths */
  characterNamesSet: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeConfidence(
  linkedCount: number,
  altCount: number,
  priorityCount: number,
  rosterCount: number,
): ConfidenceLevel {
  if (rosterCount === 0) return 'low';
  const linkedRatio = linkedCount / rosterCount;
  const altRatio = altCount / rosterCount;
  const priorityRatio = priorityCount / rosterCount;
  if (linkedRatio >= 0.75 && altRatio >= 0.5 && priorityRatio >= 0.5) return 'high';
  if (linkedRatio >= 0.5 || altRatio >= 0.25 || priorityRatio > 0) return 'medium';
  return 'low';
}

// ── Exported functions ─────────────────────────────────────────────────────────

/**
 * Maps a player's weapon priority state to a suggested loot target.
 */
export function priorityToSplitLootTarget(player: SnapshotPlayer): {
  lootTarget: SplitLootTarget;
  lootTargetJob: string | null;
  reason: string;
} {
  if (!player.weaponPriorities?.length) {
    return { lootTarget: 'normal', lootTargetJob: null, reason: 'Priority missing — loot target left normal' };
  }

  const jobEntry = player.weaponPriorities.find(
    wp => wp.job.toUpperCase() === (player.job ?? '').toUpperCase(),
  );

  if (!jobEntry) {
    return {
      lootTarget: 'normal',
      lootTargetJob: null,
      reason: 'No weapon priority entry for current job',
    };
  }

  if (jobEntry.received) {
    return { lootTarget: 'normal', lootTargetJob: null, reason: 'Weapon already received' };
  }

  return {
    lootTarget: 'funnel_main',
    lootTargetJob: null,
    reason: 'Weapon not yet received — funneling to main',
  };
}

/**
 * Builds a transient draft from roster players, their linked characters, and
 * existing assignments.  Linked Player Hub characters are used when available;
 * legacy text fields serve as the fallback.
 *
 * Sources used (in priority order):
 *   1. Player Hub linked characters (PlayerCharacter via user_id → profile)
 *   2. Lodestone identity on SnapshotPlayer (lodestoneName / lodestoneServer)
 *   3. Existing saved assignment text fields
 *   4. Weapon priorities → loot target
 *
 * The draft is NOT persisted until the user clicks "Apply draft".
 */
export function buildSplitClearDraft(
  players: SnapshotPlayer[],
  existingAssignments: SplitClearAssignment[],
  playerCharacters: Record<string, SplitCharacterCandidate[]> = {},
): SplitClearDraft {
  const existingMap = new Map(existingAssignments.map(a => [a.snapshotPlayerId, a]));

  // Run-balance tracking: alternate preferMainInRunA across players
  let mainInRunACount = 0;
  let mainInRunBCount = 0;

  const assignments: DraftPlayerAssignment[] = players.map(player => {
    const existing = existingMap.get(player.id);
    const loot = priorityToSplitLootTarget(player);
    const candidates = playerCharacters[player.id] ?? [];

    // Determine whether to put the main in Run A for this player (for balance)
    const preferMainInRunA = mainInRunACount <= mainInRunBCount;

    const hasWeaponPriority = (player.weaponPriorities?.length ?? 0) > 0;
    const weaponEntry = player.weaponPriorities?.find(
      wp => wp.job.toUpperCase() === (player.job ?? '').toUpperCase()
    );
    const weaponReceived = weaponEntry?.received ?? false;

    // ── Character selection ────────────────────────────────────────────────────

    let runACharacterLinkId: string | null = null;
    let runACharacterName: string | null = null;
    let runACharacterWorld: string | null = null;
    let runAIsMain = false;
    let runALastSyncedAt: string | null = null;

    let runBCharacterLinkId: string | null = null;
    let runBCharacterName: string | null = null;
    let runBCharacterWorld: string | null = null;
    let runBIsMain = false;
    let runBLastSyncedAt: string | null = null;

    let runASlot: SplitRunSlot = null;
    let runBSlot: SplitRunSlot = null;
    const reasons: string[] = [];
    let pairScore = 0;

    if (candidates.length > 0) {
      // Use linked Player Hub characters
      const pair = selectBestRunPair(candidates, hasWeaponPriority, weaponReceived, preferMainInRunA);
      pairScore = pair.score;
      reasons.push(...pair.reasons);

      if (pair.runA) {
        runACharacterLinkId = pair.runALinkId;
        runACharacterName = pair.runA.name;
        runACharacterWorld = pair.runA.server;
        runAIsMain = pair.runAIsMain;
        runALastSyncedAt = pair.runA.lastSyncedAt;
        runASlot = pair.runA.isMain ? 'main' : 'alt';
      }
      if (pair.runB) {
        runBCharacterLinkId = pair.runBLinkId;
        runBCharacterName = pair.runB.name;
        runBCharacterWorld = pair.runB.server;
        runBIsMain = pair.runBIsMain;
        runBLastSyncedAt = pair.runB.lastSyncedAt;
        runBSlot = pair.runB.isMain ? 'main' : 'alt';
      }

      if (pair.runA?.isMain) mainInRunACount++;
      else if (pair.runB?.isMain) mainInRunBCount++;
    } else {
      // Fallback: Lodestone identity → existing text fields
      if (player.lodestoneName) {
        runACharacterName = player.lodestoneName;
        runACharacterWorld = player.lodestoneServer ?? null;
        runASlot = 'main';
        reasons.push('Main character from linked Lodestone identity');
      } else if (existing?.mainCharacterName) {
        runACharacterName = existing.mainCharacterName;
        runACharacterWorld = existing.mainCharacterWorld ?? null;
        runASlot = 'main';
        reasons.push('Main character from existing assignment');
      } else {
        reasons.push('No main character data — fill in manually');
      }

      if (existing?.altCharacterName) {
        runBCharacterName = existing.altCharacterName;
        runBCharacterWorld = existing.altCharacterWorld ?? null;
        runBSlot = 'alt';
        reasons.push('Alt character from existing assignment');
      } else {
        reasons.push('No alt character set — link in Player Hub or enter manually');
      }

      if (runASlot === 'main') mainInRunACount++;
    }

    reasons.push(loot.reason);

    return {
      playerId: player.id,
      runACharacterLinkId,
      runBCharacterLinkId,
      runACharacterName,
      runACharacterWorld,
      runAIsMain,
      runALastSyncedAt,
      runBCharacterName,
      runBCharacterWorld,
      runBIsMain,
      runBLastSyncedAt,
      runACharacter: runASlot,
      runBCharacter: runBSlot,
      lootTarget: loot.lootTarget,
      lootTargetJob: loot.lootTargetJob,
      reasons,
      score: pairScore,
    };
  });

  const sourceSummary_ = computeCharacterSourceSummary(
    players.map(p => p.id),
    playerCharacters,
  );

  const priorityCount = players.filter(p => (p.weaponPriorities?.length ?? 0) > 0).length;

  const sourceSummary: DraftSourceSummary = {
    rosterCount: players.length,
    linkedCount: sourceSummary_.linkedCount,
    altCount: sourceSummary_.altCount,
    priorityCount,
    recentSyncCount: sourceSummary_.recentSyncCount,
    staleSyncCount: sourceSummary_.staleSyncCount,
    altCount_legacy: sourceSummary_.altCount,
    lootLogUsed: false,
    pluginUsed: false,
  };

  const confidence = computeConfidence(
    sourceSummary_.linkedCount,
    sourceSummary_.altCount,
    priorityCount,
    players.length,
  );

  const issueCount = assignments.filter(
    a => !a.runACharacterName || !a.runBCharacterName,
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    assignments,
    sourceSummary,
    confidence,
    issueCount,
  };
}

/**
 * Computes how many fields will change when the given draft is applied on top
 * of the existing saved assignments.  Used for the apply-bar confirmation copy.
 */
export function getSplitChangeSummary(
  draft: SplitClearDraft,
  existingAssignments: SplitClearAssignment[],
): DraftChangeSummary {
  const existingMap = new Map(existingAssignments.map(a => [a.snapshotPlayerId, a]));
  let runAssignments = 0;
  let characterLinksSet = 0;
  let lootTargetsChanged = 0;
  let characterNamesSet = 0;
  let totalAffected = 0;

  for (const suggestion of draft.assignments) {
    const existing = existingMap.get(suggestion.playerId);
    let changed = false;

    if (suggestion.runACharacter !== (existing?.runACharacter ?? null)) {
      runAssignments++;
      changed = true;
    }
    if (suggestion.runBCharacter !== (existing?.runBCharacter ?? null)) {
      runAssignments++;
      changed = true;
    }
    if (suggestion.runACharacterLinkId !== (existing?.runACharacterLinkId ?? null)) {
      characterLinksSet++;
      changed = true;
    }
    if (suggestion.runBCharacterLinkId !== (existing?.runBCharacterLinkId ?? null)) {
      characterLinksSet++;
      changed = true;
    }
    if (suggestion.lootTarget !== (existing?.lootTarget ?? 'normal')) {
      lootTargetsChanged++;
      changed = true;
    }
    if (
      suggestion.runACharacterName !== null &&
      suggestion.runACharacterName !== (existing?.mainCharacterName ?? null)
    ) {
      characterNamesSet++;
      changed = true;
    }
    if (changed) totalAffected++;
  }

  return { totalAffected, runAssignments, characterLinksSet, lootTargetsChanged, characterNamesSet };
}
