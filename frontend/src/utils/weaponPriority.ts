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

    if (priorityIndex === undefined || priorityIndex === -1) {
      continue; // Player doesn't want this weapon
    }

    const weaponPriority = player.weaponPriorities[priorityIndex];
    if (weaponPriority.received) {
      continue; // Player already received this weapon
    }

    // Calculate role score (from loot priority settings)
    const roleIndex = settings.lootPriority.indexOf(player.role);
    const roleScore = roleIndex === -1 ? 0 : (5 - roleIndex) * 100;

    // Calculate rank score (lower rank = higher score)
    // Rank 0 (first) = 1000, Rank 1 = 900, Rank 2 = 800, etc.
    const rankScore = Math.max(0, 1000 - priorityIndex * 100);

    // Main job bonus
    const mainJobBonus = player.job === job ? 50 : 0;

    // Total score
    const score = roleScore + rankScore + mainJobBonus;

    entries.push({
      player,
      job,
      rank: priorityIndex,
      isMainJob: player.job === job,
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

  // Get all unique jobs from all players' weapon priorities
  const allJobs = new Set<string>();
  for (const player of players) {
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
