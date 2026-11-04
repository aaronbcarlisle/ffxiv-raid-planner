/**
 * trackCardModel — what Home's farm card says (S2a-4b·B1 Task TB1; R-F-9, D-11, S-9). The card names
 * the farm Progress lists first and the open row's #1, so it reads both from the same functions:
 * `splitFarmRows` and `queueFor`, over the columns from `progressInputs`. Pure.
 */
import type { LucideIcon } from 'lucide-react';
import type { ParticipantState } from '../stores/collectionGoalStore';
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from './goalTypeMeta';
import { splitFarmRows, type ProgressColumn, type ProgressData, type ProgressReader } from './progressModel';
import { queueFor } from './progressQueue';

export interface TrackCardModel {
  goalId: string;
  title: string;
  typeLabel: string;
  typeIcon: LucideIcon;
  /** "{n} of {m} have it": the row's own tally, so Pass and unclaimed columns count in neither. */
  tally: { n: number; m: number };
  /** One per column `m` counts, in column order. A blank cell reads `none`. */
  pips: { name: string; role: string; state: Exclude<ParticipantState, 'pass'> | 'none' }[];
  /** The queue's #1. Null for a viewer, or when nobody is queued. */
  next: { name: string; count: number | null; needed: number | null } | null;
}

interface TrackCardInput {
  data: ProgressData;
  columns: readonly ProgressColumn[];
  reader: ProgressReader;
  /** Viewers never see a queue's order (D-20): the card's rule, as it is `QueueList`'s (E-9). */
  readerIsViewer: boolean;
}

/** The first active farm, as Progress lists it, or null when the static has none. */
export function trackCardFor({ data, columns, reader, readerIsViewer }: TrackCardInput): TrackCardModel | null {
  const row = splitFarmRows(data, columns, reader).active.at(0);
  if (!row) return null;
  const { goal, cells, tally } = row;

  const pips = cells.flatMap((cell): TrackCardModel['pips'] => {
    const { column, state } = cell;
    if (column.kind !== 'claimed' || state === 'pass') return [];
    return [{ name: column.name, role: column.player.role, state: state ?? 'none' }];
  });
  const top = readerIsViewer ? undefined : queueFor(row, goal.priorityMode).at(0);

  return {
    goalId: goal.id,
    title: goal.title,
    typeLabel: GOAL_TYPE_LABELS[goal.goalType],
    typeIcon: GOAL_TYPE_ICONS[goal.goalType],
    tally: { n: tally.n, m: tally.m },
    pips,
    next: top ? { name: top.cell.column.name, count: top.count, needed: goal.tokenCost } : null,
  };
}

/** "Aya is next (62/99)", "(62)" with no token cost, and no bracket when the count is hidden. */
export function nextText({ name, count, needed }: NonNullable<TrackCardModel['next']>): string {
  if (count === null) return `${name} is next`;
  return `${name} is next (${needed !== null ? `${count}/${needed}` : count})`;
}
