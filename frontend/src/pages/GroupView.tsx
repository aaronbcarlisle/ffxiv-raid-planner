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
import { getTierById, RAID_TIERS } from '../gamedata';
import { SortablePlayerCard } from '../components/player/SortablePlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, LootPriorityPanel } from '../components/loot';
import { TeamSummary } from '../components/team/TeamSummary';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle, SettingsPopover } from '../components/ui';
import { GroupSettingsModal, RolloverDialog, CreateTierModal, DeleteTierModal, TierSelector, GroupHeader } from '../components/static-group';
import { calculateTeamSummary, sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS } from '../utils/constants';
import type { SnapshotPlayer, PageMode, ViewMode, SortPreset, StaticSettings } from '../types';

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
    isSaving,
    error: tierError,
    fetchTiers,
    fetchTier,
    updatePlayer,
    addPlayer,
    removePlayer,
    clearTiers,
  } = useTierStore();

  // Local UI state
  const [showCreateTierModal, setShowCreateTierModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRolloverDialog, setShowRolloverDialog] = useState(false);
  const [showDeleteTierConfirm, setShowDeleteTierConfirm] = useState(false);
  const [pageMode, setPageMode] = useState<PageMode>('players');
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [selectedFloor, setSelectedFloor] = useState(1);
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

  const handleTierChange = (tierId: string) => {
    if (currentGroup?.id) {
      fetchTier(currentGroup.id, tierId);
    }
  };

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

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !currentTier?.players) return;

    const players = currentTier.players;
    const activeIndex = players.findIndex(p => p.id === active.id);
    const overIndex = players.findIndex(p => p.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    // Update sort orders
    const activePlayer = players[activeIndex];
    const overPlayer = players[overIndex];

    // Swap sort orders
    await handleUpdatePlayer(activePlayer.id, { sortOrder: overPlayer.sortOrder });
    await handleUpdatePlayer(overPlayer.id, { sortOrder: activePlayer.sortOrder });

    // Switch to custom sort
    setSortPreset('custom');
  }, [currentTier?.players, handleUpdatePlayer]);

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
  const availableTiers = RAID_TIERS.filter(t => !existingTierIds.includes(t.id));

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
          onDuplicate={() => handleAddPlayer()}
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
    <div className="max-w-[120rem] mx-auto px-4 py-6">
      {/* Header: Group info + Tier + Actions in single row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <GroupHeader
          name={currentGroup.name}
          shareCode={currentGroup.shareCode}
          userRole={userRole}
        />

        {/* Right side: Tier selector + Settings popover */}
        <div className="flex items-center gap-3">
          <TierSelector
            tiers={tiers}
            currentTierId={currentTier?.tierId}
            onTierChange={handleTierChange}
          />

          {canEdit && (
            <SettingsPopover
              actions={[
                {
                  id: 'add-player',
                  label: 'Add Player',
                  badge: currentTier ? `${configuredPlayers.length}/${currentTier.players?.length || 0}` : undefined,
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  ),
                  disabled: !currentTier || isSaving,
                  onClick: handleAddPlayer,
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
                  onClick: () => setShowCreateTierModal(true),
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
                  onClick: () => setShowRolloverDialog(true),
                },
                ...(userRole === 'owner' ? [{
                  id: 'settings',
                  label: 'Static Settings',
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  onClick: () => setShowSettingsModal(true),
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
                  onClick: () => setShowDeleteTierConfirm(true),
                },
              ]}
            />
          )}
        </div>
      </div>

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
