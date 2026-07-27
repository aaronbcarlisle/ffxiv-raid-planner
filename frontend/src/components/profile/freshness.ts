const HOUR = 3600_000;
const DAY = 86400_000;

export type FreshnessLevel = 'fresh' | 'recent' | 'stale' | 'old' | 'none';

export function getFreshness(syncedAt: string | null): FreshnessLevel {
  if (!syncedAt) return 'none';
  const age = Date.now() - new Date(syncedAt).getTime();
  if (age < DAY) return 'fresh';
  if (age < 7 * DAY) return 'recent';
  if (age < 30 * DAY) return 'stale';
  return 'old';
}

export function formatSyncAge(syncedAt: string | null): string {
  if (!syncedAt) return 'Never synced';
  const age = Date.now() - new Date(syncedAt).getTime();
  if (age < HOUR) return 'Synced just now';
  if (age < DAY) return `Synced ${Math.floor(age / HOUR)}h ago`;
  const days = Math.floor(age / DAY);
  if (days === 1) return 'Synced yesterday';
  if (days < 7) return `Synced ${days} days ago`;
  if (days < 30) return `Synced ${Math.floor(days / 7)} weeks ago`;
  return `Synced ${Math.floor(days / 30)} months ago`;
}

export function freshnessColor(level: FreshnessLevel): string {
  switch (level) {
    case 'fresh': return 'text-status-success';
    case 'recent': return 'text-text-secondary';
    case 'stale': return 'text-status-warning';
    case 'old': return 'text-status-error';
    case 'none': return 'text-text-tertiary';
  }
}

const SOURCE_LABELS: Record<string, string> = {
  plugin: 'Plugin sync',
  roster_sync: 'Updated from static roster',
  tomestone: 'Lodestone sync',
  xivapi: 'Lodestone sync',
  lodestone: 'Lodestone sync',
  manual: 'Manual entry',
  unknown: 'Unknown source',
  // C5 roster-card provenances (PR #193 review rounds 4 + 6): the card's sync
  // detail renders these — raw storage identifiers must not reach copy.
  // Enumerated from the backend rather than guessed: `sync_source` is
  // `f"{source_prefix}{raw_source}"` (gear_sync.py:128), the scheduled task
  // passes `source_prefix="auto_"` (auto_sync.py:127), and `raw_source` is one
  // of the Lodestone router's `__source` values (lodestone.py:793, :1010,
  // :1025) or the "xivapi" default — so every provider needs both forms.
  player_hub: 'Player Hub sync',
  tomestone_identity: 'Lodestone identity sync',
  dev_mock: 'Mock sync (dev)',
  auto_tomestone: 'Scheduled Lodestone sync',
  auto_xivapi: 'Scheduled Lodestone sync',
  auto_tomestone_identity: 'Scheduled Lodestone identity sync',
  auto_dev_mock: 'Scheduled mock sync (dev)',
};

export function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
