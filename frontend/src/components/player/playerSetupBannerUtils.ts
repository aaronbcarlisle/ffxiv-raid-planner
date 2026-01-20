/**
 * PlayerSetupBanner Utilities
 *
 * Logic functions for determining banner state, extracted from the component
 * for testability and to comply with react-refresh/only-export-components rule.
 */

import type { SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';

export type BannerState = 'unclaimed-owner' | 'unclaimed-member' | 'needs-bis' | 'needs-bis-update' | 'hidden';

/**
 * Check if a gear slot appears to be miscategorized based on item data.
 *
 * Detects items that should be base_tome or crafted but are set to something else:
 * - base_tome: bisSource is 'tome' but itemName doesn't start with "Aug."
 * - crafted: bisSource isn't 'crafted' but itemLevel is 770 or below (crafted tier)
 */
function isSlotMiscategorized(slot: SnapshotPlayer['gear'][0]): boolean {
  // No item data = can't determine
  if (!slot.itemName && !slot.itemLevel) return false;

  // Check for potential base_tome miscategorization:
  // Set as 'tome' (implies needs augmentation) but item name doesn't have "Aug." prefix
  if (slot.bisSource === 'tome' && slot.itemName) {
    const nameLower = slot.itemName.toLowerCase();
    if (!nameLower.startsWith('aug.') && !nameLower.startsWith('augmented')) {
      // This looks like base tome gear incorrectly set as 'tome'
      return true;
    }
  }

  // Check for potential crafted miscategorization:
  // Not set as 'crafted' but item level suggests crafted gear (770 or below for current tier)
  // Note: 770 is crafted, 780 is base tome, 790 is savage/augmented
  if (slot.bisSource !== 'crafted' && slot.itemLevel && slot.itemLevel <= 770) {
    return true;
  }

  return false;
}

/**
 * Check if player has legacy BiS import with miscategorized items.
 *
 * Returns true if:
 * - Player has a bisLink (imported BiS)
 * - Any gear slot has item data that suggests it should be base_tome or crafted
 *   but is currently set to a different bisSource
 */
export function needsBisUpdate(player: SnapshotPlayer): boolean {
  // Must have a BiS link to be a legacy import
  if (!player.bisLink) return false;

  // Check if any gear slot appears to be miscategorized
  return player.gear.some(isSlotMiscategorized);
}

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

  // Check for legacy BiS import that may need update (for claimed cards)
  // Show to owner/lead for any player, or to member for their own card
  const canEditPlayer = userRole === 'owner' || userRole === 'lead' || isClaimedByMe;
  if (canEditPlayer && needsBisUpdate(player)) {
    return 'needs-bis-update';
  }

  return 'hidden';
}
