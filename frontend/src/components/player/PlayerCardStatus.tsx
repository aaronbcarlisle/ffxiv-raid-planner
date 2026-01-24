/**
 * PlayerCard Status - Status badges row
 *
 * Displays SUB, BiS, You, LinkedUser badges.
 * MT/OT selector moved to PlayerCardHeader for visual alignment.
 * Extracted from PlayerCard for maintainability.
 */

import { Tooltip } from '../primitives/Tooltip';
import type { LinkedUserInfo, SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';

// Build URL from bisLink - supports both Etro and XIVGear formats
function buildBiSUrl(bisLink: string): string {
  if (bisLink.startsWith('http')) return bisLink;
  if (bisLink.includes('|')) {
    // Handle bis|job|tier|index format - strip the index for XIVGear URL
    // XIVGear expects ?page=bis|job|tier, not ?page=bis|job|tier|index
    if (bisLink.startsWith('bis|')) {
      const parts = bisLink.split('|');
      if (parts.length === 4) {
        // Strip the index (4th part)
        return `https://xivgear.app/?page=${parts.slice(0, 3).join('|')}`;
      }
    }
    // Handle sl|uuid|setIndex format - include setIndex as URL parameter
    // XIVGear supports ?page=sl|uuid&selectedIndex=N for set selection
    if (bisLink.startsWith('sl|')) {
      const parts = bisLink.split('|');
      if (parts.length === 3) {
        const uuid = parts[1];
        const setIndex = parseInt(parts[2], 10);
        // Always include selectedIndex if we have a valid number (including 0)
        if (!Number.isNaN(setIndex)) {
          return `https://xivgear.app/?page=sl|${uuid}&selectedIndex=${setIndex}`;
        }
        return `https://xivgear.app/?page=sl|${uuid}`;
      }
    }
    return `https://xivgear.app/?page=${bisLink}`;
  }
  return `https://etro.gg/gearset/${bisLink}`;
}

// Map tier codes to user-friendly names
const TIER_DISPLAY_NAMES: Record<string, string> = {
  current: 'Savage BiS',
  fru: 'FRU BiS',
  top: 'TOP BiS',
  dsr: 'DSR BiS',
  tea: 'TEA BiS',
  ucob: 'UCoB BiS',
  uwu: 'UWU BiS',
};

// Build descriptive tooltip text for BiS link
function getBiSTooltip(bisLink: string): string {
  // Custom URL - just show source
  if (bisLink.startsWith('http')) {
    if (bisLink.includes('etro.gg')) return 'Open in Etro';
    if (bisLink.includes('xivgear')) return 'Open in XIVGear';
    return 'Open BiS link';
  }

  // Shortlink preset (sl|uuid)
  if (bisLink.startsWith('sl|')) {
    return 'Open curated BiS in XIVGear';
  }

  // GitHub preset (bis|job|tier|index)
  if (bisLink.startsWith('bis|')) {
    const parts = bisLink.split('|');
    if (parts.length >= 3) {
      const tier = parts[2];
      const tierName = TIER_DISPLAY_NAMES[tier] || `${tier.toUpperCase()} BiS`;
      return `Open ${tierName} in XIVGear`;
    }
    return 'Open curated BiS in XIVGear';
  }

  // Fallback (probably an Etro UUID)
  return 'Open in Etro';
}

interface PlayerCardStatusProps {
  role: string;
  isSubstitute: boolean;
  bisLink?: string;
  userId?: string | null;
  linkedUser?: LinkedUserInfo | null;
  currentUserId?: string;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  isAdmin?: boolean;
}

// Role-based badge colors for linked users
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner',
  lead: 'bg-membership-lead/20 text-membership-lead',
  member: 'bg-membership-member/20 text-membership-member',
  viewer: 'bg-membership-viewer/20 text-membership-viewer',
};

export function PlayerCardStatus({
  role: _role,
  isSubstitute,
  bisLink,
  userId,
  linkedUser,
  currentUserId,
  player: _player,
  userRole: _userRole,
  isAdmin: _isAdmin,
}: PlayerCardStatusProps) {
  const isLinkedToMe = userId === currentUserId;
  const isLinkedToOther = userId && userId !== currentUserId;

  // Determine badge color based on membership role
  const roleColor = linkedUser?.membershipRole
    ? ROLE_COLORS[linkedUser.membershipRole]
    : 'bg-membership-linked/20 text-membership-linked';

  // Always show username (role is indicated by color)
  const roleLabel = linkedUser?.displayName || linkedUser?.discordUsername || '';

  // Don't render if nothing to show
  const hasContent = isSubstitute || bisLink || isLinkedToMe || isLinkedToOther;
  if (!hasContent) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* SUB badge */}
      {isSubstitute && (
        <Tooltip
          content={
            <div>
              <div className="font-medium">Substitute</div>
              <div className="text-text-secondary text-xs mt-0.5">
                This player is a backup for the raid group
              </div>
            </div>
          }
        >
          <span className="text-xs bg-status-warning/20 text-status-warning px-1.5 py-0.5 rounded font-medium">
            SUB
          </span>
        </Tooltip>
      )}

      {/* BiS link badge */}
      {bisLink && (
        <Tooltip content={getBiSTooltip(bisLink)}>
          <a
            href={buildBiSUrl(bisLink)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium
                       hover:bg-accent/30 flex items-center gap-1 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            BiS
          </a>
        </Tooltip>
      )}

      {/* "You" badge */}
      {isLinkedToMe && (
        <Tooltip content="This is you">
          <span className="text-xs bg-membership-member/20 text-membership-member px-1.5 py-0.5 rounded font-medium">
            You
          </span>
        </Tooltip>
      )}

      {/* Linked user badge */}
      {isLinkedToOther && linkedUser && (
        <Tooltip content={`Linked to ${linkedUser.displayName || linkedUser.discordUsername}${linkedUser.membershipRole ? ` (${linkedUser.membershipRole})` : ''}`}>
          <span
            className={`text-xs ${roleColor} px-1.5 py-0.5 rounded font-medium flex items-center gap-1`}
          >
            {linkedUser.avatarUrl ? (
              <img
                src={linkedUser.avatarUrl}
                alt=""
                className="w-3 h-3 rounded-full"
              />
            ) : null}
            <span className="max-w-16 truncate">
              {roleLabel}
            </span>
          </span>
        </Tooltip>
      )}
    </div>
  );
}
