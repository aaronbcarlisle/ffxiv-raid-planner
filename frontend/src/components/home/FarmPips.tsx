/**
 * FarmPips (ring0 `home/`; S2a-4b·B1 Task TB1, R-F-10, D-11, S-7): the farm card's pips. One image
 * for assistive tech, named by state ("Need: A, B; Want: C"), and a dot per member. The dot's colour
 * is the member's role and its glyph is their state, so colour never tells the state.
 *
 * The role is a ring around a neutral fill: role colour is never a fill behind text
 * (`ui/InitialsAvatar.tsx`).
 */
import { getRoleColor, getValidRole } from '../../gamedata';
import { PIP_GLYPH } from '../../utils/progressState';
import type { TrackCardModel } from '../../utils/trackCardModel';

type Pips = TrackCardModel['pips'];

/** The order the image names the states in, whatever order the columns have them. */
const NAMED_STATES: readonly { state: Pips[number]['state']; label: string }[] = [
  { state: 'need', label: 'Need' },
  { state: 'want', label: 'Want' },
  { state: 'have', label: 'Have' },
  { state: 'none', label: 'No status' },
];

function pipsName(pips: Pips): string {
  return NAMED_STATES.flatMap(({ state, label }) => {
    const names = pips.filter((pip) => pip.state === state).map((pip) => pip.name);
    return names.length > 0 ? [`${label}: ${names.join(', ')}`] : [];
  }).join('; ');
}

export function FarmPips({ pips }: { pips: Pips }) {
  if (pips.length === 0) return null;
  return (
    <div role="img" aria-label={pipsName(pips)} className="flex flex-wrap gap-1">
      {pips.map((pip, index) => (
        <span
          // Two members can share a name, and a column's place is what the pips are drawn by.
          key={`${index}:${pip.name}`}
          data-testid="farm-pip"
          className="flex h-5 w-5 items-center justify-center rounded-full border-2 bg-surface-elevated text-xs leading-none text-text-primary"
          style={{ borderColor: getRoleColor(getValidRole(pip.role)) }}
        >
          {PIP_GLYPH[pip.state]}
        </span>
      ))}
    </div>
  );
}
