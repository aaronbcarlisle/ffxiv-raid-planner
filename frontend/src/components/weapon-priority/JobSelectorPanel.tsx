/**
 * Job Selector Panel
 *
 * Job picker for adding new jobs to weapon priority list.
 * Shows all combat jobs grouped by role with multi-select support.
 * Styled to match the original WeaponJobSelector from main.
 */

import { useState } from 'react';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';

interface JobSelectorPanelProps {
  existingJobs: string[];
  onAddJobs: (jobs: string[]) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export function JobSelectorPanel({
  existingJobs,
  onAddJobs,
  onCancel,
  disabled = false,
}: JobSelectorPanelProps) {
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  // Group jobs by role
  const jobsByRole = RAID_JOBS.reduce((acc, job) => {
    if (!acc[job.role]) {
      acc[job.role] = [];
    }
    acc[job.role].push(job);
    return acc;
  }, {} as Record<string, typeof RAID_JOBS>);

  const roleOrder: Array<keyof typeof jobsByRole> = ['tank', 'healer', 'melee', 'ranged', 'caster'];

  const availableJobs = RAID_JOBS.filter((job) => !existingJobs.includes(job.abbreviation));
  const allSelected = availableJobs.length > 0 && selectedJobs.size === availableJobs.length;

  const handleToggleJob = (job: string) => {
    if (disabled) return;
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(job)) {
      newSelected.delete(job);
    } else {
      newSelected.add(job);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAllToggle = () => {
    if (disabled) return;
    if (allSelected) {
      // Unselect all
      setSelectedJobs(new Set());
    } else {
      // Select all
      const allAvailableJobs = new Set(availableJobs.map((job) => job.abbreviation));
      setSelectedJobs(allAvailableJobs);
    }
  };

  const handleAddSelected = () => {
    if (selectedJobs.size === 0 || disabled) return;
    onAddJobs(Array.from(selectedJobs));
    setSelectedJobs(new Set());
  };

  return (
    <div className="border-2 border-accent/30 rounded-lg bg-surface-card flex flex-col max-h-[60vh]">
      {/* Header with Select All on right */}
      <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0">
        <h4 className="text-sm font-medium text-text-primary">
          Select Jobs {selectedJobs.size > 0 && `(${selectedJobs.size} selected)`}
        </h4>
        <button
          onClick={handleSelectAllToggle}
          disabled={availableJobs.length === 0 || disabled}
          className="text-sm text-accent hover:text-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allSelected ? 'Unselect All' : `Select All (${availableJobs.length})`}
        </button>
      </div>

      {/* Scrollable job grid */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {roleOrder.map((role) => {
          const jobs = jobsByRole[role] || [];
          if (jobs.length === 0) return null;

          return (
            <div key={role}>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                {role}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {jobs.map((job) => {
                  const isAdded = existingJobs.includes(job.abbreviation);
                  const isSelected = selectedJobs.has(job.abbreviation);
                  return (
                    <button
                      key={job.abbreviation}
                      onClick={() => {
                        if (isAdded || disabled) return;
                        handleToggleJob(job.abbreviation);
                      }}
                      disabled={isAdded || disabled}
                      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${
                        isAdded
                          ? 'opacity-30 cursor-not-allowed bg-surface-interactive'
                          : isSelected
                          ? 'bg-accent/20 border-2 border-accent cursor-pointer'
                          : 'hover:bg-surface-hover cursor-pointer border-2 border-transparent'
                      }`}
                      title={isAdded ? 'Already added' : job.name}
                    >
                      <JobIcon job={job.abbreviation} size="md" />
                      <span className="text-xs text-text-secondary">
                        {job.abbreviation}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
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
          disabled={disabled || selectedJobs.size === 0}
          className="px-4 py-2 rounded bg-accent text-accent-contrast font-bold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedJobs.size > 0 ? `Add Selected (${selectedJobs.size})` : 'Add Selected'}
        </button>
      </div>
    </div>
  );
}
