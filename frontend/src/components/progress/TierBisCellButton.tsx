/**
 * TierBisCellButton — one roster column's cell on the tier row (S2a-3b·H3, D-2, D-4, design
 * §3.2): "6/11" over the three-part bar in the column's role colour, or "No BiS set" when
 * the card has no BiS targets. An unclaimed card's cell is the same, dimmed (its header
 * already reads "Claim to track"). A column with no card (Not on the roster, Card not set
 * up) has no cell: `TierRow` draws an empty focus target for it instead of this.
 *
 * The `Button` is named with the numbers, "{player}, {tier}, {done} of {total} BiS slots
 * done[, {n} need augment]" or "…, no BiS set", so the bar is never read by colour alone.
 * S2a-3b·H3a passes `grid` (the roving grid's cell props, on the Button: the cell's one stop).
 *
 * S2a-3b·H3b (D-5, D-8, E-9, R-T-9): a click or Enter opens the slot breakdown, a read-only
 * popover (`TierBreakdown`) that ends in Open on board; Alt+Click jumps to that card on Roster ▸
 * Board and opens nothing. A plain click never jumps. There is no context menu (D-8). The
 * pointer cursor shows only while Alt is held (`altHeld`, one listener for the row), since a
 * persistent pointer would advertise a plain click the jump does not honour. The popover's
 * content is portalled, and React bubbles its events through the Popover root, which does reach
 * the `<td>` and `<tr>`. The grid misses them only because its `cellProps` sit on the trigger,
 * the Popover root's sibling, so they must never move onto the `<td>`.
 */
import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives/Popover';
import { getValidRole } from '../../gamedata';
import type { ProgressColumn } from '../../utils/progressModel';
import type { TierBisCell } from '../../utils/tierBis';
import { TierBisBar } from './TierBisBar';
import { TierBreakdown } from './TierBreakdown';
import type { MatrixCellProps } from './useMatrixKeyboard';

/** A column with a card: only these have a BiS cell. */
type CardColumn = Extract<ProgressColumn, { kind: 'claimed' | 'unclaimed' }>;

interface TierBisCellButtonProps {
  column: CardColumn;
  cell: TierBisCell;
  tierName: string;
  grid: MatrixCellProps;
  /** Alt is down: the pointer cursor shows, and a click jumps. */
  altHeld?: boolean;
  /** The jump to this card's row on the Board. */
  onJump: (playerId: string) => void;
}

function cellName(column: CardColumn, cell: TierBisCell, tierName: string): string {
  if (!cell.hasTargets) return `${column.name}, ${tierName}, no BiS set`;
  const augment = cell.needsAugment > 0 ? `, ${cell.needsAugment} need augment` : '';
  return `${column.name}, ${tierName}, ${cell.done} of ${cell.total} BiS slots done${augment}`;
}

export function TierBisCellButton({ column, cell, tierName, grid, altHeld = false, onJump }: TierBisCellButtonProps) {
  const [open, setOpen] = useState(false);
  const player = column.player;
  const dimmed = column.kind === 'unclaimed';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={cellName(column, cell, tierName)}
          className={`w-full min-w-24${altHeld ? ' cursor-pointer' : ''}`}
          onClick={(event) => {
            if (!event.altKey) return;
            // Alt+Click jumps and never opens: the default-prevented click skips the trigger's toggle.
            event.preventDefault();
            onJump(player.id);
          }}
          {...grid}
        >
          <span className="flex w-full flex-col gap-1 text-left">
            {cell.hasTargets ? (
              <>
                <span className={`text-sm font-medium tabular-nums ${dimmed ? 'text-text-secondary' : 'text-text-primary'}`}>
                  {`${cell.done}/${cell.total}`}
                </span>
                <TierBisBar cell={cell} role={getValidRole(player.role)} dimmed={dimmed} />
              </>
            ) : (
              <span className="text-xs font-normal text-text-muted">No BiS set</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={`${column.name} · BiS slots`}>
        <TierBreakdown
          player={player}
          cell={cell}
          onOpenBoard={() => {
            setOpen(false);
            onJump(player.id);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
