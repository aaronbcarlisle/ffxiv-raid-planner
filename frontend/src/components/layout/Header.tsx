/**
 * Header - Unified application header
 *
 * New layout with breadcrumb hierarchy:
 * [Logo] ─ [Static ▼] > [Tier ▼] [⋮] ─── [Invite] [⚙️] [User ▼]
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Copy, UserPlus, Settings, Plus, Trash2 } from 'lucide-react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore, useAuthHydrated } from '../../stores/authStore';
import { useViewAsStore } from '../../stores/viewAsStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { toast } from '../../stores/toastStore';
import { LoginButton, UserMenu } from '../auth';
import { StaticSwitcher, TierSelector } from '../static-group';
import { TierActionsMenu, TipsCarousel } from '../ui';
import { Tooltip, IconButton } from '../primitives';
import { RAID_TIERS } from '../../gamedata';
import { canManageTiers, canManageGroup } from '../../utils/permissions';

// Custom event types for communication with GroupView
export const HEADER_EVENTS = {
  TIER_CHANGE: 'header:tier-change',
  ADD_PLAYER: 'header:add-player',
  NEW_TIER: 'header:new-tier',
  ROLLOVER: 'header:rollover',
  SETTINGS: 'header:settings',
  DELETE_TIER: 'header:delete-tier',
  OPEN_SETTINGS_INVITATIONS: 'header:open-settings-invitations',
} as const;

export function Header() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const { currentGroup, groups, fetchGroups } = useStaticGroupStore();
  const { tiers, currentTier } = useTierStore();
  const { user, isLoading } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const { viewAsUser } = useViewAsStore();

  // Show loading state until store is hydrated from localStorage
  const authLoading = !isHydrated || isLoading;
  const { invitations, fetchInvitations } = useInvitationStore();

  // Determine current route context
  const isGroupRoute = location.pathname.startsWith('/group/');

  // Admin mode is determined by URL param (navigated from Admin Dashboard)
  const adminModeParam = searchParams.get('adminMode') === 'true';
  const isAdmin = user?.isAdmin ?? false;

  // Get the role from API, but ignore admin-elevated role when not in admin mode.
  // This ensures exiting admin mode correctly shows the user has no role for this static
  // (since isAdminAccess from API means the role was granted via admin privileges, not membership).
  const actualUserRole = (currentGroup?.isAdminAccess && !adminModeParam)
    ? null
    : currentGroup?.userRole;

  // Effective role: when viewing as someone, use their role; otherwise use actual role
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;

  // Admin access: admin mode is active when:
  // - User is an admin (user.isAdmin)
  // - adminMode=true URL param is present (navigated from Admin Dashboard)
  // - NOT viewing as another user (viewAs disables admin privileges)
  const isAdminAccess = !viewAsUser && isAdmin && adminModeParam;

  // Always show admin controls if user is admin (even without adminMode param)
  // This ensures the gear icon is visible when in admin mode or as actual owner/lead
  const isMember = userRole === 'owner' || userRole === 'lead' || userRole === 'member' || isAdmin;
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;
  const canManageInvitations = userRole === 'owner' || userRole === 'lead' || isAdminAccess;

  // Fetch invitations for Invite Members button
  useEffect(() => {
    if (isGroupRoute && currentGroup && canManageInvitations) {
      fetchInvitations(currentGroup.id);
    }
    // Only refetch when the group ID changes, not the entire object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupRoute, currentGroup?.id, canManageInvitations, fetchInvitations]);

  // Get first active invitation for quick copy
  const activeInvitation = invitations.find(inv => inv.isValid);

  // Calculate available tiers for creation
  const existingTierIds = tiers.map(t => t.tierId);
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

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

  // Handle invite members button click
  const handleInviteMembers = async () => {
    if (!currentGroup) return;

    if (activeInvitation) {
      // Copy the active invitation link
      const url = `${window.location.origin}/invite/${activeInvitation.inviteCode}`;
      try {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        toast.success('Invite link copied!');
        setTimeout(() => setInviteCopied(false), 2000);
      } catch {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setInviteCopied(true);
        toast.success('Invite link copied!');
        setTimeout(() => setInviteCopied(false), 2000);
      }
    } else {
      // No active invitation - open settings modal to invitations tab
      dispatchHeaderEvent(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS);
    }
  };

  // Dispatch custom event helper
  const dispatchHeaderEvent = useCallback((eventName: string, detail?: unknown) => {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }, []);

  // Check permissions - pass isAdminAccess for elevated admin privileges
  const tierPermission = canManageTiers(userRole, isAdminAccess);
  const groupPermission = canManageGroup(userRole, isAdminAccess);

  // Build tier actions for kebab menu
  const tierActions = useMemo(() => {
    if (!tierPermission.allowed) return [];

    return [
      {
        id: 'new-tier',
        label: 'Create New Tier',
        icon: <Plus className="w-4 h-4" />,
        shortcut: 'Alt+Shift+N',
        disabled: availableTiers.length === 0,
        tooltip: availableTiers.length === 0 ? 'All tiers have been created' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.NEW_TIER),
      },
      {
        id: 'rollover',
        label: 'Copy to New Tier',
        icon: <Copy className="w-4 h-4" />,
        shortcut: 'Alt+Shift+R',
        disabled: !currentTier || availableTiers.length === 0,
        tooltip: !currentTier ? 'Create a tier first' : availableTiers.length === 0 ? 'All tiers have been created' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.ROLLOVER),
      },
      {
        id: 'delete-tier',
        label: 'Delete Tier',
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        disabled: !currentTier || tiers.length <= 1,
        tooltip: !currentTier ? 'No tier to delete' : tiers.length <= 1 ? 'Cannot delete the last tier' : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.DELETE_TIER),
      },
    ];
  }, [tierPermission.allowed, currentTier, availableTiers.length, tiers.length, dispatchHeaderEvent]);

  return (
    <header className="sticky top-0 z-40 bg-surface-raised border-b border-border-default">
      <div className="max-w-[160rem] mx-auto px-4 py-2 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left side: Logo + Group context with breadcrumb hierarchy */}
        {/* On mobile, flex-1 allows static selector to fill available space (Invite/Share buttons hidden on mobile) */}
        <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${isGroupRoute && currentGroup ? 'flex-1 sm:flex-initial' : ''}`}>
          {/* Logo */}
          <Tooltip
            content={
              <div>
                <div className="font-medium">FFXIV Raid Planner</div>
                <div className="text-text-secondary text-xs mt-0.5">
                  Return to home page
                </div>
              </div>
            }
          >
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
          </Tooltip>

          {/* Group context (only on group pages) */}
          {isGroupRoute && currentGroup && (
            <>
              {/* Static Switcher - with left border divider on desktop */}
              <div className="hidden sm:block border-l border-border-subtle pl-3">
                <StaticSwitcher
                  currentGroup={currentGroup}
                  groups={groups}
                  onFetchGroups={fetchGroups}
                  isMember={isMember}
                  userRole={userRole ?? undefined}
                />
              </div>
              {/* Static Switcher - full width on mobile (no border) */}
              <div className="sm:hidden flex-1">
                <StaticSwitcher
                  currentGroup={currentGroup}
                  groups={groups}
                  onFetchGroups={fetchGroups}
                  isMember={isMember}
                  userRole={userRole ?? undefined}
                  fullWidthMobile
                />
              </div>

              {/* Breadcrumb separator and Tier selector - hidden on mobile */}
              {tiers.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-text-muted text-lg">›</span>
                  <TierSelector
                    tiers={tiers}
                    currentTierId={currentTier?.tierId}
                    onTierChange={(tierId) => dispatchHeaderEvent(HEADER_EVENTS.TIER_CHANGE, { tierId })}
                  />
                  {/* Tier actions kebab menu */}
                  {canEdit && tierActions.length > 0 && (
                    <TierActionsMenu actions={tierActions} />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Center: Tips carousel (hidden on mobile, shown on group pages) */}
        {isGroupRoute && currentGroup && (
          <TipsCarousel className="hidden xl:flex flex-grow justify-center max-w-md" />
        )}

        {/* Right side: Invite + Settings + Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Group controls (only on group pages) */}
          {isGroupRoute && currentGroup && (
            <>
              {/* Invite Members button (for owners/leads) - hidden on mobile */}
              {canManageInvitations && (
                <div className="hidden sm:block">
                  <Tooltip
                    content={
                      <div className="flex items-start gap-2 max-w-xs">
                        <UserPlus className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">Invite Members</div>
                          <div className="text-text-secondary text-xs mt-0.5">
                            {activeInvitation
                              ? 'Click to copy invitation link'
                              : 'Click to create an invitation link'}
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <button
                      onClick={handleInviteMembers}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 transition-colors group flex-shrink-0"
                    >
                      {inviteCopied ? (
                        <svg className="w-4 h-4 text-status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <UserPlus className="w-4 h-4 text-accent" />
                      )}
                      <span className="text-sm font-medium text-accent">
                        {inviteCopied ? 'Copied!' : 'Invite'}
                      </span>
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Share code - shown for non-managers, hidden on mobile (accessible via Controls sheet) */}
              {!canManageInvitations && (
                <div className="hidden sm:block">
                <Tooltip
                  content={
                    <div className="flex items-start gap-2 max-w-xs">
                      <Copy className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Copy Share Code</div>
                        <div className="text-text-secondary text-xs mt-0.5">
                          Click to copy code. Hold <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">Shift</kbd> for full URL with current tier.
                        </div>
                      </div>
                    </div>
                  }
                >
                  <button
                    onClick={(e) => handleCopyCode(e)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-card hover:bg-surface-interactive transition-colors group flex-shrink-0"
                  >
                    <span className="font-mono text-xs sm:text-sm text-text-secondary">{currentGroup.shareCode}</span>
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
                </Tooltip>
                </div>
              )}

              {/* Settings gear icon (opens slide-out settings panel) */}
              {groupPermission.allowed && (
                <Tooltip
                  content={
                    <div>
                      <div className="font-medium">Static Settings</div>
                      <div className="text-text-secondary text-xs mt-0.5">
                        Manage settings, members, and invitations
                      </div>
                      <div className="text-text-muted text-xs mt-1 flex gap-1">
                        <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-[10px]">Alt+G</kbd>
                        <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-[10px]">P</kbd>
                        <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-[10px]">M</kbd>
                        <kbd className="px-1.5 py-0.5 bg-surface-base rounded text-[10px]">I</kbd>
                      </div>
                    </div>
                  }
                >
                  <IconButton
                    icon={<Settings className="w-5 h-5" />}
                    onClick={() => dispatchHeaderEvent(HEADER_EVENTS.SETTINGS)}
                    variant="ghost"
                    aria-label="Static settings"
                  />
                </Tooltip>
              )}
            </>
          )}

          {/* Auth: Login button or User menu */}
          <div className={isGroupRoute && currentGroup ? 'border-l border-border-subtle pl-3' : ''}>
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-surface-interactive animate-pulse" />
            ) : user ? (
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
