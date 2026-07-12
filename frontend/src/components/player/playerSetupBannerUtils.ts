/**
 * PlayerSetupBanner Utilities
 *
 * Logic functions for determining banner state, extracted from the component
 * for testability and to comply with react-refresh/only-export-components rule.
 */

import type { SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';

export type BannerState = 'unclaimed-owner' | 'unclaimed-member' | 'needs-bis' | 'hidden';

export interface BannerOptions {
  hideSetupBanners?: boolean;
  hideBisBanners?: boolean;
}

/**
 * Determine which banner state to show based on player and user context
 */
export function getBannerState(
  player: SnapshotPlayer,
  currentUserId: string | null,
  userRole: MemberRole | null | undefined,
  userHasClaimedPlayer: boolean,
  options: BannerOptions = {}
): BannerState {
  // Never show banner if not logged in, no role, or viewer
  // Note: null/undefined userRole means no membership (shouldn't see action prompts)
  if (!currentUserId || !userRole || userRole === 'viewer') return 'hidden';

  const isUnclaimed = !player.userId;
  const isClaimedByMe = player.userId === currentUserId;
  const hasBiS = !!player.bisLink;
  const isOwnerOrLead = userRole === 'owner' || userRole === 'lead';

  // Owner/Lead sees unclaimed cards - offer to assign (unless hidden)
  if (isUnclaimed && isOwnerOrLead && !options.hideSetupBanners) {
    return 'unclaimed-owner';
  }

  // Member sees unclaimed card only if they haven't claimed another (unless hidden)
  if (isUnclaimed && userRole === 'member' && !userHasClaimedPlayer && !options.hideSetupBanners) {
    return 'unclaimed-member';
  }

  // Show needs-bis banner when card has no BiS configured:
  // - For user's own claimed card
  // - For owner/lead viewing any card they can manage
  if (!hasBiS && !options.hideBisBanners) {
    if (isClaimedByMe) {
      return 'needs-bis';
    }
    // Owner/lead can see BiS status of cards when:
    // - Card is claimed by someone else (they're managing others' cards)
    // - Card is unclaimed but they've hidden setup banners (solo manager mode)
    // Note: if card is unclaimed and setup banners are shown, they already see 'unclaimed-owner'
    if (isOwnerOrLead && (!isUnclaimed || options.hideSetupBanners)) {
      return 'needs-bis';
    }
  }

  return 'hidden';
}
