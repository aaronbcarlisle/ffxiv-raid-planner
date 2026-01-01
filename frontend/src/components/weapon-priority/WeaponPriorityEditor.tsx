/**
 * Weapon Priority Editor
 *
 * Drag-and-drop editor for reordering weapon priorities.
 * Allows adding/removing jobs and marking weapons as received.
 */

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
}

export function WeaponPriorityEditor({
  weaponPriorities,
  onChange,
  disabled = false,
  mainJob,
}: WeaponPriorityEditorProps) {
  const [showJobSelector, setShowJobSelector] = useState(false);

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
      const oldIndex = weaponPriorities.findIndex((_, i) => `weapon-${i}` === active.id);
      const newIndex = weaponPriorities.findIndex((_, i) => `weapon-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onChange(arrayMove(weaponPriorities, oldIndex, newIndex));
      }
    }
  };

  const handleAddJob = (job: string) => {
    // Check if job already exists
    if (weaponPriorities.some((wp) => wp.job === job)) {
      return;
    }

    const newPriority: WeaponPriority = {
      job,
      weaponName: undefined,
      received: false,
      receivedDate: undefined,
    };

    onChange([...weaponPriorities, newPriority]);
    setShowJobSelector(false);
  };

  const handleRemoveJob = (index: number) => {
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
    <div className="space-y-3">
      {/* List */}
      {weaponPriorities.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={weaponPriorities.map((_, i) => `weapon-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {weaponPriorities.map((priority, index) => (
                <WeaponPriorityListItem
                  key={`weapon-${index}`}
                  id={`weapon-${index}`}
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
          onClick={() => setShowJobSelector(true)}
          disabled={disabled}
          className="w-full px-4 py-2 rounded border-2 border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Job
        </button>
      )}

      {/* Job Selector */}
      {showJobSelector && (
        <WeaponJobSelector
          existingJobs={weaponPriorities.map((wp) => wp.job)}
          onSelect={handleAddJob}
          onCancel={() => setShowJobSelector(false)}
        />
      )}
    </div>
  );
}
