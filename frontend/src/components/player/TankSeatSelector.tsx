/**
 * TankSeatSelector — a tank card's one seat chip (E2, R-E2-D): tank role and
 * raid position in a single trigger ("MT · T1", an unset half reads "--"),
 * one Popover with a labelled row for each half.
 *
 * V2-only (RosterCard). It replaces the two single-axis chips on the v2 tank
 * card so the header fits one line; `TankRoleSelector` and `PositionSelector`
 * themselves are untouched — legacy's PlayerCardHeader still renders them.
 * The callbacks are the ones those two receive (`onTankRoleSelect` ≙
 * TankRoleSelector's `onSelect`, `onPositionSelect` ≙ PositionSelector's).
 *
 * Behavior deltas from the two originals, both deliberate:
 *   - A pick does NOT close the popover — the halves are usually set together.
 *     Outside click and Escape close it (Radix).
 *   - Opening focuses the selected (or first) tank-role option, so the rows
 *     are keyboard-reachable; Radix returns focus to the trigger on close.
 *   - A row's Clear hands focus to that row's first option — Clear renders
 *     only while its half is set, so it unmounts under the focus.
 */
import { useId, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import type { RaidPosition, SnapshotPlayer, TankRole } from '../../types';
import { RAID_POSITIONS } from '../../types';
import { Button, Popover, PopoverContent, PopoverTrigger, Tooltip } from '../primitives';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';

// Hover copy — the strings TankRoleSelector's TANK_ROLE_INFO and
// PositionSelector's POSITION_INFO print, duplicated (not exported) so the V1
// files stay untouched.
const TANK_ROLE_LABEL: Record<TankRole, string> = { MT: 'Main Tank', OT: 'Off Tank' };
const POSITION_ROLE: Record<string, string> = { T: 'Tank', H: 'Healer', M: 'Melee', R: 'Ranged' };
const positionLabel = (pos: RaidPosition) => `${POSITION_ROLE[pos[0]]} ${pos[1]}`;
// PositionSelector's POSITION_INFO `group` line: a position's digit is its
// light party (T1 → "Light Party 1 (G1)", T2 → "Light Party 2 (G2)").
const lightPartyLabel = (pos: RaidPosition) => `Light Party ${pos[1]} (G${pos[1]})`;
// PositionSelector's getSuggestedPositions('tank') — RAID_POSITIONS already
// lists them first, so the grid keeps that order.
const SUGGESTED: RaidPosition[] = ['T1', 'T2'];

const TANK_ROLES: TankRole[] = ['MT', 'OT'];

/**
 * Selected fill per position letter (dark text on the bright role color) —
 * PositionSelector's getPositionBgClasses, where M and R share the melee fill,
 * so the two chips' popovers paint a selected seat alike.
 */
const POSITION_SELECTED: Record<string, string> = {
  T: 'bg-role-tank text-surface-base',
  H: 'bg-role-healer text-surface-base',
  M: 'bg-role-melee text-surface-base',
  R: 'bg-role-melee text-surface-base',
};

/**
 * The Popover primitive suppresses Radix's open auto-focus, and the content
 * mounts a render after `open` flips (Radix's Portal), so focus moves in on
 * the option's own mount — the keyboard path into the rows.
 */
const focusOnMount = (el: HTMLButtonElement | null) => el?.focus();

const OPTION_BASE =
  'rounded px-3 py-2 sm:px-2 sm:py-1.5 min-h-[44px] sm:min-h-0 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

interface TankSeatSelectorProps {
  tankRole: TankRole | null | undefined;
  position: RaidPosition | null | undefined;
  /** TankRoleSelector's `onSelect` — `undefined` clears. */
  onTankRoleSelect: (role: TankRole | undefined) => void;
  /** PositionSelector's `onSelect` — `undefined` clears. */
  onPositionSelect: (position: RaidPosition | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function TankSeatSelector({
  tankRole,
  position,
  onTankRoleSelect,
  onPositionSelect,
  player,
  userRole,
  currentUserId,
  isAdmin,
}: TankSeatSelectorProps) {
  const [open, setOpen] = useState(false);
  const roleLabelId = useId();
  const positionLabelId = useId();
  const roleOptionsRef = useRef<HTMLDivElement>(null);
  const positionOptionsRef = useRef<HTMLDivElement>(null);

  const editPermission = canEditPlayer(userRole, player, currentUserId, isAdmin);
  const canEdit = editPermission.allowed;
  const isOpen = open && canEdit;

  // A Clear unmounts under the focus once its half is unset, so it hands
  // focus to its row's first option before clearing. (The tank-role options'
  // `focusOnMount` ref can't cover this: when MT was the selected one, its
  // ref never changes, so it never re-fires.)
  const clearRow = (options: typeof roleOptionsRef, clear: () => void) => {
    options.current?.querySelector<HTMLButtonElement>('button')?.focus();
    clear();
  };

  const isSet = Boolean(tankRole || position);
  const baseClasses = isSet ? 'bg-role-tank/20 text-role-tank' : 'bg-surface-interactive text-text-muted';
  const hoverClasses = canEdit ? (isSet ? 'hover:bg-role-tank/30' : 'hover:text-text-secondary') : '';

  const describe = [
    tankRole ? `${TANK_ROLE_LABEL[tankRole]} (${tankRole})` : 'No tank role',
    position ? `${positionLabel(position)} (${position})` : 'No position',
  ].join(' · ');
  const tooltipContent = !canEdit ? (
    editPermission.reason
  ) : (
    <div className="flex items-start gap-2">
      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-role-tank" />
      <div>
        <div className="font-medium">Tank Seat</div>
        <div className="mt-0.5 text-xs text-text-secondary">{describe}</div>
        {position && <div className="text-xs text-text-secondary">{lightPartyLabel(position)}</div>}
      </div>
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <Tooltip content={tooltipContent}>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            {/* design-system-ignore: badge-style seat chip, the TankRoleSelector/PositionSelector trigger styling */}
            <button
              type="button"
              aria-label={`Tank role ${tankRole ?? 'not set'}, position ${position ?? 'not set'}`}
              className={`whitespace-nowrap rounded px-2 py-1 sm:px-1.5 sm:py-0.5 min-h-[44px] sm:min-h-0 text-xs font-bold transition-colors ${baseClasses} ${hoverClasses} ${
                canEdit ? '' : 'opacity-50 cursor-not-allowed'
              }`}
              disabled={!canEdit}
            >
              {tankRole || '--'} · {position || '--'}
            </button>
          </PopoverTrigger>
        </span>
      </Tooltip>

      <PopoverContent align="start" sideOffset={4} className="w-max space-y-3 p-2">
        <div role="group" aria-labelledby={roleLabelId}>
          <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
            <span id={roleLabelId} className="text-xs font-medium text-text-secondary">
              Tank role
            </span>
            {tankRole && (
              <Button
                variant="ghost"
                size="xs"
                aria-label="Clear tank role"
                onClick={() => clearRow(roleOptionsRef, () => onTankRoleSelect(undefined))}
              >
                Clear
              </Button>
            )}
          </div>
          <div ref={roleOptionsRef} className="flex gap-1">
            {TANK_ROLES.map((role) => {
              const selected = tankRole === role;
              const focusMe = selected || (!tankRole && role === 'MT');
              return (
                /* design-system-ignore: role-colored single-select toggle (TankRoleSelector's option styling) */
                <button
                  key={role}
                  ref={focusMe ? focusOnMount : undefined}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onTankRoleSelect(role)}
                  className={`${OPTION_BASE} ${
                    selected ? 'bg-role-tank text-surface-base' : 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30'
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>

        <div role="group" aria-labelledby={positionLabelId}>
          <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
            <span id={positionLabelId} className="text-xs font-medium text-text-secondary">
              Position
            </span>
            {position && (
              <Button
                variant="ghost"
                size="xs"
                aria-label="Clear position"
                onClick={() => clearRow(positionOptionsRef, () => onPositionSelect(undefined))}
              >
                Clear
              </Button>
            )}
          </div>
          <div ref={positionOptionsRef} className="grid w-max grid-cols-4 gap-1">
            {RAID_POSITIONS.map((pos) => {
              const selected = position === pos;
              const suggested = SUGGESTED.includes(pos);
              return (
                /* design-system-ignore: role-colored position toggle (PositionSelector's grid styling) */
                <button
                  key={pos}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onPositionSelect(pos)}
                  className={`${OPTION_BASE} ${
                    selected
                      ? POSITION_SELECTED[pos[0]]
                      : suggested
                        ? 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30'
                        : 'bg-surface-base text-text-muted hover:bg-surface-interactive hover:text-text-secondary'
                  }`}
                >
                  {pos}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
