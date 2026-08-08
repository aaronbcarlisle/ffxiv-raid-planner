/**
 * The ONE edit-diff derivation for the v2 loot edit door (RecipientPicker).
 * handleSubmit submits exactly this object and the "This will:" preview
 * renders exactly this object, so they cannot drift. Lives in its own module
 * (not RecipientPicker.tsx) so it can be exported for direct unit testing
 * without breaking react-refresh's components-only export rule.
 */
import type { GearSlot, LootLogEntry, LootLogEntryUpdate, LootMethod } from '../../types';

export function computeEditUpdates(args: {
  editEntry: LootLogEntry;
  slot: GearSlot | 'ring';
  floorName: string;
  week: number;
  method: LootMethod;
  notes: string;
  recipientPlayerId: string;
  recipientJob: string | undefined;
}): LootLogEntryUpdate {
  const { editEntry, slot, floorName, week, method, notes, recipientPlayerId, recipientJob } = args;
  // Ring round-trip: an untouched ring slot keeps the entry's concrete
  // ring1/ring2 (the picker vocabulary collapses to 'ring' which would
  // otherwise rewrite ring2 → ring1). This does NOT fully round-trip a
  // legacy `itemSlot: 'ring'` entry (LootSlot includes 'ring' alongside
  // ring1/ring2) — the ternary below normalizes it to 'ring1' even when
  // untouched, so `itemSlot !== editEntry.itemSlot` reads as a change and
  // emits `updates.itemSlot`. Known phantom-diff case, disclosed in the D2
  // PR body — not fixed here.
  const itemSlot = slot === 'ring'
    ? (editEntry.itemSlot === 'ring2' ? 'ring2' : 'ring1')
    : slot;
  const updates: LootLogEntryUpdate = {};
  if (week !== editEntry.weekNumber) updates.weekNumber = week;
  if (floorName !== editEntry.floor) updates.floor = floorName;
  if (itemSlot !== editEntry.itemSlot) updates.itemSlot = itemSlot;
  if (recipientPlayerId !== editEntry.recipientPlayerId) updates.recipientPlayerId = recipientPlayerId;
  if (method !== editEntry.method) updates.method = method;
  // '' (not undefined) so an erased note actually clears server-side —
  // undefined is dropped from the JSON body and the field never arrives.
  if (notes !== (editEntry.notes ?? '')) updates.notes = notes;
  // Backfill weaponJob for weapon entries created without it.
  if (itemSlot === 'weapon' && !editEntry.weaponJob && recipientJob) {
    updates.weaponJob = recipientJob;
  }
  return updates;
}
