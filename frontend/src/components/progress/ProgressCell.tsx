/**
 * ProgressCell — one cell of the Progress matrix (R-S2-8): the state's glyph and
 * word, and the count on Need and Want when this reader may see one. A `gridcell`
 * whose accessible name is the model's ("{player}, {track}, {state}[, {count} of
 * {cost} {token}]"). Hover or focus tells where the value came from (R-S2-9).
 *
 * S2a-2·F5 (R-S2-10): a cell that `editFor` gives a write target holds a `CellPicker`,
 * whose trigger Button is the cell's focus element and its roving stop (`grid` goes on the
 * Button; the `<td>` takes no tabIndex). A blank editable cell reads a muted "Set status",
 * so a lead can see where to click. The reader's own cell is named "… — change your
 * status" / "… — set your status"; another member's (a lead's correction in Edit statuses,
 * S2a-2·F6) "… — change status" / "… — set status". The provenance tooltip is controlled
 * here for its whole life (never flipping Radix between controlled and uncontrolled) and
 * sleeps while the picker is open, so focus and pointer events from the portalled popover
 * (which React bubbles up to this `<td>`) cannot wake it over the picker. Every other cell
 * stays what F4 built: the `<td>` is the stop and never a control.
 */
import { useState } from 'react';
import { Tooltip } from '../primitives/Tooltip';
import type { CollectionGoal, ParticipantState } from '../../stores/collectionGoalStore';
import { cellAccessibleName, cellText, type ProgressCell as ProgressCellModel } from '../../utils/progressModel';
import { CellPicker } from './CellPicker';
import type { CellWriteResolver } from './editStatuses';
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
  /** Where a cell writes (R-S2-10), undefined for one this reader may not; absent where every cell is read-only (Finished). */
  editFor?: CellWriteResolver;
}

export function ProgressCell({ cell, goal, provenance, grid, editFor }: ProgressCellProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // What Radix last asked for; shown only while the cell has provenance and the picker is shut.
  // Radix never asks to close a tooltip whose controlled value is already false, so a wish the
  // cell could not show (no provenance yet) would latch; the pointer leaving or focus leaving
  // the cell forgets it, as the Tooltip would have closed.
  const [tipWanted, setTipWanted] = useState(false);
  const forgetTip = () => setTipWanted(false);
  const text = cellText(cell, goal);
  const origin = cellProvenance(cell, provenance);
  const name = cellAccessibleName(cell, goal);
  const write = editFor?.(cell);
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
        <td
          role="gridcell"
          aria-label={name}
          data-testid="progress-cell"
          className="whitespace-nowrap px-0 py-0.5 text-sm"
          onPointerLeave={forgetTip}
          onBlur={forgetTip}
        >
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
            label={`${name} — ${cell.state === null ? 'set' : 'change'}${cell.own ? ' your' : ''} status`}
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
          onPointerLeave={forgetTip}
          onBlur={(event) => {
            grid?.onBlur(event);
            forgetTip();
          }}
        >
          {content}
        </td>
      )}
    </Tooltip>
  );
}
