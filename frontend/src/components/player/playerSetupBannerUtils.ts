/**
 * PlayerSetupBanner Utilities
 *
 * Logic functions for determining banner state, extracted from the component
 * for testability and to comply with react-refresh/only-export-components rule.
 */

import type { SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';

export type BannerState = 'unclaimed-owner' | 'unclaimed-member' | 'needs-bis' | 'hidden';

/**
 * Determine which banner state to show based on player and user context
 */
export function getBannerState(
  player: SnapshotPlayer,
  currentUserId: string | null,
  userRole: MemberRole | null | undefined,
  userHasClaimedPlayer: boolean
): BannerState {
  // Never show banner if not logged in, no role, or viewer
  // Note: null/undefined userRole means no membership (shouldn't see action prompts)
  if (!currentUserId || !userRole || userRole === 'viewer') return 'hidden';

  const isUnclaimed = !player.userId;
  const isClaimedByMe = player.userId === currentUserId;
  const hasBiS = !!player.bisLink;

  // Owner/Lead sees unclaimed cards - offer to assign
  if (isUnclaimed && (userRole === 'owner' || userRole === 'lead')) {
    return 'unclaimed-owner';
  }

  // Member sees unclaimed card only if they haven't claimed another
  if (isUnclaimed && userRole === 'member' && !userHasClaimedPlayer) {
    return 'unclaimed-member';
  }

  // User sees their own card if no BiS (only if they have a valid role)
  if (isClaimedByMe && !hasBiS) {
    return 'needs-bis';
  }

  return 'hidden';
}
