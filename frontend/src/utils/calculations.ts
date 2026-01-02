/**
 * Gear and Team Calculations
 */

import type { SnapshotPlayer, GearSlotStatus, TeamSummary } from '../types';
import {
  BOOK_COSTS,
  BOOK_TYPE_FOR_SLOT,
  getUpgradeMaterialForSlot,
} from '../gamedata';

/**
 * Check if a gear slot is complete (BiS achieved)
 */
export function isSlotComplete(status: GearSlotStatus): boolean {
  if (!status.hasItem) return false;
  if (status.bisSource === 'raid') return true;
  // Tome gear must be augmented to be complete
  return status.isAugmented;
}

/**
 * Calculate completion percentage for a player
 */
export function calculatePlayerCompletion(gear: GearSlotStatus[]): number {
  const completed = gear.filter(isSlotComplete).length;
  return gear.length > 0 ? Math.round((completed / gear.length) * 100) : 0;
}

/**
 * Calculate upgrade materials needed for a player
 */
export function calculatePlayerMaterials(gear: GearSlotStatus[]): {
  twine: number;
  glaze: number;
  solvent: number;
} {
  const materials = { twine: 0, glaze: 0, solvent: 0 };

  gear.forEach((slot) => {
    // Only tome pieces need upgrade materials
    if (slot.bisSource !== 'tome') return;
    // Already augmented = no material needed
    if (slot.isAugmented) return;

    const material = getUpgradeMaterialForSlot(slot.slot);
    materials[material]++;
  });

  return materials;
}

/**
 * Calculate books needed per floor for a player
 */
export function calculatePlayerBooks(gear: GearSlotStatus[]): {
  floor1: number;
  floor2: number;
  floor3: number;
  floor4: number;
} {
  const books = { floor1: 0, floor2: 0, floor3: 0, floor4: 0 };

  gear.forEach((slot) => {
    // Only raid BiS pieces need books (as worst-case fallback)
    if (slot.bisSource !== 'raid') return;
    // Already have the item = no books needed
    if (slot.hasItem) return;

    const floor = BOOK_TYPE_FOR_SLOT[slot.slot];
    const cost = BOOK_COSTS[slot.slot];
    const key = `floor${floor}` as keyof typeof books;
    books[key] += cost;
  });

  return books;
}

/**
 * Calculate team-wide summary
 */
export function calculateTeamSummary(players: SnapshotPlayer[]): TeamSummary {
  const totalPlayers = players.length;

  if (totalPlayers === 0) {
    return {
      totalPlayers: 0,
      completionPercentage: 0,
      materialsNeeded: { twine: 0, glaze: 0, solvent: 0 },
      booksNeeded: { floor1: 0, floor2: 0, floor3: 0, floor4: 0 },
      weeksToComplete: 0,
    };
  }

  // Sum up all player stats
  let totalCompleted = 0;
  let totalSlots = 0;
  const materials = { twine: 0, glaze: 0, solvent: 0 };
  const books = { floor1: 0, floor2: 0, floor3: 0, floor4: 0 };

  players.forEach((player) => {
    // Completion
    totalCompleted += player.gear.filter(isSlotComplete).length;
    totalSlots += player.gear.length;

    // Materials
    const playerMaterials = calculatePlayerMaterials(player.gear);
    materials.twine += playerMaterials.twine;
    materials.glaze += playerMaterials.glaze;
    materials.solvent += playerMaterials.solvent;

    // Books
    const playerBooks = calculatePlayerBooks(player.gear);
    books.floor1 += playerBooks.floor1;
    books.floor2 += playerBooks.floor2;
    books.floor3 += playerBooks.floor3;
    books.floor4 += playerBooks.floor4;
  });

  const completionPercentage = totalSlots > 0
    ? Math.round((totalCompleted / totalSlots) * 100)
    : 0;

  // Estimate weeks to complete (worst case: max books needed for any floor)
  // Each floor gives 1 book per week per player
  const maxBooksPerFloor = Math.max(
    Math.ceil(books.floor1 / Math.max(totalPlayers, 1)),
    Math.ceil(books.floor2 / Math.max(totalPlayers, 1)),
    Math.ceil(books.floor3 / Math.max(totalPlayers, 1)),
    Math.ceil(books.floor4 / Math.max(totalPlayers, 1))
  );

  return {
    totalPlayers,
    completionPercentage,
    materialsNeeded: materials,
    booksNeeded: books,
    weeksToComplete: maxBooksPerFloor,
  };
}

/**
 * Sort players by role display order or custom order
 * @param players - Players to sort
 * @param displayOrder - Role order array (ignored if sortPreset is 'custom')
 * @param sortPreset - Sort preset to use (defaults to role-based sorting)
 */
