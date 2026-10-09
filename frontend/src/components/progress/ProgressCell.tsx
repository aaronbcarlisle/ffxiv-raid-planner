/**
 * ProgressCell — one cell of the Progress matrix (R-S2-8): the state's glyph and
 * word, and the count on Need and Want when this reader may see one. A `gridcell`
 * whose accessible name is the model's ("{player}, {track}, {state}[, {count} of
 * {cost} {token}]"). Hover or focus tells where the value came from (R-S2-9).
 *
 * S2a-2·F5 (R-S2-10): given an `edit` context, the reader's own cell holds a `CellPicker`,
 * whose trigger Button is the cell's focus element and its roving stop (`grid` goes on the
 * Button; the `<td>` takes no tabIndex). A blank own cell reads a muted "Set status". The
 * provenance tooltip is controlled here for its whole life (never flipping Radix between
 * controlled and uncontrolled) and sleeps while the picker is open, so focus and pointer
 * events from the portalled popover (which React bubbles up to this `<td>`) cannot wake it
 * over the picker. Every other cell stays what F4 built: the `<td>` is the stop and never
 * a control.
 */
import { useState } from 'react';
import { Tooltip } from '../primitives/Tooltip';
import type { CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { cellAccessibleName, cellText, type ProgressCell as ProgressCellModel } from '../../utils/progressModel';
import { CellPicker, type CellWriteTarget } from './CellPicker';
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
  goal: Pick<CollectionGoal, 'id' | 'title' | 'tokenCost' | 'tokenName'>;
  /** Who is looking and how to name a writer, for the provenance tooltip. */
  provenance: ProvenanceContext;
  /** The roving-grid props; absent where the cell is not part of the keyboard grid (Finished). */
  grid?: MatrixCellProps;
  /** How the reader's own cell writes (R-S2-10); absent where cells are read-only (a viewer; Finished). */
  edit?: CellWriteTarget;
}

export function ProgressCell({ cell, goal, provenance, grid, edit }: ProgressCellProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // What Radix last asked for; shown only while the cell has provenance and the picker is shut.
  const [tipWanted, setTipWanted] = useState(false);
  const text = cellText(cell, goal);
  const origin = cellProvenance(cell, provenance);
  const name = cellAccessibleName(cell, goal);
  const write = cell.own ? edit : undefined;
  // The state span sets its own weight: inside the picker's Button it would inherit semibold.
  const content =
    cell.state !== null && text !== '' ? (
      <span className={`font-normal ${STATE_TONE[cell.state]}`}>{text}</span>
    ) : write !== undefined ? (
      <span className="text-xs font-normal text-text-muted">Set status</span>
    ) : null;
  return (
    <Tooltip
      side="bottom"
      // The next row's cell sits right under this tooltip: it must not cover or hold it open.
      disableHoverableContent
      open={origin !== null && !pickerOpen && tipWanted}
      onOpenChange={setTipWanted}
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
      {write !== undefined ? (
        <td role="gridcell" aria-label={name} data-testid="progress-cell" className="whitespace-nowrap px-0 py-0.5 text-sm">
          <CellPicker
            cell={cell}
            goal={goal}
            write={write}
            grid={grid}
            onOpenChange={(next) => {
              setPickerOpen(next);
              // Whatever Radix asked for while the picker was open (focus and pointer events in
              // its content bubble here) is forgotten on both edges: the tooltip shows again only
              // on a fresh focus or hover, never stale after an outside-click close.
              setTipWanted(false);
            }}
            label={`${name} — ${cell.state === null ? 'set your status' : 'change your status'}`}
          >
            {content}
          </CellPicker>
        </td>
      ) : (
        <td
          role="gridcell"
          aria-label={name}
          data-testid="progress-cell"
          className="whitespace-nowrap px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          {...grid}
        >
          {content}
        </td>
      )}
    </Tooltip>
  );
}
