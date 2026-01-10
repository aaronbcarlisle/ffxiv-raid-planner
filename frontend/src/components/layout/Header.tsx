/**
 * Header - Unified application header
 *
 * On group pages: [Logo] [Static ▼][Owner][Code] ... [Tier ▼][⚙️][User]
 * On other pages: [Logo] ... [User]
 */

import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { LoginButton, UserMenu } from '../auth';
import { StaticSwitcher, TierSelector } from '../static-group';
import { SettingsPopover } from '../ui';
import { RAID_TIERS } from '../../gamedata';
import { canManageTiers, canManageGroup } from '../../utils/permissions';
import type { MemberRole } from '../../types';

// Role badge colors - using semantic membership tokens
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-membership-owner/20 text-membership-owner border-membership-owner/30',
  lead: 'bg-membership-lead/20 text-membership-lead border-membership-lead/30',
  member: 'bg-membership-member/20 text-membership-member border-membership-member/30',
  viewer: 'bg-membership-viewer/20 text-membership-viewer border-membership-viewer/30',
};

// Custom event types for communication with GroupView
export const HEADER_EVENTS = {
  TIER_CHANGE: 'header:tier-change',
  ADD_PLAYER: 'header:add-player',
  NEW_TIER: 'header:new-tier',
  ROLLOVER: 'header:rollover',
  SETTINGS: 'header:settings',
  DELETE_TIER: 'header:delete-tier',
} as const;

export function Header() {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const { currentGroup, groups, fetchGroups } = useStaticGroupStore();
  const { tiers, currentTier, isSaving } = useTierStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();

  // Determine current route context
  const isGroupRoute = location.pathname.startsWith('/group/');

  // Check if user is a member of the current group
  const userRole = currentGroup?.userRole;
  const isMember = userRole === 'owner' || userRole === 'lead' || userRole === 'member';
  const canEdit = userRole === 'owner' || userRole === 'lead';

  // Calculate available tiers for creation
  const existingTierIds = tiers.map(t => t.tierId);
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

  // Count configured players
  const configuredPlayerCount = currentTier?.players?.filter(p => p.configured).length ?? 0;
  const totalPlayerCount = currentTier?.players?.length ?? 0;

  // Handle share code copy (hold Shift for full URL with tier)
  const handleCopyCode = async (e: React.MouseEvent) => {
    if (!currentGroup) return;
    const isFullUrl = e.shiftKey;

    let textToCopy: string;
    let message: string;

    if (isFullUrl) {
      // Include current tier in URL so recipient sees the same tier
      const tierParam = currentTier?.tierId ? `?tier=${currentTier.tierId}` : '';
      textToCopy = `${window.location.origin}/group/${currentGroup.shareCode}${tierParam}`;
      message = currentTier?.tierId ? `Full URL with tier copied!` : 'Full URL copied!';
    } else {
      textToCopy = currentGroup.shareCode;
      message = 'Share code copied!';
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success(message);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success(message);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Dispatch custom event helper
  const dispatchHeaderEvent = (eventName: string, detail?: unknown) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  // Check permissions
  const tierPermission = canManageTiers(userRole);
  const groupPermission = canManageGroup(userRole);

  // Build settings actions
  const settingsActions = useMemo(() => {
    if (!tierPermission.allowed) return [];

    return [
      {
        id: 'add-player',
        label: 'Add Player',
        badge: currentTier ? `${configuredPlayerCount}/${totalPlayerCount}` : undefined,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
        disabled: !currentTier || isSaving,
        tooltip: !currentTier ? 'Create a tier first' : isSaving ? 'Saving...' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.ADD_PLAYER),
      },
      {
        id: 'new-tier',
        label: 'New Tier',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        disabled: availableTiers.length === 0,
        tooltip: availableTiers.length === 0 ? 'All tiers have been created' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.NEW_TIER),
      },
      {
        id: 'rollover',
        label: 'Copy to New Tier',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        disabled: !currentTier || availableTiers.length === 0,
        tooltip: !currentTier ? 'Create a tier first' : availableTiers.length === 0 ? 'All tiers have been created' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.ROLLOVER),
      },
      ...(groupPermission.allowed ? [{
        id: 'settings',
        label: 'Static Settings',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.SETTINGS),
      }] : []),
      {
        id: 'delete-tier',
        label: 'Delete Tier',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        ),
        danger: true,
        disabled: !currentTier || tiers.length <= 1,
        tooltip: !currentTier ? 'No tier to delete' : tiers.length <= 1 ? 'Cannot delete the last tier' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.DELETE_TIER),
      },
    ];
  }, [tierPermission.allowed, groupPermission.allowed, currentTier, configuredPlayerCount, totalPlayerCount, isSaving, availableTiers.length, tiers.length]);

  return (
    <header className="bg-surface-raised border-b border-border-default">
      <div className="max-w-[160rem] mx-auto px-4 py-2 flex items-center justify-between gap-4">
        {/* Left side: Logo + Group context */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 flex-shrink-0 group"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 rounded-lg blur-md group-hover:bg-accent/30 transition-colors" />
              <img
                src="/logo.svg"
                alt="FFXIV Raid Planner"
                className="relative w-9 h-9"
              />
            </div>
          </Link>

          {/* Group context (only on group pages) */}
          {isGroupRoute && currentGroup && (
            <>
              {/* Divider */}
              <span className="text-border-default">/</span>

              {/* Static Switcher */}
              <StaticSwitcher
                currentGroup={currentGroup}
                groups={groups}
                onFetchGroups={fetchGroups}
                isMember={isMember}
              />

              {/* Role badge */}
              {userRole && (
                <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${ROLE_COLORS[userRole]}`}>
                  {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </span>
              )}

              {/* Share code - clickable to copy */}
              <button
                onClick={(e) => handleCopyCode(e)}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-card hover:bg-surface-interactive transition-colors group flex-shrink-0"
                title="Copy code (hold Shift for full URL)"
              >
                <span className="font-mono text-sm text-text-secondary">{currentGroup.shareCode}</span>
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Right side: Tier + Settings + Auth */}
        <div className="flex items-center gap-3">
          {/* Group controls (only on group pages) */}
          {isGroupRoute && currentGroup && tiers.length > 0 && (
            <>
              {/* Tier selector */}
              <TierSelector
                tiers={tiers}
                currentTierId={currentTier?.tierId}
                onTierChange={(tierId) => dispatchHeaderEvent(HEADER_EVENTS.TIER_CHANGE, { tierId })}
              />

              {/* Settings popover (only for editors) */}
              {canEdit && settingsActions.length > 0 && (
                <SettingsPopover actions={settingsActions} />
              )}
            </>
          )}

          {/* Auth: Login button or User menu */}
          <div className={isGroupRoute && currentGroup ? 'border-l border-border-subtle pl-3' : ''}>
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-surface-interactive animate-pulse" />
            ) : isAuthenticated ? (
              <UserMenu />
            ) : (
              <LoginButton className="text-sm px-3 py-1.5" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
