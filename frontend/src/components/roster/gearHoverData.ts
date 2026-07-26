import type { GearSlotStatus } from '../../types';

/**
 * Legacy `SlotIcon.hasItemData` (Phase C C2, D-02): BiS item detail or a
 * synced equipped item — either gives the hover item card something to show.
 * Shared by the expanded gear table and the compact pip strip, which carry
 * the same hover-inspect affordance.
 */
export function hasHoverData(status: GearSlotStatus): boolean {
  return Boolean(
    (status.itemName && status.itemLevel) ||
      status.equippedItemName ||
      (status.equippedItemLevel ?? 0) > 0
  );
}
