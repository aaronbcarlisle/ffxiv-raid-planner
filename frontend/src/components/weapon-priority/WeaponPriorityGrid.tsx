/**
 * Weapon Priority Grid
 *
 * Multi-column grid for displaying and reordering weapon priorities.
 * Uses dnd-kit for drag and drop functionality.
 * Styled to match the original WeaponPriorityListItem from main.
 */

import { useState, useEffect, useRef } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import type { WeaponPriority } from '../../types';
import { JobIcon, Checkbox } from '../ui';
import { RAID_JOBS } from '../../gamedata/jobs';
import { useDevice } from '../../hooks/useDevice';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface WeaponPriorityGridProps {
  weaponPriorities: WeaponPriority[];
  onChange: (priorities: WeaponPriority[]) => void;
  disabled?: boolean;
  mainJob?: string;
  onMainJobMoveAttempt?: (action: () => void) => void;
  onAddJobsClick?: () => void;
}

interface SortableItemProps {
  id: string;
  priority: WeaponPriority;
  index: number;
  totalItems: number;
  isMainJob: boolean;
  disabled: boolean;
  showInsertBefore: boolean;
  showInsertAfter: boolean;
  showSwap: boolean;
  isSmallScreen: boolean;
  onRemove: () => void;
  onToggleReceived: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

interface ItemContentProps {
  priority: WeaponPriority;
  index: number;
  isMainJob: boolean;
  disabled: boolean;
  onRemove?: () => void;
  onToggleReceived?: () => void;
  isDragOverlay?: boolean;
}

// Shared item content - used by both sortable items and drag overlay
function ItemContent({
  priority,
  index,
  isMainJob,
  disabled,
  onRemove,
  onToggleReceived,
  isDragOverlay = false,
}: ItemContentProps) {
  const jobInfo = RAID_JOBS.find((j) => j.abbreviation === priority.job);
  const jobName = jobInfo?.name || priority.job;

  return (
    <>
      {/* Drag handle */}
      <div
        className={`flex-shrink-0 ${isDragOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'} ${
          disabled ? 'opacity-30 cursor-not-allowed' : ''
        }`}
      >
        <svg
          className="w-4 h-4 text-text-muted"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>

      {/* Priority number - circular teal badge */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">
        {index + 1}
      </div>

      {/* Job icon */}
      <div className="flex-shrink-0">
        <JobIcon job={priority.job} size="sm" />
      </div>

      {/* Job name - takes remaining space */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-sm font-medium text-text-primary truncate">{jobName}</span>
        {isMainJob && (
          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
            Main
          </span>
        )}
      </div>

      {/* Received checkbox with label - label hidden on mobile */}
      <Checkbox
        checked={priority.received}
        onChange={() => onToggleReceived?.()}
        disabled={disabled || isDragOverlay}
        label={<span className="hidden sm:inline">Received</span>}
        className="gap-1.5"
        aria-label="Received"
      />

      {/* Remove button - always visible */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
        disabled={disabled || isDragOverlay}
        className="flex-shrink-0 p-1 rounded hover:bg-surface-hover text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove job"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </>
  );
}

function SortableGridItem({
  id,
  priority,
  index,
  totalItems,
  isMainJob,
  disabled,
  showInsertBefore,
  showInsertAfter,
  showSwap,
  isSmallScreen,
  onRemove,
  onToggleReceived,
  onMoveUp,
  onMoveDown,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div className="relative">
      {/* Insert indicator - horizontal line above */}
      {showInsertBefore && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-accent rounded-full shadow-lg shadow-accent/50 z-10" />
      )}

      <div className="flex items-center gap-1">
        {/* Mobile move buttons - shown on touch devices */}
        {isSmallScreen && !disabled && (
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === totalItems - 1}
              className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          ref={setNodeRef}
          data-droppable-id={id}
          {...attributes}
          {...listeners}
          className={`flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface-elevated border rounded overflow-hidden transition-all duration-150 ${
            isDragging ? 'opacity-30' : ''
          } ${disabled ? 'cursor-not-allowed' : ''} ${
            showSwap ? 'ring-2 ring-accent shadow-lg shadow-accent/20 border-accent' : 'border-border-default'
          }`}
        >
          <ItemContent
            priority={priority}
            index={index}
            isMainJob={isMainJob}
            disabled={disabled}
            onRemove={onRemove}
            onToggleReceived={onToggleReceived}
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

type DropMode = 'insert-before' | 'insert-after' | 'swap' | null;

const EDGE_THRESHOLD = 0.25; // 25% on each edge for insert mode, middle 50% for swap

export function WeaponPriorityGrid({
  weaponPriorities,
  onChange,
  disabled = false,
  mainJob,
  onMainJobMoveAttempt,
  onAddJobsClick,
}: WeaponPriorityGridProps) {
  // Lift useDevice to parent level to avoid calling per row
  const { isSmallScreen } = useDevice();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropMode, setDropMode] = useState<DropMode>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Calculate drop mode based on pointer position
  const calculateDropMode = (element: Element, clientY: number): DropMode => {
    const rect = element.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = relativeY / rect.height;

    if (percentage < EDGE_THRESHOLD) return 'insert-before';
    if (percentage > 1 - EDGE_THRESHOLD) return 'insert-after';
    return 'swap';
  };

  // Track pointer position for calculating drop mode
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };

      // Recalculate dropMode continuously while dragging
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

    // Calculate initial drop mode
    const element = document.querySelector(`[data-droppable-id="${newOverId}"]`);
    if (element) {
      setDropMode(calculateDropMode(element, pointerRef.current.y));
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

    const oldIndex = weaponPriorities.findIndex((wp) => wp.job === active.id);
    const overIndex = weaponPriorities.findIndex((wp) => wp.job === over.id);

    if (oldIndex === -1 || overIndex === -1) return;

    // Handle swap mode - directly swap the two items
    if (currentDropMode === 'swap') {
      const swapped = [...weaponPriorities];
      [swapped[oldIndex], swapped[overIndex]] = [swapped[overIndex], swapped[oldIndex]];

      // Check if moving main job out of position 0
      if (mainJob && oldIndex === 0 && weaponPriorities[0].job === mainJob) {
        if (onMainJobMoveAttempt) {
          onMainJobMoveAttempt(() => onChange(swapped));
          return;
        }
      }

      onChange(swapped);
      return;
    }

    // Handle insert mode
    let newIndex = overIndex;
    if (currentDropMode === 'insert-after') {
      newIndex = overIndex + 1;
    }
    // Adjust if moving from before the target
    if (oldIndex < newIndex) {
      newIndex--;
    }

    // Check if moving main job out of position 0
    if (mainJob && oldIndex === 0 && weaponPriorities[0].job === mainJob && newIndex !== 0) {
      if (onMainJobMoveAttempt) {
        onMainJobMoveAttempt(() => {
          const reordered = arrayMove(weaponPriorities, oldIndex, newIndex);
          onChange(reordered);
        });
        return;
      }
    }

    const reordered = arrayMove(weaponPriorities, oldIndex, newIndex);
    onChange(reordered);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    setDropMode(null);
  };

  const handleRemove = (index: number) => {
    onChange(weaponPriorities.filter((_, i) => i !== index));
  };

  const handleToggleReceived = (index: number) => {
    const updated = [...weaponPriorities];
    updated[index] = {
      ...updated[index],
      received: !updated[index].received,
      receivedDate: !updated[index].received ? new Date().toISOString() : undefined,
    };
    onChange(updated);
  };

  // Mobile move handlers
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;

    // Check if moving main job out of position 0
    if (mainJob && index === 1 && weaponPriorities[0].job === mainJob) {
      // Moving item at index 1 up would push main job down
      if (onMainJobMoveAttempt) {
        onMainJobMoveAttempt(() => {
          const reordered = arrayMove(weaponPriorities, index, index - 1);
          onChange(reordered);
        });
        return;
      }
    }

    const reordered = arrayMove(weaponPriorities, index, index - 1);
    onChange(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index >= weaponPriorities.length - 1) return;

    // Check if moving main job out of position 0
    if (mainJob && index === 0 && weaponPriorities[0].job === mainJob) {
      if (onMainJobMoveAttempt) {
        onMainJobMoveAttempt(() => {
          const reordered = arrayMove(weaponPriorities, index, index + 1);
          onChange(reordered);
        });
        return;
      }
    }

    const reordered = arrayMove(weaponPriorities, index, index + 1);
    onChange(reordered);
  };

  // Split items into columns (max 8 per column) for top-down ordering
  const ITEMS_PER_COLUMN = 8;
  const columns: WeaponPriority[][] = [];
  for (let i = 0; i < weaponPriorities.length; i += ITEMS_PER_COLUMN) {
    columns.push(weaponPriorities.slice(i, i + ITEMS_PER_COLUMN));
  }

  // Calculate base index for each column
  const getBaseIndex = (colIndex: number) => colIndex * ITEMS_PER_COLUMN;

  // Find active item for drag overlay
  const activeItem = activeId ? weaponPriorities.find((wp) => wp.job === activeId) : null;
  const activeIndex = activeId ? weaponPriorities.findIndex((wp) => wp.job === activeId) : -1;

  // Responsive grid class - single column on mobile, dynamic on larger screens
  const gridColsClass = columns.length <= 1
    ? 'grid-cols-1'
    : columns.length === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={weaponPriorities.map((wp) => wp.job)}
        strategy={rectSortingStrategy}
      >
        {weaponPriorities.length === 0 ? (
          /* Empty state message */
          <div className="text-center text-text-muted text-sm py-8">
            No jobs added yet. Click "+ Add Job(s)" to get started.
          </div>
        ) : (
          /* Column-based layout - uses actual column count, not viewport breakpoints */
          <div className={`grid ${gridColsClass} gap-4`}>
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="space-y-2">
                {column.map((priority, rowIndex) => {
                  const actualIndex = getBaseIndex(colIndex) + rowIndex;
                  const isOver = overId === priority.job && activeId !== priority.job;
                  return (
                    <SortableGridItem
                      key={priority.job}
                      id={priority.job}
                      priority={priority}
                      index={actualIndex}
                      totalItems={weaponPriorities.length}
                      isMainJob={priority.job === mainJob}
                      disabled={disabled}
                      showInsertBefore={isOver && dropMode === 'insert-before'}
                      showInsertAfter={isOver && dropMode === 'insert-after'}
                      showSwap={isOver && dropMode === 'swap'}
                      isSmallScreen={isSmallScreen}
                      onRemove={() => handleRemove(actualIndex)}
                      onToggleReceived={() => handleToggleReceived(actualIndex)}
                      onMoveUp={() => handleMoveUp(actualIndex)}
                      onMoveDown={() => handleMoveDown(actualIndex)}
                    />
                  );
                })}

                {/* Add Job(s) button - show in last column only if it's not full */}
                {colIndex === columns.length - 1 && column.length < ITEMS_PER_COLUMN && onAddJobsClick && !disabled && (
                  <button
                    onClick={onAddJobsClick}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent transition-colors w-full"
                  >
                    <span className="text-sm">+ Add Job(s)</span>
                  </button>
                )}
              </div>
            ))}

            {/* Add Job(s) button in new column if last column is full, or if no items yet */}
            {onAddJobsClick && !disabled && (columns.length === 0 || columns[columns.length - 1].length === ITEMS_PER_COLUMN) && (
              <div className="space-y-2">
                <button
                  onClick={onAddJobsClick}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded border-2 border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent transition-colors w-full"
                >
                  <span className="text-sm">+ Add Job(s)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </SortableContext>

      {/* Drag overlay - renders in portal, doesn't affect layout */}
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-elevated border border-accent rounded shadow-lg opacity-90 pointer-events-none">
            <ItemContent
              priority={activeItem}
              index={activeIndex}
              isMainJob={activeItem.job === mainJob}
              disabled={true}
              isDragOverlay={true}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
