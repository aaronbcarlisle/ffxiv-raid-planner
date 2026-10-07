/**
 * GroupTopBarAuthSlot - the auth slot of the V2 group `TopBar` (GUEST-1, R-G1-4).
 *
 * Skeleton before auth resolves, Log in for a guest, nothing for a signed-in
 * user (the UserMenu lives in the AppRail footer). The slot shows the skeleton
 * only when there is no user: a signed-in user with a persisted `user` keeps
 * their bell and gear through a cold load, so the bar never shifts.
 *
 * Lives in `pages/chrome/` (boundary-exempt) so the shell-typed `TopBar` can
 * render it without importing `components/auth/`, the same placement that put
 * `TierBreadcrumb` and `NonGroupTopBar` in pages/.
 */
import { useLocation } from 'react-router-dom';
import { useAuthStore, useAuthHydrated } from '../../stores/authStore';
import { AuthSkeleton, LoginButton } from '../../components/auth';

export function GroupTopBarAuthSlot() {
  const { pathname, search } = useLocation();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isHydrated = useAuthHydrated();

  if (user) return null;
  if (!isHydrated || isLoading) return <AuthSkeleton />;
  // Return to this static, not `/`, after the Discord round trip.
  return <LoginButton redirectTo={pathname + search} className="text-sm px-3 py-1.5" />;
}
