import type { SnapshotPlayer, SplitClearAssignment, SplitLootTarget, SplitRunSlot } from '../types';

// ── Public types ───────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface DraftPlayerAssignment {
  playerId: string;
  mainCharacterName: string | null;
  mainCharacterWorld: string | null;
  altCharacterName: string | null;
  altCharacterWorld: string | null;
  runACharacter: SplitRunSlot;
  runBCharacter: SplitRunSlot;
  lootTarget: SplitLootTarget;
  lootTargetJob: string | null;
  reasons: string[];
}

/** What data sources the draft was built from. */
export interface DraftSourceSummary {
  rosterCount: number;
  altCount: number;
  priorityCount: number;
  lootLogUsed: boolean;
  pluginUsed: boolean;
}

export interface SplitClearDraft {
  generatedAt: string;
  assignments: DraftPlayerAssignment[];
  sourceSummary: DraftSourceSummary;
  confidence: ConfidenceLevel;
  /** Players in the draft with at least one incomplete field (main or alt missing). */
  issueCount: number;
}

/** Counts of fields that will change when the draft is applied. */
export interface DraftChangeSummary {
  totalAffected: number;
  runAssignments: number;
  lootTargetsChanged: number;
  characterNamesSet: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeConfidence(altCount: number, priorityCount: number, rosterCount: number): ConfidenceLevel {
  if (rosterCount === 0) return 'low';
  const altRatio = altCount / rosterCount;
  const priorityRatio = priorityCount / rosterCount;
  if (altRatio >= 0.75 && priorityRatio >= 0.5) return 'high';
  if (altRatio >= 0.5 || priorityRatio > 0) return 'medium';
  return 'low';
}

// ── Exported functions ─────────────────────────────────────────────────────────

/**
 * Maps a player's weapon priority state to a suggested loot target.
 *
 * Logic: if the player's current job has an entry in weaponPriorities and the
 * weapon has not yet been received, funnel loot to the main character so the
 * weapon drops there. Otherwise use normal loot distribution.
 */
export function priorityToSplitLootTarget(player: SnapshotPlayer): {
  lootTarget: SplitLootTarget;
  lootTargetJob: string | null;
  reason: string;
} {
  if (!player.weaponPriorities?.length) {
    return { lootTarget: 'normal', lootTargetJob: null, reason: 'No weapon priority data' };
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
 * Builds a transient draft from roster players and existing assignments.
 *
 * Sources used (in priority order):
 *   - Lodestone identity (lodestoneName / lodestoneServer) → main character
 *   - Existing saved assignment → main/alt characters
 *   - Weapon priorities → loot target
 *
 * The draft is NOT persisted until the user clicks "Apply draft".
 */
export function buildSplitClearDraft(
  players: SnapshotPlayer[],
  existingAssignments: SplitClearAssignment[],
): SplitClearDraft {
  const existingMap = new Map(existingAssignments.map(a => [a.snapshotPlayerId, a]));

  const assignments: DraftPlayerAssignment[] = players.map(player => {
    const existing = existingMap.get(player.id);
    const loot = priorityToSplitLootTarget(player);
    const reasons: string[] = [];

    // Main character: prefer lodestone link, then fall back to existing assignment.
    let mainCharacterName: string | null = null;
    let mainCharacterWorld: string | null = null;

    if (player.lodestoneName) {
      mainCharacterName = player.lodestoneName;
      mainCharacterWorld = player.lodestoneServer ?? null;
      reasons.push('Main character from linked lodestone character');
    } else if (existing?.mainCharacterName) {
      mainCharacterName = existing.mainCharacterName;
      mainCharacterWorld = existing.mainCharacterWorld ?? null;
      reasons.push('Main character from existing assignment');
    } else {
      reasons.push('No main character data — fill in manually');
    }

    // Alt character: only available from an existing assignment (no alt-linkage system yet).
    const altCharacterName = existing?.altCharacterName ?? null;
    const altCharacterWorld = existing?.altCharacterWorld ?? null;
    if (altCharacterName) {
      reasons.push('Alt character from existing assignment');
    } else {
      reasons.push('No alt character set — assign manually');
    }

    // Run assignments: main → A, alt → B when the respective character is known.
    const runACharacter: SplitRunSlot = mainCharacterName ? 'main' : null;
    const runBCharacter: SplitRunSlot = altCharacterName ? 'alt' : null;

    reasons.push(loot.reason);

    return {
      playerId: player.id,
      mainCharacterName,
      mainCharacterWorld,
      altCharacterName,
      altCharacterWorld,
      runACharacter,
      runBCharacter,
      lootTarget: loot.lootTarget,
      lootTargetJob: loot.lootTargetJob,
      reasons,
    };
  });

  const altCount = assignments.filter(a => a.altCharacterName !== null).length;
  const priorityCount = players.filter(p => (p.weaponPriorities?.length ?? 0) > 0).length;

  const sourceSummary: DraftSourceSummary = {
    rosterCount: players.length,
    altCount,
    priorityCount,
    lootLogUsed: false,
    pluginUsed: false,
  };

  const confidence = computeConfidence(altCount, priorityCount, players.length);
  const issueCount = assignments.filter(a => !a.mainCharacterName || !a.altCharacterName).length;

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
 * of the existing saved assignments. Used for the "apply" confirmation copy.
 */
export function getSplitChangeSummary(
  draft: SplitClearDraft,
  existingAssignments: SplitClearAssignment[],
): DraftChangeSummary {
  const existingMap = new Map(existingAssignments.map(a => [a.snapshotPlayerId, a]));
  let runAssignments = 0;
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
    if (suggestion.lootTarget !== (existing?.lootTarget ?? 'normal')) {
      lootTargetsChanged++;
      changed = true;
    }
    if (
      suggestion.mainCharacterName !== null &&
      suggestion.mainCharacterName !== (existing?.mainCharacterName ?? null)
    ) {
      characterNamesSet++;
      changed = true;
    }
    if (changed) totalAffected++;
  }

  return { totalAffected, runAssignments, lootTargetsChanged, characterNamesSet };
}
