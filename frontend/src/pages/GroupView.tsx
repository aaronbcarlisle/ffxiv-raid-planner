/**
 * Group View Page
 *
 * Shows a static group with its tier snapshots and roster.
 * Full integration with PlayerCard components, DnD, loot/stats tabs.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { toast } from '../stores/toastStore';
import { getTierById } from '../gamedata';
import { DragOverlayCard } from '../components/player/DragOverlayCard';
import { PlayerGrid } from '../components/player/PlayerGrid';
import { RosterViewToggle } from '../components/player/RosterViewToggle';
import { useDragAndDrop } from '../components/dnd/useDragAndDrop';
import { LootPriorityPanel } from '../components/loot';
import { TeamSummaryEnhanced } from '../components/team/TeamSummaryEnhanced';
import { HistoryView } from '../components/history/HistoryView';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle, Spinner, Modal, MobileBottomNav } from '../components/ui';
import { useDevice } from '../hooks/useDevice';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { Button, Tooltip } from '../components/primitives';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal, TierSelector } from '../components/static-group';
import { AdminBanners } from '../components/admin/AdminBanners';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { usePlayerActions } from '../hooks/usePlayerActions';
import { useGroupViewKeyboardShortcuts } from '../hooks/useGroupViewKeyboardShortcuts';
import { useViewNavigation } from '../hooks/useViewNavigation';
import { HEADER_EVENTS } from '../components/layout/Header';
import { useEventBus, Events } from '../lib/eventBus';
import { sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';
import { canManageRoster } from '../utils/permissions';
import { logger } from '../lib/logger';
import { DISCORD_BUG_REPORT_URL } from '../config';
import type { SnapshotPlayer, GearSlot, SortPreset } from '../types';

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { currentGroup, groups, isLoading: groupLoading, error: groupError, errorStack: groupErrorStack, fetchGroupByShareCode, clearError: clearGroupError } = useStaticGroupStore();
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
  } = useTierStore();
  const { user, login } = useAuthStore();
  const { viewAsUser, startViewAs, stopViewAs } = useViewAsStore();

  // Use extracted state hook
  const state = useGroupViewState();
  const {
    searchParams,
    setSearchParams,
    pageMode,
    setPageMode,
    lootSubTab,
    setLootSubTab,
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    setGroupViewState,
    subsView,
    setSubsView,
    selectedFloor,
    setSelectedFloor,
    sortPreset,
    setSortPreset,
    setSortPresetState,
    editingPlayerId,
    setEditingPlayerId,
    clipboardPlayer,
    setClipboardPlayer,
    showCreateTierModal,
    setShowCreateTierModal,
    showSettingsModal,
    setShowSettingsModal,
    showRolloverDialog,
    setShowRolloverDialog,
    showDeleteTierConfirm,
    setShowDeleteTierConfirm,
    showKeyboardHelp,
    setShowKeyboardHelp,
    showLogLootModal,
    setShowLogLootModal,
    showLogMaterialModal,
    setShowLogMaterialModal,
    showMarkFloorClearedModal,
    setShowMarkFloorClearedModal,
    playerModalCount,
    setPlayerModalCount,
    highlightedPlayerId,
    setHighlightedPlayerId,
    highlightedEntry,
    setHighlightedEntry,
    highlightedBookPlayerId,
    setHighlightedBookPlayerId,
  } = state;

  // Device capabilities for responsive behavior
  const { isSmallScreen } = useDevice();

  // Settings modal options (for opening to specific tab with highlight)
  const [settingsModalTab, setSettingsModalTab] = useState<'general' | 'priority' | 'members' | 'invitations'>('general');
  const [highlightCreateInvite, setHighlightCreateInvite] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);
  const [showControlsSheet, setShowControlsSheet] = useState(false);


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

  // Smart tab defaulting: reset to Roster when switching statics
  useEffect(() => {
    if (!currentGroup?.id) return;
    try {
      const lastStaticId = localStorage.getItem('last-static-id');
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get('tab');
      if (lastStaticId && lastStaticId !== currentGroup.id && !urlTab) {
        setPageMode('players');
      }
      localStorage.setItem('last-static-id', currentGroup.id);
    } catch {
      // Ignore localStorage errors
    }
  }, [currentGroup?.id, setPageMode]);

  // Load sortPreset from localStorage when tier changes
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

  // Load groupView (G1/G2) from localStorage when group changes
  useEffect(() => {
    if (!currentGroup?.id) return;
    const urlGroups = searchParams.get('groups');
    // Only load from localStorage if no URL param is set
    if (urlGroups === 'true' || urlGroups === 'false') {
      return;
    }
    try {
      const saved = localStorage.getItem(`group-view-groups-${currentGroup.id}`);
      if (saved === 'true') {
        setGroupViewState(true);
      } else if (saved === 'false') {
        setGroupViewState(false);
      } else {
        // Default to true (ON) for new statics
        setGroupViewState(true);
      }
    } catch {
      setGroupViewState(true);
    }
  }, [currentGroup?.id, searchParams, setGroupViewState]);

  // Handle player deep link - scroll to and highlight player
  useEffect(() => {
    const playerParam = searchParams.get('player');
    if (!playerParam || !currentTier?.players) return;
    const player = currentTier.players.find(p => p.id === playerParam);
    if (!player) return;
    setHighlightedPlayerId(playerParam);
    setTimeout(() => {
      const element = document.getElementById(`player-card-${playerParam}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    const timer = setTimeout(() => {
      setHighlightedPlayerId(null);
      setSearchParams(prev => {
        const params = new URLSearchParams(prev);
        params.delete('player');
        return params;
      }, { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [searchParams, currentTier?.players, setSearchParams, setHighlightedPlayerId]);

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

  // Refresh tier data when member roles change (updates linkedUser.membershipRole on player cards)
  useEventBus<{ groupId: string; userId: string; role: string }>(
    Events.MEMBER_ROLE_CHANGED,
    useCallback((data) => {
      if (currentGroup?.id === data.groupId && currentTier?.tierId) {
        fetchTier(currentGroup.id, currentTier.tierId);
      }
    }, [currentGroup?.id, currentTier?.tierId, fetchTier])
  );

  // Initialize loot tracking store when Loot or Players tab is active
  const { currentWeek: storeCurrentWeek, maxWeek: storeMaxWeek, fetchCurrentWeek, fetchLootLog, lootLog, fetchMaterialLog, materialLog } = useLootTrackingStore();
  useEffect(() => {
    if ((pageMode === 'loot' || pageMode === 'players') && currentGroup?.id && currentTier?.tierId) {
      fetchCurrentWeek(currentGroup.id, currentTier.tierId);
      fetchLootLog(currentGroup.id, currentTier.tierId);
      fetchMaterialLog(currentGroup.id, currentTier.tierId);
    }
  }, [pageMode, currentGroup?.id, currentTier?.tierId, fetchCurrentWeek, fetchLootLog, fetchMaterialLog]);

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
  // This ensures exiting admin mode correctly shows the user has no role for this static.
  const actualUserRole = (currentGroup?.isAdminAccess && !adminModeParam)
    ? null
    : currentGroup?.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  const canEdit = userRole === 'owner' || userRole === 'lead' || isAdminAccess;
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // Memoize setSortPreset wrapper to prevent unnecessary re-renders
  const setSortPresetWithTier = useCallback(
    (preset: SortPreset) => setSortPreset(preset, currentTier?.tierId),
    [setSortPreset, currentTier?.tierId]
  );

  // Use extracted player actions hook
  const playerActions = usePlayerActions({
    groupId: currentGroup?.id,
    tierId: currentTier?.tierId,
    players: currentTier?.players,
    setEditingPlayerId,
    setSortPreset: setSortPresetWithTier,
  });

  // Extract handleAddPlayer for stable effect dependency
  const { handleAddPlayer } = playerActions;

  // Use extracted navigation hook
  const { handleNavigateToPlayer, handleNavigateToLootEntry, handleNavigateToMaterialEntry, handleNavigateToBooksPanel } = useViewNavigation({
    setPageMode,
    setHighlightedPlayerId,
    setHighlightedEntry,
    setHighlightedBookPlayerId,
    lootLog,
    materialLog,
  });

  // Listen for header events
  useEffect(() => {
    const handleTierChangeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tierId) {
        handleTierChange(detail.tierId);
      }
    };
    const handleAddPlayerEvent = () => { handleAddPlayer(); };
    const handleNewTierEvent = () => { setShowCreateTierModal(true); };
    const handleRolloverEvent = () => { setShowRolloverDialog(true); };
    const handleSettingsEvent = () => {
      setSettingsModalTab('general');
      setHighlightCreateInvite(false);
      setShowSettingsModal(true);
    };
    const handleOpenSettingsInvitationsEvent = () => {
      setSettingsModalTab('invitations');
      setHighlightCreateInvite(true);
      setShowSettingsModal(true);
    };
    const handleDeleteTierEvent = () => { setShowDeleteTierConfirm(true); };

    window.addEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
    window.addEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
    window.addEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
    window.addEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
    window.addEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
    window.addEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, handleOpenSettingsInvitationsEvent);
    window.addEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    // Note: 'show-keyboard-shortcuts' listener is in Layout.tsx for global access

    return () => {
      window.removeEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
      window.removeEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
      window.removeEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
      window.removeEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
      window.removeEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
      window.removeEventListener(HEADER_EVENTS.OPEN_SETTINGS_INVITATIONS, handleOpenSettingsInvitationsEvent);
      window.removeEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    };
  }, [handleTierChange, handleAddPlayer, setShowCreateTierModal, setShowRolloverDialog, setShowSettingsModal, setShowDeleteTierConfirm]);

  // Calculate sorted players
  const sortedPlayers = useMemo(() => {
    if (!currentTier?.players) return [];
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(currentTier.players, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);

  // Check if current user has already claimed a player in this tier
  const userHasClaimedPlayer = useMemo(() => {
    const checkUserId = viewAsUser ? viewAsUser.userId : user?.id;
    if (!checkUserId || !currentTier?.players) return false;
    return currentTier.players.some(p => p.userId === checkUserId);
  }, [viewAsUser, user?.id, currentTier?.players]);

  // Group players by light party when group view is enabled
  const groupedPlayers = useMemo(() => {
    if (!groupView) return null;
    return groupPlayersByLightParty(sortedPlayers, subsView);
  }, [groupView, sortedPlayers, subsView]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter(p => p.configured && p.position).length >= 2;

  // Check if any substitutes exist
  const hasSubstitutes = useMemo(() => {
    return sortedPlayers.some(p => p.isSubstitute);
  }, [sortedPlayers]);

  // Main roster players (configured and not substitutes)
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

  // Get tier info for display
  const tierInfo = currentTier ? getTierById(currentTier.tierId) : null;
  const existingTierIds = tiers.map(t => t.tierId);

  // Check roster management permission for DnD
  const rosterPermission = canManageRoster(userRole, isAdminAccess);

  // Compute which slots have loot entries for each player
  const playerSlotsWithLootEntries = useMemo(() => {
    const map = new Map<string, Set<GearSlot>>();
    for (const entry of lootLog) {
      const existing = map.get(entry.recipientPlayerId) ?? new Set<GearSlot>();
      existing.add(entry.itemSlot as GearSlot);
      map.set(entry.recipientPlayerId, existing);
    }
    return map;
  }, [lootLog]);

  // Compute which slots have material entries for each player (for tome slot navigation)
  const playerSlotsWithMaterialEntries = useMemo(() => {
    const map = new Map<string, Set<GearSlot | 'tome_weapon'>>();
    for (const entry of materialLog) {
      if (entry.slotAugmented) {
        const existing = map.get(entry.recipientPlayerId) ?? new Set<GearSlot | 'tome_weapon'>();
        existing.add(entry.slotAugmented);
        map.set(entry.recipientPlayerId, existing);
      }
    }
    return map;
  }, [materialLog]);

  // Check if any modal is open (including error modal)
  const isErrorModalOpen = !!error && !!currentGroup;
  const isAnyModalOpen = showSettingsModal || showRolloverDialog ||
                          showDeleteTierConfirm || showCreateTierModal ||
                          showKeyboardHelp || showLogLootModal ||
                          showLogMaterialModal || showMarkFloorClearedModal ||
                          isErrorModalOpen ||
                          playerModalCount > 0;

  // Use extracted keyboard shortcuts hook
  useGroupViewKeyboardShortcuts({
    pageMode,
    setPageMode,
    lootSubTab,
    setLootSubTab,
    viewMode,
    setViewMode,
    groupView,
    setGroupView,
    subsView,
    setSubsView,
    hasSubstitutes,
    canEdit,
    currentTier,
    groups,
    currentGroup,
    tiers,
    navigate,
    setShowKeyboardHelp,
    setEditingPlayerId,
    setHighlightedPlayerId,
    setShowLogLootModal,
    setShowLogMaterialModal,
    setShowMarkFloorClearedModal,
  }, isAnyModalOpen);

  // Modal callbacks for PlayerCards
  const handlePlayerModalOpen = useCallback(() => {
    setPlayerModalCount(prev => prev + 1);
  }, [setPlayerModalCount]);

  const handlePlayerModalClose = useCallback(() => {
    setPlayerModalCount(prev => Math.max(0, prev - 1));
  }, [setPlayerModalCount]);

  // DnD hook - disabled on mobile (touch DnD is awkward)
  const dnd = useDragAndDrop({
    players: sortedPlayers,
    groupView,
    canEdit,
    disabled: isAnyModalOpen || !rosterPermission.allowed || isSmallScreen,
    onReorder: playerActions.handleReorder,
  });

  // Clipboard handlers for PlayerGrid
  const handleCopyPlayer = useCallback((player: SnapshotPlayer) => {
    setClipboardPlayer(player);
  }, [setClipboardPlayer]);

  const handlePastePlayer = useCallback((playerId: string, sourcePlayer: SnapshotPlayer) => {
    playerActions.handleUpdatePlayer(playerId, {
      job: sourcePlayer.job,
      role: sourcePlayer.role,
      gear: sourcePlayer.gear,
      tomeWeapon: sourcePlayer.tomeWeapon,
      isSubstitute: sourcePlayer.isSubstitute,
      notes: sourcePlayer.notes,
      bisLink: sourcePlayer.bisLink,
    });
  }, [playerActions]);

  const handleCopyUrl = useCallback((playerId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'players');
    url.searchParams.set('player', playerId);
    navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, []);

  // Helper to format error details for display and copying
  const formatErrorDetails = useCallback((errorMessage: string | null, stack: string | null) => {
    return [
      `Error: ${errorMessage}`,
      `URL: ${window.location.href}`,
      `Timestamp: ${new Date().toISOString()}`,
      stack ? `\nStack Trace:\n${stack}` : '',
    ].filter(Boolean).join('\n');
  }, []);

  // Helper to dismiss error - must be before early returns to satisfy React hooks rules
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
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
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

  // Prevent page scroll for History/Log tab (internal scroll only)
  // On mobile: also prevent for Loot tab
  const preventPageScroll = pageMode === 'history' || (isSmallScreen && pageMode === 'loot');

  // Build container classes (extracted for readability)
  const containerClasses = [
    'max-w-[160rem] mx-auto px-4 w-full',
    isSmallScreen && 'has-bottom-nav',
    preventPageScroll && 'prevent-page-scroll flex-1 min-h-0 flex flex-col overflow-hidden',
    preventPageScroll && isSmallScreen && 'h-[calc(100dvh-var(--layout-chrome))] overscroll-contain pb-4',
  ].filter(Boolean).join(' ');

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

      {/* Content when tier exists */}
      {currentTier && (
        <>
          {/* Toolbar: Tabs + Context Controls */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3 ${preventPageScroll ? 'flex-shrink-0' : ''}`}>
            {/* TabNavigation - hidden on mobile, MobileBottomNav used instead */}
            <div className="hidden sm:block">
              <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />
            </div>
            {/* Roster tab controls - only render when on players tab */}
            {pageMode === 'players' && (
              <>
                {/* Desktop controls - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-3">
                  <SortModeSelector
                    sortPreset={sortPreset}
                    onPresetChange={setSortPresetWithTier}
                  />
                  <GroupViewToggle
                    enabled={groupView}
                    onToggle={(enabled) => setGroupView(enabled, currentGroup?.id)}
                    disabled={!hasPositionData}
                  />
                  {hasSubstitutes && (
                    <Tooltip
                      content={
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <div>
                            <div className="flex items-center gap-2 font-medium">
                              {subsView ? 'Hide Substitutes Section' : 'Show Substitutes Section'}
                              <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">S</kbd>
                            </div>
                            <div className="text-text-secondary text-xs mt-0.5">
                              {subsView ? 'Merge subs back into main roster' : 'Separate substitute players into their own section'}
                            </div>
                          </div>
                        </div>
                      }
                    >
                      {/* design-system-ignore: Toggle button requires specific toggle styling */}
                      <button
                        onClick={() => setSubsView(!subsView)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                          subsView
                            ? 'bg-accent/20 text-accent border-accent/50'
                            : 'bg-surface-raised border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                        }`}
                        aria-label={subsView ? 'Show substitutes with main roster' : 'Separate substitute players into their own section'}
                        aria-pressed={subsView}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Subs</span>
                      </button>
                    </Tooltip>
                  )}
                  <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                </div>
              </>
            )}
          </div>

          {/* Players Tab */}
          {pageMode === 'players' && currentTier.players && (
            <>
              <DndContext
                sensors={dnd.sensors}
                collisionDetection={pointerWithin}
                onDragStart={dnd.handleDragStart}
                onDragOver={dnd.handleDragOver}
                onDragEnd={dnd.handleDragEnd}
                onDragCancel={dnd.handleDragCancel}
              >
                <PlayerGrid
                  players={sortedPlayers}
                  groupedPlayers={groupedPlayers}
                  groupView={groupView}
                  subsView={subsView}
                  viewMode={viewMode}
                  contentType={currentTier?.contentType ?? 'savage'}
                  editingPlayerId={editingPlayerId}
                  clipboardPlayer={clipboardPlayer}
                  highlightedPlayerId={highlightedPlayerId}
                  dragState={dnd.dragState}
                  canEdit={canEdit}
                  effectiveUserId={effectiveUserId}
                  userRole={userRole}
                  userHasClaimedPlayer={userHasClaimedPlayer}
                  isAdminAccess={isAdminAccess}
                  isAdmin={isAdmin}
                  viewAsUserId={viewAsUser?.userId}
                  hideSetupBanners={currentGroup?.settings?.hideSetupBanners}
                  hideBisBanners={currentGroup?.settings?.hideBisBanners}
                  groupId={currentGroup!.id}
                  tierId={currentTier!.tierId}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries}
                  playerSlotsWithMaterialEntries={playerSlotsWithMaterialEntries}
                  onUpdatePlayer={playerActions.handleUpdatePlayer}
                  onRemovePlayer={playerActions.handleRemovePlayer}
                  onConfigurePlayer={playerActions.handleConfigurePlayer}
                  onDuplicatePlayer={playerActions.handleDuplicatePlayer}
                  onResetGear={playerActions.handleResetGear}
                  onClaimPlayer={playerActions.handleClaimPlayer}
                  onReleasePlayer={playerActions.handleReleasePlayer}
                  onAdminAssignPlayer={playerActions.handleAdminAssignPlayer}
                  onOwnerAssignPlayer={playerActions.handleOwnerAssignPlayer}
                  onCopyPlayer={handleCopyPlayer}
                  onPastePlayer={handlePastePlayer}
                  onCopyUrl={handleCopyUrl}
                  onNavigateToLootEntry={handleNavigateToLootEntry}
                  onNavigateToMaterialEntry={handleNavigateToMaterialEntry}
                  onNavigateToBooksPanel={handleNavigateToBooksPanel}
                  onModalOpen={handlePlayerModalOpen}
                  onModalClose={handlePlayerModalClose}
                  onEditPlayer={setEditingPlayerId}
                  onCancelEdit={() => setEditingPlayerId(null)}
                />

                {/* Drag overlay - ghost card that follows cursor */}
                <DragOverlay dropAnimation={null}>
                  {dnd.dragState.activeId && (() => {
                    const draggedPlayer = sortedPlayers.find(p => p.id === dnd.dragState.activeId);
                    if (!draggedPlayer || !draggedPlayer.configured) return null;
                    return (
                      <DragOverlayCard
                        player={draggedPlayer}
                        settings={DEFAULT_SETTINGS}
                        viewMode={viewMode}
                        contentType={currentTier?.contentType ?? 'savage'}
                        groupId={currentGroup?.id ?? ''}
                        tierId={currentTier?.tierId ?? ''}
                      />
                    );
                  })()}
                </DragOverlay>
              </DndContext>
            </>
          )}

          {/* Loot Tab */}
          {pageMode === 'loot' && tierInfo && mainRosterPlayers.length > 0 && (
            <LootPriorityPanel
              players={mainRosterPlayers}
              settings={{
                ...DEFAULT_SETTINGS,
                ...currentGroup?.settings,
              }}
              selectedFloor={selectedFloor}
              floorName={tierInfo.floors[selectedFloor - 1]}
              floors={tierInfo.floors}
              dutyNames={tierInfo.dutyNames}
              onFloorChange={setSelectedFloor}
              showLogButtons={canEdit}
              groupId={currentGroup?.id}
              tierId={currentTier?.tierId}
              currentWeek={storeCurrentWeek}
              maxWeek={storeMaxWeek}
              lootLog={lootLog}
              materialLog={materialLog}
              showEnhancedScores={true}
              activeSubTab={lootSubTab}
              onSubTabChange={setLootSubTab}
              onLogSuccess={() => {
                if (currentGroup?.id && currentTier?.tierId) {
                  fetchTier(currentGroup.id, currentTier.tierId);
                }
              }}
            />
          )}

          {/* Summary Tab */}
          {pageMode === 'stats' && tierInfo && mainRosterPlayers.length > 0 && (
            <TeamSummaryEnhanced
              groupId={currentGroup!.id}
              tierId={currentTier.tierId}
              players={mainRosterPlayers}
              tierInfo={tierInfo}
            />
          )}

          {/* History Tab - wrapped in flex-1 container for proper scroll containment */}
          {pageMode === 'history' && currentTier?.players && tierInfo && (
            <div className={preventPageScroll ? 'flex-1 min-h-0 flex flex-col w-full' : ''}>
              <HistoryView
                groupId={currentGroup!.id}
                tierId={currentTier.tierId}
                players={currentTier.players}
                floors={tierInfo.floors}
                userRole={userRole || 'viewer'}
                isAdmin={isAdminAccess}
                currentUserId={effectiveUserId}
                highlightedBookPlayerId={highlightedBookPlayerId}
                onNavigateToPlayer={handleNavigateToPlayer}
                highlightedEntryId={highlightedEntry?.id}
                highlightedEntryType={highlightedEntry?.type}
                targetWeek={highlightedEntry?.week}
                openLogLootModal={showLogLootModal}
                onLogLootModalClose={() => setShowLogLootModal(false)}
                openLogMaterialModal={showLogMaterialModal}
                onLogMaterialModalClose={() => setShowLogMaterialModal(false)}
                openMarkFloorClearedModal={showMarkFloorClearedModal}
                onMarkFloorClearedModalClose={() => setShowMarkFloorClearedModal(false)}
              />
            </div>
          )}
        </>
      )}

      {/* Create Tier Modal */}
      {showCreateTierModal && currentGroup && (
        <CreateTierModal
          groupId={currentGroup.id}
          existingTierIds={existingTierIds}
          onClose={() => setShowCreateTierModal(false)}
          onCreate={() => setPageMode('players')}
        />
      )}

      {/* Group Settings Modal */}
      {showSettingsModal && currentGroup && (
        <GroupSettingsModal
          group={currentGroup}
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsModalTab('general');
            setHighlightCreateInvite(false);
          }}
          isAdmin={isAdmin}
          initialTab={settingsModalTab}
          highlightCreateInvite={highlightCreateInvite}
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

      {/* Mobile Controls Sheet - tab-aware */}
      <Modal
        isOpen={showControlsSheet}
        onClose={() => setShowControlsSheet(false)}
        title={
          pageMode === 'players' ? 'Roster Controls' :
          pageMode === 'loot' ? 'Loot Controls' :
          pageMode === 'history' ? 'Log Controls' :
          'Controls'
        }
        variant="sheet"
      >
        <div className="space-y-4">
          {/* Tier Selector - shown for all tabs */}
          {tiers.length > 0 && (
            <div>
              <div className="text-sm text-text-muted mb-2">Raid Tier</div>
              <TierSelector
                tiers={tiers}
                currentTierId={currentTier?.tierId}
                onTierChange={(tierId) => {
                  handleTierChange(tierId);
                  setShowControlsSheet(false);
                }}
              />
            </div>
          )}

          {/* Roster Tab Controls */}
          {pageMode === 'players' && (
            <>
              {/* Sort */}
              <div>
                <div className="text-sm text-text-muted mb-2">Sort By</div>
                <SortModeSelector
                  sortPreset={sortPreset}
                  onPresetChange={(preset) => {
                    setSortPresetWithTier(preset);
                  }}
                />
              </div>

              {/* Group View */}
              <div>
                <div className="text-sm text-text-muted mb-2">Group View</div>
                <GroupViewToggle
                  enabled={groupView}
                  onToggle={(enabled) => setGroupView(enabled, currentGroup?.id)}
                  disabled={!hasPositionData}
                />
              </div>

              {/* Subs Toggle */}
              {hasSubstitutes && (
                <div>
                  <div className="text-sm text-text-muted mb-2">Substitutes</div>
                  {/* design-system-ignore: Toggle button requires specific toggle styling */}
                  <button
                    onClick={() => {
                      setSubsView(!subsView);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      subsView
                        ? 'bg-accent/20 text-accent border-accent/50'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>{subsView ? 'Show Subs Separately' : 'Show Subs with Roster'}</span>
                  </button>
                </div>
              )}

              {/* View Mode - hidden on mobile (floating toggle used instead) */}
              <div className="hidden md:block">
                <div className="text-sm text-text-muted mb-2">View Mode</div>
                <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
            </>
          )}

          {/* Loot Tab Controls */}
          {pageMode === 'loot' && (
            <>
              {/* Sub-tab selector */}
              <div>
                <div className="text-sm text-text-muted mb-2">View</div>
                <div className="flex flex-col gap-2">
                  {/* design-system-ignore: Sub-tab toggle buttons with specific styling */}
                  <button
                    onClick={() => {
                      setLootSubTab('matrix');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'matrix'
                        ? 'bg-accent text-accent-contrast border-accent'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Who Needs It
                  </button>
                  <button
                    onClick={() => {
                      setLootSubTab('gear');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'gear'
                        ? 'bg-accent text-accent-contrast border-accent'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Gear Priority
                  </button>
                  <button
                    onClick={() => {
                      setLootSubTab('weapon');
                      setShowControlsSheet(false);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      lootSubTab === 'weapon'
                        ? 'bg-accent text-accent-contrast border-accent'
                        : 'bg-surface-raised border-border-default text-text-secondary'
                    }`}
                  >
                    Weapon Priority
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Log Tab Controls */}
          {pageMode === 'history' && canManageRoster(userRole) && (
            <>
              {/* Reset Data Actions */}
              <div>
                <div className="text-sm text-text-muted mb-2">Reset Data</div>
                <div className="flex flex-col gap-2">
                  {/* design-system-ignore: Danger action buttons require specific styling */}
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-loot'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border bg-surface-raised border-border-default text-text-secondary hover:border-status-error/50 hover:text-status-error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset Loot Log
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-books'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border bg-surface-raised border-border-default text-text-secondary hover:border-status-error/50 hover:text-status-error"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Reset Book Balances
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('log:reset-all'));
                      setShowControlsSheet(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border bg-status-error/10 border-status-error/40 text-status-error hover:bg-status-error/20 hover:border-status-error/60"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Reset All Data
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Mobile Floating View Toggle (Roster tab) */}
      <RosterViewToggle
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        visible={isSmallScreen && pageMode === 'players' && !!currentTier}
      />

      {/* Mobile bottom navigation */}
      {currentTier && (
        <MobileBottomNav
          activeTab={pageMode}
          onTabChange={setPageMode}
          onControlsClick={() => setShowControlsSheet(true)}
        />
      )}
    </div>
  );
}
