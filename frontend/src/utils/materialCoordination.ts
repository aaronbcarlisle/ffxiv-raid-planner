/**
 * Material Coordination Utilities
 *
 * Provides cross-store coordination for material logging actions.
 * Ensures material log entries and gear updates stay in sync.
 *
 * Material Types:
 * - universal_tomestone: Grants the base tome weapon (marks hasItem = true)
 * - solvent: Augments tome weapon OR weapon gear slot (marks isAugmented = true)
 * - twine: Augments armor slots (head, body, hands, legs, feet)
 * - glaze: Augments accessory slots (earring, necklace, bracelet, ring1, ring2)
 */

import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useTierStore } from '../stores/tierStore';
import { UPGRADE_MATERIAL_SLOTS, isSlotAugmentationMaterial } from '../gamedata/loot-tables';
import type {
  MaterialLogEntryCreate,
  MaterialLogEntry,
  SnapshotPlayer,
  GearSlot,
  MaterialType,
} from '../types';

// ==================== Types ====================

export interface LogMaterialOptions {
  /** Update player's gear when logging a material */
  updateGear?: boolean;
  /** Specific slot to mark as augmented (for twine/glaze) */
  slotToAugment?: GearSlot;
  /** For solvent: augment tome weapon instead of weapon gear slot */
  augmentTomeWeapon?: boolean;
}

export interface DeleteMaterialOptions {
  /** Revert player's gear when deleting a material entry */
  revertGear?: boolean;
  /** Specific slot to un-augment (if known from the original log action) */
  slotToRevert?: GearSlot;
  /** For solvent: revert tome weapon instead of weapon gear slot */
  revertTomeWeapon?: boolean;
}

// ==================== Helper Functions ====================

/**
 * Check if player needs the tome weapon item.
 *
 * Returns true if:
 * - tomeWeapon.pursuing === true (player is tracking tome weapon)
 * - tomeWeapon.hasItem === false (player doesn't have it yet)
 */
export function needsTomeWeaponItem(player: SnapshotPlayer): boolean {
  return (
    player.tomeWeapon.pursuing === true &&
    player.tomeWeapon.hasItem === false
  );
}

/**
 * Check if player's tome weapon needs augmentation.
 *
 * Returns true if:
 * - tomeWeapon.pursuing === true (player is tracking tome weapon)
 * - tomeWeapon.hasItem === true (player has the tome weapon)
 * - tomeWeapon.isAugmented === false (not yet augmented)
 */
export function needsTomeWeaponAugmentation(player: SnapshotPlayer): boolean {
  return (
    player.tomeWeapon.pursuing === true &&
    player.tomeWeapon.hasItem === true &&
    player.tomeWeapon.isAugmented === false
  );
}

/**
 * Check if player has the tome weapon (for universal_tomestone reversion).
 */
export function hasTomeWeaponItem(player: SnapshotPlayer): boolean {
  return (
    player.tomeWeapon.pursuing === true &&
    player.tomeWeapon.hasItem === true
  );
}

/**
 * Check if player's tome weapon is augmented.
 */
export function isTomeWeaponAugmented(player: SnapshotPlayer): boolean {
  return (
    player.tomeWeapon.pursuing === true &&
    player.tomeWeapon.hasItem === true &&
    player.tomeWeapon.isAugmented === true
  );
}

/**
 * Get eligible slots for augmentation based on player's gear and material type.
 *
 * A slot is eligible if:
 * 1. bisSource === 'tome' (BiS is augmented tome)
 * 2. hasItem === true (player has the tome piece)
 * 3. isAugmented === false (not yet augmented)
 * 4. Slot matches material type (twine → armor, glaze → accessories, solvent → weapon)
 *
 * Note: For solvent, this returns weapon gear slots only. Tome weapon is handled separately.
 */
export function getEligibleSlotsForAugmentation(
  player: SnapshotPlayer,
  materialType: MaterialType
): GearSlot[] {
  // Universal tomestone doesn't augment gear slots
  if (materialType === 'universal_tomestone') {
    return [];
  }

  if (!isSlotAugmentationMaterial(materialType)) {
    return [];
  }

  const validSlots = UPGRADE_MATERIAL_SLOTS[materialType];

  return player.gear
    .filter((g) =>
      validSlots.includes(g.slot) &&
      g.bisSource === 'tome' &&
      g.hasItem === true &&
      g.isAugmented === false
    )
    .map((g) => g.slot);
}

/**
 * Get augmented slots that could be reverted for a player by material type.
 *
 * A slot is revertable if:
 * 1. bisSource === 'tome' (BiS is augmented tome)
 * 2. hasItem === true (player has the tome piece)
 * 3. isAugmented === true (currently augmented)
 * 4. Slot matches material type (twine → armor, glaze → accessories, solvent → weapon)
 */
export function getAugmentedSlotsForMaterial(
  player: SnapshotPlayer,
  materialType: MaterialType
): GearSlot[] {
  if (materialType === 'universal_tomestone') {
    return [];
  }

  if (!isSlotAugmentationMaterial(materialType)) {
    return [];
  }

  const validSlots = UPGRADE_MATERIAL_SLOTS[materialType];

  return player.gear
    .filter((g) =>
      validSlots.includes(g.slot) &&
      g.bisSource === 'tome' &&
      g.hasItem === true &&
      g.isAugmented === true
    )
    .map((g) => g.slot);
}

