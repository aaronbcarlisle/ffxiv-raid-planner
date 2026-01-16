/**
 * PlayerCard Status - Status badges row
 *
 * Displays SUB, BiS, You, LinkedUser badges.
 * MT/OT selector moved to PlayerCardHeader for visual alignment.
 * Extracted from PlayerCard for maintainability.
 */

import type { LinkedUserInfo, SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';

// Build URL from bisLink - supports both Etro and XIVGear formats
function buildBiSUrl(bisLink: string): string {
  if (bisLink.startsWith('http')) return bisLink;
  if (bisLink.includes('|')) return `https://xivgear.app/?page=${bisLink}`;
  return `https://etro.gg/gearset/${bisLink}`;
}

// Detect if bisLink is from Etro or XIVGear
function getBiSSourceName(bisLink: string): string {
  if (bisLink.includes('etro.gg')) return 'Etro';
  if (bisLink.includes('xivgear')) return 'XIVGear';
  if (bisLink.includes('|')) return 'XIVGear';
  return 'Etro';
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
        <span className="text-xs bg-status-warning/20 text-status-warning px-1.5 py-0.5 rounded font-medium">
          SUB
        </span>
      )}

      {/* BiS link badge */}
      {bisLink && (
        <a
          href={buildBiSUrl(bisLink)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium
                     hover:bg-accent/30 flex items-center gap-1 transition-colors"
          title={`Open BiS in ${getBiSSourceName(bisLink)}`}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          BiS
        </a>
      )}

      {/* "You" badge */}
      {isLinkedToMe && (
        <span className="text-xs bg-membership-member/20 text-membership-member px-1.5 py-0.5 rounded font-medium" title="This is you">
          You
        </span>
      )}

      {/* Linked user badge */}
      {isLinkedToOther && linkedUser && (
        <span
          className={`text-xs ${roleColor} px-1.5 py-0.5 rounded font-medium flex items-center gap-1`}
          title={`Linked to ${linkedUser.displayName || linkedUser.discordUsername}${linkedUser.membershipRole ? ` (${linkedUser.membershipRole})` : ''}`}
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
      )}
    </div>
  );
}
