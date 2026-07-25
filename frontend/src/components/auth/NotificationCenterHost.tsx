/**
 * NotificationCenterHost — the single app-level NotificationCenter mount
 * (Stage-1 req 10).
 *
 * Before Stage 1 the center was mounted TWICE in a v2 group render (NewShell
 * and UserMenu each self-mounted one). Open-state now lives in
 * notificationStore (`centerOpen` / `openCenter` / `closeCenter`); every
 * opener — the legacy UserMenu "Notifications" item and the v2 TopBar bell —
 * writes the store, and this one host (mounted in App.tsx next to
 * ToastContainer) renders the center for both shells on every route.
 */
import { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationCenter } from './NotificationCenter';

export function NotificationCenterHost() {
  const user = useAuthStore((s) => s.user);
  const centerOpen = useNotificationStore((s) => s.centerOpen);
  const closeCenter = useNotificationStore((s) => s.closeCenter);
  // The open flag must not survive a session boundary: without this reset a
  // logout (or a guest click on an opener) leaves centerOpen=true in the
  // store and the NEXT login would mount the center already open.
  useEffect(() => {
    if (!user && centerOpen) closeCenter();
  }, [user, centerOpen, closeCenter]);
  // Self-gates on the session exactly as the old UserMenu-hosted mount did
  // (UserMenu returns null for guests): an open center must unmount the
  // moment the session is cleared — including mid-flight auth failures —
  // not linger with stale notifications and an unauthenticated retry.
  if (!user) return null;
  return <NotificationCenter isOpen={centerOpen} onClose={closeCenter} />;
}
