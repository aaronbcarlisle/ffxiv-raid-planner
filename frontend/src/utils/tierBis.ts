/**
 * tierBis — the tier row's BiS model (S2a-3b R-T-1, R-T-2).
 *
 * One player's BiS progress for the active tier, split three ways, plus the
 * roster-wide sums and the status-line text Progress prints. The counting rules
 * live elsewhere and are imported, never copied:
 *   - which slots count: `relevantGear` (an empty off-hand off-PLD neither
 *     renders nor counts);
 *   - when a slot is done: `isSlotComplete`;
 *   - when a had slot still needs its tome augment: `requiresAugmentation`.
 *
 * `done` and `total` equal `playerBisProgress` for the same player, so the
 * roster card, the Board and the tier row cannot disagree.
 */
import type { GearSlot, GearSlotStatus, SnapshotPlayer } from '../types';
import { isSlotComplete, requiresAugmentation } from './calculations';
import { relevantGear } from './offhand';

export type TierBisCell = {
  /** Relevant slots complete by `isSlotComplete`. */
  done: number;
  /** Had, tome-augment required, not yet augmented. */
  needsAugment: number;
  /** Everything else that is relevant. */
  toGo: number;
  /** Relevant slots, or 11 when there are none. */
  total: number;
  /** At least one relevant slot has a BiS source. */
  hasTargets: boolean;
};

type BisPlayer = Pick<SnapshotPlayer, 'job' | 'gear'>;

function needsAugment(slot: GearSlotStatus): boolean {
  return slot.hasItem && requiresAugmentation(slot) && !slot.isAugmented;
}

/** Each relevant slot in exactly one class, in gear order. */
export function tierBisBreakdown(player: BisPlayer): {
  done: GearSlot[];
  needsAugment: GearSlot[];
  toGo: GearSlot[];
} {
  const out: { done: GearSlot[]; needsAugment: GearSlot[]; toGo: GearSlot[] } = {
    done: [],
    needsAugment: [],
    toGo: [],
  };
  for (const slot of relevantGear(player.job, player.gear)) {
    if (isSlotComplete(slot)) out.done.push(slot.slot);
    else if (needsAugment(slot)) out.needsAugment.push(slot.slot);
    else out.toGo.push(slot.slot);
  }
  return out;
}

export function tierBisCell(player: BisPlayer): TierBisCell {
  const relevant = relevantGear(player.job, player.gear);
  const done = relevant.filter(isSlotComplete).length;
  const augment = relevant.filter((s) => !isSlotComplete(s) && needsAugment(s)).length;
  const total = relevant.length || 11;
  return {
    done,
    needsAugment: augment,
    toGo: total - done - augment,
    total,
    hasTargets: relevant.some((s) => !!s.bisSource),
  };
}

/**
 * Sum the cells that count. A column that doesn't count (Not on the roster,
 * Card not set up, a substitute) passes `null`; a cell with no targets adds
 * nothing either.
 */
export function tierBisTotals(
  cells: readonly (TierBisCell | null)[],
): { done: number; total: number; anySet: boolean } {
  let done = 0;
  let total = 0;
  let anySet = false;
  for (const cell of cells) {
    if (!cell || !cell.hasTargets) continue;
    done += cell.done;
    total += cell.total;
    anySet = true;
  }
  return { done, total, anySet };
}

/** "23/77 BiS slots · Week 11 · 0 of 4 floors cleared" */
export function tierStatusText({
  totals,
  week,
  floors,
}: {
  totals: { done: number; total: number; anySet: boolean };
  week: number | null;
  floors: { cleared: number; of: number } | null;
}): string {
  const parts = [totals.anySet ? `${totals.done}/${totals.total} BiS slots` : 'No BiS set'];
  if (week !== null) parts.push(`Week ${week}`);
  if (floors !== null && week !== null) parts.push(`${floors.cleared} of ${floors.of} floors cleared`);
  return parts.join(' · ');
}
