/* eslint-disable design-system/no-raw-button */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Mail,
  ThumbsUp,
  Target,
  Calendar,
  AlertTriangle,
  CheckCheck,
  Check,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives';
import { useNotificationStore } from '../../stores/notificationStore';
import type { AppNotification } from '../../stores/notificationStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import {
  getSyntheticNotifications,
  markSyntheticRead,
  markAllSyntheticRead,
} from '../../lib/syntheticNotifications';

type Filter = 'all' | 'unread' | 'static' | 'system';

// ─── Type icon map ────────────────────────────────────────────────────────────

function typeIcon(notificationType: string): React.ReactNode {
  switch (notificationType) {
    case 'new_application':
    case 'join_request':
      return <Mail className="w-3.5 h-3.5" />;
    case 'suggestion_vote':
      return <ThumbsUp className="w-3.5 h-3.5" />;
    case 'objective_promoted':
      return <Target className="w-3.5 h-3.5" />;
    case 'schedule_update':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'webhook_failure':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'web_update':
      return <Sparkles className="w-3.5 h-3.5" />;
    default:
      return <Bell className="w-3.5 h-3.5" />;
  }
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 1) return 'just now';
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { notifications, unreadCount, loading, error, markRead, markAllRead, fetchNotifications } =
    useNotificationStore();
  const { currentGroup } = useStaticGroupStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const [syntheticNotifications, setSyntheticNotifications] = useState<AppNotification[]>(
    () => getSyntheticNotifications()
  );
  const refreshSynthetic = useCallback(() => {
    setSyntheticNotifications(getSyntheticNotifications());
  }, []);

  // Re-fetch server notifications whenever the panel opens
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const syntheticUnreadCount = syntheticNotifications.filter((n) => !n.is_read).length;
  const totalUnread = unreadCount + syntheticUnreadCount;

  // Build the base list for the current filter before sub-filtering
  const baseList: AppNotification[] = (() => {
    if (filter === 'system') return syntheticNotifications;
    if (filter === 'all' || filter === 'unread') {
      return [...notifications, ...syntheticNotifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return notifications;
  })();

  const filtered = baseList.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'static')
      return currentGroup
        ? (n.group_id
            ? n.group_id === currentGroup.id
            : (n.href?.includes(`/group/${currentGroup.shareCode}`) ?? false))
        : false;
    return true;
  });

  async function handleNotificationClick(n: AppNotification) {
    if (!n.is_read) {
      if (n.id.startsWith('__release__')) {
        markSyntheticRead(n.id);
        refreshSynthetic();
      } else {
        await markRead(n.id);
      }
    }
    if (n.href) {
      navigate(n.href);
      onClose();
    }
  }

  function handleMarkRead(e: React.MouseEvent, n: AppNotification) {
    e.stopPropagation();
    if (n.id.startsWith('__release__')) {
      markSyntheticRead(n.id);
      refreshSynthetic();
    } else {
      markRead(n.id);
    }
  }

  function handleMarkAllRead() {
    markAllRead();
    markAllSyntheticRead();
    refreshSynthetic();
  }

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: totalUnread > 0 ? `Unread (${totalUnread})` : 'Unread' },
    { id: 'static', label: 'This static' },
    { id: 'system', label: syntheticUnreadCount > 0 ? `System (${syntheticUnreadCount})` : 'System' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-status-error text-white text-[10px] font-bold leading-none">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>
      }
      footer={
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {(notifications.length + syntheticNotifications.length) > 0
              ? `${notifications.length + syntheticNotifications.length} notification${(notifications.length + syntheticNotifications.length) !== 1 ? 's' : ''}`
              : ''}
          </p>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      }
    >
      {/* Filter pills */}
      <div className="flex gap-1.5 mb-3 pb-3 border-b border-border-subtle flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-accent text-accent-contrast'
                : 'bg-surface-elevated text-text-secondary hover:bg-surface-interactive hover:text-text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertTriangle className="w-8 h-8 text-status-error opacity-50" />
          <p className="text-sm text-text-secondary">Could not load notifications</p>
          <button
            type="button"
            className="text-xs text-accent underline"
            onClick={() => fetchNotifications()}
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Bell className="w-8 h-8 text-text-muted opacity-30" />
          <p className="text-sm font-medium text-text-secondary">
            {filter === 'unread' ? 'All caught up!' : 'No notifications'}
          </p>
          <p className="text-xs text-text-muted">
            {filter === 'unread'
              ? 'No unread notifications.'
              : filter === 'static'
              ? 'No notifications for this static.'
              : filter === 'system'
              ? 'No system notifications.'
              : 'Nothing to show here.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-subtle max-h-[420px] overflow-y-auto -mx-6 px-6">
          {filtered.map((n) => (
            <div
              key={n.id}
              role={n.href ? 'button' : undefined}
              tabIndex={n.href ? 0 : undefined}
              onKeyDown={
                n.href
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(n);
                    }
                  : undefined
              }
              onClick={() => handleNotificationClick(n)}
              className={`group flex items-start gap-3 py-3 -mx-6 px-6 transition-colors ${
                n.href ? 'cursor-pointer hover:bg-surface-elevated' : ''
              }`}
            >
              {/* Type icon */}
              <div
                className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                  n.is_read
                    ? 'bg-surface-elevated text-text-muted'
                    : 'bg-accent/15 text-accent'
                }`}
              >
                {typeIcon(n.notification_type)}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-sm flex-1 min-w-0 truncate ${
                      n.is_read ? 'text-text-secondary' : 'font-medium text-text-primary'
                    }`}
                  >
                    {n.title}
                    {!n.is_read && (
                      <span className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-accent align-middle flex-shrink-0" />
                    )}
                  </p>
                  <span className="text-[10px] text-text-muted flex-shrink-0">
                    {relativeTime(n.created_at)}
                  </span>
                </div>
                {n.body && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                )}
              </div>

              {/* Per-item mark-read */}
              {!n.is_read && (
                <button
                  type="button"
                  title="Mark as read"
                  className="flex-shrink-0 mt-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-text-primary text-text-muted"
                  onClick={(e) => handleMarkRead(e, n)}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
