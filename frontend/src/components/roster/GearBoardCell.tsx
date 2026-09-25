/**
 * GearBoardCell — one gear slot in the Roster Board matrix (ring0, F6c Board).
 *
 * Derived from the `GearStatusCircle` state machine (`toGearState` +
 * `requiresAugmentation`), rendered as the mockup's `.gcell`: a 30px rounded
 * square with a one-letter source code when obtained, a dashed `·` when needed,
 * and a muted `—` when no BiS target is set. The Board is the gear-editing
 * surface: clicking cycles the obtained state via `onCycle` (the parent Board
 * does the state math + persistence). When `priority` is set on a needed slot
 * (F6d `need.up`, spec §5.8), the cell renders the next-upgrade glyph (●) in the
 * player's `role` color instead of the plain need dot. Visual target:
 * `mockups/02-roster-board.html` `.gcell` / `.gcell.need.up`.
 *
 * Keyboard (R-E1-E): the cell keeps `role="checkbox"`; Space/Enter cycle it and
 * an unmodified arrow is routed to `onNavigate`. The Board owns the roving tab
 * stop — `isTabStop` decides whether this cell is the one in the Tab sequence.
 */
import { toGearState } from '../../utils/calculations';
import { BIS_SOURCE_NAMES, BIS_SOURCE_FULL_NAMES } from '../../types';
import { isBoardArrowKey, type BoardArrowKey } from './gearBoardNav';
import type { GearSlot, GearSlotStatus } from '../../types';

export interface GearBoardCellProps {
  slot: GearSlotStatus;
  onCycle?: (slot: GearSlot) => void;
  disabled?: boolean;
  /** F6d loot-priority highlight: when true AND the slot is needed, renders the
   * next-upgrade glyph (●) instead of the plain need dot. */
  priority?: boolean;
  /** Player role — colors the next-upgrade glyph (mockup `.need.up`). */
  role?: 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';
  /** Roving tab stop (R-E1-E): `false` takes the cell out of the Tab sequence
   * (tabIndex -1) while it stays focusable by script and click. Defaults to
   * `true`, so a standalone cell behaves as before. */
  isTabStop?: boolean;
  /** Unmodified arrow keys are routed here. Return `true` when focus moved so
   * the cell can `preventDefault`; an edge returns `false` and the key keeps
   * its default (e.g. scrolling the board). */
  onNavigate?: (key: BoardArrowKey) => boolean;
  /** Wired only while interactive: the Board records the focused cell as the
   * roving stop, so a disabled cell (click-focusable at tabIndex -1) never
   * becomes one. */
  onFocus?: () => void;
}

// design-system-ignore: text-[9px] is the board glyph (R/T/BT/C, ·, ●, —) in a dense 30 px gearsheet cell; each cell's full meaning is in its aria-label
// `scroll-mt-10` clears the Board's ~34px sticky column header when focus scrolls a cell into view.
const BASE = 'grid h-[30px] w-[30px] place-items-center rounded-md text-[9px] font-extrabold mx-auto scroll-mt-10';

/** Source fill classes (token-only) keyed by BiS source, for the obtained state. */
const FILL: Record<'raid' | 'tome' | 'base_tome' | 'crafted', string> = {
  raid: 'bg-gear-raid/25 text-text-primary',
  tome: 'bg-gear-tome/25 text-text-primary',
  base_tome: 'bg-gear-base-tome/25 text-text-primary',
  crafted: 'bg-gear-crafted/25 text-text-primary',
};

export function GearBoardCell({
  slot,
  onCycle,
  disabled = false,
  priority = false,
  role,
  isTabStop = true,
  onNavigate,
  onFocus,
}: GearBoardCellProps) {
  const { bisSource } = slot;

  // No BiS target set → non-interactive muted placeholder.
  if (!bisSource) {
    return (
      <span className={`${BASE} text-text-muted opacity-40`} aria-label="No BiS target">
        —
      </span>
    );
  }

  const state = toGearState(slot.hasItem, slot.isAugmented);
  const obtained = state !== 'missing';
  const augmented = state === 'augmented';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) onCycle?.(slot.slot);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onCycle?.(slot.slot);
      return;
    }
    // Only an unmodified arrow navigates (Alt+Left is browser Back; Shift/Ctrl/
    // Meta combos belong to the browser), and only an actual move eats the key.
    if (isBoardArrowKey(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && onNavigate?.(e.key)) {
      e.preventDefault();
    }
  };

  const interactive = !disabled && !!onCycle;
  const commonProps = {
    role: 'checkbox' as const,
    'aria-checked': obtained,
    'aria-disabled': !interactive,
    tabIndex: interactive && isTabStop ? 0 : -1,
    onClick: interactive ? handleClick : undefined,
    onKeyDown: interactive ? handleKeyDown : undefined,
    onFocus: interactive ? onFocus : undefined,
  };

  if (!obtained) {
    if (priority) {
      // F6d next-upgrade highlight (mockup `.gcell.need.up`): dashed border +
      // ● glyph in the player's role color.
      return (
        <span
          {...commonProps}
          aria-label={`${BIS_SOURCE_FULL_NAMES[bisSource]} — next upgrade priority`}
          className={`${BASE} border-[1.5px] border-dashed ${interactive ? 'cursor-pointer' : ''}`}
          style={role ? {
            borderColor: `color-mix(in srgb, var(--color-role-${role}) 60%, transparent)`,
            color: `var(--color-role-${role})`,
          } : undefined}
        >
          ●
        </span>
      );
    }
    return (
      <span
        {...commonProps}
        aria-label={`${BIS_SOURCE_FULL_NAMES[bisSource]} — needed`}
        className={`${BASE} border-[1.5px] border-dashed border-border-default text-text-muted ${interactive ? 'cursor-pointer hover:border-text-tertiary' : ''}`}
      >
        ·
      </span>
    );
  }

  const code = augmented ? 'A' : BIS_SOURCE_NAMES[bisSource];
  const fill = augmented ? 'bg-gear-augmented/30 text-text-primary' : FILL[bisSource];
  return (
    <span
      {...commonProps}
      aria-label={augmented ? 'Augmented' : BIS_SOURCE_FULL_NAMES[bisSource]}
      className={`${BASE} ${fill} ${interactive ? 'cursor-pointer hover:brightness-110' : ''}`}
    >
      {code}
    </span>
  );
}
