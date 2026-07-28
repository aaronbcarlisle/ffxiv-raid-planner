/**
 * The gear slot-icon treatment, shared by both card densities.
 *
 * Moved out of `RosterGearTable` (where it was `slotIconClass` + an inline
 * `itemIcon || GEAR_SLOT_ICONS[slot]`) when the compact strip gained icons
 * too: two copies in the same directory would trip `pnpm dupes` and, worse,
 * let the densities drift into printing the same slot differently.
 *
 * Condensed originally from legacy `GearTable`'s SlotIcon: real item icons
 * dim/desaturate by progress; placeholder glyphs invert to read on the dark
 * surface and dim the same way.
 */

import { GEAR_SLOT_ICONS, type GearSlot, type GearSlotStatus } from '../../types';
import { requiresAugmentation } from '../../utils/calculations';

/** Whether this slot has a real item icon (vs. the slot placeholder glyph). */
export function isRealItemIcon(status: GearSlotStatus): boolean {
  return !!status.itemIcon;
}

/** The icon to print for a slot: its item's, or the slot placeholder. */
export function gearSlotIconUrl(slot: GearSlot, status: GearSlotStatus): string {
  return status.itemIcon || GEAR_SLOT_ICONS[slot];
}

/** Progress treatment for that icon. */
export function gearSlotIconClass(status: GearSlotStatus, isItemIcon: boolean): string {
  const incomplete =
    !status.hasItem || (status.bisSource === 'tome' && requiresAugmentation(status) && !status.isAugmented);
  if (isItemIcon) {
    if (!status.hasItem) return 'rounded opacity-50 grayscale';
    return incomplete ? 'rounded opacity-75' : 'rounded';
  }
  if (!status.hasItem) return 'opacity-50';
  return incomplete ? 'brightness-0 invert opacity-50' : 'brightness-0 invert opacity-90';
}
