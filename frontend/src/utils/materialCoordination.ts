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
  LootMethod,
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

export interface UpdateMaterialOptions {
  /** Update player's gear to reflect the (possibly new) material/slot */
  updateGear?: boolean;
  /** Whether the edit form actually RENDERED a gear control (default true). When this is
   *  `false` and both the recipient and the material are unchanged, the user had no way to
   *  express gear intent (recipient no longer in the roster — R-21's injected Select entry),
   *  so the entry's recorded `slotAugmented` is preserved on the PUT instead of being
   *  cleared by the `''` sentinel, and reconciliation is skipped. A material change never preserves —
   *  it owes the old effect's revert, and the old slot is invalid in the new material's
   *  domain (round 11). Without this, a notes-only edit of an out-of-pool
   *  recipient's entry wipes the recorded slot, and a later `deleteMaterialAndRevertGear`
   *  falls off the precise `entry.slotAugmented` branch onto the legacy heuristic (PR #236
   *  round 10). Distinct from `updateGear: false` with a control rendered, which is the
   *  user UNCHECKING it — a deliberate clear-and-revert. */
  gearEditable?: boolean;
  /** Specific slot to mark as augmented (for twine/glaze, or solvent-on-gear) */
  slotToAugment?: GearSlot;
  /** For solvent: augment tome weapon instead of weapon gear slot */
  augmentTomeWeapon?: boolean;
}

/**
 * The gear consequence a material log entry currently represents (or will
 * represent after an edit). Used by `updateMaterialAndReconcileGear` to
 * diff old-vs-new state instead of branching on material type directly —
 * this is what lets a material-type change (e.g. universal_tomestone →
 * twine) revert the old effect and apply the new one symmetrically, unlike
 * the legacy edit modal whose UT branch never fell through to the generic
 * slot handling (`LogMaterialModal.tsx:348`).
 */
