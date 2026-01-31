/**
 * Player Based Priority Editor
 *
 * Tree-view editor with collapsible player groups and DnD reordering.
 * Players can be dragged between groups to change priority tiers.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { Input, NumberInput, Checkbox } from '../ui';
import { JobIcon } from '../ui/JobIcon';
import type {
  PlayerBasedConfig,
  PriorityGroupConfig,
  PlayerPriorityConfig,
  SnapshotPlayer,
} from '../../types';

// Default single group for all players
const DEFAULT_GROUPS: PriorityGroupConfig[] = [
  { id: 'all', name: 'All Players', sortOrder: 0, basePriority: 100 },
];

// Sortable player item
function SortablePlayerItem({
  player,
  config,
  showAdvanced,
  disabled,
  onOffsetChange,
}: {
  player: SnapshotPlayer;
  config: PlayerPriorityConfig;
  showAdvanced: boolean;
  disabled?: boolean;
  onOffsetChange: (playerId: string, offset: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-surface-base border border-border-default rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      } ${disabled ? 'pointer-events-none' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className={`text-text-muted ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}>
        <GripVertical className="w-4 h-4" />
      </span>
      {player.job && <JobIcon job={player.job} size="sm" />}
      <span className="text-text-primary text-sm flex-1">
        {player.name || 'Unnamed Player'}
      </span>
      <span className="text-xs text-text-muted">{player.job || '?'}</span>
      {showAdvanced && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted">Offset:</span>
          <NumberInput
            value={config.priorityOffset}
            onChange={(value) => onOffsetChange(player.id, value ?? 0)}
            min={-100}
            max={100}
            step={5}
            size="sm"
            disabled={disabled}
            className="w-24"
          />
        </div>
      )}
    </div>
  );
}

// Sortable group header
function SortableGroupHeader({
  group,
  isExpanded,
  onToggle,
  onRename,
  onDelete,
  playerCount,
  showAdvanced,
  disabled,
  isCustomGroup: _isCustomGroup,
  canDelete,
  onBasePriorityChange,
}: {
  group: PriorityGroupConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  playerCount: number;
  showAdvanced: boolean;
  disabled?: boolean;
  isCustomGroup?: boolean;
  canDelete: boolean;
  onBasePriorityChange: (priority: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}`, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSaveRename = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(group.name);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border-default rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      }`}
    >
      <span
        className={`text-text-muted ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </span>

      <button
        type="button"
        onClick={onToggle}
        className="text-text-muted hover:text-text-primary"
        disabled={disabled}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={editName}
            onChange={setEditName}
            size="sm"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') handleCancelRename();
            }}
          />
          <IconButton
            icon={<Check className="w-4 h-4" />}
            onClick={handleSaveRename}
            variant="ghost"
            size="sm"
            aria-label="Save"
          />
          <IconButton
            icon={<X className="w-4 h-4" />}
            onClick={handleCancelRename}
            variant="ghost"
            size="sm"
            aria-label="Cancel"
          />
        </div>
      ) : (
        <>
          <span className="text-text-primary font-medium flex-1">{group.name}</span>
          <span className="text-xs text-text-muted">({playerCount} players)</span>

          {showAdvanced && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-muted">Base:</span>
              <NumberInput
                value={group.basePriority}
                onChange={(value) => onBasePriorityChange(value ?? 0)}
                min={0}
                max={200}
                step={25}
                size="sm"
                disabled={disabled}
                className="w-24"
              />
            </div>
          )}

          {!disabled && (
            <>
              <IconButton
                icon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                aria-label="Rename group"
              />
              {canDelete && (
                <IconButton
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={onDelete}
                  variant="ghost"
                  size="sm"
                  aria-label="Delete group"
                  className="text-status-error hover:text-status-error"
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// Droppable zone for groups to accept player drops
function DroppableGroupZone({ groupId, isEmpty }: { groupId: string; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `dropzone-${groupId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`ml-6 py-3 px-4 border-2 border-dashed rounded-lg text-sm text-center transition-colors ${
        isOver
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border-default text-text-muted'
      }`}
    >
      {isEmpty ? 'Drop players here' : 'Drop here to add to this group'}
    </div>
  );
}

interface PlayerBasedEditorProps {
  config: PlayerBasedConfig;
  onChange: (config: PlayerBasedConfig) => void;
  players: SnapshotPlayer[];
  disabled?: boolean;
}

export function PlayerBasedEditor({
  config,
  onChange,
  players,
  disabled,
}: PlayerBasedEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(config.groups.map((g) => g.id))
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Only configured players
  const configuredPlayers = useMemo(() => {
    return players.filter((p) => p.configured && !p.isSubstitute);
  }, [players]);

  // Ensure all configured players have a config entry
  const ensuredConfig = useMemo(() => {
    const existingPlayerIds = new Set(config.players.map((p) => p.playerId));
    const missingPlayers = configuredPlayers.filter(
      (p) => !existingPlayerIds.has(p.id)
    );

    if (missingPlayers.length === 0) return config;

    // Add missing players to the first group
    const firstGroupId = config.groups[0]?.id || 'all';
    const newPlayerConfigs = missingPlayers.map((p, i) => ({
      playerId: p.id,
      groupId: firstGroupId,
      sortOrder: config.players.length + i,
      priorityOffset: 0,
    }));

    return {
      ...config,
      players: [...config.players, ...newPlayerConfigs],
    };
  }, [config, configuredPlayers]);

  // Group players by group ID
  const playersByGroup = useMemo(() => {
    const groups: Record<string, Array<{ player: SnapshotPlayer; config: PlayerPriorityConfig }>> = {};
    ensuredConfig.groups.forEach((g) => {
      groups[g.id] = [];
    });

    ensuredConfig.players.forEach((playerConfig) => {
      const player = configuredPlayers.find((p) => p.id === playerConfig.playerId);
      if (player && groups[playerConfig.groupId]) {
        groups[playerConfig.groupId].push({ player, config: playerConfig });
      }
    });

    // Sort players within each group by sortOrder
    Object.values(groups).forEach((items) => {
      items.sort((a, b) => a.config.sortOrder - b.config.sortOrder);
    });

    return groups;
  }, [ensuredConfig, configuredPlayers]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: disabled ? 999999 : 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle group reordering
    if (activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const activeGroupId = activeIdStr.replace('group-', '');
      const overGroupId = overIdStr.replace('group-', '');

      const oldIndex = ensuredConfig.groups.findIndex((g) => g.id === activeGroupId);
      const newIndex = ensuredConfig.groups.findIndex((g) => g.id === overGroupId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newGroups = arrayMove(ensuredConfig.groups, oldIndex, newIndex).map(
          (g, i) => ({ ...g, sortOrder: i })
        );
        onChange({ ...ensuredConfig, groups: newGroups });
      }
      return;
    }

    // Handle player dropped onto a dropzone (empty group area)
    if (!activeIdStr.startsWith('group-') && overIdStr.startsWith('dropzone-')) {
      const targetGroupId = overIdStr.replace('dropzone-', '');
      const activePlayer = ensuredConfig.players.find((p) => p.playerId === activeIdStr);

      if (activePlayer && activePlayer.groupId !== targetGroupId) {
        const newPlayers = ensuredConfig.players.map((p) => {
          if (p.playerId === activeIdStr) {
            return { ...p, groupId: targetGroupId, sortOrder: 0 };
          }
          return p;
        });
        onChange({ ...ensuredConfig, players: newPlayers });
      }
      return;
    }

    // Handle player dropped onto a group header
    if (!activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const targetGroupId = overIdStr.replace('group-', '');
      const activePlayer = ensuredConfig.players.find((p) => p.playerId === activeIdStr);

      if (activePlayer && activePlayer.groupId !== targetGroupId) {
        const newPlayers = ensuredConfig.players.map((p) => {
          if (p.playerId === activeIdStr) {
            return { ...p, groupId: targetGroupId, sortOrder: 0 };
          }
          return p;
        });
        onChange({ ...ensuredConfig, players: newPlayers });
      }
      return;
    }

    // Handle player reordering within or between groups
    if (!activeIdStr.startsWith('group-') && !overIdStr.startsWith('group-')) {
      const activePlayer = ensuredConfig.players.find((p) => p.playerId === activeIdStr);
      const overPlayer = ensuredConfig.players.find((p) => p.playerId === overIdStr);

      if (activePlayer && overPlayer) {
        if (activePlayer.groupId === overPlayer.groupId) {
          // Same group - reorder
          const groupPlayers = playersByGroup[activePlayer.groupId] || [];
          const oldIndex = groupPlayers.findIndex((p) => p.player.id === activeIdStr);
          const newIndex = groupPlayers.findIndex((p) => p.player.id === overIdStr);

          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(groupPlayers, oldIndex, newIndex);
            const newPlayers = ensuredConfig.players.map((p) => {
              if (p.groupId === activePlayer.groupId) {
                const idx = reordered.findIndex((rp) => rp.player.id === p.playerId);
                return { ...p, sortOrder: idx >= 0 ? idx : p.sortOrder };
              }
              return p;
            });
            onChange({ ...ensuredConfig, players: newPlayers });
          }
        } else {
          // Different group - move to new group
          const newPlayers = ensuredConfig.players.map((p) => {
            if (p.playerId === activeIdStr) {
              return { ...p, groupId: overPlayer.groupId };
            }
            return p;
          });
          onChange({ ...ensuredConfig, players: newPlayers });
        }
      }
    }
  };

  const handleToggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleRenameGroup = useCallback(
    (groupId: string, newName: string) => {
      const newGroups = ensuredConfig.groups.map((g) =>
        g.id === groupId ? { ...g, name: newName } : g
      );
      onChange({ ...ensuredConfig, groups: newGroups });
    },
    [ensuredConfig, onChange]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      // Move all players in this group to the first remaining group
      const remainingGroups = ensuredConfig.groups.filter((g) => g.id !== groupId);
      if (remainingGroups.length === 0) return;

      const targetGroupId = remainingGroups[0].id;
      const newPlayers = ensuredConfig.players.map((p) =>
        p.groupId === groupId ? { ...p, groupId: targetGroupId } : p
      );
      const newGroups = remainingGroups.map((g, i) => ({ ...g, sortOrder: i }));

      onChange({ ...ensuredConfig, groups: newGroups, players: newPlayers });
    },
    [ensuredConfig, onChange]
  );

  const handleAddGroup = useCallback(() => {
    const newGroupId = `custom-${Date.now()}`;
    const newGroup: PriorityGroupConfig = {
      id: newGroupId,
      name: 'New Group',
      sortOrder: ensuredConfig.groups.length,
      basePriority: 0,
    };
    onChange({ ...ensuredConfig, groups: [...ensuredConfig.groups, newGroup] });
    setExpandedGroups((prev) => new Set([...prev, newGroupId]));
  }, [ensuredConfig, onChange]);

  const handleReset = useCallback(() => {
    // Create default config with all players in one group
    const playerConfigs = configuredPlayers.map((p, i) => ({
      playerId: p.id,
      groupId: 'all',
      sortOrder: i,
      priorityOffset: 0,
    }));

    onChange({
      groups: [...DEFAULT_GROUPS],
      players: playerConfigs,
      showAdvancedControls: false,
    });
    setExpandedGroups(new Set(['all']));
  }, [configuredPlayers, onChange]);

  const handleToggleAdvanced = useCallback(
    (show: boolean) => {
      onChange({ ...ensuredConfig, showAdvancedControls: show });
    },
    [ensuredConfig, onChange]
  );

  const handlePlayerOffsetChange = useCallback(
    (playerId: string, offset: number) => {
      const newPlayers = ensuredConfig.players.map((p) =>
        p.playerId === playerId ? { ...p, priorityOffset: offset } : p
      );
      onChange({ ...ensuredConfig, players: newPlayers });
    },
    [ensuredConfig, onChange]
  );

  const handleGroupBasePriorityChange = useCallback(
    (groupId: string, basePriority: number) => {
      const newGroups = ensuredConfig.groups.map((g) =>
        g.id === groupId ? { ...g, basePriority } : g
      );
      onChange({ ...ensuredConfig, groups: newGroups });
    },
    [ensuredConfig, onChange]
  );

  // Find active player for drag overlay
  const activePlayer = activeId
    ? configuredPlayers.find((p) => p.id === activeId)
    : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={ensuredConfig.showAdvancedControls}
          onChange={handleToggleAdvanced}
          disabled={disabled}
          label="Show priority values"
        />
        <div className="flex-1" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddGroup}
          disabled={disabled}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Group
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={disabled}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>
      </div>

      {/* Help text */}
      <p className="text-xs text-text-muted">
        Drag groups to reorder priority tiers. Drag players between groups to change their priority.
        Higher groups have higher priority for loot.
      </p>

      {configuredPlayers.length === 0 && (
        <div className="p-4 bg-surface-elevated rounded-lg border border-border-default text-center text-text-muted">
          No configured players in the roster. Configure players first to set up player-based priority.
        </div>
      )}

      {configuredPlayers.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ensuredConfig.groups.map((g) => `group-${g.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {ensuredConfig.groups.map((group) => {
                const groupPlayers = playersByGroup[group.id] || [];
                const isExpanded = expandedGroups.has(group.id);

                return (
                  <div key={group.id} className="space-y-2">
                    <SortableGroupHeader
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => handleToggleGroup(group.id)}
                      onRename={(name) => handleRenameGroup(group.id, name)}
                      onDelete={() => handleDeleteGroup(group.id)}
                      playerCount={groupPlayers.length}
                      showAdvanced={ensuredConfig.showAdvancedControls}
                      disabled={disabled}
                      isCustomGroup={!DEFAULT_GROUPS.some((dg) => dg.id === group.id)}
                      canDelete={ensuredConfig.groups.length > 1}
                      onBasePriorityChange={(priority) =>
                        handleGroupBasePriorityChange(group.id, priority)
                      }
                    />

                    {isExpanded && groupPlayers.length > 0 && (
                      <SortableContext
                        items={groupPlayers.map((p) => p.player.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="ml-6 space-y-1">
                          {groupPlayers.map(({ player, config: playerConfig }) => (
                            <SortablePlayerItem
                              key={player.id}
                              player={player}
                              config={playerConfig}
                              showAdvanced={ensuredConfig.showAdvancedControls}
                              disabled={disabled}
                              onOffsetChange={handlePlayerOffsetChange}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    )}

                    {isExpanded && (
                      <DroppableGroupZone groupId={group.id} isEmpty={groupPlayers.length === 0} />
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activePlayer && (
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-accent rounded-lg shadow-lg">
                {activePlayer.job && <JobIcon job={activePlayer.job} size="sm" />}
                <span className="text-text-primary text-sm">
                  {activePlayer.name || 'Unnamed Player'}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
