import { isSyncStale, formatSyncLabel } from '../../utils/splitClearScoringService';

interface CharacterSyncBadgeProps {
  lastSyncedAt: string | null | undefined;
}

export function CharacterSyncBadge({ lastSyncedAt }: CharacterSyncBadgeProps) {
  if (!lastSyncedAt) return null;
  const stale = isSyncStale(lastSyncedAt);
  const label = formatSyncLabel(lastSyncedAt, null);
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        stale ? 'text-status-warning bg-status-warning/10' : 'text-status-success bg-status-success/10'
      }`}
      title={stale ? 'Sync data may be stale' : 'Recently synced'}
    >
      {label}
    </span>
  );
}
