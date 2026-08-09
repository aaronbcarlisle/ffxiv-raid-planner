/**
 * rosterLedgerJumps — which ledger entry a gear slot points at (C7, D-05).
 *
 * The v2 expression of legacy's two-part wiring: `GroupViewContent`'s
 * `playerSlotsWithLootEntries` / `playerSlotsWithMaterialEntries` maps decided
 * whether a slot's jump affordance appeared, while `useViewNavigation`'s
 * finders decided which entry it landed on — two derivations that could
 * disagree. Here availability IS the target: one pass produces the id, and a
 * slot shows the affordance exactly when an id exists.
 *
 * Loot-entry precedence is legacy's, preserved verbatim
 * (`useViewNavigation.ts:150-165`): exact slot + non-extra, then exact slot,
 * then — for ring slots only — a generic "ring" entry non-extra, then any.
 * Rings need the fallback because the loot log stores a single `ring` slot
 * while gear tracks `ring1`/`ring2`.
 *
 * Pure and store-free so the precedence rules are testable without a card.
 */
import { GEAR_SLOTS } from '../../types';
import type { GearSlot, LootLogEntry, MaterialLogEntry } from '../../types';

/** The ledger entries a single gear slot can jump to. */
export interface SlotJumpTarget {
  /** Loot-log entry id (raid drops). */
  loot?: number;
  /** Material-log entry id (the augment that upgraded this slot). */
  material?: number;
}

export type SlotJumpTargets = Partial<Record<GearSlot, SlotJumpTarget>>;

/** The kind of ledger row a jump lands on — the URL's `entryType`. */
export type JumpKind = 'loot' | 'material';

function findLootEntry(
  lootLog: LootLogEntry[],
  playerId: string,
  slot: GearSlot
): LootLogEntry | undefined {
  const isPlayer = (e: LootLogEntry) => e.recipientPlayerId === playerId;
  const isRingSlot = slot === 'ring1' || slot === 'ring2';
  const isRingVariant = (e: LootLogEntry) =>
    e.itemSlot === 'ring' || e.itemSlot === 'ring1' || e.itemSlot === 'ring2';
  return (
    lootLog.find((e) => isPlayer(e) && e.itemSlot === slot && !e.isExtra) ??
    lootLog.find((e) => isPlayer(e) && e.itemSlot === slot) ??
    (isRingSlot ? lootLog.find((e) => isPlayer(e) && isRingVariant(e) && !e.isExtra) : undefined) ??
    (isRingSlot ? lootLog.find((e) => isPlayer(e) && isRingVariant(e)) : undefined)
  );
}

/**
 * The augment material for a gear slot. Deliberately narrower than legacy's
 * finder: `tome_weapon` (a universal tomestone with no `slotAugmented`) is NOT
 * a gear slot — the tome sub-row's own jump owns it (C4), so it must never
 * attach to the weapon row above it.
 */
function findMaterialEntry(
  materialLog: MaterialLogEntry[],
  playerId: string,
  slot: GearSlot
): MaterialLogEntry | undefined {
  return materialLog.find((e) => e.recipientPlayerId === playerId && e.slotAugmented === slot);
}

/**
 * Where a slot's right-click jump menu opens.
 *
 * Keyboard-invoked context menus (Shift+F10, the menu key) dispatch with NO
 * cursor position — both coordinates are 0 — and must anchor to the icon
 * instead of the page corner. A mouse right-click against the viewport's left
 * or top edge legitimately reports a single 0, which is a real position: only
 * the both-zero case is "no position" (PR #200 review).
 */
export function jumpMenuAnchor(
  event: { clientX: number; clientY: number },
  iconRect: { left: number; bottom: number }
): { x: number; y: number } {
  if (event.clientX === 0 && event.clientY === 0) {
    return { x: iconRect.left, y: iconRect.bottom };
  }
  return { x: event.clientX, y: event.clientY };
}

/**
 * Resolve every gear slot's ledger targets for one player. Slots with nothing
 * to jump to are absent from the result (never present-but-empty), so a caller
 * can test `targets[slot]` for "is there an affordance here at all".
 */
export function buildSlotJumpTargets(
  lootLog: LootLogEntry[],
  materialLog: MaterialLogEntry[],
  playerId: string
): SlotJumpTargets {
  const targets: SlotJumpTargets = {};
  // 'offhand' iterates here but can never populate: no loot entry carries
  // itemSlot 'offhand' and no material entry carries slotAugmented 'offhand'
  // (both validated against loot-domain sets the off-hand is excluded from).
  for (const slot of GEAR_SLOTS) {
    const lootEntry = findLootEntry(lootLog, playerId, slot);
    const materialEntry = findMaterialEntry(materialLog, playerId, slot);
    if (!lootEntry && !materialEntry) continue;
    const target: SlotJumpTarget = {};
    if (lootEntry) target.loot = lootEntry.id;
    if (materialEntry) target.material = materialEntry.id;
    targets[slot] = target;
  }
  return targets;
}
