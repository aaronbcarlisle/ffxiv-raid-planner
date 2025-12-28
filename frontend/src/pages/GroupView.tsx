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
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { getTierById } from '../gamedata';
import { SortablePlayerCard } from '../components/player/SortablePlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, LootPriorityPanel } from '../components/loot';
import { TeamSummary } from '../components/team/TeamSummary';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle } from '../components/ui';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal } from '../components/static-group';
import { HEADER_EVENTS } from '../components/layout/Header';
import { calculateTeamSummary, sortPlayersByRole, groupPlayersByLightParty, getGroupFromPosition, swapPositionGroup } from '../utils/calculations';
import { SORT_PRESETS } from '../utils/constants';
import type { SnapshotPlayer, PageMode, ViewMode, SortPreset, StaticSettings } from '../types';
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

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentTier?.players || !currentGroup?.id) return;

    const players = currentTier.players;
    const activeIndex = players.findIndex(p => p.id === active.id);
    const overIndex = players.findIndex(p => p.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    const activePlayer = players[activeIndex];
    const overPlayer = players[overIndex];

    // Check if this is a cross-group move (G1 <-> G2)
    const activeGroup = getGroupFromPosition(activePlayer.position);
    const overGroup = getGroupFromPosition(overPlayer.position);

    // Build updates for the active player
    const activeUpdates: Partial<SnapshotPlayer> = { sortOrder: overPlayer.sortOrder };

    // If moving between groups and player has a position, swap the position number
    if (groupView && activeGroup && overGroup && activeGroup !== overGroup && activePlayer.position) {
      activeUpdates.position = swapPositionGroup(activePlayer.position) as SnapshotPlayer['position'];
    }

    // Use optimistic reorder to prevent visual "pop"
    await reorderPlayers(currentGroup.id, currentTier.tierId, [
      { playerId: activePlayer.id, data: activeUpdates },
      { playerId: overPlayer.id, data: { sortOrder: activePlayer.sortOrder } },
    ]);

    // Switch to custom sort
    setSortPreset('custom');
  }, [currentTier?.players, currentTier?.tierId, currentGroup?.id, reorderPlayers, groupView]);

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
      return (
        <SortablePlayerCard
          key={player.id}
          player={player}
          settings={DEFAULT_SETTINGS}
          viewMode={viewMode}
          clipboardPlayer={clipboardPlayer}
          isDragEnabled={canEdit}
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
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={playerIds} strategy={rectSortingStrategy}>
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
