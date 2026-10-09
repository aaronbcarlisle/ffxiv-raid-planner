/**
 * EditStatusesBar — the Progress tab's one toolbar row (S2a-2·F6 Task TF8; R-S2-10,
 * R-S2-12, R-S2-17). A lead sees "Edit statuses"; in the mode, "Mark everyone without a
 * status as Need" and "Done": never more than four controls. The page owns the mode and
 * renders the bar only for a reader who may edit (owner, lead or admin access), so a
 * member or a viewer gets no button at all: hidden, not disabled (ROLE-1).
 *
 * The bulk sends exactly the blank claimed cells the page shows on active rows, through
 * the store (which chunks the request), then toasts "Marked n cells Need" with Undo for
 * eight seconds (R-S2-11): Undo puts every chunk back, in order, and refetches. With no
 * blank cell the button is disabled and "No blank cells" describes it: a state, not a role.
 *
 * Entering the mode unmounts "Edit statuses", so focus would fall to the body: a click
 * here moves it to Done, and Done moves it back to "Edit statuses". A mode the page
 * changes by itself (the reader lost the role) moves nothing.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../primitives/Button';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type MarkNeedCell } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { undoWithToasts } from './undoToasts';

interface EditStatusesBarProps {
  groupId: string;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  /** The blank claimed cells on the active rows, as shown (R-S2-12, Q2). */
  blankCells: readonly MarkNeedCell[];
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'something went wrong');

export function EditStatusesBar({ groupId, editing, onEdit, onDone, blankCells }: EditStatusesBarProps) {
  const [marking, setMarking] = useState(false);
  const helpId = useId();
  const editRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  // Set by a click here and consumed once the mode has changed.
  const moveFocus = useRef(false);
  const markNeed = useCollectionGoalStore((s) => s.markNeed);
  const undoCells = useCollectionGoalStore((s) => s.undoCells);

  useLayoutEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (editing ? doneRef : editRef).current?.focus();
  }, [editing]);

  const enter = () => {
    moveFocus.current = true;
    onEdit();
  };
  const done = () => {
    moveFocus.current = true;
    onDone();
  };

  // Every chunk's token, in order; one report for the lot.
  const undo = (tokens: readonly string[]) =>
    undoWithToasts(async () => {
      let skipped = 0;
      for (const token of tokens) skipped += (await undoCells(groupId, token)).skipped;
      return { skipped };
    });

  const mark = async () => {
    setMarking(true);
    try {
      const { created, undoTokens } = await markNeed(groupId, blankCells);
      if (created === 0) {
        toast.info('No cells marked: they changed since');
      } else {
        const message = `Marked ${created} ${created === 1 ? 'cell' : 'cells'} Need`;
        if (undoTokens.length === 0) toast.success(message);
        else toast.withUndo(message, () => void undo(undoTokens));
      }
    } catch (err) {
      // api.ts toasts a true 403 itself; any other failure is told once, here.
      if (!wasToastedByApi(err)) toast.error(`Couldn't mark cells: ${messageOf(err)}`);
    } finally {
      setMarking(false);
    }
  };

  const noBlank = blankCells.length === 0;
  return (
    <div data-testid="progress-toolbar" className="flex flex-wrap items-center gap-2">
      {editing ? (
        <>
          <Button
            variant="primary"
            size="sm"
            loading={marking}
            disabled={noBlank}
            aria-describedby={noBlank ? helpId : undefined}
            onClick={() => void mark()}
          >
            Mark everyone without a status as Need
          </Button>
          {noBlank && (
            <span id={helpId} className="text-xs text-text-muted">
              No blank cells
            </span>
          )}
          <Button ref={doneRef} variant="ghost" size="sm" onClick={done}>
            Done
          </Button>
        </>
      ) : (
        <Button ref={editRef} variant="secondary" size="sm" onClick={enter}>
          Edit statuses
        </Button>
      )}
    </div>
  );
}
