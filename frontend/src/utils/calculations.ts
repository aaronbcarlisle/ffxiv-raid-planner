/**
 * Gear and Team Calculations
 */

import type { SnapshotPlayer, GearSlotStatus, TeamSummary } from '../types';

// ==================== Gear State Types ====================

/**
 * Triple-state for gear tracking:
 * - missing: Don't have the item
 * - have: Have the item (but may need augmentation for tome)
 * - augmented: Have augmented tome item (complete)
 */
export type GearState = 'missing' | 'have' | 'augmented';

/**
 * Convert hasItem/isAugmented to GearState
 */
export function toGearState(hasItem: boolean, isAugmented: boolean): GearState {
  if (!hasItem) return 'missing';
  if (isAugmented) return 'augmented';
  return 'have';
}

/**
 * Convert GearState to hasItem/isAugmented
 */
export function fromGearState(state: GearState): { hasItem: boolean; isAugmented: boolean } {
  return {
    hasItem: state !== 'missing',
    isAugmented: state === 'augmented',
  };
}
import {
  BOOK_COSTS,
  BOOK_TYPE_FOR_SLOT,
  getUpgradeMaterialForSlot,
} from '../gamedata';

/**
 * Check if a BiS slot requires augmentation to be complete.
 *
 * With the new BiS source system:
 * - 'raid': No augmentation (2-state)
 * - 'base_tome': No augmentation (2-state) - base tome is BiS
 * - 'crafted': No augmentation (2-state)
 * - 'tome': Requires augmentation (3-state)
 * - null: Unset slot (no augmentation possible)
 *
 * Also checks item name prefix from BiS import for backward compatibility.
 *
 * @param slot - The gear slot status
 * @returns true if augmentation is needed, false otherwise
 */
export function requiresAugmentation(slot: GearSlotStatus): boolean {
  // Null/unset bisSource - no augmentation possible
  if (!slot.bisSource) return false;

  // Only 'tome' requires augmentation
  // base_tome, raid, and crafted are all 2-state
  if (slot.bisSource !== 'tome') return false;

  // For 'tome' bisSource, check if BiS item name indicates augmented version
  // This is a fallback for backward compatibility
  if (slot.itemName) {
    const name = slot.itemName.toLowerCase();
    // "Aug. Item Name" or "Augmented Item Name" = BiS is augmented version
    return name.startsWith('aug.') || name.startsWith('augmented');
  }

  // 'tome' bisSource with no item name - assume augmented is target (safer default)
  return true;
}

/**
 * Check if a gear slot is complete (BiS achieved)
 *
 * @param status - The gear slot status
 */
export function isSlotComplete(status: GearSlotStatus): boolean {
  // Unset bisSource = incomplete (must set BiS first)
  if (!status.bisSource) return false;

  // Must have the item
  if (!status.hasItem) return false;

  // Raid, base_tome, and crafted are complete when you have the item
  if (status.bisSource === 'raid') return true;
  if (status.bisSource === 'base_tome') return true;
  if (status.bisSource === 'crafted') return true;

  // Tome BiS - check if augmentation is required
  if (!requiresAugmentation(status)) return true;
  return status.isAugmented;
}

/**
 * Calculate completion percentage for a player
 *
 * @param gear - Player's gear array
 */
export function calculatePlayerCompletion(gear: GearSlotStatus[]): number {
  const completed = gear.filter((slot) => isSlotComplete(slot)).length;
  return gear.length > 0 ? Math.round((completed / gear.length) * 100) : 0;
}

/**
 * Calculate upgrade materials needed for a player
 *
 * Only 'tome' bisSource requires augmentation materials.
 * 'base_tome' does not need augmentation (base version is BiS).
 *
 * @param gear - Player's gear array
 */
export function calculatePlayerMaterials(gear: GearSlotStatus[]): {
  twine: number;
  glaze: number;
  solvent: number;
} {
  const materials = { twine: 0, glaze: 0, solvent: 0 };

  gear.forEach((slot) => {
    // Only 'tome' pieces need upgrade materials (not base_tome)
    if (slot.bisSource !== 'tome') return;
    // Already augmented = no material needed
    if (slot.isAugmented) return;
    // Skip if augmentation is not required (backward compat check)
    if (!requiresAugmentation(slot)) return;

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
 *
 * @param players - Array of players
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
    totalCompleted += player.gear.filter((slot) => isSlotComplete(slot)).length;
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
 * @param players - List of players to group
 * @param separateSubs - If true, substitutes are returned in a separate array instead of in their groups
 */
export function groupPlayersByLightParty(players: SnapshotPlayer[], separateSubs = false): {
  group1: SnapshotPlayer[]; // T1, H1, M1, R1
  group2: SnapshotPlayer[]; // T2, H2, M2, R2
  unassigned: SnapshotPlayer[];
  substitutes: SnapshotPlayer[];
} {
  const g1Positions = ['T1', 'H1', 'M1', 'R1'];
  const g2Positions = ['T2', 'H2', 'M2', 'R2'];

  // If separating subs, filter them out first
  const mainPlayers = separateSubs ? players.filter((p) => !p.isSubstitute) : players;
  const subs = separateSubs ? players.filter((p) => p.isSubstitute) : [];

  return {
    group1: mainPlayers.filter((p) => p.position && g1Positions.includes(p.position)),
    group2: mainPlayers.filter((p) => p.position && g2Positions.includes(p.position)),
    unassigned: mainPlayers.filter(
      (p) => !p.position || (!g1Positions.includes(p.position) && !g2Positions.includes(p.position))
    ),
    substitutes: subs,
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
    if (status.bisSource === 'tome') {
      // 'tome' = augmented tome is BiS
      return status.isAugmented ? 'tome_up' : 'tome';
    }
    if (status.bisSource === 'base_tome') {
      // 'base_tome' = base tome is BiS (no augmentation)
      return 'tome';
    }
    if (status.bisSource === 'crafted') {
      return 'crafted';
    }
    // Null bisSource with hasItem - assume savage
    return 'savage';
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
    // Special case: 'tome' BiS with item but NOT augmented
    // itemLevel from BiS is augmented iLv, but player only has base tome
    if (slot.hasItem && slot.bisSource === 'tome' && !slot.isAugmented) {
      const isWeapon = slot.slot === 'weapon';
      const iLv = getItemLevelForCategory(tierId, 'tome', isWeapon);
      if (iLv > 0) {
        totalILv += iLv;
        validSlots++;
      }
      continue;
    }

    // 'base_tome' BiS - use base tome iLv (not augmented)
    if (slot.hasItem && slot.bisSource === 'base_tome') {
      const isWeapon = slot.slot === 'weapon';
      const iLv = getItemLevelForCategory(tierId, 'tome', isWeapon);
      if (iLv > 0) {
        totalILv += iLv;
        validSlots++;
      }
      continue;
    }

    // Use itemLevel from BiS import if player has the item
    // (itemLevel is set for BiS target, not current gear)
    if (slot.hasItem && slot.itemLevel && slot.itemLevel > 0) {
      totalILv += slot.itemLevel;
      validSlots++;
      continue;
    }

    // Calculate from currentSource for unacquired gear or when itemLevel unavailable
    const currentSource = getEffectiveCurrentSource(slot);
    const isWeapon = slot.slot === 'weapon';

    // For 'unknown' slots, assume crafted gear as baseline (most common starting point)
    // This prevents inflated averages when only a few items are checked
    const effectiveSource = currentSource === 'unknown' ? 'crafted' : currentSource;
    const iLv = getItemLevelForCategory(tierId, effectiveSource, isWeapon);
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
