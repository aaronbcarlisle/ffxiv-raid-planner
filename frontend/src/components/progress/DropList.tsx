/**
 * DropList — "Last drops" (S2a-3a·G3 Task TG5; design §3.4, D-15, R-S3-9, R-S3-12). The three
 * newest drops, one line each: "{Week n or a date} · {recipient} · ×{quantity}[ · {note}]". The
 * recipient (vet M-4): "Nobody" for no recipient, else the display name, else the character's,
 * else "Unknown member"; then "({character})" only when the character's name differs. A failed
 * load reads "Couldn't load drops" with Retry; the rest of the panel renders regardless. TG6
 * adds Show all and delete.
 */
import type { RewardDrop } from '../../stores/collectionGoalStore';
import { dropWeekLabel, type WeekClock } from '../../utils/dropWeek';
import { Button } from '../primitives';
import type { DropsStatus } from './useDrops';

const SHOWN = 3;
const MUTED = 'text-sm text-text-muted';

function recipientOf(drop: RewardDrop): string {
  if (drop.recipientUserId === null) return 'Nobody';
  const character = drop.recipientCharacterName ?? null;
  const name = drop.recipientDisplayName ?? character ?? 'Unknown member';
  return character !== null && character !== name ? `${name} (${character})` : name;
}

/** Newest first by when it dropped; the server's order breaks a tie. */
const byNewest = (a: RewardDrop, b: RewardDrop) => Date.parse(b.droppedAt) - Date.parse(a.droppedAt) || 0;

interface DropListProps {
  drops: readonly RewardDrop[];
  status: DropsStatus;
  onRetry: () => void;
  clock: WeekClock;
}

export function DropList({ drops, status, onRetry, clock }: DropListProps) {
  if (status === 'failed') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-text-primary">
        <span>Couldn&apos;t load drops</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (drops.length === 0) {
    return status === 'loading' ? (
      <p role="status" className={MUTED}>
        Loading drops…
      </p>
    ) : (
      <p className={MUTED}>No drops logged yet.</p>
    );
  }
  const newest = [...drops].sort(byNewest).slice(0, SHOWN);
  return (
    <ol className="flex flex-col gap-1 text-sm text-text-primary">
      {newest.map((drop) => (
        <li key={drop.id}>
          {[dropWeekLabel(drop.droppedAt, clock), recipientOf(drop), `×${drop.quantity}`, drop.notes]
            .filter((part) => part)
            .join(' · ')}
        </li>
      ))}
    </ol>
  );
}
