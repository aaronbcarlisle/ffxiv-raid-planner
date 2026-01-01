/**
 * Weapon Priority Calculation
 *
 * Functions for calculating weapon priority based on:
 * - Player's weapon priority list position (lower index = higher priority)
 * - Role priority (melee > ranged > caster > tank > healer)
 * - Main job vs off-job
 */

import type { SnapshotPlayer, StaticSettings } from '../types';

export interface WeaponPriorityEntry {
  player: SnapshotPlayer;
  job: string;
  rank: number; // Position in player's priority list (0-based)
  isMainJob: boolean;
  received: boolean;
  score: number; // Overall priority score (higher = higher priority)
}

/**
 * Calculate weapon priority for a specific job
 * Returns list of players who want this weapon, sorted by priority (highest first)
 *
 * Players are included if:
 * 1. They have this job in their explicit weapon priorities, OR
 * 2. This is their main job (implicit priority)
 */
export function getWeaponPriorityForJob(
  players: SnapshotPlayer[],
  job: string,
  settings: StaticSettings
): WeaponPriorityEntry[] {
  const entries: WeaponPriorityEntry[] = [];

  for (const player of players) {
    // Find this job in player's weapon priorities
    const priorityIndex = player.weaponPriorities?.findIndex((wp) => wp.job === job);
    const hasExplicitPriority = priorityIndex !== undefined && priorityIndex !== -1;

    // Check if this is the player's main job (implicit priority)
    const isMainJob = player.job === job;

    if (!hasExplicitPriority && !isMainJob) {
      continue; // Player doesn't want this weapon
    }

    // Check if already received
    if (hasExplicitPriority) {
      const weaponPriority = player.weaponPriorities![priorityIndex];
      if (weaponPriority.received) {
        continue; // Player already received this weapon
      }
    }

    // Check if player already has the weapon (via gear tracking)
    const hasWeapon = player.gear?.find((g) => g.slot === 'weapon')?.hasItem;
    if (isMainJob && !hasExplicitPriority && hasWeapon) {
      continue; // Main job weapon already acquired
    }

    // Calculate role score (from loot priority settings)
    const roleIndex = settings.lootPriority.indexOf(player.role);
    const roleScore = roleIndex === -1 ? 0 : (5 - roleIndex) * 100;

    // Calculate rank score (lower rank = higher score)
    // For main job without explicit priority, treat as rank 0 (top priority)
    // Rank 0 (first) = 1000, Rank 1 = 900, Rank 2 = 800, etc.
    const effectiveRank = hasExplicitPriority ? priorityIndex! : 0;
    const rankScore = Math.max(0, 1000 - effectiveRank * 100);

    // Main job bonus - significantly higher to ensure main job always wins
    // This ensures a PLD will always get PLD weapon before a DRG who wants it as off-job
    // The bonus (2000) exceeds any possible role + rank combination
    const mainJobBonus = isMainJob ? 2000 : 0;

    // Total score
    const score = roleScore + rankScore + mainJobBonus;

    entries.push({
      player,
      job,
      rank: effectiveRank,
      isMainJob,
      received: false,
      score,
    });
  }

  // Sort by score (descending)
  return entries.sort((a, b) => b.score - a.score);
}

/**
 * Get weapon priority for all jobs in the tier
 * Returns map of job -> priority list
 */
export function getAllWeaponPriorities(
  players: SnapshotPlayer[],
  settings: StaticSettings
): Map<string, WeaponPriorityEntry[]> {
  const priorityMap = new Map<string, WeaponPriorityEntry[]>();

  // Get all unique jobs from all players' weapon priorities AND main jobs
  const allJobs = new Set<string>();
  for (const player of players) {
    // Include main job
    if (player.job) {
      allJobs.add(player.job);
    }
    // Include explicit weapon priorities
    for (const wp of player.weaponPriorities || []) {
      allJobs.add(wp.job);
    }
  }

  // Calculate priority for each job
  for (const job of allJobs) {
    const priority = getWeaponPriorityForJob(players, job, settings);
    if (priority.length > 0) {
      priorityMap.set(job, priority);
    }
  }

  return priorityMap;
}
