/**
 * QueueOrderEditor — Change order's inline editor (S2a-3c·C3 Task TC3; design §3.3, §3.6, D-2,
 * D-6, E-7, E-8; R-C-7). Every queued entry, Needs then Wants, as "#k {name} · Need 12/99",
 * numbered by its place in the draft, each with Move {name} up and Move {name} down. A move stays
 * in its state: a button at the list's end or at the Need/Want boundary is `aria-disabled` with
 * `BUSY_CLASS` (`IconButton` dims only for native `disabled`, which would drop focus) and does
 * nothing. After a move, focus goes back to the button pressed, now on the moved entry, and a
 * polite status line reads "{name}, {k} of {n}".
 *
 * The draft is the ids taken at mount; each render places the current queue by it
 * (`orderedDraft`), so a refresh drops whoever left the queue and appends whoever joined it, in
 * their state. Save order hands up that list. While `saving`, every control ignores clicks. An
 * Escape no layer handled is prevented and cancels, so the panel around the editor stays open.
 * Opening it moves focus to the first control that can act: the trigger it replaced is gone.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { moveWithinState, orderedDraft, queueEntryText, type QueueEntry } from '../../utils/progressQueue';
import { Button, IconButton, VisuallyHidden } from '../primitives';
import { BUSY_CLASS } from './useDrops';

export interface QueueOrderEditorProps {
  queue: readonly QueueEntry[];
  tokenCost: number | null;
  /** A save is in flight: every control is unavailable but keeps focus. */
  saving: boolean;
  onSave: (userIds: string[]) => void;
  onCancel: () => void;
}

type Delta = -1 | 1;

const MOVES = [
  { delta: -1, word: 'up', Icon: ChevronUp },
  { delta: 1, word: 'down', Icon: ChevronDown },
] as const;

const idOf = (entry: QueueEntry) => entry.cell.column.userId as string;
const buttonKey = (userId: string, delta: Delta) => `${delta}:${userId}`;

export function QueueOrderEditor({ queue, tokenCost, saving, onSave, onCancel }: QueueOrderEditorProps) {
  const [draft, setDraft] = useState<readonly string[]>(() => queue.map(idOf));
  // The last move: whose button takes focus back, and what the status line reads.
  const [moved, setMoved] = useState<{ userId: string; delta: Delta; status: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const order = orderedDraft(draft, queue);

  useLayoutEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button:not([aria-disabled="true"])')?.focus();
  }, []);

  useLayoutEffect(() => {
    if (moved !== null) buttons.current.get(buttonKey(moved.userId, moved.delta))?.focus();
  }, [moved]);

  const canMove = (index: number, delta: Delta) => {
    const to = index + delta;
    return to >= 0 && to < order.length && order[to].state === order[index].state;
  };

  const move = (entry: QueueEntry, delta: Delta) => {
    const userId = idOf(entry);
    const next = moveWithinState(order, userId, delta);
    setDraft(next);
    setMoved({ userId, delta, status: `${entry.cell.column.name}, ${next.indexOf(userId) + 1} of ${next.length}` });
  };

  // A native listener, as FarmEditBlock's (a group is not an interactive element to hang a React
  // key handler on): it runs before React's root dispatch, so the panel's filter sees it prevented.
  const escape = useRef(() => {});
  useEffect(() => {
    escape.current = () => {
      if (!saving) onCancel();
    };
  });
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      escape.current();
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={rootRef} role="group" aria-label="Change order" className="w-full">
      <ol aria-label="Queue order" className="flex flex-col gap-1 text-sm text-text-primary">
        {order.map((entry, index) => {
          const userId = idOf(entry);
          const { name } = entry.cell.column;
          return (
            <li key={entry.cell.column.key} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-text-muted">#{index + 1}</span>
              {/* A real space: the flex gap spaces them on screen, the text keeps them apart (textContent, readers). */}
              {' '}
              <span className="min-w-0 flex-1">{`${name} · ${queueEntryText(entry, tokenCost)}`}</span>
              {MOVES.map(({ delta, word, Icon }) => {
                const stuck = saving || !canMove(index, delta);
                const key = buttonKey(userId, delta);
                return (
                  <IconButton
                    key={word}
                    ref={(el) => {
                      if (el) buttons.current.set(key, el);
                      else buttons.current.delete(key);
                    }}
                    icon={<Icon size={14} aria-hidden="true" />}
                    variant="ghost"
                    size="sm"
                    className={BUSY_CLASS}
                    aria-label={`Move ${name} ${word}`}
                    aria-disabled={stuck || undefined}
                    onClick={() => {
                      if (!stuck) move(entry, delta);
                    }}
                  />
                );
              })}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          className={BUSY_CLASS}
          aria-disabled={saving || undefined}
          onClick={() => {
            if (!saving) onSave(order.map(idOf));
          }}
        >
          Save order
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={BUSY_CLASS}
          aria-disabled={saving || undefined}
          onClick={() => {
            if (!saving) onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
      <div role="status">
        <VisuallyHidden>{moved?.status ?? ''}</VisuallyHidden>
      </div>
    </div>
  );
}
