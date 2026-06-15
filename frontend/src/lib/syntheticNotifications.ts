import { RELEASES } from '../data/releaseNotes';
import type { AppNotification } from '../stores/notificationStore';

export const SEEN_RELEASES_KEY = 'seen-release-notes';

export function getSyntheticNotifications(): AppNotification[] {
  const seen = new Set(
    (localStorage.getItem(SEEN_RELEASES_KEY) ?? '').split(',').filter(Boolean)
  );
  return RELEASES
    .filter((r) => r.version !== 'Unreleased' && !r.internal)
    .slice(0, 5)
    .map((r) => ({
      id: `__release__${r.version}`,
      notification_type: 'web_update',
      title: `v${r.version}${r.title ? ` — ${r.title}` : ''}`,
      body: (r.highlights?.[0] ?? r.items[0]?.description ?? r.items[0]?.title ?? null) as string | null,
      href: '/docs/release-notes',
      is_read: seen.has(r.version),
      created_at: r.date,
    }));
}

export function getSyntheticUnreadCount(): number {
  return getSyntheticNotifications().filter((n) => !n.is_read).length;
}

export function markSyntheticRead(id: string): void {
  const version = id.replace('__release__', '');
  const seen = new Set(
    (localStorage.getItem(SEEN_RELEASES_KEY) ?? '').split(',').filter(Boolean)
  );
  seen.add(version);
  localStorage.setItem(SEEN_RELEASES_KEY, Array.from(seen).join(','));
}

export function markAllSyntheticRead(): void {
  const versions = RELEASES
    .filter((r) => r.version !== 'Unreleased' && !r.internal)
    .slice(0, 5)
    .map((r) => r.version);
  localStorage.setItem(SEEN_RELEASES_KEY, versions.join(','));
}
