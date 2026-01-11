/**
 * Permission Utilities - Role-Based Access Control
 *
 * This module provides helper functions for checking user permissions
 * throughout the application. These are UX helpers only - the backend
 * always enforces actual permissions.
 *
 * Admin users (isAdmin=true) automatically have owner-level access to all groups.
 */

import type { SnapshotPlayer } from '../types';

// Member roles in hierarchical order
export type MemberRole = 'owner' | 'lead' | 'member' | 'viewer';

/**
 * Permission check result with optional explanation
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string; // Human-readable explanation when denied
}

/**
 * Get the effective role for a user, accounting for admin status.
 * Admins are treated as owners for all permission checks.
 */
export function getEffectiveRole(
  userRole: MemberRole | null | undefined,
  isAdmin?: boolean
): MemberRole | null | undefined {
  if (isAdmin) {
    return 'owner';
  }
  return userRole;
}

// ==================== Player-Level Permissions ====================

/**
 * Check if user can edit a specific player's details (name, job, position).
 *
 * Rules:
 * - Admins have owner-level access to all groups
 * - Owners and Leads can edit any player
 * - Members can only edit players they own (player.userId === currentUserId)
 * - Viewers cannot edit
 */
export function canEditPlayer(
  userRole: MemberRole | null | undefined,
  player: SnapshotPlayer,
  currentUserId?: string,
  isAdmin?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole && !isAdmin) {
    return { allowed: false, reason: 'You must be logged in to edit players' };
  }

  // Owner, Lead, and Admins can edit any player
  if (effectiveRole === 'owner' || effectiveRole === 'lead') {
    return { allowed: true };
  }

  // Members can only edit players they own
  if (effectiveRole === 'member') {
    if (player.userId === currentUserId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Members can only edit their own claimed cards' };
  }

  // Viewers cannot edit
  return { allowed: false, reason: 'Viewers cannot edit players. Ask the Owner or a Lead for Member access.' };
}

/**
 * Check if user can edit gear on a specific player.
 *
 * Same rules as canEditPlayer, but with gear-specific error messaging.
 */
export function canEditGear(
  userRole: MemberRole | null | undefined,
  player: SnapshotPlayer,
  currentUserId?: string,
  isAdmin?: boolean
): PermissionCheck {
  const check = canEditPlayer(userRole, player, currentUserId, isAdmin);
  if (!check.allowed && check.reason?.includes('claimed cards')) {
    return { allowed: false, reason: 'You can only edit gear on your own claimed card' };
  }
  return check;
}

/**
 * Check if user can reset gear on a player.
 *
 * This is a destructive action, so same rules as editing but with specific messaging.
 */
export function canResetGear(
  userRole: MemberRole | null | undefined,
  player: SnapshotPlayer,
  currentUserId?: string,
  isAdmin?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole && !isAdmin) {
    return { allowed: false, reason: 'You must be logged in' };
  }

  // Owner, Lead, and Admins can reset any player's gear
  if (effectiveRole === 'owner' || effectiveRole === 'lead') {
    return { allowed: true };
  }

  // Members can reset their own claimed card's gear
  if (effectiveRole === 'member' && player.userId === currentUserId) {
    return { allowed: true };
  }

  if (effectiveRole === 'member') {
    return { allowed: false, reason: 'You can only reset gear on your own claimed card' };
  }

  return { allowed: false, reason: 'Viewers cannot reset gear' };
}

/**
 * Check if user can claim or unclaim a player card.
 *
 * Rules:
 * - Must be logged in
 * - Admins can claim/unclaim any card
 * - Can't claim if already owned by someone else (unless you're the owner)
 * - Members and above can claim unclaimed cards
 * - Viewers cannot claim
 */
export function canClaimPlayer(
  userRole: MemberRole | null | undefined,
  player: SnapshotPlayer,
  currentUserId?: string,
  isAdmin?: boolean,
  hasMembership?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole || !currentUserId) {
    return { allowed: false, reason: 'You must be logged in to claim cards' };
  }

  // Check for actual membership (not just share code access)
  // Admins bypass this check
  if (!isAdmin && !hasMembership) {
    return {
      allowed: false,
      reason: 'Only group members can claim player cards. Share code access is read-only.'
    };
  }

  // Can't claim if already owned by someone else
  if (player.userId && player.userId !== currentUserId) {
    if (effectiveRole === 'owner') {
      return { allowed: true }; // Owners can unclaim others
    }
    return { allowed: false, reason: 'This card is claimed by another user' };
  }

  // Members and above can claim unclaimed cards or their own
  if (effectiveRole === 'member' || effectiveRole === 'lead' || effectiveRole === 'owner') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Viewers cannot claim cards. Ask for Member access.' };
}

