/**
 * Weapon Job Selector
 *
 * Job picker for adding new jobs to weapon priority list.
 * Shows all combat jobs grouped by role.
 */

import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';

interface WeaponJobSelectorProps {
  existingJobs: string[];
  onSelect: (job: string) => void;
  onCancel: () => void;
}

export function WeaponJobSelector({
  existingJobs,
  onSelect,
  onCancel,
}: WeaponJobSelectorProps) {
  // Group jobs by role
  const jobsByRole = RAID_JOBS.reduce((acc, job) => {
    if (!acc[job.role]) {
      acc[job.role] = [];
    }
    acc[job.role].push(job);
    return acc;
  }, {} as Record<string, typeof RAID_JOBS>);

  const roleOrder: Array<keyof typeof jobsByRole> = ['tank', 'healer', 'melee', 'ranged', 'caster'];

  return (
    <div className="border-2 border-accent/30 rounded-lg p-4 bg-surface-card">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-text-primary">Select Job</h4>
        <button
          onClick={onCancel}
          className="text-sm text-text-muted hover:text-text-secondary"
        >
          Cancel
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
                  return (
                    <button
                      key={job.abbreviation}
                      onClick={() => !isAdded && onSelect(job.abbreviation)}
                      disabled={isAdded}
                      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors ${
                        isAdded
                          ? 'opacity-30 cursor-not-allowed bg-surface-interactive'
                          : 'hover:bg-surface-hover cursor-pointer'
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
