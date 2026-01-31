/**
 * Job Based Priority Editor
 *
 * Tree-view editor with collapsible job groups and DnD reordering.
 * Jobs can be dragged between groups to change priority tiers.
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

// Sortable job item
function SortableJobItem({
  job,
  config,
  isInUse,
  showAdvanced,
  disabled,
  onOffsetChange,
}: {
  job: string;
  config: JobPriorityConfig;
  isInUse: boolean;
  showAdvanced: boolean;
  disabled?: boolean;
  onOffsetChange: (job: string, offset: number) => void;
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
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-surface-base border border-border-default rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      } ${!isInUse ? 'opacity-50' : ''} ${disabled ? 'pointer-events-none' : ''}`}
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
      {showAdvanced && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted">Offset:</span>
          <NumberInput
            value={config.priorityOffset}
            onChange={(value) => onOffsetChange(job, value ?? 0)}
            min={-100}
            max={100}
            step={5}
            size="sm"
            disabled={disabled}
            className="w-16"
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
  jobCount,
  showAdvanced,
  disabled,
  isCustomGroup,
  onBasePriorityChange,
}: {
  group: PriorityGroupConfig;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  jobCount: number;
  showAdvanced: boolean;
  disabled?: boolean;
  isCustomGroup: boolean;
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
          <span className="text-xs text-text-muted">({jobCount} jobs)</span>

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
                className="w-16"
              />
            </div>
          )}

          {isCustomGroup && !disabled && (
            <>
              <IconButton
                icon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                aria-label="Rename group"
              />
              <IconButton
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={onDelete}
                variant="ghost"
                size="sm"
                aria-label="Delete group"
                className="text-status-error hover:text-status-error"
              />
            </>
          )}
        </>
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

      const oldIndex = config.groups.findIndex((g) => g.id === activeGroupId);
      const newIndex = config.groups.findIndex((g) => g.id === overGroupId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newGroups = arrayMove(config.groups, oldIndex, newIndex).map(
          (g, i) => ({ ...g, sortOrder: i })
        );
        onChange({ ...config, groups: newGroups });
      }
      return;
    }

    // Handle job reordering within or between groups
    if (!activeIdStr.startsWith('group-') && !overIdStr.startsWith('group-')) {
      const activeJob = config.jobs.find((j) => j.job === activeIdStr);
      const overJob = config.jobs.find((j) => j.job === overIdStr);

      if (activeJob && overJob) {
        if (activeJob.groupId === overJob.groupId) {
          // Same group - reorder
          const groupJobs = jobsByGroup[activeJob.groupId] || [];
          const oldIndex = groupJobs.findIndex((j) => j.job === activeIdStr);
          const newIndex = groupJobs.findIndex((j) => j.job === overIdStr);

          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(groupJobs, oldIndex, newIndex);
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Checkbox
          checked={config.showAdvancedControls}
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
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={config.groups.map((g) => `group-${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {config.groups.map((group) => {
              const groupJobs = jobsByGroup[group.id] || [];
              const isExpanded = expandedGroups.has(group.id);
              const isCustomGroup = !DEFAULT_GROUPS.some((dg) => dg.id === group.id);

              return (
                <div key={group.id} className="space-y-2">
                  <SortableGroupHeader
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => handleToggleGroup(group.id)}
                    onRename={(name) => handleRenameGroup(group.id, name)}
                    onDelete={() => handleDeleteGroup(group.id)}
                    jobCount={groupJobs.length}
                    showAdvanced={config.showAdvancedControls}
                    disabled={disabled}
                    isCustomGroup={isCustomGroup}
                    onBasePriorityChange={(priority) =>
                      handleGroupBasePriorityChange(group.id, priority)
                    }
                  />

                  {isExpanded && groupJobs.length > 0 && (
                    <SortableContext
                      items={groupJobs.map((j) => j.job)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="ml-6 space-y-1">
                        {groupJobs.map((jobConfig) => (
                          <SortableJobItem
                            key={jobConfig.job}
                            job={jobConfig.job}
                            config={jobConfig}
                            isInUse={jobsInUse.has(jobConfig.job)}
                            showAdvanced={config.showAdvancedControls}
                            disabled={disabled}
                            onOffsetChange={handleJobOffsetChange}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}

                  {isExpanded && groupJobs.length === 0 && (
                    <div className="ml-6 text-text-muted text-sm italic py-2">
                      No jobs in this group. Drag jobs here to add them.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId && !activeId.startsWith('group-') && (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-accent rounded-lg shadow-lg">
              <JobIcon job={activeId} size="sm" />
              <span className="text-text-primary text-sm">{activeId}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
