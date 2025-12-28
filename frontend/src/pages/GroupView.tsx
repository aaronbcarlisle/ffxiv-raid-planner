/**
 * Group View Page
 *
 * Shows a static group with its tier snapshots and roster.
 * Full integration with PlayerCard components, DnD, loot/stats tabs.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { getTierById } from '../gamedata';
import { SortablePlayerCard } from '../components/player/SortablePlayerCard';
import { PlayerCard } from '../components/player/PlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, LootPriorityPanel } from '../components/loot';
import { TeamSummary } from '../components/team/TeamSummary';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle } from '../components/ui';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal } from '../components/static-group';
import { HEADER_EVENTS } from '../components/layout/Header';
import { calculateTeamSummary, sortPlayersByRole, groupPlayersByLightParty, getGroupFromPosition, swapPositionGroup } from '../utils/calculations';
import { SORT_PRESETS } from '../utils/constants';
import type { SnapshotPlayer, PageMode, ViewMode, SortPreset, StaticSettings, GearSlotStatus } from '../types';
import { GEAR_SLOTS } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';

// Default settings for display
const DEFAULT_SETTINGS: StaticSettings = {
  displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
  lootPriority: ['melee', 'ranged', 'caster', 'tank', 'healer'],
  sortPreset: 'standard',
  groupView: false,
  timezone: 'UTC',
  autoSync: false,
  syncFrequency: 'weekly',
};

export function GroupView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { currentGroup, isLoading: groupLoading, error: groupError, fetchGroupByShareCode } = useStaticGroupStore();
  const {
    tiers,
    currentTier,
    isLoading: tierLoading,
    error: tierError,
    fetchTiers,
    fetchTier,
    updatePlayer,
    addPlayer,
    removePlayer,
    reorderPlayers,
    clearTiers,
  } = useTierStore();

  // Local UI state
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);
  const [pageMode, setPageMode] = useState<PageMode>('players');
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [selectedFloor, setSelectedFloor] = useState<FloorNumber>(1);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [clipboardPlayer, setClipboardPlayer] = useState<SnapshotPlayer | null>(null);
  const [sortPreset, setSortPreset] = useState<SortPreset>('standard');
  const [groupView, setGroupView] = useState(false);

  // DnD state for drag overlay and drop target highlighting
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overPlayerId, setOverPlayerId] = useState<string | null>(null);
  // Insert mode: 'before' or 'after' the over card, null means swap mode
  const [insertSide, setInsertSide] = useState<'before' | 'after' | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

      // Remove this code if it exists, then add to front
      const filtered = recent.filter(code => code !== shareCode);
      const updated = [shareCode, ...filtered].slice(0, MAX_RECENT);

      localStorage.setItem('recent-statics', JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  }, [shareCode]);

  // Fetch tiers and load active tier sequentially (avoids race condition)
  useEffect(() => {
    if (!currentGroup?.id) return;

    let cancelled = false;

    (async () => {
      // First fetch the list of tiers
      await fetchTiers(currentGroup.id);
      if (cancelled) return;

      // Get fresh tiers from store after fetch completes
      const { tiers: freshTiers } = useTierStore.getState();
      if (freshTiers.length === 0) return;

      // Load the active tier or first tier
      const activeTier = freshTiers.find(t => t.isActive) || freshTiers[0];
      if (activeTier) {
        await fetchTier(currentGroup.id, activeTier.tierId);
      }
    })();

    return () => { cancelled = true; };
  }, [currentGroup?.id, fetchTiers, fetchTier]);

  const handleTierChange = useCallback((tierId: string) => {
    if (currentGroup?.id) {
      fetchTier(currentGroup.id, tierId);
    }
  }, [currentGroup?.id, fetchTier]);

  // Called when a tier is deleted - load the next available tier
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

  // Player update handler
  const handleUpdatePlayer = useCallback(async (playerId: string, updates: Partial<SnapshotPlayer>) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, updates);
  }, [currentGroup?.id, currentTier?.tierId, updatePlayer]);

  // Player remove handler
  const handleRemovePlayer = useCallback(async (playerId: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await removePlayer(currentGroup.id, currentTier.tierId, playerId);
  }, [currentGroup?.id, currentTier?.tierId, removePlayer]);

  // Configure player (set name, job, role)
  const handleConfigurePlayer = useCallback(async (playerId: string, name: string, job: string, role: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, {
      name,
      job,
      role,
      configured: true,
    });
    setEditingPlayerId(null);
  }, [currentGroup?.id, currentTier?.tierId, updatePlayer]);

  // Add player handler
  const handleAddPlayer = useCallback(async () => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    await addPlayer(currentGroup.id, currentTier.tierId);
  }, [currentGroup?.id, currentTier?.tierId, addPlayer]);

  // Duplicate player handler - creates a copy of the player
  const handleDuplicatePlayer = useCallback(async (sourcePlayer: SnapshotPlayer) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;
    try {
      // Create a new player slot
      const newPlayer = await addPlayer(currentGroup.id, currentTier.tierId);
      // Update the new player with the source player's data
      await updatePlayer(currentGroup.id, currentTier.tierId, newPlayer.id, {
        name: `${sourcePlayer.name} (Copy)`,
        job: sourcePlayer.job,
        role: sourcePlayer.role,
        position: sourcePlayer.position,
        tankRole: sourcePlayer.tankRole,
        templateRole: sourcePlayer.templateRole,
        configured: true,
        gear: sourcePlayer.gear,
        tomeWeapon: sourcePlayer.tomeWeapon,
        isSubstitute: sourcePlayer.isSubstitute,
        notes: sourcePlayer.notes,
        bisLink: sourcePlayer.bisLink,
      });
    } catch {
      // Error handled in store
    }
  }, [currentGroup?.id, currentTier?.tierId, addPlayer, updatePlayer]);

  // Reset gear handler - resets all gear slots and tome weapon to default
  const handleResetGear = useCallback(async (playerId: string) => {
    if (!currentGroup?.id || !currentTier?.tierId) return;

    // Create default gear with all slots empty
    // Ring2 defaults to tome since you can't equip two identical raid rings
    const defaultGear: GearSlotStatus[] = GEAR_SLOTS.map((slot) => ({
      slot,
      bisSource: slot === 'ring2' ? 'tome' as const : 'raid' as const,
      hasItem: false,
      isAugmented: false,
    }));

    const defaultTomeWeapon = { pursuing: false, hasItem: false, isAugmented: false };

    await updatePlayer(currentGroup.id, currentTier.tierId, playerId, {
      gear: defaultGear,
      tomeWeapon: defaultTomeWeapon,
    });
  }, [currentGroup?.id, currentTier?.tierId, updatePlayer]);

  // Listen for header events
  useEffect(() => {
    const handleTierChangeEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tierId) {
        handleTierChange(detail.tierId);
      }
    };

    const handleAddPlayerEvent = () => {
      handleAddPlayer();
    };

    const handleNewTierEvent = () => {
      setShowCreateTierModal(true);
    };

    const handleRolloverEvent = () => {
      setShowRolloverDialog(true);
    };

    const handleSettingsEvent = () => {
      setShowSettingsModal(true);
    };

    const handleDeleteTierEvent = () => {
      setShowDeleteTierConfirm(true);
    };

    window.addEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
    window.addEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
    window.addEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
    window.addEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
    window.addEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
    window.addEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);

    return () => {
      window.removeEventListener(HEADER_EVENTS.TIER_CHANGE, handleTierChangeEvent);
      window.removeEventListener(HEADER_EVENTS.ADD_PLAYER, handleAddPlayerEvent);
      window.removeEventListener(HEADER_EVENTS.NEW_TIER, handleNewTierEvent);
      window.removeEventListener(HEADER_EVENTS.ROLLOVER, handleRolloverEvent);
      window.removeEventListener(HEADER_EVENTS.SETTINGS, handleSettingsEvent);
      window.removeEventListener(HEADER_EVENTS.DELETE_TIER, handleDeleteTierEvent);
    };
  }, [handleTierChange, handleAddPlayer]);

  // DnD event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverPlayerId(overId);

    // Detect if cursor is near edge (insert mode) or center (swap mode)
    if (!overId || !event.over) {
      setInsertSide(null);
      return;
    }

    // Check if this is a drop zone (start/end of list)
    if (typeof overId === 'string' && overId.startsWith('drop-')) {
      // Drop zones are always insert mode
      setInsertSide(overId.includes('start') ? 'before' : 'after');
      return;
    }

    // Get CURRENT cursor position (initial position + drag delta)
    const initialX = (event.activatorEvent as PointerEvent)?.clientX;
    const deltaX = event.delta?.x ?? 0;
    if (initialX === undefined) {
      setInsertSide(null);
      return;
    }
    const currentPointerX = initialX + deltaX;

    // Find the over element and get its bounds
    const overElement = document.querySelector(`[data-player-id="${overId}"]`);
    if (!overElement) {
      setInsertSide(null);
      return;
    }

    const rect = overElement.getBoundingClientRect();
    const relativeX = currentPointerX - rect.left;
    const percentage = relativeX / rect.width;

    // Edge threshold: 25% on each side for insert mode
    const EDGE_THRESHOLD = 0.25;

    if (percentage < EDGE_THRESHOLD) {
      setInsertSide('before');
    } else if (percentage > 1 - EDGE_THRESHOLD) {
      setInsertSide('after');
    } else {
      setInsertSide(null); // Center = swap mode
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverPlayerId(null);
    setInsertSide(null);
  }, []);

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    // Capture insert state before clearing
    const wasInsertMode = insertSide !== null;
    const insertDirection = insertSide;

    // Clear drag state
    setActiveDragId(null);
    setOverPlayerId(null);
    setInsertSide(null);

    const { active, over } = event;
    if (!over || active.id === over.id || !currentTier?.players || !currentGroup?.id) return;

    const players = currentTier.players;
    const activeIndex = players.findIndex(p => p.id === active.id);
    if (activeIndex === -1) return;

    const activePlayer = players[activeIndex];
    const activeGroup = getGroupFromPosition(activePlayer.position);
    const overId = over.id as string;

    // Handle drop zones (start/end of list)
    if (overId.startsWith('drop-')) {
      const sortedByOrder = [...players].sort((a, b) => a.sortOrder - b.sortOrder);
      const activeOrderIndex = sortedByOrder.findIndex(p => p.id === active.id);

      // Determine target position and group
      let targetIndex: number;
      let targetGroup: 1 | 2 | null = null;

      if (overId === 'drop-start' || overId === 'drop-start-g1') {
        targetIndex = 0;
        if (overId === 'drop-start-g1') targetGroup = 1;
      } else if (overId === 'drop-end') {
        targetIndex = sortedByOrder.length - 1;
      } else if (overId === 'drop-end-g1') {
        // Find the last G1 player index
        const g1Players = sortedByOrder.filter(p => getGroupFromPosition(p.position) === 1);
        targetIndex = g1Players.length > 0
          ? sortedByOrder.findIndex(p => p.id === g1Players[g1Players.length - 1].id)
          : 0;
        targetGroup = 1;
      } else if (overId === 'drop-start-g2') {
        // Find the first G2 player index
        const firstG2Index = sortedByOrder.findIndex(p => getGroupFromPosition(p.position) === 2);
        targetIndex = firstG2Index >= 0 ? firstG2Index : sortedByOrder.length;
        targetGroup = 2;
      } else if (overId === 'drop-end-g2') {
        targetIndex = sortedByOrder.length - 1;
        targetGroup = 2;
      } else {
        return; // Unknown drop zone
      }

      // Adjust if moving from before target
      if (activeOrderIndex < targetIndex) {
        targetIndex--;
      }

      // Build updates
      const updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }> = [];
      const withoutActive = sortedByOrder.filter(p => p.id !== active.id);
      withoutActive.splice(targetIndex, 0, activePlayer);

      withoutActive.forEach((player, index) => {
        if (player.sortOrder !== index) {
          const playerUpdates: Partial<SnapshotPlayer> = { sortOrder: index };

          // Update position if moving to different group
          if (player.id === activePlayer.id && groupView && targetGroup && activeGroup !== targetGroup && activePlayer.position) {
            playerUpdates.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
          }

          updates.push({ playerId: player.id, data: playerUpdates });
        }
      });

      if (updates.length > 0) {
        await reorderPlayers(currentGroup.id, currentTier.tierId, updates);
        setSortPreset('custom');
      }
      return;
    }

    // Regular player card drop
    const overIndex = players.findIndex(p => p.id === over.id);
    if (overIndex === -1) return;

    const overPlayer = players[overIndex];

    // Check if this is a cross-group move (G1 <-> G2)
    const overGroup = getGroupFromPosition(overPlayer.position);

    if (wasInsertMode) {
      // INSERT MODE: Move active card to before/after over card
      // Sort players by current sortOrder to work with actual positions
      const sortedByOrder = [...players].sort((a, b) => a.sortOrder - b.sortOrder);
      const activeOrderIndex = sortedByOrder.findIndex(p => p.id === active.id);
      const overOrderIndex = sortedByOrder.findIndex(p => p.id === over.id);

      // Calculate target position
      let targetIndex = insertDirection === 'before' ? overOrderIndex : overOrderIndex + 1;
      // Adjust if we're moving from before the target
      if (activeOrderIndex < targetIndex) {
        targetIndex--;
      }

      // Build updates: shift cards and insert active at target position
      const updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }> = [];

      // Remove active from sorted list and insert at target
      const withoutActive = sortedByOrder.filter(p => p.id !== active.id);
      withoutActive.splice(targetIndex, 0, activePlayer);

      // Update sortOrder for all affected cards
      withoutActive.forEach((player, index) => {
        if (player.sortOrder !== index) {
          const playerUpdates: Partial<SnapshotPlayer> = { sortOrder: index };

          // Handle cross-group position swap for the dragged player
          if (player.id === activePlayer.id && groupView && activeGroup && overGroup && activeGroup !== overGroup && activePlayer.position) {
            playerUpdates.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
          }

          updates.push({ playerId: player.id, data: playerUpdates });
        }
      });

      if (updates.length > 0) {
        await reorderPlayers(currentGroup.id, currentTier.tierId, updates);
      }
    } else {
      // SWAP MODE: Swap positions of active and over cards
      const activeUpdates: Partial<SnapshotPlayer> = { sortOrder: overPlayer.sortOrder };
      const overUpdates: Partial<SnapshotPlayer> = { sortOrder: activePlayer.sortOrder };

      // If moving between groups, both cards need their position numbers swapped
      // e.g., M2 swapping with T1 → M2 becomes M1, T1 becomes T2
      if (groupView && activeGroup && overGroup && activeGroup !== overGroup) {
        if (activePlayer.position) {
          activeUpdates.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
        }
        if (overPlayer.position) {
          overUpdates.position = swapPositionGroup(overPlayer.position) as SnapshotPlayer['position'];
        }
      }

      // Use optimistic reorder to prevent visual "pop"
      await reorderPlayers(currentGroup.id, currentTier.tierId, [
        { playerId: activePlayer.id, data: activeUpdates },
        { playerId: overPlayer.id, data: overUpdates },
      ]);
    }

    // Switch to custom sort
    setSortPreset('custom');
  }, [currentTier?.players, currentTier?.tierId, currentGroup?.id, reorderPlayers, groupView, insertSide]);

  // Calculate sorted players
  const sortedPlayers = useMemo(() => {
    if (!currentTier?.players) return [];
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(currentTier.players, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);

  // Player IDs for SortableContext
  const playerIds = useMemo(() => sortedPlayers.map(p => p.id), [sortedPlayers]);

  // Group players by light party when group view is enabled
  const groupedPlayers = useMemo(() => {
    if (!groupView) return null;
    return groupPlayersByLightParty(sortedPlayers);
  }, [groupView, sortedPlayers]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter(p => p.configured && p.position).length >= 2;

  // Only count configured players for team summary
  const configuredPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.configured);
  }, [sortedPlayers]);

  const teamSummary = useMemo(() => {
    if (configuredPlayers.length === 0) return null;
    return calculateTeamSummary(configuredPlayers);
  }, [configuredPlayers]);

  const isLoading = groupLoading || tierLoading;
  const error = groupError || tierError;
  const userRole = currentGroup?.userRole;
  const canEdit = userRole === 'owner' || userRole === 'lead';

  // Get tier info for display
  const tierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Available tiers for creation (filter out existing)
  const existingTierIds = tiers.map(t => t.tierId);

  // Grid classes
  const gridClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl';

  // Helper function to render a player card
  const renderPlayerCard = (player: SnapshotPlayer) => {
    // If editing this player, show inline edit form
    if (editingPlayerId === player.id) {
      return (
        <InlinePlayerEdit
          key={player.id}
          player={player}
          onSave={(name, job, role) => handleConfigurePlayer(player.id, name, job, role)}
          onCancel={() => setEditingPlayerId(null)}
        />
      );
    }

    // If player is configured, show sortable player card
    if (player.configured) {
      const isOver = overPlayerId === player.id && activeDragId !== player.id;
      return (
        <SortablePlayerCard
          key={player.id}
          player={player}
          settings={DEFAULT_SETTINGS}
          viewMode={viewMode}
          clipboardPlayer={clipboardPlayer}
          isDragEnabled={canEdit}
          isDropTarget={isOver}
          insertBefore={isOver && insertSide === 'before'}
          insertAfter={isOver && insertSide === 'after'}
          onUpdate={(updates) => handleUpdatePlayer(player.id, updates)}
          onRemove={() => handleRemovePlayer(player.id)}
          onCopy={() => setClipboardPlayer(player)}
          onPaste={() => {
            if (clipboardPlayer) {
              handleUpdatePlayer(player.id, {
                job: clipboardPlayer.job,
                role: clipboardPlayer.role,
                gear: clipboardPlayer.gear,
                tomeWeapon: clipboardPlayer.tomeWeapon,
                isSubstitute: clipboardPlayer.isSubstitute,
                notes: clipboardPlayer.notes,
                bisLink: clipboardPlayer.bisLink,
              });
            }
          }}
          onDuplicate={() => handleDuplicatePlayer(player)}
          onResetGear={canEdit ? () => handleResetGear(player.id) : undefined}
        />
      );
    }

    // Otherwise show empty slot
    return (
      <EmptySlotCard
        key={player.id}
        templateRole={player.templateRole}
        position={player.position}
        onStartEdit={() => setEditingPlayerId(player.id)}
        onRemove={canEdit ? () => handleRemovePlayer(player.id) : undefined}
      />
    );
  };

  if (isLoading && !currentGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <h2 className="text-xl font-display text-red-400 mb-2">Error</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-bg-primary font-medium rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-display text-accent mb-2">Group Not Found</h2>
          <p className="text-text-muted">The static group you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[120rem] mx-auto px-4 py-4">
      {/* No tiers state */}
      {tiers.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-bg-card rounded-lg border border-white/10">
          <h2 className="text-xl font-display text-accent mb-2">No Raid Tiers</h2>
          <p className="text-text-muted mb-6">
            Create your first tier snapshot to start tracking gear progress.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateTierModal(true)}
              className="bg-accent text-bg-primary px-6 py-2 rounded font-medium hover:bg-accent-bright"
            >
              Create First Tier
            </button>
          )}
        </div>
      )}

      {/* Content when tier exists */}
      {currentTier && (
        <>
          {/* Toolbar: Tabs + Context Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />
            <div className="relative flex items-center justify-end gap-3">
              {/* Floor selector - visible in Loot tab */}
              <div className={pageMode !== 'loot' ? 'invisible' : ''}>
                {tierInfo && (
                  <FloorSelector
                    floors={tierInfo.floors}
                    dutyNames={tierInfo.dutyNames}
                    selectedFloor={selectedFloor}
                    onFloorChange={setSelectedFloor}
                  />
                )}
              </div>
              {/* Sort mode + Group view + View mode toggle - visible in Players tab */}
              <div className={`absolute right-0 flex items-center gap-3 ${pageMode !== 'players' ? 'invisible' : ''}`}>
                <SortModeSelector
                  sortPreset={sortPreset}
                  onPresetChange={setSortPreset}
                />
                <GroupViewToggle
                  enabled={groupView}
                  onToggle={setGroupView}
                  disabled={!hasPositionData}
                />
                <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              </div>
            </div>
          </div>

          {/* Players Tab */}
          {pageMode === 'players' && currentTier.players && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={playerIds}>
                {/* Grouped View */}
                {groupView && groupedPlayers ? (
                  <div className="space-y-8 mb-8">
                    {/* Group 1 */}
                    {groupedPlayers.group1.length > 0 && (
                      <div>
                        <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                          <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-bold">G1</span>
                          Light Party 1
                        </h3>
                        <div className={gridClasses}>
                          {groupedPlayers.group1.map((player) => renderPlayerCard(player))}
                        </div>
                      </div>
                    )}

                    {/* Group 2 */}
                    {groupedPlayers.group2.length > 0 && (
                      <div>
                        <h3 className="text-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                          <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-bold">G2</span>
                          Light Party 2
                        </h3>
                        <div className={gridClasses}>
                          {groupedPlayers.group2.map((player) => renderPlayerCard(player))}
                        </div>
                      </div>
                    )}

                    {/* Unassigned */}
                    {groupedPlayers.unassigned.length > 0 && (
                      <div className="opacity-75">
                        <h3 className="text-text-muted text-sm font-medium mb-3">
                          Unassigned Positions
                        </h3>
                        <div className={gridClasses}>
                          {groupedPlayers.unassigned.map((player) => renderPlayerCard(player))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard View */
                  <div className={`${gridClasses} mb-8`}>
                    {sortedPlayers.map((player) => renderPlayerCard(player))}
                  </div>
                )}
              </SortableContext>

              {/* Drag overlay - ghost card that follows cursor */}
              <DragOverlay dropAnimation={null}>
                {activeDragId && (() => {
                  const draggedPlayer = sortedPlayers.find(p => p.id === activeDragId);
                  if (!draggedPlayer || !draggedPlayer.configured) return null;
                  return (
                    <div className="opacity-90 shadow-xl">
                      <PlayerCard
                        player={draggedPlayer}
                        settings={DEFAULT_SETTINGS}
                        viewMode={viewMode}
                        clipboardPlayer={null}
                        onUpdate={() => {}}
                        onRemove={() => {}}
                        onCopy={() => {}}
                        onPaste={() => {}}
                        onDuplicate={() => {}}
                      />
                    </div>
                  );
                })()}
              </DragOverlay>
            </DndContext>
          )}

          {/* Loot Tab */}
          {pageMode === 'loot' && tierInfo && configuredPlayers.length > 0 && (
            <LootPriorityPanel
              players={configuredPlayers}
              settings={DEFAULT_SETTINGS}
              selectedFloor={selectedFloor}
              floorName={tierInfo.floors[selectedFloor - 1]}
            />
          )}

          {/* Stats Tab */}
          {pageMode === 'stats' && teamSummary && (
            <TeamSummary summary={teamSummary} />
          )}
        </>
      )}

      {/* Create Tier Modal */}
      {showCreateTierModal && currentGroup && (
        <CreateTierModal
          groupId={currentGroup.id}
          existingTierIds={existingTierIds}
          onClose={() => setShowCreateTierModal(false)}
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
          tierId={currentTier.tierId}
          onClose={() => setShowDeleteTierConfirm(false)}
          onDeleted={handleTierDeleted}
        />
      )}
    </div>
  );
}