// ==================== Roster-Level Permissions ====================

/**
 * Check if user can manage the roster (add/remove/reorder players).
 *
 * Rules:
 * - Admins have owner-level access
 * - Owners and Leads can manage roster
 * - Members and Viewers cannot
 */
export function canManageRoster(
  userRole: MemberRole | null | undefined,
  isAdmin?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole && !isAdmin) {
    return { allowed: false, reason: 'You must be logged in' };
  }

  if (effectiveRole === 'owner' || effectiveRole === 'lead') {
    return { allowed: true };
  }

  if (effectiveRole === 'member') {
    return { allowed: false, reason: 'Only Leads and Owners can add, remove, or reorder players' };
  }

  return { allowed: false, reason: 'Viewers cannot modify the roster. Ask the Owner for Lead access.' };
}

/**
 * Check if user can manage tiers (create, delete, rollover).
 *
 * Same permission level as managing roster.
 */
export function canManageTiers(
  userRole: MemberRole | null | undefined,
  isAdmin?: boolean
): PermissionCheck {
  const check = canManageRoster(userRole, isAdmin);
  if (!check.allowed && check.reason?.includes('players')) {
    return { allowed: false, reason: 'Only Leads and Owners can create, delete, or rollover tiers' };
  }
  return check;
}

// ==================== Group-Level Permissions ====================

/**
 * Check if user can manage group settings (edit name, visibility, delete group).
 *
 * Rules:
 * - Admins have owner-level access
 * - Only the Owner can manage group settings
 */
export function canManageGroup(
  userRole: MemberRole | null | undefined,
  isAdmin?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole && !isAdmin) {
    return { allowed: false, reason: 'You must be logged in' };
  }

  if (effectiveRole === 'owner') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Only the Owner can edit group settings or delete the group' };
}

/**
 * Check if user can manage invitations (create, revoke).
 *
 * Rules:
 * - Admins have owner-level access
 * - Owners and Leads can manage invitations
 */
export function canManageInvitations(
  userRole: MemberRole | null | undefined,
  isAdmin?: boolean
): PermissionCheck {
  const effectiveRole = getEffectiveRole(userRole, isAdmin);

  if (!effectiveRole && !isAdmin) {
    return { allowed: false, reason: 'You must be logged in' };
  }

  if (effectiveRole === 'owner' || effectiveRole === 'lead') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Only Leads and Owners can manage invitations' };
}

// ==================== UI Helpers ====================

/**
 * Get a user-friendly role description for UI display.
 */
export function getRoleDescription(role: MemberRole | null | undefined): string {
  if (!role) return 'No access';

  const descriptions: Record<MemberRole, string> = {
    owner: 'Full control over group and roster',
    lead: 'Can edit roster and manage players',
    member: 'Can edit own claimed cards',
    viewer: 'Read-only access',
  };

  return descriptions[role];
}

/**
 * Get role display name (capitalized).
 */
export function getRoleDisplayName(role: MemberRole | null | undefined): string {
  if (!role) return 'Viewer';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Get role color classes for Tailwind styling.
 * Uses semantic membership color tokens from the design system.
 */
export function getRoleColorClasses(role: MemberRole | null | undefined): string {
  if (!role) return 'bg-membership-viewer/20 border-membership-viewer/30 text-membership-viewer';

  const colorClasses: Record<MemberRole, string> = {
    owner: 'bg-membership-owner/20 border-membership-owner/30 text-membership-owner',
    lead: 'bg-membership-lead/20 border-membership-lead/30 text-membership-lead',
    member: 'bg-membership-member/20 border-membership-member/30 text-membership-member',
    viewer: 'bg-membership-viewer/20 border-membership-viewer/30 text-membership-viewer',
  };

  return colorClasses[role];
}
