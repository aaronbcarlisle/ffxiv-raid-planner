/**
 * PlayerCard Status - Status badges and tank role selector
 *
 * Displays SUB, BiS, You, LinkedUser badges and MT/OT for tanks.
 * Extracted from PlayerCard for maintainability.
 */

import { TankRoleSelector } from './TankRoleSelector';
import type { TankRole, LinkedUserInfo } from '../../types';

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
  tankRole: TankRole | null | undefined;
  userId?: string | null;
  linkedUser?: LinkedUserInfo | null;
  currentUserId?: string;
  onTankRoleChange: (tankRole: TankRole | undefined) => void;
}

export function PlayerCardStatus({
  role,
  isSubstitute,
  bisLink,
  tankRole,
  userId,
  linkedUser,
  currentUserId,
  onTankRoleChange,
}: PlayerCardStatusProps) {
  const isLinkedToMe = userId === currentUserId;
  const isLinkedToOther = userId && userId !== currentUserId;

  // Don't render if nothing to show
  const hasContent = isSubstitute || bisLink || isLinkedToMe || isLinkedToOther || role === 'tank';
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
        <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium" title="This is you">
          You
        </span>
      )}

      {/* Linked user badge */}
      {isLinkedToOther && linkedUser && (
        <span
          className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-1"
          title={`Linked to ${linkedUser.displayName || linkedUser.discordUsername}`}
        >
          {linkedUser.avatarUrl ? (
            <img
              src={linkedUser.avatarUrl}
              alt=""
              className="w-3 h-3 rounded-full"
            />
          ) : null}
          <span className="max-w-16 truncate">
            {linkedUser.displayName || linkedUser.discordUsername}
          </span>
        </span>
      )}

      {/* Tank role selector (MT/OT) */}
      {role === 'tank' && (
        <TankRoleSelector
          tankRole={tankRole}
          onSelect={onTankRoleChange}
        />
      )}
    </div>
  );
}
