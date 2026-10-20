/**
 * TierBisCellButton — one roster column's cell on the tier row (S2a-3b·H3, D-2, D-4, design
 * §3.2): "6/11" over the three-part bar in the column's role colour, or "No BiS set" when
 * the card has no BiS targets. An unclaimed card's cell is the same, dimmed (its header
 * already reads "Claim to track"). A column with no card (Not on the roster, Card not set
 * up) has no cell: `cell` is null and nothing renders.
 *
 * The `Button` is named with the numbers, "{player}, {tier}, {done} of {total} BiS slots
 * done[, {n} need augment]" or "…, no BiS set", so the bar is never read by colour alone.
 * S2a-3b·H3a passes `grid` (the roving grid's cell props); H3b adds the breakdown and the jump.
 */
import { Button } from '../primitives/Button';
import { getValidRole } from '../../gamedata';
import type { ProgressColumn } from '../../utils/progressModel';
import type { TierBisCell } from '../../utils/tierBis';
import { TierBisBar } from './TierBisBar';
import type { MatrixCellProps } from './useMatrixKeyboard';

interface TierBisCellButtonProps {
  column: ProgressColumn;
  cell: TierBisCell | null;
  tierName: string;
  grid?: MatrixCellProps;
}

function cellName(column: ProgressColumn, cell: TierBisCell, tierName: string): string {
  if (!cell.hasTargets) return `${column.name}, ${tierName}, no BiS set`;
  const augment = cell.needsAugment > 0 ? `, ${cell.needsAugment} need augment` : '';
  return `${column.name}, ${tierName}, ${cell.done} of ${cell.total} BiS slots done${augment}`;
}

export function TierBisCellButton({ column, cell, tierName, grid }: TierBisCellButtonProps) {
  if (cell === null || column.player === null) return null;
  const dimmed = column.kind === 'unclaimed';
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={cellName(column, cell, tierName)}
      className="w-full min-w-24"
      {...grid}
    >
      <span className="flex w-full flex-col gap-1 text-left">
        {cell.hasTargets ? (
          <>
            <span className={`text-sm font-medium tabular-nums ${dimmed ? 'text-text-secondary' : 'text-text-primary'}`}>
              {`${cell.done}/${cell.total}`}
            </span>
            <TierBisBar cell={cell} role={getValidRole(column.player.role)} dimmed={dimmed} />
          </>
        ) : (
          <span className="text-xs font-normal text-text-muted">No BiS set</span>
        )}
      </span>
    </Button>
  );
}
