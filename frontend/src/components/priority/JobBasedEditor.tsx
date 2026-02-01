/**
 * Job Based Priority Editor
 *
 * Tree-view editor with collapsible job groups and DnD reordering.
 * Jobs can be dragged between groups to change priority tiers.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
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
  ChevronUp,
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
import { getJobsByRole } from '../../gamedata';
import type {
  JobBasedConfig,
  PriorityGroupConfig,
  JobPriorityConfig,
  SnapshotPlayer,
  RoleType,
} from '../../types';

// Default groups by role
const DEFAULT_GROUPS: PriorityGroupConfig[] = [
  { id: 'melee', name: 'Melee DPS', sortOrder: 0, basePriority: 125 },
  { id: 'ranged', name: 'Physical Ranged', sortOrder: 1, basePriority: 100 },
  { id: 'caster', name: 'Magical Ranged', sortOrder: 2, basePriority: 75 },
  { id: 'tank', name: 'Tank', sortOrder: 3, basePriority: 50 },
  { id: 'healer', name: 'Healer', sortOrder: 4, basePriority: 25 },
];

// Create default job config from role-based groups
function createDefaultJobConfig(): JobPriorityConfig[] {
  const jobs: JobPriorityConfig[] = [];
  const roles: RoleType[] = ['melee', 'ranged', 'caster', 'tank', 'healer'];

  roles.forEach((role) => {
    const roleJobs = getJobsByRole(role);
    roleJobs.forEach((job, index) => {
      jobs.push({
        job: job.abbreviation,
        groupId: role,
        sortOrder: index,
        priorityOffset: 0,
      });
    });
  });

  return jobs;
}

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

// Sortable job item
function SortableJobItem({
  job,
  config,
  isInUse,
  showAdvanced,
  disabled,
  onOffsetChange,
  showInsertBefore,
  showInsertAfter,
  showSwap,
}: {
  job: string;
  config: JobPriorityConfig;
  isInUse: boolean;
  showAdvanced: boolean;
  disabled?: boolean;
  onOffsetChange: (job: string, offset: number) => void;
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
  } = useSortable({ id: job, disabled });

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
        data-droppable-id={job}
        style={style}
        className={`flex items-center gap-2 px-3 py-2 bg-surface-base border rounded-lg transition-all duration-150 ${
          isDragging ? 'opacity-30' : ''
        } ${!isInUse ? 'opacity-50' : ''} ${disabled ? 'pointer-events-none' : ''} ${
          showSwap ? 'ring-2 ring-accent shadow-lg shadow-accent/20 border-accent' : 'border-border-default'
        }`}
        {...attributes}
        {...listeners}
      >
        <span className={`text-text-muted ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}>
          <GripVertical className="w-4 h-4" />
        </span>
        <JobIcon job={job} size="sm" />
        <span className="text-text-primary text-sm flex-1">{job}</span>
        {isInUse && (
          <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            In Use
          </span>
        )}
        <div className={`flex items-center gap-1 ${showAdvanced ? '' : 'invisible'}`}>
          <span className="text-xs text-text-muted">Offset:</span>
          <NumberInput
            value={config.priorityOffset}
            onChange={(value) => onOffsetChange(job, value ?? 0)}
            min={-100}
            max={100}
            step={5}
            size="sm"
            disabled={disabled}
            className="w-24"
          />
        </div>
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
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  jobCount,
  showAdvanced,
  disabled,
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
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  jobCount: number;
  showAdvanced: boolean;
  disabled?: boolean;
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
            <span className="text-xs text-text-muted">({jobCount} jobs)</span>

            <div className={`flex items-center gap-1 ${showAdvanced ? '' : 'invisible'}`}>
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

            {!disabled && (
              <div className="flex items-center gap-0.5">
                <IconButton
                  icon={<ChevronUp className="w-3.5 h-3.5" />}
                  onClick={onMoveUp}
                  variant="ghost"
                  size="sm"
                  aria-label="Move group up"
                  disabled={!canMoveUp}
                />
                <IconButton
                  icon={<ChevronDown className="w-3.5 h-3.5" />}
                  onClick={onMoveDown}
                  variant="ghost"
                  size="sm"
                  aria-label="Move group down"
                  disabled={!canMoveDown}
                />
                <IconButton
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => setIsEditing(true)}
                  variant="ghost"
                  size="sm"
                  aria-label="Rename group"
                />
                <IconButton
                  icon={isDeleteArmed ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  onClick={handleDeleteClick}
                  onBlur={handleDeleteBlur}
                  variant="ghost"
                  size="sm"
                  aria-label={isDeleteArmed ? 'Confirm delete' : 'Delete group'}
                  className={isDeleteArmed ? 'text-status-warning hover:text-status-warning' : 'text-status-error hover:text-status-error'}
                />
              </div>
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

interface JobBasedEditorProps {
  config: JobBasedConfig;
  onChange: (config: JobBasedConfig) => void;
  players: SnapshotPlayer[];
  disabled?: boolean;
}

export function JobBasedEditor({
  config,
  onChange,
  players,
  disabled,
}: JobBasedEditorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(config.groups.map((g) => g.id))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<DropMode>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Jobs currently in use by players
  const jobsInUse = useMemo(() => {
    return new Set(players.filter((p) => p.configured && p.job).map((p) => p.job.toUpperCase()));
  }, [players]);

  // Group jobs by group ID
  const jobsByGroup = useMemo(() => {
    const groups: Record<string, JobPriorityConfig[]> = {};
    config.groups.forEach((g) => {
      groups[g.id] = [];
    });
    config.jobs.forEach((job) => {
      if (groups[job.groupId]) {
        groups[job.groupId].push(job);
      }
    });
    // Sort jobs within each group by sortOrder
    Object.values(groups).forEach((jobs) => {
      jobs.sort((a, b) => a.sortOrder - b.sortOrder);
    });
    return groups;
  }, [config]);

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

      // Recalculate dropMode continuously while dragging over a job or group
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

    // Calculate drop mode for both jobs and groups
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

      const oldIndex = config.groups.findIndex((g) => g.id === activeGroupId);
      let targetIndex = config.groups.findIndex((g) => g.id === overGroupId);

      if (oldIndex !== -1 && targetIndex !== -1) {
        // Handle swap mode - directly swap the two groups
        if (currentDropMode === 'swap') {
          const swapped = [...config.groups];
          [swapped[oldIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[oldIndex]];
          const newGroups = swapped.map((g, i) => ({ ...g, sortOrder: i }));
          onChange({ ...config, groups: newGroups });
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

        const newGroups = arrayMove(config.groups, oldIndex, targetIndex).map(
          (g, i) => ({ ...g, sortOrder: i })
        );
        onChange({ ...config, groups: newGroups });
      }
      return;
    }

    // Handle job dropped onto a group header
    if (!activeIdStr.startsWith('group-') && overIdStr.startsWith('group-')) {
      const targetGroupId = overIdStr.replace('group-', '');
      const activeJob = config.jobs.find((j) => j.job === activeIdStr);

      if (activeJob && activeJob.groupId !== targetGroupId) {
        const newJobs = config.jobs.map((j) => {
          if (j.job === activeIdStr) {
            return { ...j, groupId: targetGroupId, sortOrder: 0 };
          }
          return j;
        });
        onChange({ ...config, jobs: newJobs });
      }
      return;
    }

    // Handle job reordering within or between groups
    if (!activeIdStr.startsWith('group-') && !overIdStr.startsWith('group-')) {
      const activeJob = config.jobs.find((j) => j.job === activeIdStr);
      const overJob = config.jobs.find((j) => j.job === overIdStr);

      if (activeJob && overJob) {
        if (activeJob.groupId === overJob.groupId) {
          // Same group - reorder with precise positioning based on drop mode
          const groupJobs = jobsByGroup[activeJob.groupId] || [];
          const oldIndex = groupJobs.findIndex((j) => j.job === activeIdStr);
          let targetIndex = groupJobs.findIndex((j) => j.job === overIdStr);

          if (oldIndex !== -1 && targetIndex !== -1) {
            // Handle swap mode - directly swap the two items
            if (currentDropMode === 'swap') {
              const swapped = [...groupJobs];
              [swapped[oldIndex], swapped[targetIndex]] = [swapped[targetIndex], swapped[oldIndex]];
              const newJobs = config.jobs.map((j) => {
                if (j.groupId === activeJob.groupId) {
                  const idx = swapped.findIndex((sj) => sj.job === j.job);
                  return { ...j, sortOrder: idx };
                }
                return j;
              });
              onChange({ ...config, jobs: newJobs });
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

            const reordered = arrayMove(groupJobs, oldIndex, targetIndex);
            const newJobs = config.jobs.map((j) => {
              if (j.groupId === activeJob.groupId) {
                const idx = reordered.findIndex((rj) => rj.job === j.job);
                return { ...j, sortOrder: idx };
              }
              return j;
            });
            onChange({ ...config, jobs: newJobs });
          }
        } else {
          // Different group - move to new group
          const newJobs = config.jobs.map((j) => {
            if (j.job === activeIdStr) {
              return { ...j, groupId: overJob.groupId };
            }
            return j;
          });
          onChange({ ...config, jobs: newJobs });
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
      const newGroups = config.groups.map((g) =>
        g.id === groupId ? { ...g, name: newName } : g
      );
      onChange({ ...config, groups: newGroups });
    },
    [config, onChange]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      // Move all jobs in this group to the first remaining group
      const remainingGroups = config.groups.filter((g) => g.id !== groupId);
      if (remainingGroups.length === 0) return;

      const targetGroupId = remainingGroups[0].id;
      const newJobs = config.jobs.map((j) =>
        j.groupId === groupId ? { ...j, groupId: targetGroupId } : j
      );
      const newGroups = remainingGroups.map((g, i) => ({ ...g, sortOrder: i }));

      onChange({ ...config, groups: newGroups, jobs: newJobs });
    },
    [config, onChange]
  );

  const handleMoveGroupUp = useCallback(
    (groupId: string) => {
      const index = config.groups.findIndex((g) => g.id === groupId);
      if (index <= 0) return;

      const newGroups = [...config.groups];
      [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
      onChange({ ...config, groups: newGroups.map((g, i) => ({ ...g, sortOrder: i })) });
    },
    [config, onChange]
  );

  const handleMoveGroupDown = useCallback(
    (groupId: string) => {
      const index = config.groups.findIndex((g) => g.id === groupId);
      if (index < 0 || index >= config.groups.length - 1) return;

      const newGroups = [...config.groups];
      [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
      onChange({ ...config, groups: newGroups.map((g, i) => ({ ...g, sortOrder: i })) });
    },
    [config, onChange]
  );

  const handleAddGroup = useCallback(() => {
    const newGroupId = `custom-${Date.now()}`;
    const newGroup: PriorityGroupConfig = {
      id: newGroupId,
      name: 'New Group',
      sortOrder: config.groups.length,
      basePriority: 0,
    };
    onChange({ ...config, groups: [...config.groups, newGroup] });
    setExpandedGroups((prev) => new Set([...prev, newGroupId]));
  }, [config, onChange]);

  const handleReset = useCallback(() => {
    onChange({
      groups: [...DEFAULT_GROUPS],
      jobs: createDefaultJobConfig(),
      showAdvancedControls: false,
    });
    setExpandedGroups(new Set(DEFAULT_GROUPS.map((g) => g.id)));
  }, [onChange]);

  const handleToggleAdvanced = useCallback(
    (show: boolean) => {
      onChange({ ...config, showAdvancedControls: show });
    },
    [config, onChange]
  );

  const handleJobOffsetChange = useCallback(
    (job: string, offset: number) => {
      const newJobs = config.jobs.map((j) =>
        j.job === job ? { ...j, priorityOffset: offset } : j
      );
      onChange({ ...config, jobs: newJobs });
    },
    [config, onChange]
  );

  const handleGroupBasePriorityChange = useCallback(
    (groupId: string, basePriority: number) => {
      const newGroups = config.groups.map((g) =>
        g.id === groupId ? { ...g, basePriority } : g
      );
      onChange({ ...config, groups: newGroups });
    },
    [config, onChange]
  );

  // Check if current config matches default
  const isDefaultConfig = useMemo(() => {
    const defaultJobs = createDefaultJobConfig();
    return (
      config.groups.length === DEFAULT_GROUPS.length &&
      config.groups.every((g, i) => g.id === DEFAULT_GROUPS[i].id) &&
      config.jobs.length === defaultJobs.length
    );
  }, [config]);

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
          const allGroupIds = config.groups.map((g) => g.id);
          // If all are expanded, collapse all; otherwise expand all
          const allExpanded = allGroupIds.every((id) => prev.has(id));
          return allExpanded ? new Set<string>() : new Set(allGroupIds);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.groups]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          checked={config.showAdvancedControls}
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
          disabled={disabled || isDefaultConfig}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>
      </div>

      {/* Help text */}
      <p className="text-xs text-text-muted">
        Drag groups to reorder priority tiers. Drag jobs between groups to change their priority.
        Jobs marked "In Use" are active in your roster.
      </p>

      {/* Groups and jobs */}
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
          items={config.groups.map((g) => `group-${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <LayoutGroup>
            <div className="space-y-3">
              {config.groups.map((group, groupIndex) => {
                const groupJobs = jobsByGroup[group.id] || [];
                const isExpanded = expandedGroups.has(group.id);
                // Only show group indicators when dragging a group
                const isDraggingGroup = activeId?.startsWith('group-');
                const isOverGroup = overId === `group-${group.id}` && activeId !== `group-${group.id}`;
                const showGroupIndicators = isDraggingGroup && isOverGroup;

                return (
                  <motion.div
                    key={group.id}
                    layoutId={`group-container-${group.id}`}
                    layout={!activeId}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="space-y-2"
                  >
                  <SortableGroupHeader
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => handleToggleGroup(group.id)}
                    onRename={(name) => handleRenameGroup(group.id, name)}
                    onDelete={() => handleDeleteGroup(group.id)}
                    onMoveUp={() => handleMoveGroupUp(group.id)}
                    onMoveDown={() => handleMoveGroupDown(group.id)}
                    canMoveUp={groupIndex > 0}
                    canMoveDown={groupIndex < config.groups.length - 1}
                    jobCount={groupJobs.length}
                    showAdvanced={config.showAdvancedControls}
                    disabled={disabled}
                    onBasePriorityChange={(priority) =>
                      handleGroupBasePriorityChange(group.id, priority)
                    }
                    showInsertBefore={showGroupIndicators && dropMode === 'insert-before'}
                    showInsertAfter={showGroupIndicators && dropMode === 'insert-after'}
                    showSwap={showGroupIndicators && dropMode === 'swap'}
                  />

                  {isExpanded && groupJobs.length > 0 && (
                    <SortableContext
                      items={groupJobs.map((j) => j.job)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="ml-6 space-y-1">
                        {groupJobs.map((jobConfig) => {
                          // Only show job indicators when dragging a job (not a group)
                          const isDraggingJob = activeId && !activeId.startsWith('group-');
                          const isOverJob = overId === jobConfig.job && activeId !== jobConfig.job;
                          const showJobIndicators = isDraggingJob && isOverJob;
                          return (
                            <SortableJobItem
                              key={jobConfig.job}
                              job={jobConfig.job}
                              config={jobConfig}
                              isInUse={jobsInUse.has(jobConfig.job)}
                              showAdvanced={config.showAdvancedControls}
                              disabled={disabled}
                              onOffsetChange={handleJobOffsetChange}
                              showInsertBefore={showJobIndicators && dropMode === 'insert-before'}
                              showInsertAfter={showJobIndicators && dropMode === 'insert-after'}
                              showSwap={showJobIndicators && dropMode === 'swap'}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  )}

                </motion.div>
              );
            })}
            </div>
          </LayoutGroup>
        </SortableContext>

        <DragOverlay>
          {activeId && !activeId.startsWith('group-') && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-accent rounded-lg shadow-lg">
              <JobIcon job={activeId} size="sm" />
              <span className="text-text-primary text-sm">{activeId}</span>
            </div>
          )}
          {activeId && activeId.startsWith('group-') && (() => {
            const groupId = activeId.replace('group-', '');
            const group = config.groups.find((g) => g.id === groupId);
            const groupJobs = jobsByGroup[groupId] || [];
            const isExpanded = expandedGroups.has(groupId);
            if (!group) return null;
            return (
              <div className="bg-surface-elevated border border-accent rounded-lg shadow-xl overflow-hidden max-w-xs">
                <div className={`flex items-center gap-2 px-3 py-2 bg-surface-base ${isExpanded && groupJobs.length > 0 ? 'border-b border-border-default' : ''}`}>
                  <GripVertical className="w-5 h-5 text-text-muted" />
                  <span className="text-text-primary font-medium">{group.name}</span>
                  <span className="text-xs text-text-muted">({groupJobs.length} jobs)</span>
                </div>
                {isExpanded && groupJobs.length > 0 && (
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {groupJobs.slice(0, 8).map((jobConfig) => (
                      <div
                        key={jobConfig.job}
                        className="flex items-center gap-2 px-2 py-1 bg-surface-base rounded text-sm"
                      >
                        <JobIcon job={jobConfig.job} size="sm" />
                        <span className="text-text-primary">{jobConfig.job}</span>
                      </div>
                    ))}
                    {groupJobs.length > 8 && (
                      <div className="text-xs text-text-muted text-center py-1">
                        +{groupJobs.length - 8} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
