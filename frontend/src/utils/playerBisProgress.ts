/**
 * playerBisProgress — one player's BiS progress fraction, the number the v2
 * roster prints for that player (R-E2-F, #7).
 *
 * RosterCard's definition, lifted so the Board's summary column and the card's
 * progress line cannot disagree about the same player:
 *   - only the RELEVANT slots count (`relevantGear`: an empty off-hand off-PLD
 *     neither renders nor counts);
 *   - a slot is complete by `isSlotComplete` (a relevant slot with no
 *     `bisSource` is incomplete; a tome slot needs its augment);
 *   - `total` falls back to 11 when there are no relevant slots at all.
 *
 * Display only. The Board's "No BiS imported" gate keeps `bisSlotTotals`
 * (`rosterReadiness.ts`) — what "no BiS" means is #8's call, not this helper's.
 */
import type { SnapshotPlayer } from '../types';
import { isSlotComplete } from './calculations';
import { relevantGear } from './offhand';

export function playerBisProgress(
  player: Pick<SnapshotPlayer, 'job' | 'gear'>,
): { completed: number; total: number } {
  const relevant = relevantGear(player.job, player.gear);
  return {
    completed: relevant.filter(isSlotComplete).length,
    total: relevant.length || 11,
  };
}
