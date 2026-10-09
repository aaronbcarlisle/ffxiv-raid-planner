/**
 * CellPicker — a member's own Progress cell as a control (S2a-2·F5 Task TF7; R-S2-10,
 * R-S2-11). The trigger is the cell's `Button`, and it is the grid's roving stop for that
 * cell: `grid` goes on it, not on the `<td>`, since a WAI-ARIA gridcell with one widget
 * focuses the widget. The popover content is portalled, and React bubbles its events
 * through the Popover root, the trigger's sibling, so nothing typed in it reaches the grid.
 *
 * The popover holds four state Buttons in a "Status" group, the current one pressed, and
 * on a token farm the count field, unless the count is hidden from the reader. A pick
 * saves at once and closes (Radix returns focus to the trigger). The count commits as a
 * whole number on Enter (the form's submit) or whenever focus leaves the field, Tab
 * included, with the cell's current state, and on nothing else: Escape closes without a
 * commit of its own (Chrome fires no blur for a field it removes, so Escape discards a
 * typed count there). Clicking away saves: the press outside starts the close, and the
 * popover's exit animation keeps the field mounted while that press then moves focus
 * and blurs it (verified live; without the animation the field would be gone first). A
 * pointer press on a status button keeps focus in the field, so that pick carries the
 * typed count as one write, and the count is marked sent so the field's later blur
 * (still mounted through the exit animation) cannot send it again with the old state.
 * Nothing is optimistic: the cell shows the store's row, so a failed save leaves it as it
 * was. Every save toasts "{Word} saved" with Undo while the server returned a token; Undo
 * posts it back and refetches.
 *
 * `write.targetUserId` sends the write through the lead route: the viewed user under
 * View As (R-S2-10), and a lead's correction from S2a-2·F6 on.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '../primitives/Button';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives/Popover';
import { Label } from '../ui/Label';
import { NumberInput } from '../ui/NumberInput';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type CellWrite, type CollectionGoal, type ParticipantState } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import type { ProgressCell as ProgressCellModel } from '../../utils/progressModel';
import { undoWithToasts } from './undoToasts';
import type { MatrixCellProps } from './useMatrixKeyboard';

/** Where a cell's write goes (R-S2-10). */
export interface CellWriteTarget {
  groupId: string;
  /**
   * The member written through the lead route when the cell is not the caller's own: the
   * viewed user under View As (so the admin's own row is never written by mistake).
   */
  targetUserId?: string;
}

interface Option {
  state: ParticipantState;
  label: string;
  /** The toast's word: "{word} saved". */
  word: string;
}

const OPTIONS: readonly Option[] = [
  { state: 'need', label: 'Need', word: 'Need' },
  { state: 'want', label: '★ Want', word: 'Want' },
  { state: 'have', label: '✓ Have', word: 'Have' },
  { state: 'pass', label: '– Pass', word: 'Pass' },
];

/**
 * Opening focuses the pressed (or first) option: the Popover primitive suppresses Radix's
 * own auto-focus, so this ref is the keyboard's way into the content (TankSeatSelector's
 * path). Module-level, so its identity never changes and it fires on mount only.
 */
const focusOnMount = (el: HTMLButtonElement | null) => el?.focus();

const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'something went wrong');

interface CellPickerProps {
  cell: ProgressCellModel;
  goal: Pick<CollectionGoal, 'id' | 'tokenCost' | 'tokenName'>;
  write: CellWriteTarget;
  /** The trigger's accessible name. */
  label: string;
  /** The roving-grid props, spread on the trigger; absent outside the grid. */
  grid?: MatrixCellProps;
  onOpenChange?: (open: boolean) => void;
  /** The trigger's visible content: the cell's text. */
  children: ReactNode;
}

