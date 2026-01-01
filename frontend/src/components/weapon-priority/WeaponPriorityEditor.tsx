/**
 * Weapon Priority Editor
 *
 * Drag-and-drop editor for reordering weapon priorities.
 * Allows adding/removing jobs and marking weapons as received.
 */

import { useState, useRef } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { WeaponPriority } from '../../types';
import { WeaponPriorityListItem } from './WeaponPriorityListItem';
import { WeaponJobSelector } from './WeaponJobSelector';

interface WeaponPriorityEditorProps {
  weaponPriorities: WeaponPriority[];
  onChange: (priorities: WeaponPriority[]) => void;
  disabled?: boolean;
  mainJob?: string;
  onShowJobSelectorChange?: (show: boolean, selectedCount: number, addSelectedFn: () => void) => void;
  onMainJobMoveAttempt?: (action: () => void) => void;
  onMainJobRemoveAttempt?: (action: () => void) => void;
}

export function WeaponPriorityEditor({
  weaponPriorities,
  onChange,
  disabled = false,
  mainJob,
  onShowJobSelectorChange,
  onMainJobMoveAttempt,
  onMainJobRemoveAttempt,
}: WeaponPriorityEditorProps) {
  const [showJobSelector, setShowJobSelector] = useState(false);
  const selectedJobsRef = useRef<string[]>([]);

  // Create function to add currently selected jobs (always uses latest ref value)
  const addSelectedJobsRef2 = useRef(() => {
    if (selectedJobsRef.current.length > 0) {
      handleAddMultipleJobs(selectedJobsRef.current);
    }
  });

  // Update the function ref when dependencies change
  addSelectedJobsRef2.current = () => {
    if (selectedJobsRef.current.length > 0) {
      handleAddMultipleJobs(selectedJobsRef.current);
    }
  };

  // Notify parent when selector state changes
  const updateJobSelectorState = (show: boolean, count: number) => {
    setShowJobSelector(show);
    onShowJobSelectorChange?.(show, count, addSelectedJobsRef2.current);
  };

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = weaponPriorities.findIndex((wp) => wp.job === active.id);
      const newIndex = weaponPriorities.findIndex((wp) => wp.job === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
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
      }
    }
  };

  const handleAddMultipleJobs = (jobs: string[]) => {
    const newPriorities = jobs
      .filter((job) => !weaponPriorities.some((wp) => wp.job === job))
      .map((job) => ({
        job,
        received: false,
      } as WeaponPriority));

    if (newPriorities.length > 0) {
      onChange([...weaponPriorities, ...newPriorities]);
    }
    selectedJobsRef.current = [];
    updateJobSelectorState(false, 0);
  };

  const handleRemoveJob = (index: number) => {
    // Check if removing main job
    if (mainJob && weaponPriorities[index].job === mainJob) {
      if (onMainJobRemoveAttempt) {
        onMainJobRemoveAttempt(() => {
          onChange(weaponPriorities.filter((_, i) => i !== index));
        });
        return;
      }
    }

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

  return (
    <div className="space-y-3 overflow-x-hidden">
      {/* List */}
      {weaponPriorities.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={weaponPriorities.map((wp) => wp.job)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 overflow-x-hidden">
              {weaponPriorities.map((priority, index) => (
                <WeaponPriorityListItem
                  key={priority.job}
                  id={priority.job}
                  priority={priority}
                  index={index}
                  isMainJob={priority.job === mainJob}
                  disabled={disabled}
                  onRemove={() => handleRemoveJob(index)}
                  onToggleReceived={() => handleToggleReceived(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Job Button */}
      {!showJobSelector && (
        <button
          onClick={() => updateJobSelectorState(true, 0)}
          disabled={disabled}
          className="w-full px-4 py-2 rounded border-2 border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Job(s)
        </button>
      )}

      {/* Job Selector */}
      {showJobSelector && (
        <WeaponJobSelector
          existingJobs={weaponPriorities.map((wp) => wp.job)}
          onSelectMultiple={handleAddMultipleJobs}
          onCancel={() => updateJobSelectorState(false, 0)}
          onSelectionChange={(count, jobs) => {
            // Store selected jobs and notify parent
            selectedJobsRef.current = jobs;
            updateJobSelectorState(true, count);
          }}
        />
      )}
    </div>
  );
}
