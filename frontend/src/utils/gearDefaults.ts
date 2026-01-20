/**
 * Gear Default Values
 *
 * Provides smart defaults for gear slots when creating/resetting players.
 */

import type { GearSlot, GearSource, GearSlotStatus } from '../types';
import { GEAR_SLOTS } from '../types';

/**
 * Get the default BiS source for a gear slot.
 *
 * Smart defaults:
 * - Weapon: raid (always raid drop)
 * - Ring1 (R. Ring): raid (unique savage ring)
 * - Ring2 (L. Ring): tome (can't wear two of same savage ring)
 * - All others: null (unset, displays as "--")
 *
 * @param slot - The gear slot
 * @returns Default BiS source or null for unset
 */
export function getDefaultBisSource(slot: GearSlot): GearSource | null {
  switch (slot) {
    case 'weapon':
      return 'raid';
    case 'ring1':
      return 'raid';
    case 'ring2':
      return 'tome';
    default:
      return null;
  }
}

/**
 * Create default gear array for a new player.
 *
 * Uses smart defaults for weapon and rings, null for other slots.
 *
 * @returns Array of default gear slot statuses
 */
export function createDefaultGear(): GearSlotStatus[] {
  return GEAR_SLOTS.map((slot) => ({
    slot,
    bisSource: getDefaultBisSource(slot),
    hasItem: false,
    isAugmented: false,
    currentSource: 'crafted' as const,
  }));
}

/**
 * Reset gear progress while keeping BiS configuration.
 *
 * Clears hasItem/isAugmented but preserves bisSource and item metadata.
 *
 * @param gear - Current gear array
 * @returns Gear array with progress reset
 */
export function resetGearProgress(gear: GearSlotStatus[]): GearSlotStatus[] {
  return gear.map((slot) => ({
    ...slot,
    hasItem: false,
    isAugmented: false,
    currentSource: 'crafted' as const,
    // Keep: bisSource, itemName, itemIcon, itemLevel, itemStats
  }));
}

/**
 * Unlink BiS data while keeping progress.
 *
 * Clears item metadata but preserves hasItem/isAugmented/bisSource.
 *
 * @param gear - Current gear array
 * @returns Gear array with BiS metadata cleared
 */
export function unlinkBisData(gear: GearSlotStatus[]): GearSlotStatus[] {
  return gear.map((slot) => {
    // Recalculate currentSource based on current state
    let currentSource: 'savage' | 'tome' | 'tome_up' | 'crafted' = 'crafted';
    if (slot.hasItem) {
      if (slot.bisSource === 'raid') {
        currentSource = 'savage';
      } else if (slot.bisSource === 'tome' || slot.bisSource === 'base_tome') {
        currentSource = slot.isAugmented ? 'tome_up' : 'tome';
      }
    }
    return {
      slot: slot.slot,
      bisSource: slot.bisSource,
      hasItem: slot.hasItem,
      isAugmented: slot.isAugmented,
      currentSource,
      // Clear: itemName, itemIcon, itemLevel, itemStats
    };
  });
}

/**
 * Reset gear to defaults (complete reset).
 *
 * Resets to default BiS sources and clears all progress/metadata.
 *
 * @returns Fresh gear array with smart defaults
 */
export function resetGearCompletely(): GearSlotStatus[] {
  return createDefaultGear();
}
