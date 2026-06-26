import { useSyncExternalStore } from 'react';
import { RELEASES } from '../data/releaseNotes';
import type { AppNotification } from '../stores/notificationStore';

export const SEEN_RELEASES_KEY = 'seen-release-notes';

// ── Reactivity ──────────────────────────────────────────────────────────────
// Synthetic (release-note) read state lives in localStorage, which React can't
// observe. Components that show the unread count subscribe here so the badge
// updates the moment something is marked read — without this, marking the only
// unread item (a release note) read wouldn't re-render the header badge, since
// the server-backed unreadCount never changes.
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSyntheticNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySyntheticChange(): void {
  listeners.forEach((l) => l());
}

export function getSyntheticNotifications(): AppNotification[] {
  const seen = new Set(
    (localStorage.getItem(SEEN_RELEASES_KEY) ?? '').split(',').filter(Boolean)
  );
  return RELEASES
    .filter((r) => r.version !== 'Unreleased' && !r.internal)
    .filter((r, i, arr) => arr.findIndex((x) => x.version === r.version) === i)
    .slice(0, 5)
    .map((r) => ({
      id: `__release__${r.version}`,
      notification_type: 'web_update',
      title: `v${r.version}${r.title ? ` — ${r.title}` : ''}`,
      body: (r.highlights?.[0] ?? r.items[0]?.description ?? r.items[0]?.title ?? null) as string | null,
      href: '/docs/release-notes',
      group_id: null,
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
  notifySyntheticChange();
}

export function markAllSyntheticRead(): void {
  // Derive versions from the same source the panel renders, so the set of
  // versions marked read exactly matches what's shown (dedup + slice applied).
  // Merge with any already-seen versions so we never clobber prior reads.
  const shown = getSyntheticNotifications().map((n) => n.id.replace('__release__', ''));
  const seen = new Set(
    (localStorage.getItem(SEEN_RELEASES_KEY) ?? '').split(',').filter(Boolean)
  );
  shown.forEach((v) => seen.add(v));
  localStorage.setItem(SEEN_RELEASES_KEY, Array.from(seen).join(','));
  notifySyntheticChange();
}

/**
 * React hook returning the live synthetic unread count. Re-renders whenever a
 * release note is marked read (via the subscription above), so badges stay in
 * sync even when the server-backed unread count doesn't change.
 */
export function useSyntheticUnreadCount(): number {
  return useSyncExternalStore(subscribeSyntheticNotifications, getSyntheticUnreadCount);
}
