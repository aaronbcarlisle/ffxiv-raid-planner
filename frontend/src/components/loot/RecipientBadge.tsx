/* eslint-disable react-refresh/only-export-components -- resolveRecipient/RecipientLike/ResolvedRecipient are exported alongside the component so LogWeekGrid's GridCell and LogCellEntriesMenu share one resolution helper instead of duplicating it (D6 Task 2). */
/**
 * RecipientBadge — role-tinted recipient badge + resolution helper, extracted
 * from `LogWeekGrid.tsx:109-142` (D6 Task 2, director F-8: a
 * signature-preserving move — bodies untouched). Shared by `LogWeekGrid`'s
 * `GridCell` and `LogCellEntriesMenu`'s per-entry rows so both consume the
 * same `playerMap` lookup structure; no O(n) scans are introduced by having
 * two call sites.
 */
import { getValidRole } from '../../gamedata';
import { JobIcon } from '../ui/JobIcon';
import type { SnapshotPlayer } from '../../types';

export interface RecipientLike {
  recipientPlayerId: string;
  recipientPlayerName: string;
}

export interface ResolvedRecipient {
  name: string;
  color: string;
  job?: string;
}

/** Role-colored token — same formula as `NeedMatrix.tsx:46`. */
const roleVar = (player: SnapshotPlayer) => `var(--color-role-${getValidRole(player.role)}, var(--color-text-muted))`;

/** Unknown `recipientPlayerId` (player left the roster) falls back to the entry's own recorded name. */
export function resolveRecipient(entry: RecipientLike, playerMap: Map<string, SnapshotPlayer>): ResolvedRecipient {
  const player = playerMap.get(entry.recipientPlayerId);
  if (!player) return { name: entry.recipientPlayerName, color: 'var(--color-text-secondary)' };
  return { name: player.name, color: roleVar(player), job: player.job };
}

/** The `WeeklyLootGrid.tsx:392-400` badge treatment re-expressed with `roleVar`. */
export function RecipientBadge({ color, name, job }: { color: string; name: string; job?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {job && <JobIcon job={job} size="xs" />}
      {name}
    </span>
  );
}
