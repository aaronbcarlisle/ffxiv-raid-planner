/**
 * Priority Calculation Utilities
 *
 * Functions for calculating loot priority based on:
 * - Role priority (melee > ranged > caster > tank > healer by default)
 * - Slot value weight (weapon > body/legs > head/hands/feet > accessories)
 * - Items needed (more items needed = higher priority)
 */

import type { Player, StaticSettings, GearSlot, GearSlotStatus } from '../types';
import { SLOT_VALUE_WEIGHTS } from '../gamedata/costs';
import { UPGRADE_MATERIAL_SLOTS } from '../gamedata/loot-tables';
import { isSlotComplete } from './calculations';

export interface PriorityEntry {
  player: Player;
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
  player: Player,
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
  players: Player[],
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
  players: Player[],
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
 */
export function getPriorityForUpgradeMaterial(
  players: Player[],
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
      return unaugmented.length > 0;
    })
    .map((player) => {
      // Boost score by number of pieces that need this material
      const unaugmentedCount = player.gear.filter(
        (g) =>
          applicableSlots.includes(g.slot) &&
          g.bisSource === 'tome' &&
          g.hasItem &&
          !g.isAugmented
      ).length;

      return {
        player,
        score: calculatePriorityScore(player, settings) + unaugmentedCount * 15,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Summary of what a player needs
 */
export interface PlayerNeeds {
  raidItems: number; // Raid BiS slots not yet obtained
  tomeItems: number; // Tome BiS slots not yet obtained
  upgrades: number; // Tome items that need augmenting
}

/**
 * Calculate what a player still needs
 */
export function calculatePlayerNeeds(gear: GearSlotStatus[]): PlayerNeeds {
  let raidItems = 0;
  let tomeItems = 0;
  let upgrades = 0;

  gear.forEach((g) => {
    if (g.bisSource === 'raid' && !g.hasItem) {
      raidItems++;
    } else if (g.bisSource === 'tome') {
      if (!g.hasItem) {
        tomeItems++;
      } else if (!g.isAugmented) {
        upgrades++;
      }
    }
  });

  return { raidItems, tomeItems, upgrades };
}
