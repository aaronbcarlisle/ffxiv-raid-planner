/**
 * QueueList — "Next in line" (S2a-3a·G2b Task TG4; design §3.1, D-13, D-20, R-S3-14, R-S3-15).
 * Leads and members read the ranked queue, the top four with "Show all (n)" expanding in place
 * when more are queued. A viewer never sees the order (D-20): one unranked line, "Need: A, B ·
 * Want: C", names in column order, no ranks, no counts and no Show all. `free_roll` queues
 * nobody, for every role.
 */
import { useId, useState } from 'react';
import type { FarmRow } from '../../utils/progressModel';
import { queueEntryText, queueFor } from '../../utils/progressQueue';
import { Button } from '../primitives';

const TOP = 4;

export interface QueueListProps {
  row: FarmRow;
  /** `userRole === 'viewer'`: the unranked line, no counts. */
  viewer: boolean;
}

const MUTED = 'text-sm text-text-muted';

export function QueueList({ row, viewer }: QueueListProps) {
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const { goal } = row;
  const queue = queueFor(row, goal.priorityMode);

  if (goal.priorityMode === 'free_roll') return <p className={MUTED}>Free roll: no queue</p>;
  if (queue.length === 0) return <p className={MUTED}>Nobody needs it</p>;

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

  const shown = showAll ? queue : queue.slice(0, TOP);
  return (
    <div className="flex flex-col items-start gap-1">
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
        <Button variant="ghost" size="sm" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((open) => !open)}>
          {showAll ? 'Show fewer' : `Show all (${queue.length})`}
        </Button>
      )}
    </div>
  );
}
