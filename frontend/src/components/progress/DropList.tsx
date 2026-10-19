/**
 * DropList — "Last drops" (S2a-3a·G3 Task TG5, G4 Task TG6; design §3.4, D-13, D-14, D-15,
 * R-S3-9, R-S3-12). The three newest drops, one line each: "{Week n or a date} · {recipient} ·
 * ×{quantity}[ · {note}]", and "Show all ({n})" below them when more were fetched, which expands
 * in place to every one (the server sends at most 50). The recipient (vet M-4): "Nobody" for no
 * recipient, else the display name, else the character's, else "Unknown member"; then
 * "({character})" only when the character's name differs. A failed load reads "Couldn't load
 * drops" with Retry; the rest of the panel renders regardless.
 *
 * Delete (D-14): a trash `IconButton` on each drop the reader may delete (`canDelete`: the
 * panel's call), opening V1's confirm exactly (`DropHistoryPanel`): "Delete Drop", danger, and
 * the recipient's prior state when the server reports one. A confirmed delete runs `deleteDrop`
 * then the read-model refresh; a failure toasts and keeps the confirm open. Once the drop's row
 * is gone, focus goes to the delete button now at its place (else the last), else to `onLeave`.
 */
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type RewardDrop } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { dropWeekLabel, type WeekClock } from '../../utils/dropWeek';
import { Button, IconButton } from '../primitives';
import { ConfirmModal } from '../ui/ConfirmModal';
import { messageOf } from './undoToasts';
import type { DropsStatus } from './useDrops';

const SHOWN = 3;
const MUTED = 'text-sm text-text-muted';
const PRIOR_STATE_LABELS: Record<string, string> = { need: 'Need', want: 'Want' };

function recipientOf(drop: RewardDrop): string {
  if (drop.recipientUserId === null) return 'Nobody';
  const character = drop.recipientCharacterName ?? null;
  const name = drop.recipientDisplayName ?? character ?? 'Unknown member';
  return character !== null && character !== name ? `${name} (${character})` : name;
}

/** "2 Oct 2026" (en-GB, as `dropWeekLabel`'s dates): what tells two drops of one recipient apart in a delete button's name. */
const dateOf = (drop: RewardDrop) =>
  new Date(drop.droppedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Newest first by when it dropped; the server's order breaks a tie. */
const byNewest = (a: RewardDrop, b: RewardDrop) => Date.parse(b.droppedAt) - Date.parse(a.droppedAt) || 0;

interface DropListProps {
  drops: readonly RewardDrop[];
  status: DropsStatus;
  onRetry: () => void;
  clock: WeekClock;
  groupId: string;
  goalId: string;
  /** Whether the reader may delete this drop (the API validates it again). */
  canDelete: (drop: RewardDrop) => boolean;
  /** Moves focus on when a delete leaves no delete button to take it. Keep it stable (`useCallback`). */
  onLeave: () => void;
}

export function DropList({ drops, status, onRetry, clock, groupId, goalId, canDelete, onLeave }: DropListProps) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<RewardDrop | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // Where the deleted row stood, until focus has moved on (after the confirm has closed).
  const focusIndex = useRef<number | null>(null);

  // Runs after the confirm's own focus restore (a child effect), which finds its trigger gone.
  useEffect(() => {
    if (focusIndex.current === null || pending !== null) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-drop-delete]') ?? [];
    const target = buttons[Math.min(focusIndex.current, buttons.length - 1)];
    focusIndex.current = null;
    if (target) target.focus();
    else onLeave();
  });

  const sorted = [...drops].sort(byNewest);
  const shown = expanded ? sorted : sorted.slice(0, SHOWN);

  async function confirmDelete() {
    if (pending === null) return;
    const drop = pending;
    const index = shown.filter(canDelete).findIndex((d) => d.id === drop.id);
    try {
      await useCollectionGoalStore.getState().deleteDrop(groupId, goalId, drop.id);
    } catch (err) {
      if (!wasToastedByApi(err)) toast.error(`Couldn't delete the drop: ${messageOf(err)}`);
      return;
    }
    toast.success('Drop deleted.');
    await useCollectionGoalStore.getState().refreshGoalProgress(groupId, goalId);
    focusIndex.current = Math.max(index, 0);
    setPending(null);
  }

  const priorLabel = pending?.recipientPriorState ? PRIOR_STATE_LABELS[pending.recipientPriorState] ?? null : null;
  const confirmMessage =
    pending && priorLabel
      ? `Delete this drop? ${pending.recipientDisplayName ?? 'The recipient'} goes back to ${priorLabel} if it was their only drop.`
      : 'Delete this drop?';

  let content;
  if (status === 'failed') {
    content = (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-text-primary">
        <span>Couldn&apos;t load drops</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  } else if (drops.length === 0) {
    content =
      status === 'loading' ? (
        <p role="status" className={MUTED}>
          Loading drops…
        </p>
      ) : (
        <p className={MUTED}>No drops logged yet.</p>
      );
  } else {
    content = (
      <div className="flex flex-col items-start gap-2">
        <ol ref={listRef} className="flex w-full flex-col gap-1 text-sm text-text-primary">
          {shown.map((drop) => (
            <li key={drop.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                {[dropWeekLabel(drop.droppedAt, clock), recipientOf(drop), `×${drop.quantity}`, drop.notes]
                  .filter((part) => part)
                  .join(' · ')}
              </span>
              {canDelete(drop) && (
                <IconButton
                  data-drop-delete=""
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  aria-label={`Delete drop for ${recipientOf(drop)}, ${dateOf(drop)}`}
                  variant="danger"
                  size="sm"
                  onClick={() => setPending(drop)}
                />
              )}
            </li>
          ))}
        </ol>
        {drops.length > SHOWN && (
          <Button variant="secondary" size="sm" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
            {expanded ? 'Show fewer' : `Show all (${drops.length})`}
          </Button>
        )}
      </div>
    );
  }

  // The confirm renders in every branch, so a delete that empties the list never unmounts it mid-flight.
  return (
    <>
      {content}
      <ConfirmModal
        isOpen={pending !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirmDelete}
        title="Delete Drop"
        message={confirmMessage}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
