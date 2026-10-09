/**
 * ProgressCell — one cell of the Progress matrix (R-S2-8): the state's glyph and
 * word, and the count on Need and Want when this reader may see one. A `gridcell`
 * whose accessible name is the model's ("{player}, {track}, {state}[, {count} of
 * {cost} {token}]"). Hover or focus tells where the value came from (R-S2-9). Read-only
 * in S2a-2·F4: the cell is never a control, but it is the grid's focus target, so S2a-2·F5
 * can put a button inside it without touching the keyboard model.
 */
import { Tooltip } from '../primitives/Tooltip';
import type { CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { cellAccessibleName, cellText, type ProgressCell as ProgressCellModel } from '../../utils/progressModel';
import { cellProvenance, type ProvenanceContext } from './progressProvenance';
import type { MatrixCellProps } from './useMatrixKeyboard';

/** Semantic tones only. The glyph/word carries each state; colour never tells it alone. */
const STATE_TONE: Record<ParticipantState, string> = {
  have: 'text-status-success',
  need: 'text-status-error',
  want: 'text-status-warning',
  pass: 'text-text-secondary',
};

interface ProgressCellProps {
  cell: ProgressCellModel;
  goal: Pick<CollectionGoal, 'title' | 'tokenCost' | 'tokenName'>;
  /** Who is looking and how to name a writer, for the provenance tooltip. */
  provenance: ProvenanceContext;
  /** The roving-grid props; absent where the cell is not part of the keyboard grid (Finished). */
  grid?: MatrixCellProps;
}

export function ProgressCell({ cell, goal, provenance, grid }: ProgressCellProps) {
  const text = cellText(cell, goal);
  const origin = cellProvenance(cell, provenance);
  return (
    <Tooltip
      side="bottom"
      disabled={origin === null}
      content={
        origin !== null && (
          <div data-testid="progress-provenance" className="space-y-0.5 text-xs">
            {origin.count === null ? (
              <div>{origin.state}</div>
            ) : (
              <>
                <div>{`State: ${origin.state}`}</div>
                <div>{`Count: ${origin.count}`}</div>
              </>
            )}
          </div>
        )
      }
    >
      <td
        role="gridcell"
        aria-label={cellAccessibleName(cell, goal)}
        data-testid="progress-cell"
        className="whitespace-nowrap px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        {...grid}
      >
        {text !== '' && cell.state !== null && <span className={STATE_TONE[cell.state]}>{text}</span>}
      </td>
    </Tooltip>
  );
}
