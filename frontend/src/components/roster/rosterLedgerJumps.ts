/**
 * rosterLedgerJumps — both directions of the gear↔ledger mapping (C7, D-05, D12).
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
import type { HistoryItem } from '../loot/logWeekGridData';

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

/**
 * The gear-table row a ledger entry points at — the INVERSE of
 * `buildSlotJumpTargets` above, and deliberately its neighbour: one module
 * owns both directions of the same mapping, so they can never drift apart.
 *
 * Two deltas from legacy's `useViewNavigation.ts:125-127`, both ruled:
 *   - `tome_weapon` is NOT normalized to `weapon` (R-D12-E). v2 renders a real
 *     tome sub-row with its own anchor, and `findMaterialEntry` above already
 *     rules that a tome material must never attach to the weapon row.
 *   - `ring` → `ring1` IS kept (R-D12-H), because nothing in the entry can
 *     tell the two rings apart. Note the asymmetry with `findLootEntry`'s ring
 *     fallback, which lets BOTH ring rows claim one generic entry: outbound is
 *     one-to-many, inbound is one-to-first. That is inherent to the data.
 */
export type JumpAnchorSlot = GearSlot | 'tome_weapon';

const ANCHOR_SLOTS: ReadonlySet<string> = new Set<string>([...GEAR_SLOTS, 'tome_weapon']);

/** Is this string an anchor slot? The `?slot=` param's validator. */
export function isJumpAnchorSlot(value: string): value is JumpAnchorSlot {
  return ANCHOR_SLOTS.has(value);
}

/** The gear row's DOM id. Legacy's shape (`GearTable.tsx:325,664`), v2's anchors. */
export function gearRowDomId(playerId: string, slot: JumpAnchorSlot): string {
  return `gear-row-${playerId}-${slot}`;
}

/**
 * `null` = "no row to land on, use the card" (R-D12-F): a universal tomestone
 * (no `slotAugmented`), or an `itemSlot` that isn't a gear slot at all.
 */
export function jumpAnchorSlotOf(item: HistoryItem): JumpAnchorSlot | null {
  const raw = item.kind === 'loot' ? item.entry.itemSlot : item.entry.slotAugmented;
  if (!raw) return null;
  const normalized = raw === 'ring' ? 'ring1' : raw;
  return isJumpAnchorSlot(normalized) ? normalized : null;
}

/**
 * R-28's split, as one symmetric rule (R-D12-A): the Log holds exactly one
 * week's grid, so an entry reaches a Log CELL only when it is in the week the
 * Log will display. Older AND newer both go to History — R-28's prose names
 * only the older case, but a newer entry is just as absent from that grid.
 *
 * `displayedWeek === null` means the caller could not name a week the Log's
 * mount is GUARANTEED to land on (R-D12-C: no concrete override, and a clock
 * still at its provisional `currentWeek: 1`). Routing there would let the Log
 * mount at week 1 and then walk to the real current week the moment
 * `fetchCurrentWeek` lands — leaving the entry unpulsed with no second chance,
 * because the highlight effect's deps never move. History has no week axis, so
 * it is always a correct destination.
 */
export function entryJumpView(
  entryWeek: number | null | undefined,
  displayedWeek: number | null,
): 'log' | 'history' {
  if (entryWeek == null || displayedWeek == null) return 'history';
  return entryWeek === displayedWeek ? 'log' : 'history';
}
