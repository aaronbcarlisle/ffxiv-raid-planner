/**
 * Player Based Priority Editor
 *
 * Tree-view editor with collapsible player groups and DnD reordering.
 * Players can be dragged between groups to change priority tiers.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDoubleClickConfirm } from '../../hooks/useDoubleClickConfirm';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
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
import { Input, NumberInput, Toggle } from '../ui';
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

// Drop mode for visual indicators
type DropMode = 'insert-before' | 'insert-after' | 'swap' | null;

// Edge threshold for insert mode (25% on each edge, middle 50% for swap)
const EDGE_THRESHOLD = 0.25;

// Calculate drop mode based on pointer position
function calculateDropMode(element: Element, clientY: number): DropMode {
  const rect = element.getBoundingClientRect();
  const relativeY = clientY - rect.top;
  const percentage = relativeY / rect.height;

  if (percentage < EDGE_THRESHOLD) return 'insert-before';
  if (percentage > 1 - EDGE_THRESHOLD) return 'insert-after';
  return 'swap';
}

// Sortable player item
function SortablePlayerItem({
  player,
  config,
  showAdvanced,
  disabled,
  onOffsetChange,
  showInsertBefore,
  showInsertAfter,
  showSwap,
}: {
  player: SnapshotPlayer;
  config: PlayerPriorityConfig;
  showAdvanced: boolean;
  disabled?: boolean;
  onOffsetChange: (playerId: string, offset: number) => void;
  showInsertBefore?: boolean;
  showInsertAfter?: boolean;
  showSwap?: boolean;
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
    <div className="relative">
      {/* Insert indicator - horizontal line above */}
      {showInsertBefore && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}

      <div
        ref={setNodeRef}
        data-droppable-id={player.id}
        style={style}
        className={`flex items-center gap-2 px-3 py-2 bg-surface-base border rounded-lg transition-all duration-150 ${
          isDragging ? 'opacity-30' : ''
        } ${disabled ? 'pointer-events-none' : ''} ${
          showSwap ? 'ring-2 ring-accent shadow-lg shadow-accent/20 border-accent' : 'border-border-default'
        }`}
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

      {/* Insert indicator - horizontal line below */}
      {showInsertAfter && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
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
  showInsertBefore,
  showInsertAfter,
  showSwap,
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
  showInsertBefore?: boolean;
  showInsertAfter?: boolean;
  showSwap?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  // Double-click confirm for delete
  const { isArmed: isDeleteArmed, handleClick: handleDeleteClick, handleBlur: handleDeleteBlur } =
    useDoubleClickConfirm({ onConfirm: onDelete });

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
    <div className="relative">
      {/* Insert indicator - horizontal line above */}
      {showInsertBefore && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}

      <div
        ref={setNodeRef}
        data-droppable-id={`group-${group.id}`}
        style={style}
        className={`flex items-center gap-2 px-3 py-2 bg-surface-elevated border rounded-lg transition-all duration-150 ${
          isDragging ? 'opacity-50 shadow-lg z-50' : ''
        } ${showSwap ? 'ring-2 ring-accent shadow-lg shadow-accent/20 border-accent' : 'border-border-default'}`}
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
                    icon={isDeleteArmed ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    onClick={handleDeleteClick}
                    onBlur={handleDeleteBlur}
                    variant="ghost"
                    size="sm"
                    aria-label={isDeleteArmed ? 'Confirm delete' : 'Delete group'}
                    className={isDeleteArmed ? 'text-status-warning hover:text-status-warning' : 'text-status-error hover:text-status-error'}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Insert indicator - horizontal line below */}
      {showInsertAfter && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}
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
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<DropMode>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Track pointer position for calculating drop mode
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };

      // Recalculate dropMode continuously while dragging over a player or group
      if (activeId && overId) {
        const element = document.querySelector(`[data-droppable-id="${overId}"]`);
        if (element) {
          const newDropMode = calculateDropMode(element, e.clientY);
          if (newDropMode !== dropMode) {
            setDropMode(newDropMode);
          }
        }
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [activeId, overId, dropMode]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const newOverId = event.over?.id as string | null;

    if (!newOverId || newOverId === activeId) {
      setOverId(null);
      setDropMode(null);
      return;
    }

    setOverId(newOverId);

    // Calculate drop mode for both players and groups
    const element = document.querySelector(`[data-droppable-id="${newOverId}"]`);
    if (element) {
      setDropMode(calculateDropMode(element, pointerRef.current.y));
    } else {
      setDropMode(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropMode = dropMode;

    // Clear state
    setActiveId(null);
    setOverId(null);
    setDropMode(null);

    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle group reordering
    if (activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const activeGroupId = activeIdStr.replace('group-', '');
      const overGroupId = overIdStr.replace('group-', '');

      const oldIndex = ensuredConfig.groups.findIndex((g) => g.id === activeGroupId);
      let targetIndex = ensuredConfig.groups.findIndex((g) => g.id === overGroupId);

      if (oldIndex !== -1 && targetIndex !== -1) {
        // Handle swap mode - directly swap the two groups
        if (currentDropMode === 'swap') {
          const swapped = [...ensuredConfig.groups];
          [swapped[oldIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[oldIndex]];
          const newGroups = swapped.map((g, i) => ({ ...g, sortOrder: i }));
          onChange({ ...ensuredConfig, groups: newGroups });
          return;
        }

        // Handle insert mode
        if (currentDropMode === 'insert-after') {
          targetIndex = targetIndex + 1;
        }
        // Adjust if moving from before the target
        if (oldIndex < targetIndex) {
          targetIndex--;
        }

        const newGroups = arrayMove(ensuredConfig.groups, oldIndex, targetIndex).map(
          (g, i) => ({ ...g, sortOrder: i })
        );
        onChange({ ...ensuredConfig, groups: newGroups });
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
          // Same group - reorder with precise positioning based on drop mode
          const groupPlayers = playersByGroup[activePlayer.groupId] || [];
          const oldIndex = groupPlayers.findIndex((p) => p.player.id === activeIdStr);
          let targetIndex = groupPlayers.findIndex((p) => p.player.id === overIdStr);

          if (oldIndex !== -1 && targetIndex !== -1) {
            // Handle swap mode - directly swap the two items
            if (currentDropMode === 'swap') {
              const swapped = [...groupPlayers];
              [swapped[oldIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[oldIndex]];
              const newPlayers = ensuredConfig.players.map((p) => {
                if (p.groupId === activePlayer.groupId) {
                  const idx = swapped.findIndex((sp) => sp.player.id === p.playerId);
                  return { ...p, sortOrder: idx >= 0 ? idx : p.sortOrder };
                }
                return p;
              });
              onChange({ ...ensuredConfig, players: newPlayers });
              return;
            }

            // Handle insert mode
            if (currentDropMode === 'insert-after') {
              targetIndex = targetIndex + 1;
            }
            // Adjust if moving from before the target
            if (oldIndex < targetIndex) {
              targetIndex--;
            }

            const reordered = arrayMove(groupPlayers, oldIndex, targetIndex);
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

  // Keyboard shortcut: 'v' to toggle all groups expanded/collapsed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setExpandedGroups((prev) => {
          const allGroupIds = ensuredConfig.groups.map((g) => g.id);
          // If all are expanded, collapse all; otherwise expand all
          const allExpanded = allGroupIds.every((id) => prev.has(id));
          return allExpanded ? new Set<string>() : new Set(allGroupIds);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ensuredConfig.groups]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          checked={ensuredConfig.showAdvancedControls}
          onChange={handleToggleAdvanced}
          disabled={disabled}
          label="Show priority values"
          size="sm"
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
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverId(null);
            setDropMode(null);
          }}
        >
          <SortableContext
            items={ensuredConfig.groups.map((g) => `group-${g.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {ensuredConfig.groups.map((group) => {
                const groupPlayers = playersByGroup[group.id] || [];
                const isExpanded = expandedGroups.has(group.id);
                // Only show group indicators when dragging a group
                const isDraggingGroup = activeId?.startsWith('group-');
                const isOverGroup = overId === `group-${group.id}` && activeId !== `group-${group.id}`;
                const showGroupIndicators = isDraggingGroup && isOverGroup;

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
                      showInsertBefore={showGroupIndicators && dropMode === 'insert-before'}
                      showInsertAfter={showGroupIndicators && dropMode === 'insert-after'}
                      showSwap={showGroupIndicators && dropMode === 'swap'}
                    />

                    {isExpanded && groupPlayers.length > 0 && (
                      <SortableContext
                        items={groupPlayers.map((p) => p.player.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="ml-6 space-y-1">
                          {groupPlayers.map(({ player, config: playerConfig }) => {
                            // Only show player indicators when dragging a player (not a group)
                            const isDraggingPlayer = activeId && !activeId.startsWith('group-');
                            const isOverPlayer = overId === player.id && activeId !== player.id;
                            const showPlayerIndicators = isDraggingPlayer && isOverPlayer;
                            return (
                              <SortablePlayerItem
                                key={player.id}
                                player={player}
                                config={playerConfig}
                                showAdvanced={ensuredConfig.showAdvancedControls}
                                disabled={disabled}
                                onOffsetChange={handlePlayerOffsetChange}
                                showInsertBefore={showPlayerIndicators && dropMode === 'insert-before'}
                                showInsertAfter={showPlayerIndicators && dropMode === 'insert-after'}
                                showSwap={showPlayerIndicators && dropMode === 'swap'}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
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
