/**
 * progressQueue — the farm queue (S2a-3a·G1 Task 1; design §3.1, R-S3-14, D-1,
 * D-19, D-20). One pure order for a farm row that the picker, "Next in line" and
 * Copy plan all read, so they never disagree. Viewers never see its order (D-20);
 * that is the callers' rule, not this function's.
 */
import type { CollectionPriorityMode } from '../stores/collectionGoalStore';
import type { FarmRow, ProgressCell } from './progressModel';

export interface QueueEntry {
  /** The matrix cell; its column is `claimed` or `notOnRoster` (R-S3-14). */
  cell: ProgressCell;
  /** 1-based, contiguous. */
  rank: number;
  state: 'need' | 'want';
  /** The count this reader may see; null when hidden or unknown. */
  count: number | null;
  countHidden: boolean;
}

type QueueState = QueueEntry['state'];

/** Known counts first, fewest first; an unknown or hidden count after them. */
function compareCounts(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a - b;
}

/**
 * The ordered queue for one farm row. Who: every column with a member
 * (`claimed`, and `notOnRoster` with either reason, R-S3-14) whose cell is Need or
 * Want; Have, Pass, blank and unclaimed cells are out. Order: Need before Want;
 * within each state the fewest count first, a hidden or unknown count after the
 * known ones, ties and a drop-only farm (`tokenCost === null`) in column order.
 * Mode: `free_roll` queues nobody, `desired_only` keeps Need only, anything else
 * (including null) takes the full rule. `priority_rank` is ignored (D-1).
 */
export function queueFor(row: FarmRow, mode: CollectionPriorityMode | null): QueueEntry[] {
  if (mode === 'free_roll') return [];
  const states: QueueState[] = mode === 'desired_only' ? ['need'] : ['need', 'want'];
  const dropOnly = row.goal.tokenCost === null;

  return states
    .flatMap((state) => {
      const members = row.cells.filter((cell) => cell.column.userId !== null && cell.state === state);
      // Array#sort is stable, so equal keys keep column order.
      return dropOnly ? members : [...members].sort((a, b) => compareCounts(a.count, b.count));
    })
    .map((cell, index): QueueEntry => ({
      cell,
      rank: index + 1,
      state: cell.state as QueueState,
      count: cell.count,
      countHidden: cell.countHidden,
    }));
}

/** "Need 12/99", "Want 80/99"; the state alone when the count is hidden or unknown; "Need 12" with no cost. */
export function queueEntryText(e: QueueEntry, tokenCost: number | null): string {
  const label = e.state === 'need' ? 'Need' : 'Want';
  if (e.count === null) return label;
  return tokenCost !== null ? `${label} ${e.count}/${tokenCost}` : `${label} ${e.count}`;
}
