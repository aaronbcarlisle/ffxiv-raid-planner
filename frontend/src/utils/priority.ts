/**
 * Priority Calculation Utilities
 *
 * Functions for calculating loot priority based on:
 * - Role priority (melee > ranged > caster > tank > healer by default)
 * - Slot value weight (weapon > body/legs > head/hands/feet > accessories)
 * - Items needed (more items needed = higher priority)
 * - Job modifiers (per-job adjustments from settings)
 * - Player modifiers (per-player adjustments)
 *
 * Supports new priority modes:
 * - role-based: Traditional role-based priority (default)
 * - job-based: Priority based on job groups and order
 * - player-based: Priority based on player groups and order
 * - manual-planning: Weekly assignments, no automatic priority
 * - disabled: All players equal priority
 */

import type { SnapshotPlayer, StaticSettings, GearSlot, PlayerNeeds, RaidPosition, TankRole, MaterialLogEntry, PrioritySystemMode, AdvancedPriorityOptions } from '../types';
import { DEFAULT_ADVANCED_OPTIONS } from '../types';
import { SLOT_VALUE_WEIGHTS, TOMESTONE_COSTS, WEEKLY_TOMESTONE_CAP } from '../gamedata/costs';
import { UPGRADE_MATERIAL_SLOTS } from '../gamedata/loot-tables';
import { isSlotComplete, requiresAugmentation } from './calculations';

/**
 * Get advanced options from settings with defaults
 * Used for priority calculation multipliers and toggles
 */
function getAdvancedOptions(settings: StaticSettings): AdvancedPriorityOptions {
  return settings.prioritySettings?.advancedOptions || DEFAULT_ADVANCED_OPTIONS;
}

/**
 * Get the effective priority mode from settings
 * Prefers new prioritySettings.mode over legacy priorityMode
 * Exported for use in components that need to check the current mode
 */
export function getEffectivePriorityMode(settings: StaticSettings): PrioritySystemMode | 'automatic' | 'manual' {
  // New settings take precedence
  if (settings.prioritySettings?.mode) {
    return settings.prioritySettings.mode;
  }
  // Fall back to legacy mode
  return settings.priorityMode || 'automatic';
}

/**
 * Check if priority mode is effectively disabled
 * Exported for use in components that need to check priority mode state
 */
export function isPriorityDisabled(settings: StaticSettings): boolean {
  const mode = getEffectivePriorityMode(settings);
  return mode === 'disabled' || mode === 'manual-planning';
}

/**
 * Calculate job-based priority for a player
 * Uses job group base priority + job sort order within group + job offset
 */
function calculateJobBasedPriority(player: SnapshotPlayer, settings: StaticSettings): number {
  const jobConfig = settings.prioritySettings?.jobBasedConfig;
  if (!jobConfig) return 0;

  const jobEntry = jobConfig.jobs.find(
    (j) => j.job.toUpperCase() === player.job.toUpperCase()
  );
  if (!jobEntry) return 0;

  const group = jobConfig.groups.find((g) => g.id === jobEntry.groupId);
  if (!group) return 0;

  // Calculate: base priority from group + inverse sort order within group + offset
  // Groups with higher sortOrder are lower priority (first group is highest)
  const maxGroupSortOrder = Math.max(...jobConfig.groups.map((g) => g.sortOrder));
  const groupPriority = (maxGroupSortOrder - group.sortOrder + 1) * 50; // 50 points per group tier

  // Jobs earlier in the list within a group have higher priority
  const jobsInGroup = jobConfig.jobs.filter((j) => j.groupId === jobEntry.groupId);
  const maxJobSortOrder = Math.max(...jobsInGroup.map((j) => j.sortOrder), 0);
  const jobOrderBonus = (maxJobSortOrder - jobEntry.sortOrder) * 5; // 5 points per position

  return group.basePriority + groupPriority + jobOrderBonus + jobEntry.priorityOffset;
}

/**
 * Calculate player-based priority for a player
 * Uses player group base priority + player sort order within group + player offset
 */
