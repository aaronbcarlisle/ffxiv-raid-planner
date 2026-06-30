/**
 * useStaticPermissions (F6a, Task 9)
 *
 * The v2 chrome's copy of the role/permission derivation that legacy `Header`
 * computes inline (Header.tsx:79-96). Kept VERBATIM and kept TOGETHER (the three
 * booleans are interdependent: `isAdminAccess` feeds `canEdit` /
 * `canManageInvitations`, and the admin-elevated role is masked off when not in
 * admin mode). This is duplicated — not moved — because legacy `Header` still
 * renders on the legacy route and needs its own copy; deleting it from Header
 * would change the legacy appearance. Both copies are retired when legacy is
 * deleted post-F6e.
 */

import { useSearchParams } from 'react-router-dom';
import type { MemberRole } from '../types';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';

export interface StaticPermissions {
  /** Effective role for permission checks (viewAs role wins, admin-elevated role masked off-mode). */
  userRole: MemberRole | null | undefined;
  /** Super-user flag (always true for admins, independent of adminMode). */
  isAdmin: boolean;
  /** Elevated admin privileges active (admin + adminMode=true, not viewing-as). */
  isAdminAccess: boolean;
  /** Has any member-level access (owner/lead/member, or admin). */
  isMember: boolean;
  /** Can edit roster/tiers. */
  canEdit: boolean;
  /** Can manage invitations / recruitment. */
  canManageInvitations: boolean;
}

export function useStaticPermissions(): StaticPermissions {
  const [searchParams] = useSearchParams();
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);

  // ── Verbatim from Header.tsx:79-96 ──
  // Admin mode is determined by URL param (navigated from Admin Dashboard).
  const adminModeParam = searchParams.get('adminMode') === 'true';
  const isAdmin = user?.isAdmin ?? false;

  // Get the role from API, but ignore admin-elevated role when not in admin mode.
  const actualUserRole = (currentGroup?.isAdminAccess && !adminModeParam)
    ? null
    : currentGroup?.userRole;

  // Effective role: when viewing as someone, use their role; otherwise actual role.
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;

  const isAdminAccess = !viewAsUser && isAdmin && adminModeParam;

  const isMember = userRole === 'owner' || userRole === 'lead' || userRole === 'member' || isAdmin;
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;
  const canManageInvitations = userRole === 'owner' || userRole === 'lead' || isAdminAccess;

  return { userRole, isAdmin, isAdminAccess, isMember, canEdit, canManageInvitations };
}
