import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
import { useStaticStore } from '../stores/staticStore';
import { getTierById } from '../gamedata';
import { PlayerCard } from '../components/player/PlayerCard';
import { SortablePlayerCard } from '../components/player/SortablePlayerCard';
import { EmptySlotCard } from '../components/player/EmptySlotCard';
import { InlinePlayerEdit } from '../components/player/InlinePlayerEdit';
import { FloorSelector, LootPriorityPanel } from '../components/loot';
import { TeamSummary } from '../components/team/TeamSummary';
import { TabNavigation, ViewModeToggle, SortModeSelector, GroupViewToggle } from '../components/ui';
import { calculateTeamSummary, sortPlayersByRole, groupPlayersByLightParty } from '../utils/calculations';
import { SORT_PRESETS } from '../utils/constants';
import type { Player, SortPreset } from '../types';

export function StaticView() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const {
    currentStatic,
    isLoading,
    error,
    selectedFloor,
    pageMode,
    viewMode,
    editingPlayerId,
    clipboardPlayer,
    fetchStatic,
    updatePlayer,
    removePlayer,
    configurePlayer,
    duplicatePlayer,
    reorderPlayers,
    updateSettings,
    setSelectedFloor,
    setPageMode,
    setViewMode,
    setEditingPlayerId,
    setClipboardPlayer,
  } = useStaticStore();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!shareCode) return;
    fetchStatic(shareCode);
  }, [shareCode, fetchStatic]);

  // Calculate sorted players and team summary
  const sortedPlayers = useMemo(() => {
    if (!currentStatic) return [];
    const sortPreset = currentStatic.settings.sortPreset ?? 'custom';
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? currentStatic.settings.displayOrder;
    return sortPlayersByRole(currentStatic.players, displayOrder ?? [], sortPreset);
  }, [currentStatic]);

  // Dragging is always enabled - reordering auto-switches to custom mode

  // Player IDs for SortableContext
  const playerIds = useMemo(() => sortedPlayers.map((p) => p.id), [sortedPlayers]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderPlayers(active.id as string, over.id as string);
    }
  };

  // Handle sort preset change
  const handleSortPresetChange = (preset: SortPreset) => {
    updateSettings({ sortPreset: preset });
  };

  // Handle group view toggle
  const handleGroupViewToggle = (enabled: boolean) => {
    updateSettings({ groupView: enabled });
  };

  // Group players by light party when group view is enabled
  const isGroupView = currentStatic?.settings.groupView ?? false;
  const groupedPlayers = useMemo(() => {
    if (!isGroupView) return null;
    return groupPlayersByLightParty(sortedPlayers);
  }, [isGroupView, sortedPlayers]);

  // Check if we have enough position data to enable group view
  const hasPositionData = sortedPlayers.filter((p) => p.configured && p.position).length >= 2;

  // Grid classes: responsive columns (1 → 2 → 3 → 4) to show full party at once
  // grid-4xl is a custom CSS class for 4 columns at 1400px+
  const gridClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 grid-4xl';

  // Helper function to render a player card (used in both grouped and flat views)
  const renderPlayerCard = (player: Player) => {
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
          settings={currentStatic!.settings}
          viewMode={viewMode}
          clipboardPlayer={clipboardPlayer}
          isDragEnabled={true}
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
          onDuplicate={() => duplicatePlayer(player.id)}
        />
      );
    }

    // Otherwise show empty slot - all unconfigured slots can be removed
    return (
      <EmptySlotCard
        key={player.id}
        templateRole={player.templateRole}
        position={player.position}
        onStartEdit={() => setEditingPlayerId(player.id)}
        onRemove={() => handleRemovePlayer(player.id)}
      />
    );
  };

  // Only count configured players for team summary
  const configuredPlayers = useMemo(() => {
    return sortedPlayers.filter((p) => p.configured);
  }, [sortedPlayers]);

  const teamSummary = useMemo(() => {
    if (!currentStatic || configuredPlayers.length === 0) return null;
    return calculateTeamSummary(configuredPlayers);
  }, [currentStatic, configuredPlayers]);

  const tierInfo = currentStatic ? getTierById(currentStatic.tier) : null;

  const handleUpdatePlayer = (playerId: string, updates: Partial<Player>) => {
    updatePlayer(playerId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRemovePlayer = (playerId: string) => {
    removePlayer(playerId);
  };

  const handleConfigurePlayer = (playerId: string, name: string, job: string, role: string) => {
    configurePlayer(playerId, name, job, role);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-secondary">Loading static...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-status-error">{error}</div>
      </div>
    );
  }

  if (!currentStatic) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-secondary">Static not found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: Tabs + Context Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <TabNavigation activeTab={pageMode} onTabChange={setPageMode} />
        {/*
          Right-side controls container - uses relative/absolute positioning
          to prevent layout shift when switching tabs. Both controls are always
          rendered but only the relevant one is visible.
        */}
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
          {/* Sort mode + Group view + View mode toggle - visible in Players tab, absolutely positioned to overlap */}
          <div className={`absolute right-0 flex items-center gap-3 ${pageMode !== 'players' ? 'invisible' : ''}`}>
            <SortModeSelector
              sortPreset={currentStatic.settings.sortPreset ?? 'custom'}
              onPresetChange={handleSortPresetChange}
            />
            <GroupViewToggle
              enabled={isGroupView}
              onToggle={handleGroupViewToggle}
              disabled={!hasPositionData}
            />
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Players Tab */}
      {pageMode === 'players' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={playerIds} strategy={rectSortingStrategy}>
            {/* Grouped View */}
            {isGroupView && groupedPlayers ? (
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
          settings={currentStatic.settings}
          selectedFloor={selectedFloor}
          floorName={tierInfo.floors[selectedFloor - 1]}
        />
      )}

      {/* Stats Tab */}
      {pageMode === 'stats' && teamSummary && (
        <TeamSummary summary={teamSummary} />
      )}
    </div>
  );
}
