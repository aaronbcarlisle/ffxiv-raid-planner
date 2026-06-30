/**
 * NotificationBell (F6a, Task 10) — v2 TopBar bell affordance.
 *
 * Unified unread badge: server notifications (`unreadCount`) + synthetic release
 * notes (`useSyntheticUnreadCount`) + pending join requests (`pendingCount`).
 * Opens the existing `NotificationCenter` modal via `useModal`.
 *
 * Join-count fetch: the legacy `Header` (suppressed for v2 by Task 9) owns the
 * `canManageInvitations`-gated `fetchGroupRequests` call. This component
 * replicates that effect so the badge is live in v2. Mirrors Header.tsx:107-113.
 *
 * Byte-for-byte rule: does NOT modify `NotificationCenter`, `UserMenu`,
 * `Header`, or `SettingsDockToggle`. Those stay intact for the legacy route.
 */
import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useModal } from '../../hooks/useModal';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSyntheticUnreadCount } from '../../lib/syntheticNotifications';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
// design-system-ignore: shell→person boundary — identical pattern to Header.tsx (count: 1 in eslint-suppressions.json)
import { NotificationCenter } from '../auth/NotificationCenter';
import { IconButton, Tooltip } from '../primitives';

/** Clamps the badge count: returns '99+' if count > 99, else the decimal string. */
function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function NotificationBell() {
  const modal = useModal();

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const syntheticUnread = useSyntheticUnreadCount();
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const { canManageInvitations } = useStaticPermissions();

  // Replicate Header's canManageInvitations-gated join-count fetch for v2.
  // The legacy Header is suppressed when ?shell=v2, so this effect keeps the
  // pendingCount badge live. Mirrors Header.tsx:107-113.
  useEffect(() => {
    if (currentGroup && canManageInvitations) {
      useJoinRequestStore.getState().fetchGroupRequests(currentGroup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGroup?.id, canManageInvitations]);

  const total = unreadCount + syntheticUnread + pendingCount;

  return (
    <>
      <Tooltip content="Notifications">
        <span className="relative inline-flex">
          <IconButton
            aria-label="Notifications"
            icon={<Bell className="w-5 h-5" />}
            variant="ghost"
            size="md"
            onClick={modal.open}
          />
          {total > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full bg-status-error text-white pointer-events-none select-none"
            >
              {formatBadge(total)}
            </span>
          )}
        </span>
      </Tooltip>
      <NotificationCenter isOpen={modal.isOpen} onClose={modal.close} />
    </>
  );
}
