/**
 * NotificationBell (F6a, Task 10) — v2 TopBar bell affordance.
 *
 * Prop-driven: calls `onOpen` when clicked; openers write notificationStore
 * and the single app-level NotificationCenterHost renders the center; passes
 * the opener down via TopBar → NotificationBell. This keeps the shell→person
 * boundary clean — no direct auth-component import here.
 *
 * Unified unread badge: server notifications (`unreadCount`) + synthetic release
 * notes (`useSyntheticUnreadCount`) + pending join requests (`pendingCount`,
 * IN-STATIC ONLY — see the route gate below).
 *
 * Join-count fetch: the legacy `Header` (suppressed for v2) owns the
 * `canManageInvitations`-gated `fetchGroupRequests` call. This component
 * replicates that effect so the badge is live in v2. Mirrors Header.tsx:113-118.
 *
 * Byte-for-byte rule: does NOT modify `NotificationCenter`,
 * `Header`, or `SettingsDockToggle`. Those stay intact for the legacy route.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSyntheticUnreadCount } from '../../lib/syntheticNotifications';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import { IconButton, Tooltip } from '../primitives';

interface NotificationBellProps {
  /** Called when the bell is clicked; opens the app-level center host. */
  onOpen: () => void;
}

/** Clamps the badge count: returns '99+' if count > 99, else the decimal string. */
function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function NotificationBell({ onOpen }: NotificationBellProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const syntheticUnread = useSyntheticUnreadCount();
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const { canManageInvitations } = useStaticPermissions();
  // Stage-1 T4 / RC5. The pending-join-request contribution is IN-STATIC ONLY,
  // and the predicate is the ROUTE — the same one Header.tsx:60 and
  // GlobalSettingsPanel.tsx:25 use — NOT `currentGroup`. `currentGroup` is
  // never cleared when you navigate off a static (joinRequestStore likewise
  // never resets `pendingCount`), so gating on it would leak a STALE join-
  // request badge onto /profile after any static visit: precisely the
  // unfulfillable affordance matrix row H7 rules out off-group (its tap
  // promise, `tab: 'recruitment'`, cannot be honored there — GlobalSettingsPanel
  // is account-only). In-static the badge behaves exactly as before.
  const onGroupRoute = useLocation().pathname.startsWith('/group/');

  // Replicate Header's canManageInvitations-gated join-count fetch for v2.
  // The app-wide Header is suppressed on the group route, so this effect
  // keeps the pendingCount badge live. Mirrors Header.tsx:113-118 — including
  // its `isGroupRoute` condition, since off-group the result is not displayed.
  useEffect(() => {
    if (onGroupRoute && currentGroup && canManageInvitations) {
      useJoinRequestStore.getState().fetchGroupRequests(currentGroup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGroupRoute, currentGroup?.id, canManageInvitations]);

  const total = unreadCount + syntheticUnread + (onGroupRoute ? pendingCount : 0);

  return (
    <Tooltip content="Notifications">
      <span className="relative inline-flex">
        <IconButton
          aria-label={total > 0 ? `Notifications, ${formatBadge(total)} unread` : 'Notifications'}
          icon={<Bell className="w-5 h-5" />}
          variant="ghost"
          size="md"
          onClick={onOpen}
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
  );
}
