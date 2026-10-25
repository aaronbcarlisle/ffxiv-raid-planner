/**
 * progressQueue — the farm queue (S2a-3a·G1 Task 1; design §3.1, R-S3-14, D-1,
 * D-19, D-20; S2a-3c·C2: a lead's pin, D-2, D-3, E-5, E-7). One pure order for a farm row that
 * the picker, "Next in line" and Copy plan all read, so they never disagree. Viewers never see
 * its order (D-20); that is the callers' rule, not this function's.
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
  /** A lead set this entry's place in its state (its row holds a `priorityRank`, D-2). */
  pinned: boolean;
}

type QueueState = QueueEntry['state'];

/** Known counts first, fewest first; an unknown or hidden count after them. */
function compareCounts(a: number | null, b: number | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a - b;
}

/** The cell's lead-set rank, or null when it has none. */
function pinOf(cell: ProgressCell): number | null {
  return cell.entry?.priorityRank ?? null;
}

/** Pinned before unpinned, pinned by rank; otherwise 0, so a stable sort keeps the order it had. */
function comparePins(a: ProgressCell, b: ProgressCell): number {
  const pa = pinOf(a);
  const pb = pinOf(b);
  if (pa === null || pb === null) return pa === pb ? 0 : pa === null ? 1 : -1;
  return pa - pb;
}

/**
 * The ordered queue for one farm row. Who: every column with a member
 * (`claimed`, and `notOnRoster` with either reason, R-S3-14) whose cell is Need or
 * Want; Have, Pass, blank and unclaimed cells are out. Order: Need before Want;
 * within each state the fewest count first, a hidden or unknown count after the
 * known ones, ties and a drop-only farm (`tokenCost === null`) in column order; then a
 * lead's pin reorders that list: pinned entries first by rank (a tie keeps the automatic
 * order), the rest after in the automatic order (D-2, D-3). Mode: `free_roll` queues
 * nobody, `desired_only` keeps Need only, anything else (including null) takes the full rule.
 */
export function queueFor(row: FarmRow, mode: CollectionPriorityMode | null): QueueEntry[] {
  if (mode === 'free_roll') return [];
  const states: QueueState[] = mode === 'desired_only' ? ['need'] : ['need', 'want'];
  const dropOnly = row.goal.tokenCost === null;

  return states
    .flatMap((state) => {
      const members = row.cells.filter((cell) => cell.column.userId !== null && cell.state === state);
      // Array#sort is stable, so equal keys keep column order.
      const automatic = dropOnly ? members : [...members].sort((a, b) => compareCounts(a.count, b.count));
      return [...automatic].sort(comparePins);
    })
    .map((cell, index): QueueEntry => ({
      cell,
      rank: index + 1,
      state: cell.state as QueueState,
      count: cell.count,
      countHidden: cell.countHidden,
      pinned: pinOf(cell) !== null,
    }));
}

/** A lead has pinned someone in this queue: it is a manual order, not the automatic one. */
export function queueIsManual(queue: readonly QueueEntry[]): boolean {
  return queue.some((e) => e.pinned);
}

/**
 * The user ids holding a rank on this row, by rank, ties in column order. Every member cell
 * with a rank counts, Have and Pass included, so an Undo restores them too (R-C-4).
 */
export function pinnedOrder(row: FarmRow): string[] {
  return row.cells
    .filter((cell) => cell.column.userId !== null && pinOf(cell) !== null)
    .sort((a, b) => (pinOf(a) as number) - (pinOf(b) as number))
    .map((cell) => cell.column.userId as string);
}

/**
 * The queue as a draft order puts it (E-7): per state, in the queue's state order, the
 * draft's ids that are still queued in that state in draft order, then that state's ids the
 * draft lacks in queue order. A draft id no longer queued drops; a member who switched state
 * moves to the new state's group.
 */
export function orderedDraft(draft: readonly string[], queue: readonly QueueEntry[]): QueueEntry[] {
  const byId = new Map(queue.map((e) => [e.cell.column.userId, e]));
  const drafted = new Set(draft);
  const states = [...new Set(queue.map((e) => e.state))];
  return states.flatMap((state) => [
    ...draft.flatMap((id) => {
      const entry = byId.get(id);
      return entry && entry.state === state ? [entry] : [];
    }),
    ...queue.filter((e) => e.state === state && !drafted.has(e.cell.column.userId as string)),
  ]);
}

/**
 * The ids of `order` with `userId` swapped with its neighbour one place up (-1) or down (1).
 * Unchanged at either end of the list, across the Need/Want boundary, or for an id not in it.
 */
export function moveWithinState(order: readonly QueueEntry[], userId: string, delta: -1 | 1): string[] {
  const ids = order.map((e) => e.cell.column.userId as string);
  const from = ids.indexOf(userId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length || order[from].state !== order[to].state) return ids;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** "Need 12/99", "Want 80/99"; the state alone when the count is hidden or unknown; "Need 12" with no cost. */
export function queueEntryText(e: Omit<QueueEntry, 'pinned'>, tokenCost: number | null): string {
  const label = e.state === 'need' ? 'Need' : 'Want';
  if (e.count === null) return label;
  return tokenCost !== null ? `${label} ${e.count}/${tokenCost}` : `${label} ${e.count}`;
}
