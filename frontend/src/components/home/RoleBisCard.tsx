/**
 * RoleBisCard (ring0 `home/`)
 *
 * BiS-by-role glance for the redesigned Home (spec §5.11): one labeled,
 * role-colored progress bar per role (Tanks / Healers / Melee / Ranged /
 * Casters) with an `X/Y` obtained-slots count, plus the gear-source legend
 * once at the bottom.
 *
 * Boundary discipline (ring0): reads the tier store (`useTierPlayers` — ring0→
 * store is allowed) and composes shared `ui/` components. Never imports a
 * ring1/ring3 component. The per-role aggregation lives in the pure
 * `utils/roleBis` helper so it stays testable in isolation.
 */

import { CardShell } from '../ui/CardShell';
import { ProgressBar, ProgressBarLegend, type ProgressBarColor } from '../ui/ProgressBar';
import { useTierPlayers } from '../../stores/tierStore';
import { bisByRole, type BisRole } from '../../utils/roleBis';

/** Display label per role (the mockup pluralizes where it reads naturally). */
const ROLE_LABEL: Record<BisRole, string> = {
  tank: 'Tanks',
  healer: 'Healers',
  melee: 'Melee',
  ranged: 'Ranged',
  caster: 'Caster',
};

/** aria-label stem per role — singular, e.g. "Tank BiS progress". */
const ROLE_ARIA: Record<BisRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee',
  ranged: 'Ranged',
  caster: 'Caster',
};

export function RoleBisCard() {
  const players = useTierPlayers();
  const rows = bisByRole(players);

  return (
    <CardShell
      title="BiS progress by role"
      headerRight={<span className="text-xs text-text-tertiary leading-none">to current tier</span>}
    >
      <div className="flex flex-col gap-3">
        {rows.map(({ role, obtained, total }) => {
          const value = total > 0 ? obtained / total : 0;
          const color = `role-${role}` as ProgressBarColor;
          return (
            <div key={role}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-text-secondary leading-none">
                  {ROLE_LABEL[role]}
                </span>
                <span className="text-xs tabular-nums text-text-tertiary leading-none">
                  {obtained}/{total}
                </span>
              </div>
              <ProgressBar value={value} color={color} ariaLabel={`${ROLE_ARIA[role]} BiS progress`} />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <ProgressBarLegend />
      </div>
    </CardShell>
  );
}
