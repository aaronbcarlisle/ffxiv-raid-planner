/**
 * Equipped-average item level for the v2 roster surfaces (C5, D-10).
 *
 * One expression, two consumers — the RosterCard headline and the GearBoard
 * row subtitle — so the two v2 roster views always print the same number
 * (director F3: they briefly disagreed when only the card went
 * equipped-first). Mirrors legacy PlayerCardHeader: the equipped average
 * counts only when Lodestone/Tomestone sync data covers at least half the
 * player's slots; otherwise callers fall back to the BiS-target average.
 */
import type { GearSlotStatus } from '../../types';

export function equippedAverageIlv(gear: GearSlotStatus[]): number {
  const synced = gear.filter((g) => (g.equippedItemLevel ?? 0) > 0);
  if (synced.length < Math.ceil(gear.length / 2)) return 0;
  return Math.round(
    synced.reduce((sum, g) => sum + (g.equippedItemLevel ?? 0), 0) / synced.length
  );
}
