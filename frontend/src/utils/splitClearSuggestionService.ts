import type { SnapshotPlayer, SplitClearAssignment, SplitLootTarget, SplitRunSlot } from '../types';

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

export interface SplitClearDraft {
  generatedAt: string;
  assignments: DraftPlayerAssignment[];
}

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

  return { generatedAt: new Date().toISOString(), assignments };
}
