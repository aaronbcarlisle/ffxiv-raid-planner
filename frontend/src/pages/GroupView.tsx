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
import { useAuthStore } from '../stores/authStore';
import { getTierById, RAID_TIERS } from '../gamedata';
import { SortablePlayerCard } from '../components/player/SortablePlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, LootPriorityPanel } from '../components/loot';
import { TeamSummary } from '../components/team/TeamSummary';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle } from '../components/ui';
import { GroupSettingsModal, RolloverDialog } from '../components/static-group';
import { calculateTeamSummary, sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS } from '../utils/constants';
import type { MemberRole, SnapshotPlayer, PageMode, ViewMode, SortPreset, StaticSettings } from '../types';

// Role badge colors
const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

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
  const { isAuthenticated } = useAuthStore();
  const { currentGroup, isLoading: groupLoading, error: groupError, fetchGroupByShareCode } = useStaticGroupStore();
  const {
    tiers,
    currentTier,
    isLoading: tierLoading,
    isSaving,
    error: tierError,
    fetchTiers,
    fetchTier,
    createTier,
    deleteTier,
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
  const [selectedTierId, setSelectedTierId] = useState<string>('');
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

  const handleCreateTier = async () => {
    if (!currentGroup?.id || !selectedTierId) return;

    try {
      await createTier(currentGroup.id, selectedTierId);
      setShowCreateTierModal(false);
      setSelectedTierId('');
    } catch {
      // Error handled in store
    }
  };

  const handleTierChange = (tierId: string) => {
    if (currentGroup?.id) {
      fetchTier(currentGroup.id, tierId);
    }
  };

  const handleDeleteTier = async () => {
    if (!currentGroup?.id || !currentTier?.tierId) return;

    try {
      await deleteTier(currentGroup.id, currentTier.tierId);
      setShowDeleteTierConfirm(false);

      // Load another tier if available
      const { tiers: freshTiers } = useTierStore.getState();
      if (freshTiers.length > 0) {
        const nextTier = freshTiers.find(t => t.isActive) || freshTiers[0];
        if (nextTier) {
          await fetchTier(currentGroup.id, nextTier.tierId);
        }
      }
    } catch {
      // Error handled in store
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
    // Convert SnapshotPlayer to format expected by sortPlayersByRole
    const playersForSort = currentTier.players.map(p => ({
      ...p,
      staticId: currentTier.staticGroupId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    return sortPlayersByRole(playersForSort as any, displayOrder, sortPreset);
  }, [currentTier?.players, sortPreset]);

  // Player IDs for SortableContext
  const playerIds = useMemo(() => sortedPlayers.map(p => p.id), [sortedPlayers]);

  // Group players by light party when group view is enabled
  const groupedPlayers = useMemo(() => {
    if (!groupView) return null;
    return groupPlayersByLightParty(sortedPlayers as any);
  }, [groupView, sortedPlayers]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter(p => p.configured && p.position).length >= 2;

  // Only count configured players for team summary
  const configuredPlayers = useMemo(() => {
    return sortedPlayers.filter(p => p.configured);
  }, [sortedPlayers]);

  const teamSummary = useMemo(() => {
    if (configuredPlayers.length === 0) return null;
    return calculateTeamSummary(configuredPlayers as any);
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
          player={player as any}
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
          player={player as any}
          settings={DEFAULT_SETTINGS}
          viewMode={viewMode}
          clipboardPlayer={clipboardPlayer as any}
          isDragEnabled={canEdit}
          onUpdate={(updates) => handleUpdatePlayer(player.id, updates as any)}
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display text-accent">{currentGroup.name}</h1>
            {userRole && (
              <span className={`text-xs px-2 py-0.5 rounded border ${ROLE_COLORS[userRole]}`}>
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </span>
            )}
            {/* Settings button (owner only) */}
            {userRole === 'owner' && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                title="Static Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-text-muted text-sm mt-1">
            Code: <span className="font-mono text-accent">{currentGroup.shareCode}</span>
            {currentGroup.isPublic ? ' (Public)' : ' (Private)'}
          </p>
        </div>

        {/* Tier selector */}
        <div className="flex items-center gap-3">
          {tiers.length > 0 && (
            <select
              value={currentTier?.tierId || ''}
              onChange={(e) => handleTierChange(e.target.value)}
              className="bg-bg-card border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
            >
              {tiers.map((tier) => {
                const info = getTierById(tier.tierId);
                return (
                  <option key={tier.tierId} value={tier.tierId}>
                    {info?.name || tier.tierId} {tier.isActive && '(Active)'}
                  </option>
                );
              })}
            </select>
          )}

          {canEdit && availableTiers.length > 0 && (
            <button
              onClick={() => setShowCreateTierModal(true)}
              className="bg-accent/20 text-accent px-3 py-2 rounded font-medium hover:bg-accent/30 text-sm"
            >
              + New Tier
            </button>
          )}

          {/* Rollover button (owner/lead, when tier exists and more tiers available) */}
          {canEdit && currentTier && availableTiers.length > 0 && (
            <button
              onClick={() => setShowRolloverDialog(true)}
              className="bg-purple-500/20 text-purple-400 px-3 py-2 rounded font-medium hover:bg-purple-500/30 text-sm"
              title="Copy roster to a new tier"
            >
              Rollover
            </button>
          )}

          {/* Delete tier button (owner/lead, when more than one tier) */}
          {canEdit && currentTier && tiers.length > 1 && (
            <button
              onClick={() => setShowDeleteTierConfirm(true)}
              className="text-red-400 hover:text-red-300 px-2 py-2 text-sm"
              title="Delete this tier"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          {canEdit && currentTier && (
            <button
              onClick={handleAddPlayer}
              disabled={isSaving}
              className="bg-accent/20 text-accent px-3 py-2 rounded font-medium hover:bg-accent/30 text-sm disabled:opacity-50"
            >
              + Add Player
            </button>
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
          {/* Tier info banner */}
          {tierInfo && (
            <div className="bg-bg-card border border-white/10 rounded-lg px-4 py-3 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-display text-lg text-accent">{tierInfo.name}</span>
                  <span className="text-text-muted ml-2">({tierInfo.shortName})</span>
                </div>
                <div className="text-sm text-text-secondary">
                  {configuredPlayers.length} / {currentTier.players?.length || 0} players configured
                </div>
              </div>
            </div>
          )}

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
                          {groupedPlayers.group1.map((player) => renderPlayerCard(player as any))}
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
                          {groupedPlayers.group2.map((player) => renderPlayerCard(player as any))}
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
                          {groupedPlayers.unassigned.map((player) => renderPlayerCard(player as any))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard View */
                  <div className={`${gridClasses} mb-8`}>
                    {sortedPlayers.map((player) => renderPlayerCard(player as any))}
                  </div>
                )}
              </SortableContext>
            </DndContext>
          )}

          {/* Loot Tab */}
          {pageMode === 'loot' && tierInfo && configuredPlayers.length > 0 && (
            <LootPriorityPanel
              players={configuredPlayers as any}
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
      {showCreateTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-display text-accent mb-4">Create New Tier</h2>

            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-2">
                Select Raid Tier
              </label>
              <select
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Choose a tier...</option>
                {availableTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({tier.shortName})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateTierModal(false);
                  setSelectedTierId('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTier}
                disabled={!selectedTierId || isSaving}
                className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
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
      {showDeleteTierConfirm && currentTier && tierInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-card rounded-lg border border-white/10 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-display text-red-400 mb-4">Delete Tier</h2>

            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-text-secondary">
                Are you sure you want to delete <strong className="text-text-primary">{tierInfo.name}</strong>?
                This will remove all player data for this tier.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteTierConfirm(false)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTier}
                disabled={isSaving}
                className="bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Deleting...' : 'Delete Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
