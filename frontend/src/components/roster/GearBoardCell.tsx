/**
 * GearBoardCell — one gear slot in the Roster Board matrix (ring0, F6c Board).
 *
 * Derived from the `GearStatusCircle` state machine (`toGearState` +
 * `requiresAugmentation`), rendered as the mockup's `.gcell`: a 30px rounded
 * square with a one-letter source code when obtained, a dashed `·` when needed,
 * and a muted `—` when no BiS target is set. The Board is the gear-editing
 * surface: clicking cycles the obtained state via `onCycle` (the parent Board
 * does the state math + persistence). `priority` is reserved for F6d's
 * next-upgrade highlight and currently renders plain need. Visual target:
 * `mockups/02-roster-board.html` `.gcell`.
 */
import { toGearState } from '../../utils/calculations';
import { BIS_SOURCE_NAMES, BIS_SOURCE_FULL_NAMES } from '../../types';
import type { GearSlot, GearSlotStatus } from '../../types';

export interface GearBoardCellProps {
  slot: GearSlotStatus;
  onCycle?: (slot: GearSlot) => void;
  disabled?: boolean;
  /** Reserved for F6d loot-priority highlight; default false → renders plain need. */
  priority?: boolean;
}

const BASE = 'grid h-[30px] w-[30px] place-items-center rounded-md text-[9px] font-extrabold mx-auto';

/** Source fill classes (token-only) keyed by BiS source, for the obtained state. */
const FILL: Record<'raid' | 'tome' | 'base_tome' | 'crafted', string> = {
  raid: 'bg-gear-raid/25 text-text-primary',
  tome: 'bg-gear-tome/25 text-text-primary',
  base_tome: 'bg-gear-base-tome/25 text-text-primary',
  crafted: 'bg-gear-crafted/25 text-text-primary',
};

export function GearBoardCell({ slot, onCycle, disabled = false, priority = false }: GearBoardCellProps) {
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
    }
  };

  const interactive = !disabled && !!onCycle;
  const commonProps = {
    role: 'checkbox' as const,
    'aria-checked': obtained,
    'aria-disabled': disabled,
    tabIndex: interactive ? 0 : -1,
    onClick: interactive ? handleClick : undefined,
    onKeyDown: interactive ? handleKeyDown : undefined,
  };

  if (!obtained) {
    // `priority` is reserved (F6d): render plain need regardless.
    void priority;
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
