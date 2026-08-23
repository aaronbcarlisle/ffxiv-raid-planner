/**
 * logWeekGridData — v2 Log tab weekly-grid derivation (Phase-D D5, Task 2).
 *
 * Pure re-expression of one week's loot/material logs into the grid Task 3
 * renders: 4 floors (ascending, F1→F4 — the §4 mockup order), each with its
 * gear cells (from FLOOR_LOOT_TABLES[n].gearDrops) and material cells (from
 * .upgradeMaterials). No React here.
 *
 * Deliberate deltas vs the legacy WeeklyLootGrid (components/history/), which
 * this file is a re-expression of, NOT a transcription of (reference-only;
 * never imported from):
 *   - the 'ring' cell buckets ALL of 'ring'/'ring1'/'ring2' (legacy keyed raw
 *     itemSlot and silently dropped 'ring'/'ring2' entries — a quirk we do
 *     NOT reproduce; director F-8/rule 3);
 *   - material cells bucket an ARRAY of entries (legacy showed only the one
 *     match per cell, under-reporting a double-solvent week — recorded in
 *     Task 6's build note; rule 5);
 *   - the floor-name fallback (`floors[n-1] ?? 'Floor ' + n`) matches what v2
 *     *writes* for an unnamed tier (Loot.tsx:740 et al.), not a legacy-lookup
 *     parity claim — legacy's lookup path has no such fallback (director F-8;
 *     rule 2).
 *
 * Entries are indexed ONCE (a single pass building `floorName:bucketKey` ->
 * entries maps), then each of the 4 floors' cells look their bucket up — the
 * grid never re-scans the full log per cell.
 */
import {
  FLOOR_LOOT_TABLES, type FloorNumber,
} from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type {
  GearSlot, LootLogEntry, MaterialLogEntry, MaterialType,
} from '../../types';

// Short column labels for the grid (rule 1) — distinct from the long
// UPGRADE_MATERIAL_DISPLAY_NAMES form that modals/History keep using.
// Matches the §4 mockup column (phase-d-loot-design.md:663) and the legacy
// grid's own column label — director F-14ii, recorded in Task 6's build
// note. Do NOT change UPGRADE_MATERIAL_DISPLAY_NAMES to match this; the two
// forms are intentionally different for different surfaces.
const MATERIAL_SHORT_LABELS: Record<MaterialType, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
  universal_tomestone: 'Tome',
};

export interface LogGridGearCell {
  /** Picker vocabulary — floor 1's ring1 collapses to 'ring'. */
  slot: GearSlot | 'ring';
  label: string;
  /** This week+floor+slot's entries, createdAt DESC (newest first). */
  entries: LootLogEntry[];
}

export interface LogGridMaterialCell {
  material: MaterialType;
  label: string;
  /** This week+floor+material's entries, createdAt DESC (newest first). */
  entries: MaterialLogEntry[];
}

export interface LogGridFloor {
  floorNumber: FloorNumber;
  floorName: string;
  bookNumeral: string;
  gearCells: LogGridGearCell[];
  materialCells: LogGridMaterialCell[];
}

/**
 * One discriminated ref type across the grid, the History rows
 * (`LootEntryRow.tsx`'s `HistoryItem` is a type alias of this — director
 * F-12), and `requestDelete` — a multi-entry cell's `×N` chip menu
 * (`LogCellEntriesMenu`, D6 Task 2) hands one of these back via `onEdit`.
 */
export type LogGridEntryRef =
  | { kind: 'loot'; entry: LootLogEntry }
  | { kind: 'material'; entry: MaterialLogEntry };

/**
 * The Log grid cell's DOM id — the ONE author of this string (director F-2,
 * blocker). `Loot.tsx`'s `?entry=` scroll effect and `LogWeekGrid`'s cell
 * wrapper (D6a Task 6) both consume this helper instead of each composing the
 * string independently — contrast the shipped History path's drift-prone
 * split (`LootHistoryTable.tsx:84-85` vs `LootEntryRow.tsx:80`), which this
 * one-author rule forbids repeating here.
 */
export const logCellDomId = (ref: LogGridEntryRef): string =>
  `log-cell-${ref.kind}-${ref.entry.id}`;

/** ring / ring1 / ring2 all collapse into the one 'ring' cell (rule 3). */
function gearBucketKey(itemSlot: string): string {
  return itemSlot === 'ring' || itemSlot === 'ring1' || itemSlot === 'ring2' ? 'ring' : itemSlot;
}

/** Newest-first; ties broken by id DESC (rule 5). */
function byNewestFirst<T extends { createdAt: string; id: number }>(a: T, b: T): number {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  if (tb !== ta) return tb - ta;
  return b.id - a.id;
}

/**
 * Index a week's entries once, keyed `${floor}:${bucketKey}`. Entries whose
 * week doesn't match are dropped up front; entries whose floor+bucketKey
 * never corresponds to an actual cell (unknown slot, `floor: 'Adjustment'`
 * page-ledger echoes, ...) simply sit in a bucket no cell ever looks up —
 * silently excluded (rule 6), never thrown on.
 */
function indexByFloorAndBucket<T extends { weekNumber: number; floor: string; createdAt: string; id: number }>(
  entries: T[], week: number, bucketKeyOf: (entry: T) => string,
): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const entry of entries) {
    if (entry.weekNumber !== week) continue;
    const key = `${entry.floor}:${bucketKeyOf(entry)}`;
    const bucket = index.get(key);
    if (bucket) bucket.push(entry);
    else index.set(key, [entry]);
  }
  for (const bucket of index.values()) bucket.sort(byNewestFirst);
  return index;
}

export function buildLogWeekGrid(args: {
  floors: string[]; week: number;
  lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[];
}): LogGridFloor[] {
  const { floors, week, lootLog, materialLog } = args;

  const gearIndex = indexByFloorAndBucket(lootLog, week, (e) => gearBucketKey(e.itemSlot));
  const materialIndex = indexByFloorAndBucket(materialLog, week, (e) => e.materialType);

  const result: LogGridFloor[] = [];
  for (let n = 1; n <= 4; n++) {
    const floorNumber = n as FloorNumber;
    const table = FLOOR_LOOT_TABLES[floorNumber];
    const floorName = floors[n - 1] ?? `Floor ${n}`;

    const gearCells: LogGridGearCell[] = table.gearDrops.map((tableSlot) => {
      const isRing = tableSlot === 'ring1';
      const slot: GearSlot | 'ring' = isRing ? 'ring' : tableSlot;
      const label = isRing ? 'Ring' : GEAR_SLOT_NAMES[tableSlot];
      const entries = gearIndex.get(`${floorName}:${slot}`) ?? [];
      return { slot, label, entries };
    });

    const materialCells: LogGridMaterialCell[] = table.upgradeMaterials.map((material) => {
      const entries = materialIndex.get(`${floorName}:${material}`) ?? [];
      return { material, label: MATERIAL_SHORT_LABELS[material], entries };
    });

    result.push({ floorNumber, floorName, bookNumeral: table.bookType, gearCells, materialCells });
  }
  return result;
}
