/* eslint-disable design-system/no-raw-button */
/**
 * Header - Unified application header
 *
 * New layout with breadcrumb hierarchy:
 * [Logo] ─ [Static ▼] > [Tier ▼] [⋮] ─── [Invite] [⚙️] [User ▼]
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, UserPlus, Settings, Plus, Trash2, Globe, Swords } from 'lucide-react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore, useAuthHydrated } from '../../stores/authStore';
import { useViewAsStore } from '../../stores/viewAsStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { toast } from '../../stores/toastStore';
import { LoginButton, UserMenu } from '../auth';
import { StaticSwitcher, TierSelector } from '../static-group';
import { TierActionsMenu, TipsCarousel, DiscordIcon, GitHubIcon, ThemeToggle, LanguageToggle } from '../ui';
import { Tooltip, IconButton } from '../primitives';
import { RAID_TIERS } from '../../gamedata';
import { canManageTiers, canManageGroup } from '../../utils/permissions';
import { DISCORD_INVITE_URL, GITHUB_REPO_URL } from '../../config';

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
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [inviteCopied, setInviteCopied] = useState(false);

  const { currentGroup, groups, fetchGroups } = useStaticGroupStore();
  const { tiers, currentTier } = useTierStore();
  const { user, isLoading } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const { viewAsUser } = useViewAsStore();

  // Show loading state until store is hydrated from localStorage
  const authLoading = !isHydrated || isLoading;
  const { invitations, fetchInvitations } = useInvitationStore();
  const pendingJoinRequests = useJoinRequestStore((s) => s.pendingCount);

  // Determine current route context
  const isGroupRoute = location.pathname.startsWith('/group/');
  const isHomePage = location.pathname === '/';

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

  // Fetch pending join request count for badge on settings gear
  useEffect(() => {
    if (isGroupRoute && currentGroup && canManageInvitations) {
      useJoinRequestStore.getState().fetchGroupRequests(currentGroup.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupRoute, currentGroup?.id, canManageInvitations]);

  // Get first active invitation for quick copy
  const activeInvitation = invitations.find(inv => inv.isValid);

  // Calculate available tiers for creation
  const existingTierIds = tiers.map(tier => tier.tierId);
  const availableTiers = RAID_TIERS.filter(tier => !existingTierIds.includes(tier.id));

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
        label: t('header.createNewTier'),
        icon: <Plus className="w-4 h-4" />,
        shortcut: 'Alt+Shift+N',
        disabled: availableTiers.length === 0,
        tooltip: availableTiers.length === 0 ? t('header.allTiersCreated') : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.NEW_TIER),
      },
      {
        id: 'rollover',
        label: t('header.rolloverTier'),
        icon: <Copy className="w-4 h-4" />,
        shortcut: 'Alt+Shift+R',
        disabled: !currentTier || availableTiers.length === 0,
        tooltip: !currentTier ? t('header.createTierFirst') : availableTiers.length === 0 ? t('header.allTiersCreated') : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.ROLLOVER),
      },
      {
        id: 'delete-tier',
        label: t('header.deleteTier'),
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        disabled: !currentTier || tiers.length <= 1,
        tooltip: !currentTier ? t('header.noTierToDelete') : tiers.length <= 1 ? t('header.cannotDeleteLastTier') : undefined,
        onClick: () => dispatchHeaderEvent(HEADER_EVENTS.DELETE_TIER),
      },
    ];
  }, [tierPermission.allowed, currentTier, availableTiers.length, tiers.length, dispatchHeaderEvent]);

  return (
    <header className="sticky top-0 z-40 bg-surface-raised border-b border-border-default">
      <div className="max-w-[160rem] mx-auto px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 sm:gap-x-4 sm:flex-nowrap">
        {/* Left side: Logo + Group context with breadcrumb hierarchy */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo */}
          <Tooltip
            content={
              <div>
                <div className="font-medium">{t('header.logoTooltipTitle')}</div>
                <div className="text-text-secondary text-xs mt-0.5">
                  {t('header.logoTooltipDesc')}
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

          {/* Group context - desktop only (inline with logo) */}
          {isGroupRoute && currentGroup && (
            <>
              <div className="hidden sm:block border-l border-border-subtle pl-3">
                <StaticSwitcher
                  currentGroup={currentGroup}
                  groups={groups}
                  onFetchGroups={fetchGroups}
                  isMember={isMember}
                  userRole={userRole ?? undefined}
                />
              </div>

            </>
          )}

          {/* Breadcrumb separator and Tier selector - group routes only, hidden on mobile */}
          {isGroupRoute && currentGroup && tiers.length > 0 && (
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
        </div>

        {/* Center: Tips carousel (hidden on mobile, shown on group pages) */}
        {isGroupRoute && currentGroup && (
          <TipsCarousel className="hidden xl:flex flex-grow justify-center max-w-md" />
        )}

        {/* Right side: Invite + Settings + Auth */}
        <div className="flex items-center gap-1 sm:gap-3">
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
                          <div className="font-medium">{t('header.inviteMembersTitle')}</div>
                          <div className="text-text-secondary text-xs mt-0.5">
                            {activeInvitation
                              ? t('header.inviteMembersActive')
                              : t('header.inviteMembersInactive')}
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <button
                      onClick={handleInviteMembers}
                      aria-label={t('header.inviteMembersTitle')}
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
                        {inviteCopied ? t('header.inviteCopied') : t('header.inviteButton')}
                      </span>
                    </button>
                  </Tooltip>
                </div>
              )}

              {/* Settings gear icon (opens slide-out settings panel) */}
              {groupPermission.allowed && (
                <Tooltip
                  content={
                    <div>
                      <div className="font-medium">{t('header.settingsTitle')}</div>
                      <div className="text-text-secondary text-xs mt-0.5">
                        {t('header.settingsDesc')}
                        {pendingJoinRequests > 0 && ` — ${t('header.settingsPendingRequests', { count: pendingJoinRequests })}`}
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
                  <span className="relative">
                    <IconButton
                      icon={<Settings className="w-5 h-5" />}
                      onClick={() => dispatchHeaderEvent(
                        HEADER_EVENTS.SETTINGS,
                        pendingJoinRequests > 0 ? { tab: 'recruitment' } : undefined,
                      )}
                      variant="ghost"
                      aria-label={t('header.settingsTitle')}
                    />
                    {pendingJoinRequests > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-accent text-accent-contrast pointer-events-none">
                        {pendingJoinRequests}
                      </span>
                    )}
                  </span>
                </Tooltip>
              )}
            </>
          )}

          {/* External links + theme toggle — hidden on the Home page (login only there) */}
          {!isHomePage && (
            <>
              <div className="flex items-center gap-0 sm:gap-1">
                {user && (
                  <Tooltip content="Player Hub — character, jobs, gear & applications">
                    <Link
                      to="/profile"
                      aria-label="Player Hub"
                      className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:text-accent hover:bg-surface-interactive transition-colors flex-shrink-0"
                    >
                      <Swords className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Link>
                  </Tooltip>
                )}
                <Tooltip content={t('header.findAStatic')}>
                  <Link
                    to="/discover"
                    aria-label={t('header.findAStatic')}
                    className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:text-accent hover:bg-surface-interactive transition-colors flex-shrink-0"
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                </Tooltip>
                <Tooltip content={t('header.discordCommunity')}>
                  <a
                    href={DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('header.discordCommunity')}
                    className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:text-discord hover:bg-surface-interactive transition-colors flex-shrink-0"
                  >
                    <DiscordIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </a>
                </Tooltip>
                <Tooltip content={t('header.viewOnGitHub')}>
                  <a
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('header.viewOnGitHub')}
                    className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors flex-shrink-0"
                  >
                    <GitHubIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </a>
                </Tooltip>
              </div>
              {/* Language + theme toggles — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1 border-l border-border-subtle pl-3">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </>
          )}

          {/* Auth: login button or user menu */}
          <div
            className={`flex items-center gap-1 ${!isHomePage ? 'border-l border-border-subtle pl-1.5 sm:pl-3' : ''}`}
          >
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-surface-interactive animate-pulse" />
            ) : user ? (
              <UserMenu />
            ) : (
              <LoginButton className="text-sm px-3 py-1.5" />
            )}
          </div>
        </div>

        {/* Mobile second row: Static Switcher gets full width */}
        {isGroupRoute && currentGroup && (
          <div className="sm:hidden w-full">
            <StaticSwitcher
              currentGroup={currentGroup}
              groups={groups}
              onFetchGroups={fetchGroups}
              isMember={isMember}
              userRole={userRole ?? undefined}
              fullWidthMobile
            />
          </div>
        )}
      </div>
    </header>
  );
}
