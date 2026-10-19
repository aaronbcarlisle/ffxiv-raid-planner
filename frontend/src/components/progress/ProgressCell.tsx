/**
 * ProgressCell — one cell of the Progress matrix (R-S2-8): the state's glyph and
 * word, and the count on Need and Want when this reader may see one. Read-only in
 * S2a-2·F3: the cell is a plain table cell, never a control. The accessible name is
 * the model's ("{player}, {track}, {state}[, {count} of {cost} {token}]").
 */
import type { CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { cellAccessibleName, cellText, type ProgressCell as ProgressCellModel } from '../../utils/progressModel';

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
}

export function ProgressCell({ cell, goal }: ProgressCellProps) {
  const text = cellText(cell, goal);
  return (
    <td
      aria-label={cellAccessibleName(cell, goal)}
      data-testid="progress-cell"
      className="whitespace-nowrap px-3 py-2 text-sm"
    >
      {text !== '' && cell.state !== null && <span className={STATE_TONE[cell.state]}>{text}</span>}
    </td>
  );
}
