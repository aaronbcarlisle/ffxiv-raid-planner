/**
 * Loot Tables and Drop Configuration
 *
 * This file defines what drops from each savage floor.
 * These mechanics are consistent across all savage tiers.
 */

import type { GearSlot } from '../types';

export type FloorNumber = 1 | 2 | 3 | 4;

export interface FloorLootTable {
  /** Floor number (1-4) */
  floor: FloorNumber;
  /** Gear slots that can drop from this floor */
  gearDrops: GearSlot[];
  /** Upgrade materials that drop from this floor */
  upgradeMaterials: ('twine' | 'glaze' | 'solvent')[];
  /** Special materials like Universal Tomestone (informational only, no priority calc) */
  specialMaterials?: string[];
  /** Book type earned from this floor */
  bookType: string;
  /** Number of coffers that drop (typically 2) */
  cofferCount: number;
}

/**
 * Standard savage floor loot tables.
 * These are consistent across all savage tiers since Stormblood.
 */
export const FLOOR_LOOT_TABLES: Record<FloorNumber, FloorLootTable> = {
  1: {
    floor: 1,
    gearDrops: ['earring', 'necklace', 'bracelet', 'ring1'], // ring1 represents "ring" drop
    upgradeMaterials: [], // First floor never has upgrade materials
    bookType: 'I',
    cofferCount: 2,
  },
  2: {
    floor: 2,
    gearDrops: ['head', 'hands', 'feet'],
    upgradeMaterials: ['glaze'],
    specialMaterials: ['Universal Tomestone'],
    bookType: 'II',
    cofferCount: 2,
  },
  3: {
    floor: 3,
    gearDrops: ['body', 'legs'],
    upgradeMaterials: ['twine', 'solvent'],
    bookType: 'III',
    cofferCount: 2,
  },
  4: {
    floor: 4,
    gearDrops: ['weapon'],
    upgradeMaterials: [], // No upgrade materials from floor 4
    bookType: 'IV',
    cofferCount: 1, // Weapon coffer only
  },
};

/**
 * Floor color coding for UI.
 * Each floor has a distinct color for visual identification.
 */
export const FLOOR_COLORS: Record<FloorNumber, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },   // M9S  - Green
  2: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },      // M10S - Blue
  3: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }, // M11S - Purple
  4: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },   // M12S - Amber
};

/**
 * Get which floor drops a specific gear slot
 */
export function getFloorForSlot(slot: GearSlot): FloorNumber {
  // Accessories from floor 1
  if (['earring', 'necklace', 'bracelet', 'ring1', 'ring2'].includes(slot)) {
    return 1;
  }
  // Head/Hands/Feet from floor 2
  if (['head', 'hands', 'feet'].includes(slot)) {
    return 2;
  }
  // Body/Legs from floor 3
  if (['body', 'legs'].includes(slot)) {
    return 3;
  }
  // Weapon from floor 4
  if (slot === 'weapon') {
    return 4;
  }
  throw new Error(`Unknown gear slot: ${slot}`);
}

/**
 * Get which floor drops a specific upgrade material
 */
export function getFloorForUpgradeMaterial(material: 'twine' | 'glaze' | 'solvent'): FloorNumber[] {
  switch (material) {
    case 'glaze':
      return [2]; // Floor 2 only
    case 'twine':
      return [3]; // Floor 3 only
    case 'solvent':
      return [3]; // Floor 3 only
  }
}

/**
 * Upgrade material to slot type mapping
 */
export const UPGRADE_MATERIAL_SLOTS: Record<'twine' | 'glaze' | 'solvent', GearSlot[]> = {
  twine: ['head', 'body', 'hands', 'legs', 'feet'], // Left-side armor
  glaze: ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'], // Accessories
  solvent: ['weapon'], // Weapon only
};

/**
 * Get which upgrade material is needed for a slot
 */
export function getUpgradeMaterialForSlot(slot: GearSlot): 'twine' | 'glaze' | 'solvent' {
  if (UPGRADE_MATERIAL_SLOTS.twine.includes(slot)) return 'twine';
  if (UPGRADE_MATERIAL_SLOTS.glaze.includes(slot)) return 'glaze';
  if (UPGRADE_MATERIAL_SLOTS.solvent.includes(slot)) return 'solvent';
  throw new Error(`Unknown slot for upgrade material: ${slot}`);
}
