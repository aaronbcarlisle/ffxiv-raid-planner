/**
 * discordPlan — the "Copy plan" text for a farm (S2a-3a·G1 Task 2, R-S2-2 / R-S3-2).
 * V1's builder moved here unchanged in its lines, emoji and labels; the sort left
 * the function. Callers pass the entries already in the order they want listed:
 * V1 (`CollectionsHub`) sorts Need by `priorityRank ?? 999` and keeps every other
 * state in input order, V2 (`planEntriesFor`) lists the queue's order.
 */
import type { CollectionGoal, CollectionPriorityMode, ParticipantState } from '../stores/collectionGoalStore';
import { PRIORITY_MODE_OPTIONS } from './goalTypeMeta';
import type { FarmRow } from './progressModel';
import { queueFor } from './progressQueue';

export interface DiscordPlanEntry {
  name: string;
  state: ParticipantState;
  /** The count the reader may see; null when hidden or unknown (never "Can buy now"). */
  count: number | null;
}

/** Derived from the Edit block's options, so a mode has one name everywhere (TG8 carry). */
const MODE_LABELS: Record<string, string> = Object.fromEntries(
  PRIORITY_MODE_OPTIONS.flatMap((option) => (option.value === null ? [] : [[option.value, option.label]])),
);

/**
 * The plan text. The 🎯, ⭐ and ✅ lines filter `ordered` by state, keeping its order;
 * "💰 Can buy now" filters `canBuyFrom` (default `ordered`), in its order, to a
 * non-Have entry whose known count reaches the token cost.
 */
export function buildDiscordPlan(
  goal: CollectionGoal,
  ordered: readonly DiscordPlanEntry[],
  canBuyFrom: readonly DiscordPlanEntry[] = ordered,
): string {
  const needing = ordered.filter((p) => p.state === 'need');
  const wanting = ordered.filter((p) => p.state === 'want');
  const having = ordered.filter((p) => p.state === 'have');

  const cost = goal.tokenCost;
  const canBuyPeople =
    cost != null ? canBuyFrom.filter((p) => p.state !== 'have' && p.count !== null && p.count >= cost) : [];

  const names = (list: readonly DiscordPlanEntry[]) => list.map((p) => p.name).join(', ');

  const lines: string[] = [`**${goal.title}** farm plan`];
  if (goal.priorityMode) {
    lines.push(`Mode: ${MODE_LABELS[goal.priorityMode] ?? goal.priorityMode}`);
  }
  if (goal.tokenCost && goal.tokenName) {
    lines.push(`Exchange: ${goal.tokenCost}× ${goal.tokenName}`);
  }
  lines.push('');
  if (needing.length) lines.push(`🎯 **Need (${needing.length}):** ${names(needing)}`);
  if (wanting.length) lines.push(`⭐ **Want (${wanting.length}):** ${names(wanting)}`);
  if (canBuyPeople.length) lines.push(`💰 **Can buy now:** ${names(canBuyPeople)}`);
  if (having.length) lines.push(`✅ **Have (${having.length}):** ${names(having)}`);
  if (goal.note) lines.push(`\n📝 ${goal.note}`);
  return lines.join('\n');
}

/**
 * V2's entries for one Progress row (R-S3-2). `ordered`: the queue's Need and Want
 * in queue order, then Have in column order (every column with a member, R-S3-14); a
 * Need or Want the queue leaves out (all of them under `free_roll`, the Wants under
 * `desired_only`) is omitted, so the paste matches the expansion. `canBuyFrom`: the
 * queue in order, then every other non-blank member cell in column order, so a player
 * who can buy is listed whatever the mode. A hidden or unknown count is `null`.
 */
export function planEntriesFor(
  row: FarmRow,
  mode: CollectionPriorityMode | null,
): { ordered: DiscordPlanEntry[]; canBuyFrom: DiscordPlanEntry[] } {
  const queue = queueFor(row, mode);
  const queued = new Set(queue.map((e) => e.cell));
  const toEntry = (cell: FarmRow['cells'][number], state: ParticipantState): DiscordPlanEntry => ({
    name: cell.column.name,
    state,
    count: cell.countHidden ? null : cell.count,
  });

  const queueEntries = queue.map((e) => ({ name: e.cell.column.name, state: e.state, count: e.count }));
  const members = row.cells.filter((cell) => cell.column.userId !== null && cell.state !== null);
  const have = members.filter((cell) => cell.state === 'have').map((cell) => toEntry(cell, 'have'));
  const rest = members.filter((cell) => !queued.has(cell)).map((cell) => toEntry(cell, cell.state as ParticipantState));

  return { ordered: [...queueEntries, ...have], canBuyFrom: [...queueEntries, ...rest] };
}