export function CellPicker({ cell, goal, write, label, grid, onOpenChange, children }: CellPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(cell.count);
  // The option focused when the content mounts: fixed at open, so a state change while the
  // picker is open cannot move the auto-focus ref and steal focus from the count field.
  const [focusTarget, setFocusTarget] = useState<ParticipantState>('need');
  const countId = useId();
  const setCell = useCollectionGoalStore((s) => s.setCell);
  const undoCells = useCollectionGoalStore((s) => s.undoCells);
  // Saves run one after another, in the order they were made, so a later response can never
  // overwrite an earlier one; the first starts at once, inside the event that asked for it.
  const pendingRef = useRef<Array<() => Promise<void>>>([]);
  const drainingRef = useRef(false);
  // The count last sent and not yet in the cell: a blur after Enter sends nothing twice.
  const sentRef = useRef<number | null>(null);

  const enqueue = (job: () => Promise<void>) => {
    pendingRef.current.push(job);
    if (drainingRef.current) return;
    drainingRef.current = true;
    void (async () => {
      for (let next = pendingRef.current.shift(); next !== undefined; next = pendingRef.current.shift()) await next();
      drainingRef.current = false;
    })();
  };

  const state = cell.state;
  const tokenLabel = goal.tokenName || 'Totems';
  const showCount = (goal.tokenCost != null || Boolean(goal.tokenName)) && !cell.countHidden;

  const changeOpen = (next: boolean) => {
    if (next) {
      setDraft(cell.count);
      setFocusTarget(state ?? 'need');
      sentRef.current = null;
    }
    setOpen(next);
    onOpenChange?.(next);
  };

  const undo = (token: string) => undoWithToasts(() => undoCells(write.groupId, token));

  const save = (next: ParticipantState, tokenCount: number | undefined, message: string) => {
    const body: CellWrite = { state: next };
    if (write.targetUserId) body.targetUserId = write.targetUserId;
    if (tokenCount !== undefined) body.tokenCount = tokenCount;
    enqueue(async () => {
      try {
        const { undoToken } = await setCell(write.groupId, goal.id, body);
        if (undoToken === null) toast.success(message);
        else toast.withUndo(message, () => void undo(undoToken));
      } catch (err) {
        sentRef.current = null;
        // api.ts toasts a true 403 itself; any other failure is told once, here.
        if (!wasToastedByApi(err)) toast.error(`Couldn't save: ${messageOf(err)}`);
      }
    });
  };

  // A typed count the cell does not hold yet (and that is not already on its way), as a whole
  // number: the field takes "62.5", the API takes integers only.
  const pendingCount = () => {
    if (state === null || draft === null) return undefined;
    const count = Math.trunc(draft);
    return count !== cell.count && count !== sentRef.current ? count : undefined;
  };

  const pick = (option: Option) => {
    const count = pendingCount();
    if (count !== undefined) {
      sentRef.current = count;
      setDraft(count);
    }
    changeOpen(false);
    save(option.state, count, `${option.word} saved`);
  };

  const commitCount = () => {
    const count = pendingCount();
    if (state === null || count === undefined) return;
    sentRef.current = count;
    // The field shows what was sent (a typed 62.5 went as 62).
    setDraft(count);
    save(state, count, `${tokenLabel} saved`);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        {/* Ghost keeps the card's background behind the state tones (the secondary surface
            drops the light-theme Need tone under AA); the border is the at-rest control look. */}
        <Button variant="ghost" size="sm" className="border border-border-default" aria-label={label} {...grid}>
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-2">
        {/* A pointer press here keeps focus where it is (no blur of the count field), so the
            pick it starts carries a typed count as one write. Keyboard focus moves are not
            picks: leaving the field by Tab commits the count on its blur. */}
        <div role="group" aria-label="Status" className="flex gap-1" onPointerDown={(event) => event.preventDefault()}>
          {OPTIONS.map((option) => {
            const pressed = option.state === state;
            return (
              <Button
                key={option.state}
                ref={option.state === focusTarget ? focusOnMount : undefined}
                type="button"
                size="sm"
                variant={pressed ? 'primary' : 'secondary'}
                aria-pressed={pressed}
                onClick={() => pick(option)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        {showCount && (
          <form
            className="mt-2"
            // Enter must reach onSubmit with "62.5" too (type=number, step 1 would block it); the commit truncates.
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              commitCount();
            }}
            onBlur={commitCount}
          >
            <Label htmlFor={countId} size="sm" description={state === null ? 'Pick a status first' : undefined}>
              {tokenLabel}
            </Label>
            <NumberInput id={countId} showButtons={false} min={0} value={draft} onChange={setDraft} disabled={state === null} />
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
