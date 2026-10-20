/**
 * TierBisBar — the tier cell's three-part bar (S2a-3b·H3, D-2, design §3.2): done at the
 * role colour, needs augment at its tint with a stripe (so it never reads by colour alone),
 * to go on the bare track. Each part grows by its count from a zero basis, so the widths
 * stand in the counts' ratio. Decorative (`aria-hidden`): the cell's name carries the numbers.
 *
 * `ui/ProgressBar` has one fill, so this is progress-local rather than an extension of it.
 */
import type { Role } from '../../gamedata';
import type { TierBisCell } from '../../utils/tierBis';

/** Literal classes, so Tailwind's scanner sees every one. */
const DONE: Record<Role, string> = {
  tank: 'bg-role-tank',
  healer: 'bg-role-healer',
  melee: 'bg-role-melee',
  ranged: 'bg-role-ranged',
  caster: 'bg-role-caster',
};
const AUGMENT: Record<Role, string> = {
  tank: 'bg-role-tank/35 bg-[repeating-linear-gradient(135deg,var(--color-role-tank)_0_2px,transparent_2px_5px)]',
  healer: 'bg-role-healer/35 bg-[repeating-linear-gradient(135deg,var(--color-role-healer)_0_2px,transparent_2px_5px)]',
  melee: 'bg-role-melee/35 bg-[repeating-linear-gradient(135deg,var(--color-role-melee)_0_2px,transparent_2px_5px)]',
  ranged: 'bg-role-ranged/35 bg-[repeating-linear-gradient(135deg,var(--color-role-ranged)_0_2px,transparent_2px_5px)]',
  caster: 'bg-role-caster/35 bg-[repeating-linear-gradient(135deg,var(--color-role-caster)_0_2px,transparent_2px_5px)]',
};

interface TierBisBarProps {
  cell: TierBisCell;
  role: Role;
  /** An unclaimed card's bar (D-4): the same parts, faded. */
  dimmed?: boolean;
}

export function TierBisBar({ cell, role, dimmed = false }: TierBisBarProps) {
  // A span (it sits inside the cell's button). `role="presentation"` keeps it a flex row: index.css
  // reverts the display of anything else marked aria-hidden (the InitialsAvatar carve-out).
  return (
    <span
      data-testid="tier-bis-bar"
      aria-hidden="true"
      role="presentation"
      className={`flex h-2 w-full overflow-hidden rounded-full bg-surface-interactive${dimmed ? ' opacity-60' : ''}`}
    >
      <span data-segment="done" className={`h-full basis-0 ${DONE[role]}`} style={{ flexGrow: cell.done }} />
      <span data-segment="augment" className={`h-full basis-0 ${AUGMENT[role]}`} style={{ flexGrow: cell.needsAugment }} />
      <span data-segment="togo" className="h-full basis-0" style={{ flexGrow: cell.toGo }} />
    </span>
  );
}