function calculatePlayerBasedPriority(player: SnapshotPlayer, settings: StaticSettings): number {
  const playerConfig = settings.prioritySettings?.playerBasedConfig;
  if (!playerConfig) return 0;

  const playerEntry = playerConfig.players.find((p) => p.playerId === player.id);
  if (!playerEntry) return 0;

  const group = playerConfig.groups.find((g) => g.id === playerEntry.groupId);
  if (!group) return 0;

  // Calculate: base priority from group + inverse sort order within group + offset
  const maxGroupSortOrder = Math.max(...playerConfig.groups.map((g) => g.sortOrder));
  const groupPriority = (maxGroupSortOrder - group.sortOrder + 1) * 50;

  // Players earlier in the list within a group have higher priority
  const playersInGroup = playerConfig.players.filter((p) => p.groupId === playerEntry.groupId);
  const maxPlayerSortOrder = Math.max(...playersInGroup.map((p) => p.sortOrder), 0);
  const playerOrderBonus = (maxPlayerSortOrder - playerEntry.sortOrder) * 5;

  return group.basePriority + groupPriority + playerOrderBonus + playerEntry.priorityOffset;
}

export interface PriorityEntry {
  player: SnapshotPlayer;
  score: number;
}

/**
 * Priority score breakdown for tooltips
 */
export interface PriorityScoreBreakdown {
  score: number;
  rolePriority: number;
  weightedNeed: number;
  weightedNeedBonus: number; // weightedNeed * 10
  lootAdjustmentBonus: number; // lootAdjustment * multiplier (positive = priority boost)
  jobModifier: number; // Job-level adjustment from settings
  playerModifier: number; // Player-level adjustment from player.priorityModifier
}

/**
 * Options for priority score calculation
 */
export interface PriorityScoreOptions {
  /** Include lootAdjustment in score (for mid-tier roster changes) */
  includeLootAdjustment?: boolean;
}

/**
 * Calculate overall priority score for a player
 * Higher score = higher priority for loot
 *
 * The calculation depends on the active priority mode:
 * - role-based: Role position + weighted need + job/player modifiers
 * - job-based: Job group position + job offset
 * - player-based: Player group position + player offset
 * - manual-planning/disabled: Returns 0 (equal priority)
 *
 * Legacy formula (role-based):
 * - Role priority: (5 - roleIndex) * 25 (melee=125, ranged=100, caster=75, tank=50, healer=25)
 * - Weighted need: sum of slot weights for incomplete slots * 10
 * - Job modifier: per-job adjustment from settings.jobPriorityModifiers
 * - Player modifier: per-player adjustment from player.priorityModifier
 * - Loot adjustment: -15 per adjustment point (positive adjustment = lower priority)
 */