type GearEffect =
  | { kind: 'tome_item' }
  | { kind: 'tome_aug' }
  | { kind: 'slot'; slot: GearSlot }
  | null;

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
 *
 * Note: If step 1 succeeds but step 2 fails, the material entry will exist
 * without the corresponding gear update. In this rare case, users can manually
 * update their gear status. We prioritize data integrity (entry exists) over
 * rollback complexity.
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

    // Re-get fresh state after potential fetch to avoid stale data
    const freshTierStore = useTierStore.getState();
    const player = freshTierStore.currentTier?.players?.find(
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

    // Re-get fresh state after potential fetch to avoid stale data
    const freshTierStore = useTierStore.getState();
    const player = freshTierStore.currentTier?.players?.find(
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
      // Use entry.slotAugmented if available for precise reversion
      if (entry.slotAugmented === 'tome_weapon') {
        // Entry explicitly recorded tome weapon augmentation
        if (isTomeWeaponAugmented(player)) {
          await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
            tomeWeapon: {
              ...player.tomeWeapon,
              isAugmented: false,
            },
          });
        }
      } else if (entry.slotAugmented) {
        // Entry explicitly recorded a gear slot augmentation
        const updatedGear = player.gear.map((g) =>
          g.slot === entry.slotAugmented ? { ...g, isAugmented: false } : g
        );
        await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
          gear: updatedGear,
        });
      } else {
        // Legacy entry without slotAugmented - fall back to heuristics
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
      }
    } else {
      // Twine/Glaze: revert gear slot augmentation
      // Use entry.slotAugmented if available for precise reversion
      let slotToRevert: string | undefined = entry.slotAugmented ?? options.slotToRevert;
      if (!slotToRevert) {
        // Legacy entry without slotAugmented - fall back to heuristics
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

// ==================== Update Reconciliation (R-21) ====================

/** Derive the gear effect a logged entry represents, from its own fields. */
function effectFromEntry(
  materialType: MaterialType,
  slotAugmented: GearSlot | 'tome_weapon' | '' | null | undefined
): GearEffect {
  if (materialType === 'universal_tomestone') return { kind: 'tome_item' };
  if (slotAugmented === 'tome_weapon') return { kind: 'tome_aug' };
  if (slotAugmented) return { kind: 'slot', slot: slotAugmented };
  return null;
}

/**
 * Derive the gear effect the *new* form state represents, mirroring the
 * create-path mapping (`logMaterialAndUpdateGear:194-202`) plus the
 * universal_tomestone → tome_item case (create never needs this — it grants
 * the item unconditionally on updateGear — but the edit path's effect model
 * must represent it to diff against the old entry).
 */
function effectFromOptions(materialType: MaterialType, options: UpdateMaterialOptions): GearEffect {
  if (!options.updateGear) return null;
  if (materialType === 'universal_tomestone') return { kind: 'tome_item' };
  if (materialType === 'solvent' && options.augmentTomeWeapon) return { kind: 'tome_aug' };
  if (options.slotToAugment) return { kind: 'slot', slot: options.slotToAugment };
  return null;
}

/** The wire value to send for `slotAugmented` on the PUT. `''` clears — never `null`. */
function effectToWireSlot(effect: GearEffect): GearSlot | 'tome_weapon' | '' {
  if (!effect) return '';
  if (effect.kind === 'tome_item') return '';
  if (effect.kind === 'tome_aug') return 'tome_weapon';
  return effect.slot;
}

function effectsEqual(a: GearEffect, b: GearEffect): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.slot === b.slot;
  return true;
}

/**
 * Revert a gear effect on `player`'s current state.
 *
 * Deliberately asymmetric with `deleteMaterialAndRevertGear`: a `tome_item`
 * revert (universal_tomestone unchecked/replaced in the *edit* form) clears
 * `hasItem` ONLY, never `isAugmented` — augmentation is solvent's concern,
 * not the tome-item checkbox's (legacy precedent `LogMaterialModal.tsx:356-363`).
 */
async function revertGearEffect(
  groupId: string,
  tierId: string,
  playerId: string,
  effect: GearEffect,
  player: SnapshotPlayer
): Promise<void> {
  if (!effect) return;
  const tierStore = useTierStore.getState();

  if (effect.kind === 'tome_item') {
    if (hasTomeWeaponItem(player)) {
      await tierStore.updatePlayer(groupId, tierId, playerId, {
        tomeWeapon: { ...player.tomeWeapon, hasItem: false },
      });
    }
  } else if (effect.kind === 'tome_aug') {
    if (isTomeWeaponAugmented(player)) {
      await tierStore.updatePlayer(groupId, tierId, playerId, {
        tomeWeapon: { ...player.tomeWeapon, isAugmented: false },
      });
    }
  } else {
    const updatedGear = player.gear.map((g) =>
      g.slot === effect.slot ? { ...g, isAugmented: false } : g
    );
    await tierStore.updatePlayer(groupId, tierId, playerId, { gear: updatedGear });
  }
}

/** Apply a gear effect to `player`'s current state (guards mirror `logMaterialAndUpdateGear:225-260`). */
async function applyGearEffect(
  groupId: string,
  tierId: string,
  playerId: string,
  effect: GearEffect,
  player: SnapshotPlayer
): Promise<void> {
  if (!effect) return;
  const tierStore = useTierStore.getState();

  if (effect.kind === 'tome_item') {
    if (needsTomeWeaponItem(player)) {
      await tierStore.updatePlayer(groupId, tierId, playerId, {
        tomeWeapon: { ...player.tomeWeapon, hasItem: true },
      });
    }
  } else if (effect.kind === 'tome_aug') {
    if (needsTomeWeaponAugmentation(player)) {
      await tierStore.updatePlayer(groupId, tierId, playerId, {
        tomeWeapon: { ...player.tomeWeapon, isAugmented: true },
      });
    }
  } else {
    const updatedGear = player.gear.map((g) =>
      g.slot === effect.slot ? { ...g, isAugmented: true } : g
    );
    await tierStore.updatePlayer(groupId, tierId, playerId, { gear: updatedGear });
  }
}

/**
 * Edit a material log entry and reconcile gear against the old-vs-new
 * effect diff (R-21).
 *
 * Coordinates multiple store actions:
 * 1. PUTs the entry update first (data-integrity precedent
 *    `materialCoordination.ts:179-182` — the entry is the durable record).
 * 2. Refreshes week data (the same call the create/delete store paths run —
 *    an edit can move an entry across weeks, so `WeekScopeControl`'s dots
 *    must not go stale).
 * 3. If the recipient is unchanged and the gear effect is unchanged, stops
 *    here — week/notes-only edits are silent, zero gear calls. The same
 *    applies when `options.gearEditable === false` with an unchanged
 *    recipient: no control rendered means no intent, so the PUT preserves
 *    the entry's recorded `slotAugmented` instead of clearing it.
 * 4. If the recipient is unchanged and the effect changed, reverts the old
 *    effect then applies the new one, re-reading store state between the
 *    two so the apply step sees the revert's result.
 * 5. If the recipient changed, the old recipient is left untouched (legacy
 *    ruling `LogMaterialModal.tsx:366-368`) and the new effect is applied
 *    only to the new recipient.
 * 6. A missing player (old or new) is a no-op for the gear step — the PUT
 *    and week refresh have already landed.
 */
export async function updateMaterialAndReconcileGear(
  groupId: string,
  tierId: string,
  oldEntry: MaterialLogEntry,
  newData: {
    weekNumber: number;
    floor: string;
    materialType: MaterialType;
    recipientPlayerId: string;
    method: LootMethod;
    /** Already trimmed. '' clears — backend applies any non-None string (loot_tracking.py:1513-1514). */
    notes: string;
  },
  options: UpdateMaterialOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();

  const newEffect = effectFromOptions(newData.materialType, options);
  const recipientChanged = newData.recipientPlayerId !== oldEntry.recipientPlayerId;
  // No gear control was rendered AND the recipient is unchanged AND the material is
  // unchanged: the null effect carries no user intent, so the recorded slot must survive the
  // PUT (see `gearEditable`'s doc). A CHANGED recipient still clears — the entry's slot
  // belonged to the old recipient and is meaningless on the new one. A CHANGED material also
  // clears (round 11): preserving across it would store a cross-material pair the create
  // path rejects with 400 (e.g. `universal_tomestone` + `'head'` — the PUT stores
  // unvalidated) AND skip the revert the material change owes, leaving the old slot
  // augmented while the entry reads as the new material's effect.
  const preserveRecordedEffect = !(options.gearEditable ?? true) && !recipientChanged &&
    newData.materialType === oldEntry.materialType;

  // 1. Update the material entry (PUT first — data-integrity precedent).
  await lootStore.updateMaterialEntry(groupId, tierId, oldEntry.id, {
    weekNumber: newData.weekNumber,
    floor: newData.floor,
    materialType: newData.materialType,
    recipientPlayerId: newData.recipientPlayerId,
    method: newData.method,
    slotAugmented: preserveRecordedEffect ? (oldEntry.slotAugmented ?? '') : effectToWireSlot(newEffect),
    notes: newData.notes,
  });

  // 2. Refresh week data (M5) — same call the create/delete store paths run.
  await useLootTrackingStore.getState().fetchWeekDataTypes(groupId, tierId);

  const oldEffect = effectFromEntry(oldEntry.materialType, oldEntry.slotAugmented);

  // 3. Same recipient, effect unchanged (or preserved as unchanged above): week/notes-only
  // edit, silent — zero gear calls.
  if (!recipientChanged && (preserveRecordedEffect || effectsEqual(oldEffect, newEffect))) {
    return;
  }

  // Ensure tier is loaded before trying to find players.
  const tierStore = useTierStore.getState();
  if (!tierStore.currentTier?.players) {
    await tierStore.fetchTier(groupId, tierId);
  }

  if (!recipientChanged) {
    // 4. Same recipient, effect changed: revert old, then apply new.
    const freshBeforeRevert = useTierStore.getState();
    const player = freshBeforeRevert.currentTier?.players?.find(
      (p) => p.id === oldEntry.recipientPlayerId
    );
    if (!player) return;

    await revertGearEffect(groupId, tierId, oldEntry.recipientPlayerId, oldEffect, player);

    // Re-read fresh state so apply sees the revert's result.
    const freshAfterRevert = useTierStore.getState();
    const freshPlayer = freshAfterRevert.currentTier?.players?.find(
      (p) => p.id === newData.recipientPlayerId
    );
    if (!freshPlayer) return;

    await applyGearEffect(groupId, tierId, newData.recipientPlayerId, newEffect, freshPlayer);
  } else {
    // 5. Recipient changed: old recipient untouched; apply new effect to the new recipient only.
    const freshTierStore = useTierStore.getState();
    const newPlayer = freshTierStore.currentTier?.players?.find(
      (p) => p.id === newData.recipientPlayerId
    );
    if (!newPlayer) return;

    await applyGearEffect(groupId, tierId, newData.recipientPlayerId, newEffect, newPlayer);
  }
}
