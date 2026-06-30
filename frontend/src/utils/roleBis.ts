/**
 * roleBis — per-role BiS-slot aggregation over a tier's roster.
 *
 * A NEW derivation with no legacy precursor (the legacy `StaticHomeTab`
 * `WeeklyProgressModule` aggregated overall + per-player, never per-role).
 * Powers the redesigned Home `RoleBisCard` (spec §5.11): one progress bar per
 * role showing obtained / total BiS slots, role-colored.
 *
 * Considers only the **active roster** — players that are `configured` and not
 * a substitute — matching the readiness derivations in `utils/rosterReadiness`.
 * A "BiS slot" is a gear slot with a `bisSource` set (`!== null/undefined`);
 * `obtained` is the subset of those with `hasItem === true`.
 */

import type { SnapshotPlayer } from '../types';

/** The five raid roles, in the fixed display order the mockup shows. */
export const BIS_ROLES = ['tank', 'healer', 'melee', 'ranged', 'caster'] as const;

export type BisRole = (typeof BIS_ROLES)[number];

export interface RoleBisAggregate {
  role: BisRole;
  /** BiS-target slots that `hasItem` across active players of this role. */
  obtained: number;
  /** BiS-target slots (those with a `bisSource` set) across active players. */
  total: number;
}

/**
 * Aggregate obtained / total BiS slots per role across the active roster.
 *
 * Returns one entry for every role in {@link BIS_ROLES} (fixed order), including
 * roles with no active players (reported as `0/0`) — the mockup renders all
 * five bars, an empty role showing an empty bar.
 */
export function bisByRole(players: SnapshotPlayer[]): RoleBisAggregate[] {
  const active = players.filter((p) => p.configured && !p.isSubstitute);

  return BIS_ROLES.map((role) => {
    let obtained = 0;
    let total = 0;
    for (const p of active) {
      if (p.role !== role) continue;
      for (const s of p.gear) {
        if (s.bisSource === null || s.bisSource === undefined) continue;
        total += 1;
        if (s.hasItem) obtained += 1;
      }
    }
    return { role, obtained, total };
  });
}
