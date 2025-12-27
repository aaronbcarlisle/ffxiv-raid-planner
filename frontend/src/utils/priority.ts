/**
 * Priority Calculation Utilities
 *
 * Functions for calculating loot priority based on:
 * - Role priority (melee > ranged > caster > tank > healer by default)
 * - Slot value weight (weapon > body/legs > head/hands/feet > accessories)
 * - Items needed (more items needed = higher priority)
 */

import type { SnapshotPlayer, StaticSettings, GearSlot, PlayerNeeds, RaidPosition, TankRole } from '../types';
import { SLOT_VALUE_WEIGHTS, TOMESTONE_COSTS, WEEKLY_TOMESTONE_CAP } from '../gamedata/costs';
import { UPGRADE_MATERIAL_SLOTS } from '../gamedata/loot-tables';
import { isSlotComplete } from './calculations';

export interface PriorityEntry {
  player: SnapshotPlayer;
  score: number;
}

/**
 * Calculate overall priority score for a player
 * Higher score = higher priority for loot
 *
 * Formula:
 * - Role priority: (5 - roleIndex) * 25 (melee=125, ranged=100, caster=75, tank=50, healer=25)
 * - Weighted need: sum of slot weights for incomplete slots * 10
 */
export function calculatePriorityScore(
  player: SnapshotPlayer,
  settings: StaticSettings
): number {
  const roleIndex = settings.lootPriority.indexOf(player.role);
  const rolePriority = roleIndex === -1 ? 0 : (5 - roleIndex) * 25;

  const weightedNeed = player.gear
    .filter((g) => !isSlotComplete(g))
    .reduce((sum, g) => sum + (SLOT_VALUE_WEIGHTS[g.slot] || 1), 0);

  return Math.round(rolePriority + weightedNeed * 10);
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
    .sort((a, b) => b.score - a.score);
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
    .sort((a, b) => b.score - a.score);
}

/**
 * Get priority list for upgrade material (twine/glaze/solvent)
 * Returns players who have unaugmented tome gear for that material type
 *
 * For solvent, also includes players pursuing tome weapon who have it but need augmentation
 */
export function getPriorityForUpgradeMaterial(
  players: SnapshotPlayer[],
  material: 'twine' | 'glaze' | 'solvent',
  settings: StaticSettings
): PriorityEntry[] {
  const applicableSlots = UPGRADE_MATERIAL_SLOTS[material];

  return players
    .filter((p) => {
      // Count unaugmented tome pieces for this material type
      const unaugmented = p.gear.filter(
        (g) =>
          applicableSlots.includes(g.slot) &&
          g.bisSource === 'tome' &&
          g.hasItem &&
          !g.isAugmented
      );

      // For solvent, also check if player needs to augment tome weapon
      if (material === 'solvent') {
        const needsTomeWeaponAugment =
          p.tomeWeapon?.pursuing && p.tomeWeapon?.hasItem && !p.tomeWeapon?.isAugmented;
        return unaugmented.length > 0 || needsTomeWeaponAugment;
      }

      return unaugmented.length > 0;
    })
    .map((player) => {
      // Boost score by number of pieces that need this material
      let unaugmentedCount = player.gear.filter(
        (g) =>
          applicableSlots.includes(g.slot) &&
          g.bisSource === 'tome' &&
          g.hasItem &&
          !g.isAugmented
      ).length;

      // For solvent, add tome weapon if it needs augmentation
      if (material === 'solvent') {
        const needsTomeWeaponAugment =
          player.tomeWeapon?.pursuing && player.tomeWeapon?.hasItem && !player.tomeWeapon?.isAugmented;
        if (needsTomeWeaponAugment) {
          unaugmentedCount++;
        }
      }

      return {
        player,
        score: calculatePriorityScore(player, settings) + unaugmentedCount * 15,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate what a player still needs
 * Returns raidNeed, tomeNeed, upgrades, and tomeWeeks
 *
 * Includes tome weapon tracking when player is pursuing it:
 * - Tome weapon costs 500 tomestones + Universal Tomestone (from M6S)
 * - Augmenting tome weapon requires Solvent (from M7S)
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
      } else if (!g.isAugmented) {
        upgrades++;
      }
    }
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