export function calculatePriorityScore(
  player: SnapshotPlayer,
  settings: StaticSettings,
  options?: PriorityScoreOptions
): number {
  const mode = getEffectivePriorityMode(settings);

  // Disabled/Manual Planning mode: all players have equal priority (0)
  if (mode === 'disabled' || mode === 'manual-planning') {
    return 0;
  }

  // Job-based mode: use job group configuration
  if (mode === 'job-based') {
    let score = calculateJobBasedPriority(player, settings);
    const advancedOptions = getAdvancedOptions(settings);

    // Apply loot adjustments if toggle is on (positive = priority boost)
    if (player.lootAdjustment && advancedOptions.useLootAdjustments) {
      const lootMultiplier = advancedOptions.useMultipliers
        ? advancedOptions.lootReceivedPenalty
        : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;
      score += player.lootAdjustment * lootMultiplier;
    }
    return Math.round(score);
  }

  // Player-based mode: use player group configuration
  if (mode === 'player-based') {
    let score = calculatePlayerBasedPriority(player, settings);
    const advancedOptions = getAdvancedOptions(settings);

    // Apply loot adjustments if toggle is on (positive = priority boost)
    if (player.lootAdjustment && advancedOptions.useLootAdjustments) {
      const lootMultiplier = advancedOptions.useMultipliers
        ? advancedOptions.lootReceivedPenalty
        : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;
      score += player.lootAdjustment * lootMultiplier;
    }
    return Math.round(score);
  }

  // Role-based mode (default, 'automatic', 'manual'): original calculation
  const advancedOptions = getAdvancedOptions(settings);

  const roleOrder = settings.prioritySettings?.roleBasedConfig?.roleOrder || settings.lootPriority;
  const roleIndex = roleOrder.indexOf(player.role);

  // Role priority - use configured multiplier when useMultipliers is enabled
  const rolePriorityMultiplier = advancedOptions.useMultipliers
    ? advancedOptions.rolePriorityMultiplier
    : DEFAULT_ADVANCED_OPTIONS.rolePriorityMultiplier;
  const rolePriority = roleIndex === -1 ? 0 : (5 - roleIndex) * rolePriorityMultiplier;

  // Weighted need - respect toggle (when off, gear need contributes 0)
  const weightedNeedRaw = player.gear
    .filter((g) => !isSlotComplete(g))
    .reduce((sum, g) => sum + (SLOT_VALUE_WEIGHTS[g.slot] || 1), 0);
  const weightedNeed = advancedOptions.useWeightedNeed ? weightedNeedRaw : 0;

  // Gear multiplier - use configured when useMultipliers is enabled
  const gearMultiplier = advancedOptions.useMultipliers
    ? advancedOptions.gearNeededMultiplier
    : DEFAULT_ADVANCED_OPTIONS.gearNeededMultiplier;

  // Job modifier from settings (use nullish coalescing to handle explicit 0 values)
  const jobModifier = settings.jobPriorityModifiers?.[player.job.toUpperCase()] ?? 0;

  // Player-level modifier (use nullish coalescing to handle explicit 0 values)
  const playerModifier = player.priorityModifier ?? 0;

  let score = Math.round(rolePriority + weightedNeed * gearMultiplier + jobModifier + playerModifier);

  // Apply loot adjustment for mid-tier roster changes
  // Positive adjustment = increase priority (player needs to catch up)
  // Negative adjustment = decrease priority (player has received enough)
  if (player.lootAdjustment && advancedOptions.useLootAdjustments) {
    const lootMultiplier = advancedOptions.useMultipliers
      ? advancedOptions.lootReceivedPenalty
      : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;
    score += player.lootAdjustment * lootMultiplier;
  }

  return score;
}

/**
 * Calculate priority score with detailed breakdown for tooltips
 */
