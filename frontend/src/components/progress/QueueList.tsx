/**
 * QueueList — "Next in line" (S2a-3a·G2b Task TG4; design §3.1, D-13, D-20, R-S3-14, R-S3-15).
 * Leads and members read the ranked queue, the top four with "Show all (n)" expanding in place
 * when more are queued. A viewer never sees the order (D-20): one unranked line, "Need: A, B ·
 * Want: C", names in column order, no ranks, no counts and no Show all. `free_roll` queues
 * nobody, for every role.
 *
 * A lead's order (S2a-3c·C3 Task TC3; design §3.3, D-5, D-7, D-8, E-7, E-8; R-C-6, R-C-8): a
 * manual queue reads "Manual order" above the list and a caption under it, for leads and members.
 * With `canOrder` (a lead on an active row), Change order (two or more queued) swaps the list for
 * `QueueOrderEditor`, and Back to automatic (a manual queue) clears the order; both are absent
 * otherwise and hidden while editing. Each write goes through `setQueueOrder`, one at a time, and
 * toasts with Undo, which puts back the ranks held before it (`pinnedOrder`). A failed Save keeps
 * the editor and its draft. After Save, Cancel or Back to automatic, focus that went with the
 * closed editor or the vanished button goes to Change order, else to `onLeave`.
 */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpDown, RotateCcw } from 'lucide-react';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import type { FarmRow } from '../../utils/progressModel';
import { pinnedOrder, queueEntryText, queueFor, queueIsManual } from '../../utils/progressQueue';
import { Button } from '../primitives';
import { Tag } from '../ui/Tag';
import { QueueOrderEditor } from './QueueOrderEditor';
import { messageOf } from './undoToasts';
import { BUSY_CLASS } from './useDrops';

const TOP = 4;

/** Change order's wiring: the open farm row passes all three; without them the list has no controls. */
type OrderProps =
  | {
      /** A lead on an active row (`lead && !finished`): Change order and Back to automatic (R-C-6). */
      canOrder: boolean;
      groupId: string;
      /** Takes focus when a write leaves no Change order to hold it (the panel's Copy plan). */
      onLeave: () => void;
    }
  | { canOrder?: undefined; groupId?: undefined; onLeave?: undefined };

export type QueueListProps = {
  row: FarmRow;
  /** `userRole === 'viewer'`: the unranked line, no counts. */
  viewer: boolean;
} & OrderProps;

const MUTED = 'text-sm text-text-muted';

/** Undo (D-8): the order held before a write, through the same route. The toast outlives the panel, so this reads nothing of it. */
async function restoreOrder(groupId: string, goalId: string, userIds: readonly string[]): Promise<void> {
  try {
    await useCollectionGoalStore.getState().setQueueOrder(groupId, goalId, userIds);
  } catch (err) {
    if (!wasToastedByApi(err)) toast.error(`Couldn't restore the order: ${messageOf(err)}`);
    return;
  }
  toast.success('Order restored');
}

