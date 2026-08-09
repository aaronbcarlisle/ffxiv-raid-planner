/**
 * Off-hand slot relevance — the data-driven display ruling.
 *
 * The 'offhand' slot exists in every player's gear model (universal model),
 * but it only *renders* and only *counts* when it is relevant: the job uses
 * an off-hand (OFFHAND_JOBS) or the slot actually carries data (a BiS target
 * or a synced item). Everything display- and math-side funnels through
 * `relevantGear` so denominators, completion, and rows can never disagree.
 */
import { OFFHAND_JOBS } from '../gamedata/jobs';
import type { GearSlotStatus } from '../types';

/** True when the offhand slot entry carries any real data. */
export function offhandSlotHasData(slot: GearSlotStatus | undefined): boolean {
  if (!slot) return false;
  return Boolean(
    slot.bisSource || slot.hasItem || slot.isAugmented ||
    slot.itemId || slot.itemName || slot.equippedItemId || slot.equippedItemName
  );
}

/** Data-driven display ruling: job uses an off-hand OR the slot has data. */
export function isOffhandRelevant(job: string | undefined, gear: GearSlotStatus[]): boolean {
  // Case-normalize: backend job validation circulates lowercase ("pld").
  if (job && OFFHAND_JOBS.has(job.toUpperCase())) return true;
  return offhandSlotHasData(gear.find((g) => g.slot === 'offhand'));
}

/** Gear entries minus an irrelevant offhand — THE denominator/completion basis. */
export function relevantGear(job: string | undefined, gear: GearSlotStatus[]): GearSlotStatus[] {
  if (isOffhandRelevant(job, gear)) return gear;
  const filtered = gear.filter((g) => g.slot !== 'offhand');
  // Preserve reference identity when nothing was dropped (memo-friendly).
  return filtered.length === gear.length ? gear : filtered;
}
