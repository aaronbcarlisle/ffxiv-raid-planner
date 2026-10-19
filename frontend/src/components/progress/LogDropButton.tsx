/**
 * LogDropButton — a lead's Log a drop (S2a-3a·G3 Task TG5; D-6, D-16, R-S3-6, R-S3-14). A split
 * button in one `group` named "Log a drop": the main `Button` logs for the queue's #1 in one
 * click ("Log drop for {name}"), and the ▾ `IconButton` opens the picker, a `Popover` named "Log
 * a drop for {track}". With no #1 (`free_roll`, or nobody queued) the main button reads "Log a
 * drop", opens the picker with Nobody checked (it then says so: `aria-haspopup`,
 * `aria-expanded`), and takes focus back when the picker closes.
 *
 * The picker is one `radiogroup` with a single tab stop (the checked option; the arrow keys move
 * the check and focus, the `loot/RecipientPicker` precedent, vet M-2; Enter logs): the queue in
 * order with "#n", then "Not in the queue" and every other member column (claimed and Not on the
 * roster, R-S3-14) in column order, then Nobody; an optional note; "Log drop" and Cancel. From
 * the click until the log and its refresh are done (`useDropLogger`) both halves and the submit
 * are unavailable but stay focusable (`aria-disabled`, clicks ignored), so a keyboard user's
 * focus is never dropped and the picker always closes onto a live ▾. The picker portals, so its
 * Escape is Radix's: it closes the picker alone (the panel's filter leaves a handled key alone,
 * R-S3-4).
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Gift } from 'lucide-react';
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import type { FarmRow, ProgressCell } from '../../utils/progressModel';
import { queueEntryText, queueFor } from '../../utils/progressQueue';
import { BUSY_CLASS, useDropLogger } from './useDrops';

interface Recipient {
  key: string;
  /** Null is Nobody. */
  userId: string | null;
  name: string;
  /** The queue's "#n", or null outside it. */
  rank: number | null;
  /** "Need 12/99", the state's word, or nothing. */
  detail: string;
}

const NOBODY: Recipient = { key: '__nobody', userId: null, name: 'Nobody', rank: null, detail: '' };

const NOTE_MAX = 500;

/** A cell outside the queue: Need or Want as the queue writes them, else the state's word. */
function restDetail(cell: ProgressCell, tokenCost: number | null): string {
  const { state } = cell;
  if (state === 'need' || state === 'want') {
    return queueEntryText({ cell, rank: 0, state, count: cell.count, countHidden: cell.countHidden }, tokenCost);
  }
  return state === 'have' ? 'Have' : state === 'pass' ? 'Pass' : '';
}

/** The queue in order, then every other member column in column order (R-S3-14). */
function recipientsFor(row: FarmRow): { queued: Recipient[]; rest: Recipient[] } {
  const queue = queueFor(row, row.goal.priorityMode);
  const inQueue = new Set(queue.map((entry) => entry.cell));
  const queued = queue.map((entry) => ({
    key: entry.cell.column.key,
    userId: entry.cell.column.userId,
    name: entry.cell.column.name,
    rank: entry.rank,
    detail: queueEntryText(entry, row.goal.tokenCost),
  }));
  const rest = row.cells.flatMap((cell): Recipient[] => {
    const { column } = cell;
    if (column.kind === 'unclaimed' || inQueue.has(cell)) return [];
    return [{ key: column.key, userId: column.userId, name: column.name, rank: null, detail: restDetail(cell, row.goal.tokenCost) }];
  });
  return { queued, rest };
}

/** Focuses the checked option when the picker mounts (the Popover primitive suppresses Radix's auto-focus). */
const focusOnMount = (el: HTMLDivElement | null) => el?.focus();

