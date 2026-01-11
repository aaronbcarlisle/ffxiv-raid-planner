/**
 * Weapon Priority List Item
 *
 * Sortable list item for displaying and editing a single weapon priority entry.
 */

import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WeaponPriority } from '../../types';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon, Checkbox } from '../ui';

interface WeaponPriorityListItemProps {
  id: string;
  priority: WeaponPriority;
  index: number;
  isMainJob: boolean;
  disabled?: boolean;
  onRemove: () => void;
  onToggleReceived: () => void;
}

export const WeaponPriorityListItem = memo(function WeaponPriorityListItem({
  id,
  priority,
  index,
  isMainJob,
  disabled = false,
  onRemove,
  onToggleReceived,
}: WeaponPriorityListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const jobInfo = RAID_JOBS.find((j) => j.abbreviation === priority.job);
  const jobName = jobInfo?.name || priority.job;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-default rounded ${
        isDragging ? 'opacity-50' : ''
      } ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`flex-shrink-0 cursor-grab active:cursor-grabbing ${
          disabled ? 'opacity-30 cursor-not-allowed' : ''
        }`}
      >
        <svg
          className="w-5 h-5 text-text-muted"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>

      {/* Priority number */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-medium">
        {index + 1}
      </div>

      {/* Job icon and name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <JobIcon job={priority.job} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary flex items-center gap-2">
            {jobName}
            {isMainJob && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                Main
              </span>
            )}
          </div>
          {priority.received && priority.receivedDate && (
            <div className="text-xs text-text-muted">
              Received {new Date(priority.receivedDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Received checkbox */}
      <Checkbox
        checked={priority.received}
        onChange={onToggleReceived}
        disabled={disabled}
        label="Received"
      />

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="flex-shrink-0 p-2 rounded hover:bg-surface-hover text-status-error hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove job"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
});
