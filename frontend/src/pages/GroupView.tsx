/* eslint-disable design-system/no-raw-button */
/**
 * Group View Page (legacy chrome)
 *
 * Shows a static group with its tier snapshots and roster. After the F6a split
 * (Task 3), GroupView is the *chrome* around the shared content region: it keeps
 * the legacy `SidebarNav`, the chrome-triggered modals (add-player + create /
 * rollover / delete tier), the error modal, the settings panel host, and the
 * `HEADER_EVENTS` window-bus listener — and renders `<GroupViewContent>` for the
 * content (toolbar + per-tab bodies + the rosterDndArea memo). Task 4's NewShell
 * renders the same `<GroupViewContent>` behind its own chrome; Task 8 unifies the
 * `actions` + chrome modals into a shared GroupActions context.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { toast } from '../stores/toastStore';
import { getTierById } from '../gamedata';
import { AddPlayerModal, type AddPlayerData } from '../components/player/AddPlayerModal';
import { Modal, Spinner } from '../components/ui';
import { SidebarNav } from '../components/layout/SidebarNav';
import { useDevice } from '../hooks/useDevice';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { Button, Tooltip } from '../components/primitives';
import { RolloverDialog, CreateTierModal, DeleteTierModal, JoinRequestBanner } from '../components/static-group';
import { StaticSettingsHost } from '../components/settings';
import { useSettingsPanelStore } from '../stores/settingsPanelStore';
import { AdminBanners } from '../components/admin/AdminBanners';
import { useJoinRequestStore } from '../stores/joinRequestStore';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { TRANSIENT_NAV_PARAMS } from '../lib/navPreferences';
import { HEADER_EVENTS } from '../components/layout/Header';
import { eventBus, Events } from '../lib/eventBus';
import { sortPlayersByRole } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';
import { logger } from '../lib/logger';
import { DISCORD_BUG_REPORT_URL } from '../config';
import { GroupViewContent } from './GroupViewContent';

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { currentGroup, isLoading: groupLoading, error: groupError, errorStack: groupErrorStack, fetchGroupByShareCode, clearError: clearGroupError } = useStaticGroupStore();
  const {
    tiers,
    currentTier,
    isLoading: tierLoading,
    error: tierError,
    errorStack: tierErrorStack,
    fetchTiers,
    fetchTier,
    clearTiers,
    clearError: clearTierError,
    addPlayer,
    updatePlayer,
  } = useTierStore();
  const { user, login } = useAuthStore();
  const { viewAsUser, startViewAs, stopViewAs } = useViewAsStore();

  // Use extracted state hook. GroupViewContent has its own instance for the
  // content; this chrome instance reads pageMode/setPageMode (SidebarNav),
  // gearSubTab (page-scroll), and the chrome-owned tier modal flags. The two
  // instances stay in sync through the URL-backed values.
  const state = useGroupViewState();
  const {
    searchParams,
    setSearchParams,
    pageMode,
    setPageMode,
    gearSubTab,
    sortPreset,
    setSortPresetState,
    showCreateTierModal,
    setShowCreateTierModal,
    showRolloverDialog,
    setShowRolloverDialog,
    showDeleteTierConfirm,
    setShowDeleteTierConfirm,
  } = state;

  // Device capabilities for responsive behavior
  const { isSmallScreen } = useDevice();

  const [errorCopied, setErrorCopied] = useState(false);

  // Add Player modal state
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  // Roster onboarding from join request
  const [rosteringRequest, setRosteringRequest] = useState<import('../types').JoinRequest | null>(null);

  // Handle viewAs URL parameter
  useEffect(() => {
    const viewAsUserId = searchParams.get('viewAs');
    if (viewAsUserId && currentGroup?.id && user?.isAdmin) {
      if (!viewAsUser || viewAsUser.userId !== viewAsUserId || viewAsUser.groupId !== currentGroup.id) {
        startViewAs(currentGroup.id, viewAsUserId);
      }
    } else if (!viewAsUserId && viewAsUser) {
      stopViewAs();
    }
  }, [searchParams, currentGroup?.id, user?.isAdmin, startViewAs, stopViewAs, viewAsUser]);

  // Clear stale viewAs state if group changed
  useEffect(() => {
    if (viewAsUser && currentGroup?.id && viewAsUser.groupId !== currentGroup.id) {
      stopViewAs();
    }
  }, [viewAsUser, currentGroup?.id, stopViewAs]);

  // Clean up viewAs state when unmounting
  useEffect(() => {
    return () => {
      stopViewAs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear tiers and errors when shareCode changes (switching groups)
  useEffect(() => {
    clearTiers();
    clearGroupError();
    clearTierError();
  }, [shareCode, clearTiers, clearGroupError, clearTierError]);

  // Fetch group on mount
  useEffect(() => {
    if (shareCode) {
      fetchGroupByShareCode(shareCode);
    }
  }, [shareCode, fetchGroupByShareCode]);

  // Track recently accessed statics in localStorage
  useEffect(() => {
    if (!shareCode) return;
    try {
      const MAX_RECENT = 10;
      const saved = localStorage.getItem('recent-statics');
      const recent: string[] = saved ? JSON.parse(saved) : [];
      const filtered = recent.filter(code => code !== shareCode);
      const updated = [shareCode, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem('recent-statics', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }, [shareCode]);

  // Persist this static's navigation state (tab + sub-tabs, minus transient
  // params) so the context switcher can restore it when the user enables
  // "remember tab per static". Keyed by share code — the unit it navigates by.
  // When that preference is OFF, the switcher instead carries the current tab
  // across, and when it's ON it reads this. Either way no forced reset here.
  useEffect(() => {
    if (!currentGroup?.shareCode) return;
    try {
      const params = new URLSearchParams(searchParams);
      TRANSIENT_NAV_PARAMS.forEach(k => params.delete(k));
      localStorage.setItem(`static-nav-${currentGroup.shareCode}`, params.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, [searchParams, currentGroup?.shareCode]);

  // Load sortPreset from localStorage when tier changes.
  // Duplicated for chrome; Task 8 removes — chrome needs sortPreset to derive the
  // same sorted `mainRosterPlayers` it passes to the settings panel as the content.
  useEffect(() => {
    if (!currentTier?.tierId) return;
    const urlSort = searchParams.get('sort');
    if (urlSort === 'standard' || urlSort === 'dps-first' || urlSort === 'healer-first' || urlSort === 'custom') {
      return;
    }
    try {
      const saved = localStorage.getItem(`sort-preset-${currentTier.tierId}`);
      if (saved === 'standard' || saved === 'dps-first' || saved === 'healer-first' || saved === 'custom') {
        setSortPresetState(saved);
      } else {
        setSortPresetState('standard');
      }
    } catch {
      setSortPresetState('standard');
    }
  }, [currentTier?.tierId, searchParams, setSortPresetState]);

  // Fetch tiers and load tier (from URL, localStorage, or active) sequentially
  useEffect(() => {
    if (!currentGroup?.id) return;
    let cancelled = false;
    const log = logger.scope('TierSelection');
    (async () => {
      await fetchTiers(currentGroup.id);
      if (cancelled) return;
      const { tiers: freshTiers } = useTierStore.getState();
      if (freshTiers.length === 0) return;
      const urlTierId = searchParams.get('tier');
      const urlTier = urlTierId ? freshTiers.find(t => t.tierId === urlTierId) : null;
      const savedTierId = localStorage.getItem(`selected-tier-${currentGroup.id}`);
      const savedTier = savedTierId ? freshTiers.find(t => t.tierId === savedTierId) : null;
      const activeTier = urlTier || savedTier || freshTiers.find(t => t.isActive) || freshTiers[0];
      const selectionSource = urlTier ? 'URL' : savedTier ? 'localStorage' : freshTiers.find(t => t.isActive) ? 'isActive' : 'fallback';
      log.debug(`Selected tier: ${activeTier?.tierId} (source: ${selectionSource})`);
      if (activeTier) {
        await fetchTier(currentGroup.id, activeTier.tierId);
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          params.set('tier', activeTier.tierId);
          return params;
        }, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [currentGroup?.id, fetchTiers, fetchTier, searchParams, setSearchParams]);

  const handleTierChange = useCallback((tierId: string) => {
    if (currentGroup?.id) {
      try {
        localStorage.setItem(`selected-tier-${currentGroup.id}`, tierId);
      } catch {
        // Ignore localStorage errors
      }
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.set('tier', tierId);
        return params;
      }, { replace: true });
      fetchTier(currentGroup.id, tierId);
    }
  }, [currentGroup?.id, fetchTier, setSearchParams]);

  const handleTierDeleted = async () => {
    if (!currentGroup?.id) return;
    const { tiers: freshTiers } = useTierStore.getState();
    if (freshTiers.length > 0) {
      const nextTier = freshTiers.find(t => t.isActive) || freshTiers[0];
      if (nextTier) {
        await fetchTier(currentGroup.id, nextTier.tierId);
      }
    }
  };

  // Admin access only when navigating from Admin Dashboard with adminMode=true
  const adminModeParam = searchParams.get('adminMode') === 'true';
  const isAdmin = user?.isAdmin ?? false; // Separate flag for admin features (always true for admins)
  const isAdminAccess = !viewAsUser && isAdmin && adminModeParam;

  // Get the role from API, but ignore admin-elevated role when not in admin mode.
  const actualUserRole = (currentGroup?.isAdminAccess && !adminModeParam)
    ? null
    : currentGroup?.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;

  // Handler for Add Player modal submission
  const { linkRoster } = useJoinRequestStore();

  const handleAddPlayerSubmit = useCallback(async (data: AddPlayerData) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;

    setIsAddingPlayer(true);
    try {
      // Create the player
      const newPlayer = await addPlayer(currentGroup.id, currentTier.tierId);

      // Build update payload — enriched with character identity when rostering from application
      const updatePayload: Record<string, unknown> = {
        name: data.name,
        job: data.job,
        role: data.role,
        position: data.position,
        tankRole: data.tankRole,
        configured: true,
      };

      const req = rosteringRequest;
      if (req) {
        if (req.characterNameAtApply) updatePayload.lodestoneName = req.characterNameAtApply;
        if (req.characterWorldAtApply) updatePayload.lodestoneServer = req.characterWorldAtApply;
        if (req.characterAvatarUrlAtApply) updatePayload.lodestoneAvatarUrl = req.characterAvatarUrlAtApply;
        if (req.characterLodestoneIdAtApply) updatePayload.lodestoneId = req.characterLodestoneIdAtApply;
      }

      await updatePlayer(currentGroup.id, currentTier.tierId, newPlayer.id, updatePayload);

      if (req) {
        try {
          await linkRoster(req.id, newPlayer.id);
        } catch {
          toast.warning('Roster entry created, but the request was not linked. You can retry linking from the Requests tab.');
        }
        setRosteringRequest(null);
      }

      // Scroll to + highlight the new player. The highlight state lives in
      // GroupViewContent (content), so signal it via the event bus across the
      // F6a split (mirrors the deep-link highlight; Task 8 unifies this).
      eventBus.emit(Events.PLAYER_ADDED, { playerId: newPlayer.id });

      toast.success(`Added ${data.name} to the roster`);
    } catch {
      // Error handled in store
    } finally {
      setIsAddingPlayer(false);
    }
  }, [currentGroup?.id, currentTier?.tierId, addPlayer, updatePlayer, rosteringRequest, linkRoster]);

  // Listen for header events (unchanged window-bus listener — Task 8 replaces it
  // with the typed GroupActions context).
  useEffect(() => {
    const handleTierChangeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tierId) {
        handleTierChange(detail.tierId);
      }
    };
    const handleAddPlayerEvent = () => { setShowAddPlayerModal(true); };
    const handleNewTierEvent = () => { setShowCreateTierModal(true); };
    const handleRolloverEvent = () => { setShowRolloverDialog(true); };
    const handleDeleteTierEvent = () => { setShowDeleteTierConfirm(true); };
    // Settings open/close is handled by settingsPanelStore (gear/dock toggle and
    // the SettingsPanelController bridge), so GroupView no longer listens for it.

    window.addEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
    window.addEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
    window.addEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
    window.addEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
    window.addEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    // Note: 'show-keyboard-shortcuts' listener is in Layout.tsx for global access

    return () => {
      window.removeEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
      window.removeEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
      window.removeEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
      window.removeEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
      window.removeEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    };
  }, [handleTierChange, setShowCreateTierModal, setShowRolloverDialog, setShowDeleteTierConfirm]);

  // Sorted main-roster players — duplicated for chrome; Task 8 removes. The
  // settings panel (StaticSettingsHost.players) needs the same sorted set the
  // content passes, so derive it identically here.
  const sortedPlayers = useMemo(() => {
    if (!currentTier?.players) return [];
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(currentTier.players, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);
  const mainRosterPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.configured && !p.isSubstitute);
  }, [sortedPlayers]);

  const isLoading = groupLoading || tierLoading;
  const error = groupError || tierError;
  // Match errorStack to whichever error is being displayed
  const errorStack = error === groupError ? groupErrorStack : tierErrorStack;

  // Reset errorCopied when error clears (modal closes)
  useEffect(() => {
    if (!error) setErrorCopied(false);
  }, [error]);

  const existingTierIds = tiers.map(t => t.tierId);

  // Stable callback for StaticSettingsHost (accepted join request → roster add).
  const handleAddToRoster = useCallback((request: import('../types').JoinRequest) => {
    if (request.rosterPlayerId) {
      toast.info('Already added to roster');
      return;
    }
    if (!currentTier?.tierId) {
      toast.error('Create a tier first before adding to roster.');
      return;
    }
    useSettingsPanelStore.getState().close();
    setRosteringRequest(request);
    setShowAddPlayerModal(true);
  }, [currentTier?.tierId]);

  // Helper to format error details for display and copying
  const formatErrorDetails = useCallback((errorMessage: string | null, stack: string | null) => {
    return [
      `Error: ${errorMessage}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
      stack ? `\nStack Trace:\n${stack}` : '',
    ].filter(Boolean).join('\n');
  }, []);

  // Helper to dismiss error
  const handleDismissError = useCallback(() => {
    clearGroupError();
    clearTierError();
    setErrorCopied(false);
  }, [clearGroupError, clearTierError]);

  // Helper to copy error to clipboard
  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(formatErrorDetails(error, errorStack));
      setErrorCopied(true);
      setTimeout(() => setErrorCopied(false), 2000);
    }
  }, [error, errorStack, formatErrorDetails]);

  // Loading state
  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" label="Loading static" />
      </div>
    );
  }

  // Error state - show full page only if no content exists, otherwise show modal overlay
  if (error && !currentGroup) {
    const isPrivateGroupError = error.toLowerCase().includes('private');
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className={`${isPrivateGroupError ? 'bg-accent/10 border-accent/30' : 'bg-status-error/10 border-status-error/30'} border rounded-lg p-6 text-center`}>
          <h2 className={`text-xl font-display mb-2 ${isPrivateGroupError ? 'text-accent' : 'text-status-error'}`}>
            {isPrivateGroupError ? 'Private Static' : 'Error'}
          </h2>
          <p className="text-text-secondary mb-4">
            {isPrivateGroupError
              ? 'This static is private. Please log in to view it.'
              : error
            }
          </p>
          <div className="flex gap-3 justify-center">
            {isPrivateGroupError && !user && (
              <Button onClick={() => login()}>
                Log In with Discord
              </Button>
            )}
            <Button
              variant={isPrivateGroupError && !user ? 'secondary' : 'primary'}
              onClick={() => navigate('/profile?tab=statics')}
            >
              Go to My Statics
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-display text-accent mb-2">Group Not Found</h2>
          <p className="text-text-muted">The static group you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Prevent page scroll for Gear/History sub-tab (internal scroll only)
  // On mobile: also prevent for Gear Priority sub-tab
  const preventPageScroll = (pageMode === 'gear' && gearSubTab === 'history') ||
    (isSmallScreen && pageMode === 'gear' && gearSubTab === 'priority');

  // Build container classes (extracted for readability)
  // Always flex-col so the sidebar+content shell can fill remaining height without sticky hacks.
  const containerClasses = [
    'max-w-[160rem] mx-auto px-4 w-full flex-1 min-h-0 flex flex-col',
    isSmallScreen && 'has-bottom-nav',
    preventPageScroll && 'prevent-page-scroll overflow-hidden',
    preventPageScroll && isSmallScreen && 'h-[calc(100dvh-var(--layout-chrome))] overscroll-contain pb-4',
  ].filter(Boolean).join(' ');

  // Chrome-owned modal open-state, fed into GroupViewContent so opening a chrome
  // modal still disables the content keyboard shortcuts + DnD (Task 8 unifies).
  const chromeModalOpen = showAddPlayerModal || showCreateTierModal || showRolloverDialog || showDeleteTierConfirm;

  return (
    <div className={containerClasses}>
      {/* No tiers state */}
      {tiers.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-surface-card rounded-lg border border-border-default">
          <h2 className="text-xl font-display text-accent mb-2">No Raid Tiers</h2>
          <p className="text-text-muted mb-6">
            Create your first tier snapshot to start tracking gear progress.
          </p>
          {canEdit && (
            <Button onClick={() => setShowCreateTierModal(true)}>
              Create First Tier
            </Button>
          )}
        </div>
      )}

      {/* Admin access banner (View As banner is in Layout) */}
      <AdminBanners
        isAdminAccess={isAdminAccess}
        onExitAdminMode={() => {
          // Refetch group to get correct permissions without admin elevation
          if (shareCode) {
            fetchGroupByShareCode(shareCode);
          }
        }}
      />

      {/* Join request banner for non-members viewing a discoverable static.
          The banner supplies its own bottom margin only when it renders, so
          members (where it returns null) don't get phantom spacing pushing
          the content down. */}
      {currentGroup && (
        <JoinRequestBanner
          shareCode={currentGroup.shareCode}
          staticName={currentGroup.name}
          groupId={currentGroup.id}
          settings={currentGroup.settings}
          userRole={userRole}
        />
      )}

      {/* Content when tier exists — sidebar + content shell */}
      {currentTier && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <SidebarNav activeTab={pageMode} onTabChange={setPageMode} staticName={currentGroup?.name} />
          <GroupViewContent
            actions={{
              onTierChange: handleTierChange,
              onAddPlayer: () => setShowAddPlayerModal(true),
              onNewTier: () => setShowCreateTierModal(true),
              onRollover: () => setShowRolloverDialog(true),
              onDeleteTier: () => setShowDeleteTierConfirm(true),
            }}
            chromeModalOpen={chromeModalOpen}
          />
        </div>
      )}

      {/* Create Tier Modal */}
      {showCreateTierModal && currentGroup && (
        <CreateTierModal
          groupId={currentGroup.id}
          existingTierIds={existingTierIds}
          onClose={() => setShowCreateTierModal(false)}
          onCreate={() => setPageMode('roster')}
        />
      )}

      {/* Add Player Modal */}
      <AddPlayerModal
        isOpen={showAddPlayerModal}
        onClose={() => { setShowAddPlayerModal(false); setRosteringRequest(null); }}
        onAdd={handleAddPlayerSubmit}
        isLoading={isAddingPlayer}
        initialName={rosteringRequest?.characterNameAtApply || rosteringRequest?.requester?.displayName}
        initialJob={rosteringRequest?.selectedJob?.toUpperCase()}
        contextLabel={rosteringRequest ? 'Adding from application' : undefined}
        tierName={currentTier?.tierId ? getTierById(currentTier.tierId)?.name : undefined}
      />

      {/* Settings Panel — subscribes to settingsPanelStore for open-state, so
          toggling it never re-renders GroupView / the roster. */}
      {currentGroup && (
        <StaticSettingsHost
          group={currentGroup}
          players={mainRosterPlayers}
          tierId={currentTier?.tierId}
          isAdmin={isAdmin}
          onAddToRoster={handleAddToRoster}
        />
      )}

      {/* Rollover Dialog */}
      {showRolloverDialog && currentGroup && currentTier && (
        <RolloverDialog
          groupId={currentGroup.id}
          currentTier={currentTier}
          existingTierIds={existingTierIds}
          onClose={() => setShowRolloverDialog(false)}
        />
      )}

      {/* Delete Tier Confirmation */}
      {showDeleteTierConfirm && currentGroup && currentTier && (
        <DeleteTierModal
          groupId={currentGroup.id}
          tierSnapshotId={currentTier.id}
          tierId={currentTier.tierId}
          onClose={() => setShowDeleteTierConfirm(false)}
          onDeleted={handleTierDeleted}
        />
      )}

      {/* Error Modal - shown as overlay when page content exists */}
      <Modal
        isOpen={!!error && !!currentGroup}
        onClose={handleDismissError}
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-error" />
            <span className="text-status-error">Error</span>
          </span>
        }
        size="lg"
      >
        <div className="space-y-4">
          {/* Main error message */}
          <p className="text-text-primary text-center text-lg">{error}</p>

          {/* Technical details with label and copy button */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted uppercase tracking-wide">Technical Details</span>
              <Tooltip content={errorCopied ? "Copied to clipboard" : "Copy error details"}>
                <button
                  type="button"
                  onClick={handleCopyError}
                  aria-label={errorCopied ? "Copied to clipboard" : "Copy error details"}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-surface-elevated hover:bg-black/20 border border-border-default transition-colors"
                >
                  {errorCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-status-success" />
                      <span className="text-status-success">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-text-muted">Copy</span>
                    </>
                  )}
                </button>
              </Tooltip>
            </div>
            <pre className="bg-surface-elevated border border-border-default rounded-lg p-3 text-xs text-text-muted overflow-x-auto max-h-32">
              <code>{formatErrorDetails(error, errorStack)}</code>
            </pre>
          </div>

          {/* Report Bug button - centered, users can use X or Esc to dismiss */}
          <div className="flex justify-center pt-2">
            <a
              href={DISCORD_BUG_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-discord hover:bg-discord-hover text-white font-medium rounded transition-colors"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Report Bug
            </a>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Help is now rendered in Layout.tsx for global access */}
    </div>
  );
}