export function QueueList(props: QueueListProps) {
  const { row, viewer } = props;
  const ordering = props.canOrder === undefined ? null : props;
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // The state alone would let a second click in before the re-render that marks the controls busy.
  const lock = useRef(false);
  // Set when Save, Cancel or Back to automatic ends; consumed once the editor has closed.
  const leaving = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const { goal } = row;
  const queue = queueFor(row, goal.priorityMode);
  const canOrder = ordering !== null && ordering.canOrder && !viewer;
  const open = editing && canOrder;

  useLayoutEffect(() => {
    if (!leaving.current || editing) return;
    leaving.current = false;
    const active = document.activeElement;
    const dropped = active === null || active === document.body || !active.isConnected || rootRef.current?.contains(active) === true;
    // Focus the reader moved elsewhere meanwhile stays where they put it.
    if (!dropped) return;
    if (changeRef.current) changeRef.current.focus();
    else props.onLeave?.();
  });

  const write = async (userIds: readonly string[], message: string) => {
    if (ordering === null || lock.current) return;
    lock.current = true;
    setBusy(true);
    const { groupId } = ordering;
    const prior = pinnedOrder(row);
    try {
      await useCollectionGoalStore.getState().setQueueOrder(groupId, goal.id, userIds);
      toast.withUndo(message, () => void restoreOrder(groupId, goal.id, prior));
      leaving.current = true;
      setEditing(false);
    } catch (err) {
      if (!wasToastedByApi(err)) toast.error(`Couldn't save the order: ${messageOf(err)}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const cancel = () => {
    leaving.current = true;
    setEditing(false);
  };

  if (goal.priorityMode === 'free_roll') return <p className={MUTED}>Free roll: no queue</p>;
  // An open editor stays open over an emptied queue, so its draft outlives the refresh (E-7).
  if (queue.length === 0 && !open) return <p className={MUTED}>Nobody needs it</p>;

  if (viewer) {
    // Column order, not the queue's: who is in the queue, never where (R-S3-15).
    const queued = new Set(queue.map((e) => e.cell));
    const names = (state: 'need' | 'want') =>
      row.cells.filter((cell) => queued.has(cell) && cell.state === state).map((cell) => cell.column.name);
    const parts = [
      { label: 'Need', names: names('need') },
      { label: 'Want', names: names('want') },
    ]
      .filter((part) => part.names.length > 0)
      .map((part) => `${part.label}: ${part.names.join(', ')}`);
    return <p className="text-sm text-text-primary">{parts.join(' · ')}</p>;
  }

  if (open) {
    return (
      <div ref={rootRef} className="flex flex-col items-start gap-1">
        <QueueOrderEditor queue={queue} tokenCost={goal.tokenCost} saving={busy} onSave={(ids) => void write(ids, 'Order saved')} onCancel={cancel} />
      </div>
    );
  }

  const manual = queueIsManual(queue);
  const changeShown = canOrder && queue.length >= 2;
  const backShown = canOrder && manual;
  const shown = showAll ? queue : queue.slice(0, TOP);
  return (
    <div ref={rootRef} className="flex flex-col items-start gap-1">
      {(manual || changeShown) && (
        <div className="flex flex-wrap items-center gap-2">
          {manual && <Tag variant="label">Manual order</Tag>}
          {changeShown && (
            <Button
              ref={changeRef}
              variant="ghost"
              size="sm"
              className={BUSY_CLASS}
              leftIcon={<ArrowUpDown size={14} aria-hidden="true" />}
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!lock.current) setEditing(true);
              }}
            >
              Change order
            </Button>
          )}
          {backShown && (
            <Button
              variant="ghost"
              size="sm"
              className={BUSY_CLASS}
              leftIcon={<RotateCcw size={14} aria-hidden="true" />}
              aria-disabled={busy || undefined}
              onClick={() => void write([], 'Back to automatic order')}
            >
              Back to automatic
            </Button>
          )}
        </div>
      )}
      <ol id={listId} className="flex flex-col gap-1 text-sm text-text-primary">
        {shown.map((entry) => (
          <li key={entry.cell.column.key} className="flex gap-2">
            <span className="w-6 shrink-0 text-text-muted">#{entry.rank}</span>
            {/* A real space: the flex gap spaces them on screen, the text keeps them apart (textContent, readers). */}
            {' '}
            <span>{`${entry.cell.column.name} · ${queueEntryText(entry, goal.tokenCost)}`}</span>
          </li>
        ))}
      </ol>
      {queue.length > TOP && (
        <Button variant="ghost" size="sm" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((isOpen) => !isOpen)}>
          {showAll ? 'Show fewer' : `Show all (${queue.length})`}
        </Button>
      )}
      {manual && <p className="text-xs text-text-muted">Set by a lead. Anyone added later goes after the set order in their status.</p>}
    </div>
  );
}
