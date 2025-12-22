/**
 * Cost Configuration
 *
 * Book exchange costs and tomestone costs for gear.
 * These values are consistent across savage tiers.
 */

import type { GearSlot } from '../types';
import type { FloorNumber } from './loot-tables';

/**
 * Book costs to exchange for gear
 * These are the number of weekly books needed to purchase each slot
 */
export const BOOK_COSTS: Record<GearSlot, number> = {
  weapon: 8,
  body: 6,
  legs: 6,
  head: 4,
  hands: 4,
  feet: 4,
  earring: 3,
  necklace: 3,
  bracelet: 3,
  ring1: 3,
  ring2: 3,
};

/**
 * Which book type (floor) is used to purchase each slot
 */
export const BOOK_TYPE_FOR_SLOT: Record<GearSlot, FloorNumber> = {
  weapon: 4,
  body: 3,
  legs: 3,
  head: 2,
  hands: 2,
  feet: 2,
  earring: 1,
  necklace: 1,
  bracelet: 1,
  ring1: 1,
  ring2: 1,
};

/**
 * Book cost for upgrade materials
 */
export const UPGRADE_MATERIAL_BOOK_COSTS: Record<'twine' | 'glaze', { books: number; floor: FloorNumber }> = {
  twine: { books: 4, floor: 3 },
  glaze: { books: 4, floor: 2 },
  // Solvent cannot be purchased with books - only drops from floor 3
};

/**
 * Tomestone costs for gear (weekly capped tomestones)
 * Weapon requires additional token from normal raid
 */
export const TOMESTONE_COSTS: Record<GearSlot, number> = {
  weapon: 500, // Also requires 7 weekly tokens from normal mode
  body: 825,
  legs: 825,
  head: 495,
  hands: 495,
  feet: 495,
  earring: 375,
  necklace: 375,
  bracelet: 375,
  ring1: 375,
  ring2: 375,
};

/**
 * Weekly tomestone cap
 */
export const WEEKLY_TOMESTONE_CAP = 450;

/**
 * Calculate weeks needed to acquire all tomestone gear
 */
export function calculateWeeksForTomestones(totalCost: number): number {
  return Math.ceil(totalCost / WEEKLY_TOMESTONE_CAP);
}

/**
 * Calculate total tomestone cost for a set of slots
 */
export function calculateTotalTomestoneCost(slots: GearSlot[]): number {
  return slots.reduce((total, slot) => total + TOMESTONE_COSTS[slot], 0);
}

/**
 * Calculate worst-case weeks to acquire a slot via books
 * (If you never win a drop and must exchange)
 */
export function calculateWeeksForBooks(slot: GearSlot): number {
  return BOOK_COSTS[slot]; // 1 book per week per floor
}

/**
 * Slot value weights for priority calculations
 * Higher value = more impactful slot
 */
export const SLOT_VALUE_WEIGHTS: Record<GearSlot, number> = {
  weapon: 3.0,
  body: 1.5,
  legs: 1.5,
  head: 1.0,
  hands: 1.0,
  feet: 1.0,
  earring: 0.8,
  necklace: 0.8,
  bracelet: 0.8,
  ring1: 0.8,
  ring2: 0.8,
};
