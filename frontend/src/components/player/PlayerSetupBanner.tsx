/**
 * PlayerSetupBanner - Contextual setup prompts on player cards
 *
 * Displays a compact banner between the header and gear table when:
 * - Card is unclaimed and user can assign/claim
 * - Card is claimed by user but has no BiS configured
 *
 * Auto-hides when card is fully configured.
 */

import { memo } from 'react';
import { Button, Tooltip } from '../primitives';
import { Link2, UserCheck, FileDown } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';
import type { MemberRole } from '../../utils/permissions';
import { getBannerState, type BannerOptions } from './playerSetupBannerUtils';

export interface PlayerSetupBannerProps {
  player: SnapshotPlayer;
  currentUserId: string | null;
  userRole: MemberRole | null | undefined;
  userHasClaimedPlayer: boolean;
  isAdminAccess: boolean;
  /** User ID being impersonated in View As mode */
  viewAsUserId?: string | null;
  /** Hide "Unclaimed" banners (group setting) */
  hideSetupBanners?: boolean;
  /** Hide "No BiS configured" banners (group setting) */
  hideBisBanners?: boolean;
  onClaimPlayer?: () => void;
  onOpenAssignModal?: () => void;
  /** Quick assign the viewAsUserId to this player (used in View As mode) */
  onAssignViewAsUser?: () => void;
  onOpenBiSImport?: () => void;
}

export const PlayerSetupBanner = memo(function PlayerSetupBanner({
  player,
  currentUserId,
  userRole,
  userHasClaimedPlayer,
  isAdminAccess,
  viewAsUserId,
  hideSetupBanners,
  hideBisBanners,
  onClaimPlayer,
  onOpenAssignModal,
  onAssignViewAsUser,
  onOpenBiSImport,
}: PlayerSetupBannerProps) {
  const bannerOptions: BannerOptions = { hideSetupBanners, hideBisBanners };
  const bannerState = getBannerState(player, currentUserId, userRole, userHasClaimedPlayer, bannerOptions);

  if (bannerState === 'hidden') return null;

  // Determine which action to show
  let message: string;
  let buttonLabel: string;
  let buttonIcon: React.ReactNode;
  let buttonTooltip: string;
  let onClick: (() => void) | undefined;
  // All current banner states use 'info' variant (warning variant was for 'needs-bis-update' which is now handled by BiSSourceFixBanner)
  const variant = 'info' as const;

  switch (bannerState) {
    case 'unclaimed-owner':
      message = 'Unclaimed';
      buttonLabel = 'Assign Player';
      buttonIcon = <Link2 className="w-3.5 h-3.5" />;
      buttonTooltip = 'Link a Discord member to this player slot';
      // Use owner assign for non-admin access, or admin assign for admin access
      onClick = onOpenAssignModal;
      break;

    case 'unclaimed-member':
      message = 'Unclaimed';
      buttonLabel = 'Take Ownership';
      buttonIcon = <UserCheck className="w-3.5 h-3.5" />;
      buttonTooltip = 'Claim this slot as your character';
      // In View As mode, use admin assign to assign the viewed user
      // Normal mode uses claim endpoint
      onClick = (isAdminAccess && viewAsUserId) ? onAssignViewAsUser : onClaimPlayer;
      break;

    case 'needs-bis':
      message = 'No BiS configured';
      buttonLabel = 'Import BiS';
      buttonIcon = <FileDown className="w-3.5 h-3.5" />;
      buttonTooltip = 'Import gear set from XIVGear or Etro';
      onClick = onOpenBiSImport;
      break;

    default:
      return null;
  }

  // Styling based on variant
  const variantStyles: Record<'info' | 'warning', { container: string; text: string }> = {
    info: {
      container: 'bg-accent/10 border-accent',
      text: 'text-accent',
    },
    warning: {
      container: 'bg-status-warning/10 border-status-warning',
      text: 'text-status-warning',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`mx-3 mb-2 px-3 py-2 rounded-lg border-l-4 flex items-center justify-between gap-3 ${styles.container}`}
      role="status"
      aria-label={`Setup needed: ${message}`}
    >
      <span className={`text-sm ${styles.text}`}>{message}</span>
      <Tooltip content={buttonTooltip}>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={buttonIcon}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          disabled={!onClick}
        >
          {buttonLabel}
        </Button>
      </Tooltip>
    </div>
  );
});
