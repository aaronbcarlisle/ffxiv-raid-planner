/**
 * loggedSlotsForWeek — what the loot and material logs already hold for one
 * week, per floor, keyed the way the wizard keys its rows (LOG-1, R-P0-9).
 *
 * Pure: no React, no store. Matching follows `lootFairness.ts:26-27`
 * (`weekNumber === week && floor === floors[n - 1]`, by floor NAME). A ring
 * entry may be logged as `ring`, `ring1` or `ring2`; all three land on the
 * wizard's `ring1` key. Only `method === 'drop'` locks a slot (V4): a tome,
 * book or purchase entry for the same slot is reported under `otherMethods`
 * so the row can show it as a hint without blocking the floor's actual drop.
 */
import type { LootLogEntry, MaterialLogEntry } from '../../../types';
import type { FloorNumber, UpgradeMaterialType } from '../../../gamedata/loot-tables';

const RING_SLOTS = new Set(['ring', 'ring1', 'ring2']);

export interface FloorLoggedSlots {
  /** Drop entries by wizard slot key (`ring` / `ring2` → `ring1`). */
  gear: Record<string, LootLogEntry>;
  /** Drop entries by material type. */
  materials: Partial<Record<UpgradeMaterialType, MaterialLogEntry>>;
  /** Same-slot loot entries logged by another method (tome, book, purchase). */
  otherMethods: Record<string, LootLogEntry[]>;
  /** Same-material entries logged by another method. */
  materialOtherMethods: Partial<Record<UpgradeMaterialType, MaterialLogEntry[]>>;
}

function wizardSlotKey(itemSlot: string): string {
  return RING_SLOTS.has(itemSlot) ? 'ring1' : itemSlot;
}

export function loggedSlotsForWeek(args: {
  floors: string[];
  week: number;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
}): Record<FloorNumber, FloorLoggedSlots> {
  const { floors, week, lootLog, materialLog } = args;
  const out = {} as Record<FloorNumber, FloorLoggedSlots>;

  for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
    const floorName = floors[floorNum - 1];
    const floor: FloorLoggedSlots = { gear: {}, materials: {}, otherMethods: {}, materialOtherMethods: {} };
    out[floorNum] = floor;
    if (floorName === undefined) continue;

    for (const entry of lootLog) {
      if (entry.weekNumber !== week || entry.floor !== floorName) continue;
      const key = wizardSlotKey(entry.itemSlot);
      if (entry.method === 'drop') {
        floor.gear[key] ??= entry;
      } else {
        (floor.otherMethods[key] ??= []).push(entry);
      }
    }

    for (const entry of materialLog) {
      if (entry.weekNumber !== week || entry.floor !== floorName) continue;
      if (entry.method === 'drop') {
        floor.materials[entry.materialType] ??= entry;
      } else {
        (floor.materialOtherMethods[entry.materialType] ??= []).push(entry);
      }
    }
  }

  return out;
}
