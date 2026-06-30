/**
 * rosterReadiness — shared readiness derivations over a tier's roster.
 *
 * Promoted verbatim from `components/static-group/StaticHomeTab.tsx` so the new
 * redesigned Home (`components/home/RosterReadinessCard`) and the legacy Home
 * tab share one copy (promote-and-repoint, not copy — keeps the jscpd
 * fail-on-new gate clean and prevents the two copies drifting).
 *
 * All helpers consider only the **active roster**: players that are
 * `configured` and not a substitute — matching the legacy `WeeklyProgressModule`
 * / `GroupHeroPanel` definition of "active".
 */

import type { SnapshotPlayer } from '../types';

/**
 * Average item level across the active roster.
 *
 * Per player, averages each gear slot's `equippedItemLevel ?? itemLevel`
 * (slots without either are ignored); players with no item levels at all are
 * excluded from the roster average. Returns `null` when no active player
 * contributes an item level. (Verbatim from legacy `StaticHomeTab.rosterAvgIlv`.)
 */
export function rosterAvgIlv(players: SnapshotPlayer[]): number | null {
  const active = players.filter((p) => p.configured && !p.isSubstitute);
  if (!active.length) return null;
  let total = 0, count = 0;
  for (const p of active) {
    const iLvs = p.gear
      .map((s) => s.equippedItemLevel ?? s.itemLevel)
      .filter((v): v is number => v != null);
    if (iLvs.length) { total += iLvs.reduce((a, b) => a + b, 0) / iLvs.length; count++; }
  }
  return count > 0 ? Math.round(total / count) : null;
}

/**
 * Count of active roster players who are fully BiS — every gear slot `hasItem`.
 * Players with an empty gear array do not count. (Verbatim from the legacy
 * `WeeklyProgressModule` `bisCount` derivation.)
 */
export function bisCompleteCount(players: SnapshotPlayer[]): number {
  const active = players.filter((p) => p.configured && !p.isSubstitute);
  return active.filter((p) => {
    if (!p.gear.length) return false;
    return p.gear.every((s) => s.hasItem);
  }).length;
}

/**
 * BiS-slot tallies across the active roster: `obtained` = BiS-target slots that
 * `hasItem`, `total` = BiS-target slots (those with a `bisSource` set). Used by
 * `RosterReadinessCard` for the single BiS-complete bar + "K / M slots obtained"
 * footer. A "BiS slot" mirrors `playerGearReadiness`'s configured-slot notion
 * (`bisSource !== null && !== undefined`).
 */
export function bisSlotTotals(players: SnapshotPlayer[]): { obtained: number; total: number } {
  const active = players.filter((p) => p.configured && !p.isSubstitute);
  let obtained = 0, total = 0;
  for (const p of active) {
    const bisSlots = p.gear.filter((s) => s.bisSource !== null && s.bisSource !== undefined);
    total += bisSlots.length;
    obtained += bisSlots.filter((s) => s.hasItem).length;
  }
  return { obtained, total };
}
