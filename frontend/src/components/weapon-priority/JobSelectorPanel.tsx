/* eslint-disable design-system/no-raw-button */
/**
 * Job Selector Panel
 *
 * Add-jobs panel for the weapon priority list: a bordered container with a
 * header (Select All), the shared role-grouped {@link JobSelector} grid, and a
 * sticky Cancel / Add Selected footer. Selection state lives here; the grid is
 * the reusable JobSelector with order badges.
 */

import { useState } from 'react';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobSelector } from '../player/JobSelector';

interface JobSelectorPanelProps {
  existingJobs: string[];
  onAddJobs: (jobs: string[]) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

const ROLE_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'];

export function JobSelectorPanel({
  existingJobs,
  onAddJobs,
  onCancel,
  disabled = false,
}: JobSelectorPanelProps) {
  // Array preserves selection order.
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const availableJobs = RAID_JOBS.filter((job) => !existingJobs.includes(job.abbreviation));
  const allSelected = availableJobs.length > 0 && selectedJobs.length === availableJobs.length;

  const handleSelectAllToggle = () => {
    if (disabled) return;
    if (allSelected) {
      setSelectedJobs([]);
    } else {
      const orderedJobs = ROLE_ORDER.flatMap((role) =>
        availableJobs.filter((job) => job.role === role).map((job) => job.abbreviation)
      );
      setSelectedJobs(orderedJobs);
    }
  };

  const handleAddSelected = () => {
    if (selectedJobs.length === 0 || disabled) return;
    onAddJobs(selectedJobs);
    setSelectedJobs([]);
  };

  return (
    <div className="border-2 border-accent/30 rounded-lg bg-surface-card flex flex-col max-h-[60vh]">
      {/* Header with Select All on right */}
      <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0">
        <h4 className="text-sm font-medium text-text-primary">
          Select Jobs {selectedJobs.length > 0 && `(${selectedJobs.length} selected)`}
        </h4>
        <button
          onClick={handleSelectAllToggle}
          disabled={availableJobs.length === 0 || disabled}
          className="text-sm text-accent hover:text-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allSelected ? 'Unselect All' : `Select All (${availableJobs.length})`}
        </button>
      </div>

      {/* Scrollable job grid (shared JobSelector) */}
      <div className="flex-1 overflow-y-auto px-4 pb-1">
        <JobSelector
          selectedJobs={selectedJobs}
          onChange={setSelectedJobs}
          existingJobs={existingJobs}
          showOrderBadges
          disabled={disabled}
        />
      </div>

      {/* Sticky footer - Cancel and Add Selected buttons */}
      <div className="flex-shrink-0 p-4 pt-3 border-t border-border-default flex justify-end gap-3 bg-surface-card">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-surface-interactive text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleAddSelected}
          disabled={disabled || selectedJobs.length === 0}
          className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedJobs.length > 0 ? `Add Selected (${selectedJobs.length})` : 'Add Selected'}
        </button>
      </div>
    </div>
  );
}
