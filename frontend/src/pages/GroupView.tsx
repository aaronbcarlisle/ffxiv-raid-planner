/**
 * Group View Page
 *
 * Shows a static group with its tier snapshots and roster.
 * Full integration with PlayerCard components, DnD, loot/stats tabs.
 */

import { useEffect, useMemo, useCallback } from 'react';
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
import { useDragAndDrop } from '../components/dnd/useDragAndDrop';
import { LootPriorityPanel } from '../components/loot';
import { TeamSummaryEnhanced } from '../components/team/TeamSummaryEnhanced';
import { HistoryView } from '../components/history/HistoryView';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle, KeyboardShortcutsHelp } from '../components/ui';
import { Button } from '../components/primitives';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal } from '../components/static-group';
import { AdminBanners } from '../components/admin/AdminBanners';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { usePlayerActions } from '../hooks/usePlayerActions';
import { useGroupViewKeyboardShortcuts } from '../hooks/useGroupViewKeyboardShortcuts';
import { useViewNavigation } from '../hooks/useViewNavigation';
import { HEADER_EVENTS } from '../components/layout/Header';
import { sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';
import { canManageRoster } from '../utils/permissions';
import { logger } from '../lib/logger';
import type { SnapshotPlayer, GearSlot, SortPreset } from '../types';

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { currentGroup, groups, isLoading: groupLoading, error: groupError, fetchGroupByShareCode } = useStaticGroupStore();
  const {
    tiers,
    currentTier,
    isLoading: tierLoading,
    error: tierError,
    fetchTiers,
    fetchTier,
    clearTiers,
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
  } = state;

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

  // Clear tiers when shareCode changes (switching groups)
  useEffect(() => {
    clearTiers();
  }, [shareCode, clearTiers]);

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

  // When viewing as another user, use their role instead of actual role
  const actualUserRole = currentGroup?.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  const isAdminAccess = !viewAsUser && (currentGroup?.isAdminAccess ?? false);
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
  const { handleNavigateToPlayer, handleNavigateToLootEntry } = useViewNavigation({
    setPageMode,
    setHighlightedPlayerId,
    setHighlightedEntry,
    lootLog,
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
    const handleSettingsEvent = () => { setShowSettingsModal(true); };
    const handleDeleteTierEvent = () => { setShowDeleteTierConfirm(true); };
    const handleShowKeyboardShortcuts = () => { setShowKeyboardHelp(true); };

    window.addEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
    window.addEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
    window.addEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
    window.addEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
    window.addEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
    window.addEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    window.addEventListener('show-keyboard-shortcuts', handleShowKeyboardShortcuts);

    return () => {
      window.removeEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
      window.removeEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
      window.removeEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
      window.removeEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
      window.removeEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
      window.removeEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
      window.removeEventListener('show-keyboard-shortcuts', handleShowKeyboardShortcuts);
    };
  }, [handleTierChange, handleAddPlayer, setShowCreateTierModal, setShowRolloverDialog, setShowSettingsModal, setShowDeleteTierConfirm, setShowKeyboardHelp]);

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

  // Check if any modal is open
  const isAnyModalOpen = showSettingsModal || showRolloverDialog ||
                          showDeleteTierConfirm || showCreateTierModal ||
                          showKeyboardHelp || showLogLootModal ||
                          showLogMaterialModal || showMarkFloorClearedModal ||
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

  // DnD hook
  const dnd = useDragAndDrop({
    players: sortedPlayers,
    groupView,
    canEdit,
    disabled: isAnyModalOpen || !rosterPermission.allowed,
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

  const handleExitViewAs = useCallback(() => {
    stopViewAs();
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.delete('viewAs');
      return params;
    }, { replace: true });
  }, [stopViewAs, setSearchParams]);

  // Loading state
  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    const isPrivateGroupError = error.toLowerCase().includes('private');
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className={`${isPrivateGroupError ? 'bg-accent/10 border-accent/30' : 'bg-status-error/10 border-status-error/30'} border rounded-lg p-6 text-center`}>
          <h2 className={`text-xl font-display mb-2 ${isPrivateGroupError ? 'text-accent' : 'text-status-error'}`}>
            {isPrivateGroupError ? 'Private Group' : 'Error'}
          </h2>
          <p className="text-text-secondary mb-4">
            {isPrivateGroupError
              ? 'This static group is private. Please log in to view it.'
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

  return (
    <div className="max-w-[160rem] mx-auto">
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
      <AdminBanners isAdminAccess={isAdminAccess} />

      {/* Content when tier exists */}
      {currentTier && (
        <>
          {/* Toolbar: Tabs + Context Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />
            <div className="relative flex items-center justify-end gap-3">
              <div className={`absolute right-0 flex items-center gap-3 ${pageMode !== 'players' ? 'invisible' : ''}`}>
                <SortModeSelector
                  sortPreset={sortPreset}
                  onPresetChange={setSortPresetWithTier}
                />
                <GroupViewToggle
                  enabled={groupView}
                  onToggle={setGroupView}
                  disabled={!hasPositionData}
                />
                {hasSubstitutes && (
                  <button
                    onClick={() => setSubsView(!subsView)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      subsView
                        ? 'bg-accent/20 text-accent border border-accent/50'
                        : 'bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
                    }`}
                    title={subsView ? 'Show subs with main roster (S)' : 'Separate substitutes (S)'}
                    aria-label={subsView ? 'Show substitutes with main roster' : 'Separate substitute players into their own section'}
                    aria-pressed={subsView}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Subs</span>
                  </button>
                )}
                <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
            </div>
          </div>

          {/* Players Tab */}
          {pageMode === 'players' && currentTier.players && (
            <>
              {!rosterPermission.allowed && sortPreset === 'custom' && (
                <div className="mb-3 p-3 bg-surface-card border border-border-subtle rounded-lg">
                  <p className="text-sm text-text-muted flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Player reordering is disabled. {rosterPermission.reason}
                  </p>
                </div>
              )}

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
                  groupId={currentGroup!.id}
                  tierId={currentTier!.tierId}
                  playerSlotsWithLootEntries={playerSlotsWithLootEntries}
                  onUpdatePlayer={playerActions.handleUpdatePlayer}
                  onRemovePlayer={playerActions.handleRemovePlayer}
                  onConfigurePlayer={playerActions.handleConfigurePlayer}
                  onDuplicatePlayer={playerActions.handleDuplicatePlayer}
                  onResetGear={playerActions.handleResetGear}
                  onClaimPlayer={playerActions.handleClaimPlayer}
                  onReleasePlayer={playerActions.handleReleasePlayer}
                  onCopyPlayer={handleCopyPlayer}
                  onPastePlayer={handlePastePlayer}
                  onCopyUrl={handleCopyUrl}
                  onNavigateToLootEntry={handleNavigateToLootEntry}
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
                ...(currentGroup?.settings && { lootPriority: currentGroup.settings.lootPriority }),
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

          {/* History Tab */}
          {pageMode === 'history' && currentTier?.players && tierInfo && (
            <HistoryView
              groupId={currentGroup!.id}
              tierId={currentTier.tierId}
              players={currentTier.players}
              floors={tierInfo.floors}
              userRole={userRole || 'viewer'}
              isAdmin={isAdminAccess}
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
          onClose={() => setShowSettingsModal(false)}
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

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
}