// ==================== Coordination Functions ====================

/**
 * Log material with optional gear update.
 *
 * Coordinates multiple store actions:
 * 1. Creates the material log entry
 * 2. If updateGear=true:
 *    - universal_tomestone: marks tome weapon as "have" (hasItem = true)
 *    - solvent: marks tome weapon OR weapon gear slot as augmented
 *    - twine/glaze: marks specified gear slot as augmented
 */
export async function logMaterialAndUpdateGear(
  groupId: string,
  tierId: string,
  data: MaterialLogEntryCreate,
  options: LogMaterialOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();
  const tierStore = useTierStore.getState();

  // Determine the slot to record in the entry
  let slotAugmented: MaterialLogEntryCreate['slotAugmented'] = null;
  if (options.updateGear) {
    if (data.materialType === 'solvent' && options.augmentTomeWeapon) {
      slotAugmented = 'tome_weapon';
    } else if (options.slotToAugment) {
      slotAugmented = options.slotToAugment;
    }
    // universal_tomestone doesn't augment a slot, it grants the item
  }

  // 1. Create the material entry (with slot information)
  await lootStore.createMaterialEntry(groupId, tierId, {
    ...data,
    slotAugmented,
  });

  // 2. Update gear if requested
  if (options.updateGear) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (!player) return;

    if (data.materialType === 'universal_tomestone') {
      // Universal tomestone grants the base tome weapon
      if (needsTomeWeaponItem(player)) {
        await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
          tomeWeapon: {
            ...player.tomeWeapon,
            hasItem: true,
          },
        });
      }
    } else if (data.materialType === 'solvent') {
      // Solvent can augment tome weapon OR weapon gear slot
      if (options.augmentTomeWeapon && needsTomeWeaponAugmentation(player)) {
        await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
          tomeWeapon: {
            ...player.tomeWeapon,
            isAugmented: true,
          },
        });
      } else if (options.slotToAugment) {
        const updatedGear = player.gear.map((g) =>
          g.slot === options.slotToAugment ? { ...g, isAugmented: true } : g
        );
        await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
          gear: updatedGear,
        });
      }
    } else if (options.slotToAugment) {
      // Twine/Glaze: augment specified gear slot
      const updatedGear = player.gear.map((g) =>
        g.slot === options.slotToAugment ? { ...g, isAugmented: true } : g
      );
      await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
        gear: updatedGear,
      });
    }
  }
}

/**
 * Delete material entry with optional gear reversion.
 *
 * Coordinates multiple store actions:
 * 1. Deletes the material log entry
 * 2. If revertGear=true:
 *    - universal_tomestone: marks tome weapon as not have (hasItem = false)
 *    - solvent: un-augments tome weapon OR weapon gear slot
 *    - twine/glaze: un-augments gear slot
 *
 * Note: For slot augmentation materials, if slotToRevert is not provided,
 * we attempt to find an augmented slot of the matching type. If multiple
 * slots are augmented, we pick the first one (best-effort heuristic).
 */
export async function deleteMaterialAndRevertGear(
  groupId: string,
  tierId: string,
  entryId: number,
  entry: MaterialLogEntry,
  options: DeleteMaterialOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();
  const tierStore = useTierStore.getState();

  // 1. Delete the material entry
  await lootStore.deleteMaterialEntry(groupId, tierId, entryId);

  // 2. Revert gear if requested
  if (options.revertGear) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === entry.recipientPlayerId
    );

    if (!player) return;

    if (entry.materialType === 'universal_tomestone') {
      // Universal tomestone: revert tome weapon hasItem
      if (hasTomeWeaponItem(player)) {
        await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
          tomeWeapon: {
            ...player.tomeWeapon,
            hasItem: false,
            isAugmented: false, // Also reset augmented since you can't have augmented without having item
          },
        });
      }
    } else if (entry.materialType === 'solvent') {
      // Solvent: revert tome weapon OR weapon gear slot augmentation
      // Try tome weapon first if it's augmented
      if (isTomeWeaponAugmented(player)) {
        await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
          tomeWeapon: {
            ...player.tomeWeapon,
            isAugmented: false,
          },
        });
      } else {
        // Fall back to weapon gear slot
        const slotToRevert = options.slotToRevert ?? getAugmentedSlotsForMaterial(player, 'solvent')[0];
        if (slotToRevert) {
          const updatedGear = player.gear.map((g) =>
            g.slot === slotToRevert ? { ...g, isAugmented: false } : g
          );
          await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
            gear: updatedGear,
          });
        }
      }
    } else {
      // Twine/Glaze: revert gear slot augmentation
      let slotToRevert = options.slotToRevert;
      if (!slotToRevert) {
        const augmentedSlots = getAugmentedSlotsForMaterial(player, entry.materialType);
        slotToRevert = augmentedSlots[0]; // Pick first if multiple
      }

      if (slotToRevert) {
        const updatedGear = player.gear.map((g) =>
          g.slot === slotToRevert ? { ...g, isAugmented: false } : g
        );
        await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
          gear: updatedGear,
        });
      }
    }
  }
}
