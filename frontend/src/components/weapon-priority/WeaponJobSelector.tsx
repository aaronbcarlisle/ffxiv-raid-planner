/**
 * Weapon Job Selector
 *
 * Job picker for adding new jobs to weapon priority list.
 * Shows all combat jobs grouped by role with multi-select support.
 */

import { useState } from 'react';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';

interface WeaponJobSelectorProps {
  existingJobs: string[];
  onSelectMultiple: (jobs: string[]) => void;
  onCancel: () => void;
  onSelectionChange?: (count: number, jobs: string[]) => void;
}

export function WeaponJobSelector({
  existingJobs,
  onSelectMultiple: _onSelectMultiple,
  onCancel,
  onSelectionChange,
}: WeaponJobSelectorProps) {
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

  const handleToggleJob = (job: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(job)) {
      newSelected.delete(job);
    } else {
      newSelected.add(job);
    }
    setSelectedJobs(newSelected);
    onSelectionChange?.(newSelected.size, Array.from(newSelected));
  };

  const handleSelectAll = () => {
    const allAvailableJobs = new Set(availableJobs.map((job) => job.abbreviation));
    setSelectedJobs(allAvailableJobs);
    onSelectionChange?.(allAvailableJobs.size, Array.from(allAvailableJobs));
  };

  return (
    <div className="border-2 border-accent/30 rounded-lg p-4 bg-surface-card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text-primary">
          Select Jobs {selectedJobs.size > 0 && `(${selectedJobs.size} selected)`}
        </h4>
        <button
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text-secondary"
        >
          Cancel
        </button>
      </div>

      {/* Action button */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSelectAll}
          disabled={availableJobs.length === 0}
          className="w-full px-3 py-1.5 rounded bg-accent/20 text-accent text-sm hover:bg-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select All ({availableJobs.length})
        </button>
      </div>

      <div className="space-y-3">
        {roleOrder.map((role) => {
          const jobs = jobsByRole[role] || [];
          if (jobs.length === 0) return null;

          return (
            <div key={role}>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                {role}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {jobs.map((job) => {
                  const isAdded = existingJobs.includes(job.abbreviation);
                  const isSelected = selectedJobs.has(job.abbreviation);
                  return (
                    <button
                      key={job.abbreviation}
                      onClick={() => {
                        if (isAdded) return;
                        handleToggleJob(job.abbreviation);
                      }}
                      disabled={isAdded}
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
    </div>
  );
}