export function sortPlayersByRole(
  players: SnapshotPlayer[],
  displayOrder: readonly string[],
  sortPreset: 'standard' | 'dps-first' | 'healer-first' | 'custom' = 'standard'
): SnapshotPlayer[] {
  return [...players].sort((a, b) => {
    // Custom mode: sort only by sortOrder, then name
    if (sortPreset === 'custom') {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    }

    // Role-based sorting
    const orderA = displayOrder.indexOf(a.role);
    const orderB = displayOrder.indexOf(b.role);

    // If role not in order, put at end
    const effectiveOrderA = orderA === -1 ? 999 : orderA;
    const effectiveOrderB = orderB === -1 ? 999 : orderB;

    if (effectiveOrderA !== effectiveOrderB) {
      return effectiveOrderA - effectiveOrderB;
    }

    // Same role: sort by sortOrder, then name
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Group players by light party based on raid position
 */
export function groupPlayersByLightParty(players: SnapshotPlayer[]): {
  group1: SnapshotPlayer[]; // T1, H1, M1, R1
  group2: SnapshotPlayer[]; // T2, H2, M2, R2
  unassigned: SnapshotPlayer[];
} {
  const g1Positions = ['T1', 'H1', 'M1', 'R1'];
  const g2Positions = ['T2', 'H2', 'M2', 'R2'];

  return {
    group1: players.filter((p) => p.position && g1Positions.includes(p.position)),
    group2: players.filter((p) => p.position && g2Positions.includes(p.position)),
    unassigned: players.filter(
      (p) => !p.position || (!g1Positions.includes(p.position) && !g2Positions.includes(p.position))
    ),
  };
}

/**
 * Get which group (1 or 2) a position belongs to
 */
export function getGroupFromPosition(position: string | null | undefined): 1 | 2 | null {
  if (!position) return null;
  const g1Positions = ['T1', 'H1', 'M1', 'R1'];
  const g2Positions = ['T2', 'H2', 'M2', 'R2'];
  if (g1Positions.includes(position)) return 1;
  if (g2Positions.includes(position)) return 2;
  return null;
}

/**
 * Swap a position to the other group (T1 -> T2, M2 -> M1, etc.)
 */
export function swapPositionGroup(position: string): string {
  const role = position.charAt(0); // T, H, M, or R
  const currentNum = position.charAt(1);
  const newNum = currentNum === '1' ? '2' : '1';
  return `${role}${newNum}`;
}

// ==================== iLv Calculation Functions ====================

import type { GearSourceCategory } from '../types';
import { getItemLevelForCategory } from '../gamedata/raid-tiers';

/**
 * Infer currentSource from existing gear state for backward compatibility.
 * Used when currentSource is missing (null/undefined) from existing data.
 */
export function inferCurrentSource(status: GearSlotStatus): GearSourceCategory {
  // If player has the BiS item, infer source from bisSource
  if (status.hasItem) {
    if (status.bisSource === 'raid') {
      return 'savage';
    }
    // Tome BiS: augmented or not
    return status.isAugmented ? 'tome_up' : 'tome';
  }
  // No item yet - default to crafted (reasonable tier-start assumption)
  return 'crafted';
}

/**
 * Get the effective currentSource for a gear slot, inferring if missing.
 */
export function getEffectiveCurrentSource(status: GearSlotStatus): GearSourceCategory {
  return status.currentSource ?? inferCurrentSource(status);
}

/**
 * Calculate average item level for a player based on their gear.
 *
 * Uses itemLevel from BiS import if available, otherwise calculates
 * from currentSource category and tier iLv mappings.
 *
 * @param gear - Player's gear array
 * @param tierId - Current tier ID for iLv lookups
 * @returns Average iLv rounded to nearest integer, or 0 if no gear
 */
export function calculateAverageItemLevel(
  gear: GearSlotStatus[],
  tierId: string
): number {
  if (gear.length === 0) return 0;

  let totalILv = 0;
  let validSlots = 0;

  for (const slot of gear) {
    // Use itemLevel from BiS import if available and valid
    if (slot.itemLevel && slot.itemLevel > 0) {
      totalILv += slot.itemLevel;
      validSlots++;
      continue;
    }

    // Fall back to calculating from currentSource
    const currentSource = getEffectiveCurrentSource(slot);
    if (currentSource === 'unknown') {
      // Skip unknown slots in average calculation
      continue;
    }

    const isWeapon = slot.slot === 'weapon';
    const iLv = getItemLevelForCategory(tierId, currentSource, isWeapon);
    if (iLv > 0) {
      totalILv += iLv;
      validSlots++;
    }
  }

  return validSlots > 0 ? Math.round(totalILv / validSlots) : 0;
}

/**
 * Calculate team average item level.
 *
 * @param players - Array of players
 * @param tierId - Current tier ID for iLv lookups
 * @returns Average iLv across all players, or 0 if no players
 */
export function calculateTeamAverageItemLevel(
  players: SnapshotPlayer[],
  tierId: string
): number {
  if (players.length === 0) return 0;

  const playerILvs = players
    .map((p) => calculateAverageItemLevel(p.gear, tierId))
    .filter((iLv) => iLv > 0);

  if (playerILvs.length === 0) return 0;

  const total = playerILvs.reduce((sum, iLv) => sum + iLv, 0);
  return Math.round(total / playerILvs.length);
}