export function calculatePriorityScoreWithBreakdown(
  player: SnapshotPlayer,
  settings: StaticSettings,
  options?: PriorityScoreOptions
): PriorityScoreBreakdown {
  const mode = getEffectivePriorityMode(settings);

  // Disabled/Manual Planning mode: all components are 0
  if (mode === 'disabled' || mode === 'manual-planning') {
    return {
      score: 0,
      rolePriority: 0,
      weightedNeed: 0,
      weightedNeedBonus: 0,
      lootAdjustmentBonus: 0,
      jobModifier: 0,
      playerModifier: 0,
    };
  }

  // For job-based and player-based, we simplify the breakdown
  // The score comes from the group/position, not traditional factors
  if (mode === 'job-based' || mode === 'player-based') {
    const advancedOptions = getAdvancedOptions(settings);
    const baseScore = mode === 'job-based'
      ? calculateJobBasedPriority(player, settings)
      : calculatePlayerBasedPriority(player, settings);

    let lootAdjustmentBonus = 0;
    if (player.lootAdjustment && advancedOptions.useLootAdjustments) {
      const lootMultiplier = advancedOptions.useMultipliers
        ? advancedOptions.lootReceivedPenalty
        : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;
      lootAdjustmentBonus = player.lootAdjustment * lootMultiplier;
    }

    return {
      score: Math.round(baseScore + lootAdjustmentBonus),
      rolePriority: baseScore, // Use this field to show the group-based priority
      weightedNeed: 0,
      weightedNeedBonus: 0,
      lootAdjustmentBonus,
      jobModifier: 0,
      playerModifier: 0,
    };
  }

  // Role-based mode: calculation with breakdown using configurable multipliers
  const advancedOptions = getAdvancedOptions(settings);

  const roleOrder = settings.prioritySettings?.roleBasedConfig?.roleOrder || settings.lootPriority;
  const roleIndex = roleOrder.indexOf(player.role);

  // Role priority - use configured multiplier when useMultipliers is enabled
  const rolePriorityMultiplier = advancedOptions.useMultipliers
    ? advancedOptions.rolePriorityMultiplier
    : DEFAULT_ADVANCED_OPTIONS.rolePriorityMultiplier;
  const rolePriority = roleIndex === -1 ? 0 : (5 - roleIndex) * rolePriorityMultiplier;

  // Weighted need - respect toggle (when off, gear need contributes 0)
  const weightedNeedRaw = player.gear
    .filter((g) => !isSlotComplete(g))
    .reduce((sum, g) => sum + (SLOT_VALUE_WEIGHTS[g.slot] || 1), 0);
  const weightedNeed = advancedOptions.useWeightedNeed ? weightedNeedRaw : 0;

  // Gear multiplier - use configured when useMultipliers is enabled
  const gearMultiplier = advancedOptions.useMultipliers
    ? advancedOptions.gearNeededMultiplier
    : DEFAULT_ADVANCED_OPTIONS.gearNeededMultiplier;
  const weightedNeedBonus = Math.round(weightedNeed * gearMultiplier);

  // Job modifier from settings (use nullish coalescing to handle explicit 0 values)
  const jobModifier = settings.jobPriorityModifiers?.[player.job.toUpperCase()] ?? 0;

  // Player-level modifier (use nullish coalescing to handle explicit 0 values)
  const playerModifier = player.priorityModifier ?? 0;

  let lootAdjustmentBonus = 0;
  if (player.lootAdjustment && advancedOptions.useLootAdjustments) {
    const lootMultiplier = advancedOptions.useMultipliers
      ? advancedOptions.lootReceivedPenalty
      : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;
    lootAdjustmentBonus = player.lootAdjustment * lootMultiplier;
  }

  const score = Math.round(rolePriority + weightedNeedBonus + jobModifier + playerModifier + lootAdjustmentBonus);

  return {
    score,
    rolePriority,
    weightedNeed: advancedOptions.useWeightedNeed ? weightedNeedRaw : 0, // Show raw value or 0 based on toggle
    weightedNeedBonus,
    lootAdjustmentBonus,
    jobModifier,
    playerModifier,
  };
}

/**
 * Get priority list for a specific gear slot
 * Returns players who need this slot (bisSource='raid' && !hasItem),
 * sorted by priority score (highest first)
 */
export function getPriorityForItem(
  players: SnapshotPlayer[],
  slot: GearSlot,
  settings: StaticSettings
): PriorityEntry[] {
  return players
    .filter((p) => {
      const gear = p.gear.find((g) => g.slot === slot);
      // Only include if player wants raid BiS and doesn't have it
      return gear?.bisSource === 'raid' && !gear?.hasItem;
    })
    .map((player) => ({
      player,
      score: calculatePriorityScore(player, settings),
    }))
    .sort((a, b) => {
      // Primary: sort by score (highest first)
      if (b.score !== a.score) return b.score - a.score;
      // Secondary: alphabetical by name (for disabled mode or ties)
      return a.player.name.localeCompare(b.player.name);
    });
}

/**
 * Get priority list for "Ring" drops (either ring1 or ring2)
 * A player needs ring if either ring slot has bisSource='raid' && !hasItem
 */
