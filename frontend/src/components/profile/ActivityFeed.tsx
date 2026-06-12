/**
 * ActivityFeed — V1 derived activity feed for the Player Hub.
 *
 * Derives activity items from existing stores (join requests, schedule).
 * No separate notification DB table — this is a read-only derived view
 * of activity already available in other stores.
 *
 * Roadmap: replace with a real notification store when persistent
 * notification history becomes a requirement.
 */

import { useMemo } from 'react';
import { Bell, Calendar, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import type { GearSnapshot } from '../../stores/playerProfileStore';
import { hasUsableGearSnapshot } from './jobGearUtils';

// --- Types ---

export type ActivityItemType =
  | 'application_submitted'
  | 'application_accepted'
  | 'application_declined'
  | 'application_review'
  | 'schedule_upcoming'
  | 'gear_sync';

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  title: string;
  subtitle?: string;
  createdAt: string;
  href?: string;
}

// --- Hook ---

// eslint-disable-next-line react-refresh/only-export-components
export function useActivityFeed(
  gearSnapshots: Record<string, GearSnapshot[]>,
  maxItems = 5,
): ActivityItem[] {
  const myRequests = useJoinRequestStore((s) => s.myRequests);
  const sessions = useScheduleStore((s) => s.sessions);

  return useMemo(() => {
    const items: ActivityItem[] = [];

    // My application statuses
    for (const req of myRequests) {
      const staticName = req.staticGroupName ?? 'a static';
      if (req.status === 'accepted') {
        items.push({
          id: `req-${req.id}`,
          type: 'application_accepted',
          title: 'Application accepted',
          subtitle: `You were accepted into ${staticName}`,
          createdAt: req.updatedAt,
        });
      } else if (req.status === 'declined') {
        items.push({
          id: `req-${req.id}`,
          type: 'application_declined',
          title: 'Application declined',
          subtitle: staticName,
          createdAt: req.updatedAt,
        });
      } else if (req.status === 'under_review') {
        items.push({
          id: `req-${req.id}`,
          type: 'application_review',
          title: 'Application under review',
          subtitle: staticName,
          createdAt: req.updatedAt,
        });
      } else if (req.status === 'pending') {
        items.push({
          id: `req-${req.id}`,
          type: 'application_submitted',
          title: 'Application sent',
          subtitle: staticName,
          createdAt: req.createdAt,
        });
      }
    }

    // Next upcoming raid session (just the nearest one)
    const now = new Date().toISOString();
    const upcoming = sessions
      .filter((s) => s.startTime >= now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

    if (upcoming) {
      const date = new Date(upcoming.startTime).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const time = new Date(upcoming.startTime).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      items.push({
        id: `session-${upcoming.id}`,
        type: 'schedule_upcoming',
        title: upcoming.title ?? 'Raid session',
        subtitle: `${date} at ${time}`,
        createdAt: upcoming.startTime,
      });
    }

    // Most recent gear sync (only if within 7 days)
    // eslint-disable-next-line react-hooks/purity
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    let latestSync: GearSnapshot | null = null;
    for (const snaps of Object.values(gearSnapshots)) {
      for (const snap of snaps) {
        if (!hasUsableGearSnapshot(snap)) continue;
        if (!snap.syncedAt || snap.syncedAt < cutoff) continue;
        if (!latestSync || snap.syncedAt > latestSync.syncedAt!) {
          latestSync = snap;
        }
      }
    }
    if (latestSync) {
      items.push({
        id: `sync-${latestSync.id}`,
        type: 'gear_sync',
        title: 'Gear synced',
        subtitle: `${latestSync.job} · iLv ${latestSync.avgItemLevel}`,
        createdAt: latestSync.syncedAt!,
      });
    }

    // Sort newest-first, then cap
    return items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, maxItems);
  }, [myRequests, sessions, gearSnapshots, maxItems]);
}

// --- Icon per type ---

function ActivityIcon({ type }: { type: ActivityItemType }) {
  switch (type) {
    case 'application_accepted':
      return <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />;
    case 'application_declined':
      return <XCircle className="h-3.5 w-3.5 text-status-error" />;
    case 'application_review':
      return <Clock className="h-3.5 w-3.5 text-status-warning" />;
    case 'application_submitted':
      return <Bell className="h-3.5 w-3.5 text-accent" />;
    case 'schedule_upcoming':
      return <Calendar className="h-3.5 w-3.5 text-accent" />;
    case 'gear_sync':
      return <RefreshCw className="h-3.5 w-3.5 text-text-tertiary" />;
  }
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  const days = Math.floor(delta / 86_400_000);
  return `${days}d ago`;
}

// --- Row ---

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="mt-0.5 flex-shrink-0 rounded-md border border-border-subtle bg-surface-elevated p-1">
        <ActivityIcon type={item.type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary leading-tight">{item.title}</p>
        {item.subtitle && (
          <p className="truncate text-xs text-text-tertiary mt-0.5">{item.subtitle}</p>
        )}
      </div>
      <span className="flex-shrink-0 text-[11px] text-text-muted mt-0.5 tabular-nums">
        {relativeTime(item.createdAt)}
      </span>
    </div>
  );
}

// --- Card component ---

interface ActivityFeedCardProps {
  items: ActivityItem[];
  className?: string;
}

export function ActivityFeedCard({ items, className = '' }: ActivityFeedCardProps) {
  return (
    <div
      className={`rounded-lg border border-border-default bg-surface-raised p-3 ${className}`}
      data-testid="activity-feed-card"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Bell className="h-3.5 w-3.5 text-accent flex-shrink-0" />
        <h3 className="font-display text-sm font-semibold text-text-primary">Activity</h3>
      </div>

      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-text-tertiary" data-testid="activity-feed-empty">
          No recent activity
        </p>
      ) : (
        <div className="divide-y divide-border-subtle" data-testid="activity-feed-list">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
