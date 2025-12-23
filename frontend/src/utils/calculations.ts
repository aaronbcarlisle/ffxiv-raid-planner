/**
 * Gear and Team Calculations
 */

import type { Player, GearSlotStatus, TeamSummary } from '../types';
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
export function calculateTeamSummary(players: Player[]): TeamSummary {
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
  players: Player[],
  displayOrder: string[],
  sortPreset: 'standard' | 'dps-first' | 'healer-first' | 'custom' = 'standard'
): Player[] {
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
export function groupPlayersByLightParty(players: Player[]): {
  group1: Player[]; // T1, H1, M1, R1
  group2: Player[]; // T2, H2, M2, R2
  unassigned: Player[];
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