const STEP: Record<string, (index: number, count: number) => number> = {
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

export function LogDropButton({ row, groupId }: { row: FarmRow; groupId: string }) {
  const { goal } = row;
  const { busy, log } = useDropLogger(groupId, goal.id);
  const { queued, rest } = recipientsFor(row);
  const first = queued[0] ?? null;
  const options = [...queued, ...rest, NOBODY];
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(NOBODY.key);
  // Fixed at open, so moving the check never re-runs the mount focus.
  const [focusKey, setFocusKey] = useState(NOBODY.key);
  const [note, setNote] = useState('');
  const noteId = useId();
  const restId = useId();
  const mainRef = useRef<HTMLButtonElement>(null);
  // The main button opened the picker (no #1): focus goes back to it, not to the ▾.
  const openedByMain = useRef(false);

  const changeOpen = (next: boolean, byMain = false) => {
    if (next) {
      const key = first?.key ?? NOBODY.key;
      setChecked(key);
      setFocusKey(key);
      setNote('');
      openedByMain.current = byMain;
    }
    setOpen(next);
  };

  const logFor = (recipient: Recipient, notes: string | null) =>
    log({ recipientUserId: recipient.userId, notes }, recipient.userId === null ? 'Drop logged' : `Drop logged for ${recipient.name}`);

  const submit = async (recipient = options.find((option) => option.key === checked) ?? NOBODY) => {
    if (busy) return;
    if (await logFor(recipient, note.trim() || null)) setOpen(false);
  };

  const onRadioKey = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      setChecked(options[index].key);
      // Enter logs, as it would submit a form of native radios.
      if (event.key === 'Enter') void submit(options[index]);
      return;
    }
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = step(index, options.length);
    setChecked(options[next].key);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  const radio = (option: Recipient, index: number) => {
    const isChecked = option.key === checked;
    return (
      <div
        key={option.key}
        ref={option.key === focusKey ? focusOnMount : undefined}
        role="radio"
        aria-checked={isChecked}
        aria-describedby={option.rank === null && option.userId !== null ? restId : undefined}
        tabIndex={isChecked ? 0 : -1}
        onClick={() => setChecked(option.key)}
        onKeyDown={(event) => onRadioKey(event, index)}
        className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-accent ${
          isChecked ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-surface-interactive'
        }`}
      >
        <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full border-2 ${isChecked ? 'border-accent bg-accent' : 'border-border-default'}`} />
        {option.rank !== null && (
          <>
            <span className="w-6 shrink-0 text-text-muted">{`#${option.rank}`}</span>
            {/* A real space: the text keeps "#n" and the name apart (textContent, readers). */}
            {' '}
          </>
        )}
        <span>{option.detail ? `${option.name} · ${option.detail}` : option.name}</span>
      </div>
    );
  };

  return (
    <div role="group" aria-label="Log a drop" className="inline-flex">
      <Button
        ref={mainRef}
        variant="accent-subtle"
        size="sm"
        className={`rounded-r-none ${BUSY_CLASS}`}
        leftIcon={<Gift size={14} aria-hidden="true" />}
        aria-disabled={busy || undefined}
        aria-haspopup={first ? undefined : 'dialog'}
        aria-expanded={first ? undefined : open}
        onClick={() => {
          if (busy) return;
          if (first) void logFor(first, null);
          else changeOpen(true, true);
        }}
      >
        {first ? `Log drop for ${first.name}` : 'Log a drop'}
      </Button>
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger asChild>
          <IconButton
            aria-label="More recipients"
            aria-haspopup="dialog"
            aria-disabled={busy || undefined}
            variant="accent-subtle"
            size="sm"
            className={`rounded-l-none border-l-0 ${BUSY_CLASS}`}
            icon={<ChevronDown size={14} aria-hidden="true" />}
            // Radix skips its toggle for a click whose default is prevented.
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 max-w-[calc(100vw-2rem)] p-3"
          aria-label={`Log a drop for ${goal.title}`}
          onCloseAutoFocus={(event) => {
            if (!openedByMain.current) return;
            event.preventDefault();
            mainRef.current?.focus();
          }}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div role="radiogroup" aria-label="Recipient" className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {queued.map((option, i) => radio(option, i))}
              {rest.length > 0 && (
                <div id={restId} className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Not in the queue
                </div>
              )}
              {rest.map((option, i) => radio(option, queued.length + i))}
              {radio(NOBODY, options.length - 1)}
            </div>
            <div className="mt-3">
              <Label htmlFor={noteId} size="sm">
                Note (optional)
              </Label>
              <Input id={noteId} size="sm" fullWidth maxLength={NOTE_MAX} value={note} onChange={setNote} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => changeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" aria-disabled={busy || undefined} className={BUSY_CLASS}>
                Log drop
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
