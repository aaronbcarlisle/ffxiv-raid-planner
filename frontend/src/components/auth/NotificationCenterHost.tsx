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
import { useNotificationStore } from '../../stores/notificationStore';
import { NotificationCenter } from './NotificationCenter';

export function NotificationCenterHost() {
  const centerOpen = useNotificationStore((s) => s.centerOpen);
  const closeCenter = useNotificationStore((s) => s.closeCenter);
  return <NotificationCenter isOpen={centerOpen} onClose={closeCenter} />;
}