export function getPriorityForRing(
  players: SnapshotPlayer[],
  settings: StaticSettings
): PriorityEntry[] {
  return players
    .filter((p) => {
      const ring1 = p.gear.find((g) => g.slot === 'ring1');
      const ring2 = p.gear.find((g) => g.slot === 'ring2');
      const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
      const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;
      return needsRing1 || needsRing2;
    })
    .map((player) => ({
      player,
      score: calculatePriorityScore(player, settings),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.player.name.localeCompare(b.player.name);
    });
}

/**
 * Get priority list for upgrade material (twine/glaze/solvent)
 * Returns players who have unaugmented tome gear for that material type
 *
 * For solvent, also includes players pursuing tome weapon who have it but need augmentation
 *
 * If materialLog is provided, subtracts already-received materials from need count.
 * This allows the priority list to update as materials are distributed.
 *
 * @param players - Array of players
 * @param material - Material type to check
 * @param settings - Static settings for loot priority
 * @param materialLog - Optional material log for tracking already-received materials
 */
export function getPriorityForUpgradeMaterial(
  players: SnapshotPlayer[],
  material: 'twine' | 'glaze' | 'solvent',
  settings: StaticSettings,
  materialLog?: MaterialLogEntry[]
): PriorityEntry[] {
  const applicableSlots = UPGRADE_MATERIAL_SLOTS[material];

  // Count how many of this material each player has received WITHOUT a recorded slot.
  // Entries WITH slotAugmented have already been applied to gear (slot.isAugmented=true),
  // so they shouldn't be counted against remaining unaugmented slots.
  // Only count entries WITHOUT slotAugmented (legacy entries before auto-augment feature).
  const receivedCounts = new Map<string, number>();
  if (materialLog) {
    for (const entry of materialLog) {
      if (entry.materialType === material && !entry.slotAugmented) {
        receivedCounts.set(
          entry.recipientPlayerId,
          (receivedCounts.get(entry.recipientPlayerId) || 0) + 1
        );
      }
    }
  }

  return players
    .filter((p) => {
      // Count unaugmented tome pieces for this material type
      // Only include slots where augmentation is actually required
      // Note: Only 'tome' BiS (not 'base_tome') requires augmentation materials
      // base_tome slots don't need materials since the unaugmented item is BiS
      const unaugmented = p.gear.filter(
        (g) =>
          applicableSlots.includes(g.slot) &&
          g.bisSource === 'tome' &&
          g.hasItem &&
          !g.isAugmented &&
          requiresAugmentation(g)
      );

      let totalNeed = unaugmented.length;

      // For solvent, also check if player needs to augment tome weapon
      if (material === 'solvent') {
        const needsTomeWeaponAugment =
          p.tomeWeapon?.pursuing && p.tomeWeapon?.hasItem && !p.tomeWeapon?.isAugmented;
        if (needsTomeWeaponAugment) {
          totalNeed++;
        }
      }

      // Subtract materials already received
      const received = receivedCounts.get(p.id) || 0;
      return totalNeed - received > 0;
    })
    .map((player) => {
      // Boost score by number of pieces that need this material
      let unaugmentedCount = player.gear.filter(
        (g) =>
          applicableSlots.includes(g.slot) &&
          g.bisSource === 'tome' &&
          g.hasItem &&
          !g.isAugmented &&
          requiresAugmentation(g)
      ).length;

      // For solvent, add tome weapon if it needs augmentation
      if (material === 'solvent') {
        const needsTomeWeaponAugment =
          player.tomeWeapon?.pursuing && player.tomeWeapon?.hasItem && !player.tomeWeapon?.isAugmented;
        if (needsTomeWeaponAugment) {
          unaugmentedCount++;
        }
      }

      // Subtract materials already received from the count
      const received = receivedCounts.get(player.id) || 0;
      const effectiveNeed = Math.max(0, unaugmentedCount - received);

      // Use configured loot penalty for material need bonus
      const advancedOptions = getAdvancedOptions(settings);
      const lootPenalty = advancedOptions.useMultipliers
        ? advancedOptions.lootReceivedPenalty
        : DEFAULT_ADVANCED_OPTIONS.lootReceivedPenalty;

      return {
        player,
        score: calculatePriorityScore(player, settings) + effectiveNeed * lootPenalty,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.player.name.localeCompare(b.player.name);
    });
}

/**
 * Get priority list for Universal Tomestone
 * Returns players who need to obtain the base tome weapon
 *
 * A player needs Universal Tomestone if:
 * - They are pursuing a tome weapon (tomeWeapon.pursuing === true)
 * - They don't have the tome weapon yet (tomeWeapon.hasItem === false)
 *
 * If materialLog is provided, filters out players who already received one.
 */
export function getPriorityForUniversalTomestone(
  players: SnapshotPlayer[],
  settings: StaticSettings,
  materialLog?: MaterialLogEntry[]
): PriorityEntry[] {
  // Count how many universal tomestones each player has received
  const receivedCounts = new Map<string, number>();
  if (materialLog) {
    for (const entry of materialLog) {
      if (entry.materialType === 'universal_tomestone') {
        receivedCounts.set(
          entry.recipientPlayerId,
          (receivedCounts.get(entry.recipientPlayerId) || 0) + 1
        );
      }
    }
  }

  return players
    .filter((p) => {
      // Player needs Universal Tomestone if pursuing tome weapon but doesn't have it yet
      const needsTomeWeapon =
        p.tomeWeapon?.pursuing && !p.tomeWeapon?.hasItem;

      if (!needsTomeWeapon) return false;

      // Only need 1 Universal Tomestone per player
      const received = receivedCounts.get(p.id) || 0;
      return received === 0; // Haven't received one yet
    })
    .map((player) => ({
      player,
      score: calculatePriorityScore(player, settings),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.player.name.localeCompare(b.player.name);
    });
}

/**
 * Calculate what a player still needs
 * Returns raidNeed, tomeNeed, upgrades, and tomeWeeks
 *
 * Includes tome weapon tracking when player is pursuing it:
 * - Tome weapon costs 500 tomestones + Universal Tomestone (from M6S)
 * - Augmenting tome weapon requires Solvent (from M7S)
 *
 * @param player - The player to calculate needs for
 */
export function calculatePlayerNeeds(player: SnapshotPlayer): PlayerNeeds {
  let raidNeed = 0;
  let tomeNeed = 0;
  let upgrades = 0;
  let tomestoneCost = 0;

  player.gear.forEach((g) => {
    if (g.bisSource === 'raid' && !g.hasItem) {
      raidNeed++;
    } else if (g.bisSource === 'tome') {
      if (!g.hasItem) {
        tomeNeed++;
        tomestoneCost += TOMESTONE_COSTS[g.slot] || 0;
      } else if (!g.isAugmented && requiresAugmentation(g)) {
        upgrades++;
      }
    }
    // Crafted BiS: no resource tracking needed (player obtains independently)
    // If crafted slot is missing, it doesn't affect raid/tome needs
  });

  // Include tome weapon if player is pursuing it
  if (player.tomeWeapon?.pursuing) {
    if (!player.tomeWeapon.hasItem) {
      tomeNeed++;
      tomestoneCost += 500; // Tome weapon costs 500 tomestones
    } else if (!player.tomeWeapon.isAugmented) {
      upgrades++; // Needs solvent to augment
    }
  }

  const tomeWeeks = Math.ceil(tomestoneCost / WEEKLY_TOMESTONE_CAP);

  return { raidNeed, tomeNeed, upgrades, tomeWeeks };
}

/**
 * Get the default position and tank role for a new player based on their role
 * and what positions are already assigned in the static.
 *
 * Assignment logic:
 * - Tanks: T1 (MT) first, then T2 (OT)
 * - Healers: H1 first, then H2
 * - Melee: M1, M2, then overflow to R1, R2
 * - Ranged/Caster: R1, R2, then overflow to M1, M2
 */
export function getDefaultPositionForRole(
  players: SnapshotPlayer[],
  role: string,
  excludePlayerId?: string
): { position?: RaidPosition; tankRole?: TankRole } {
  // Get all currently assigned positions from configured players
  // Exclude the player being updated (if editing an existing player)
  const assignedPositions = new Set(
    players
      .filter((p) => p.configured && p.position && p.id !== excludePlayerId)
      .map((p) => p.position)
  );

  let positionsToTry: RaidPosition[] = [];

  switch (role) {
    case 'tank':
      positionsToTry = ['T1', 'T2'];
      break;
    case 'healer':
      positionsToTry = ['H1', 'H2'];
      break;
    case 'melee':
      // Primary: M1, M2, then overflow to R1, R2
      positionsToTry = ['M1', 'M2', 'R1', 'R2'];
      break;
    case 'ranged':
    case 'caster':
      // Primary: R1, R2, then overflow to M1, M2
      positionsToTry = ['R1', 'R2', 'M1', 'M2'];
      break;
    default:
      return {};
  }

  for (const pos of positionsToTry) {
    if (!assignedPositions.has(pos)) {
      const result: { position: RaidPosition; tankRole?: TankRole } = { position: pos };
      if (role === 'tank') {
        result.tankRole = pos === 'T1' ? 'MT' : 'OT';
      }
      return result;
    }
  }

  return {};
}
