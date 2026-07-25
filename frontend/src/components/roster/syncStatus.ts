/**
 * Character sync status helpers.
 *
 * Moved out of the deleted split-clear tree (`utils/splitClearScoringService.ts`)
 * since `CharacterSyncBadge` (a surviving v2 roster component) is the only
 * consumer left — the split-clear-specific scoring functions in that file
 * died with the rest of the split-clear capability.
 */

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isSyncStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > STALE_MS;
}

export function formatSyncLabel(lastSyncedAt: string | null, syncSource: string | null): string {
  if (!lastSyncedAt) return 'No sync';
  const diffMs = Date.now() - new Date(lastSyncedAt).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const prefix = syncSource === 'plugin' ? 'Plugin' : 'Synced';
  if (diffHours < 1) return `${prefix} recently`;
  if (diffHours < 24) return `${prefix} ${diffHours}h ago`;
  return `${prefix} ${diffDays}d ago`;
}
