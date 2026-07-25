/* eslint-disable design-system/no-raw-button */
/**
 * JobSelector — reusable role-grouped job picker (controlled).
 *
 * Extracted from the weapon-priorities picker so Add Job and Weapon Priorities
 * share one UX. Selection state is owned by the caller via `selectedJobs` +
 * `onChange`; selection order is preserved.
 *
 * - `existingJobs`   — already-added jobs: shown disabled, with their saved position.
 * - `showOrderBadges`— numbered position badges (weapon-priority behavior).
 * - `showRoleFilters`— All / Tanks / … filter chips (Add Job behavior).
 * - `syncedJobs`     — enables a "Select all synced (N)" action.
 */
import { useMemo, useState } from 'react';
import { RAID_JOBS } from '../../gamedata/jobs';
import { JobIcon } from '../ui/JobIcon';

interface JobSelectorProps {
  selectedJobs: string[];
  onChange: (jobs: string[]) => void;
  existingJobs?: string[];
  showRoleFilters?: boolean;
  showOrderBadges?: boolean;
  syncedJobs?: string[];
  disabled?: boolean;
  className?: string;
}

const ROLE_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'] as const;
type RoleKey = (typeof ROLE_ORDER)[number];

const ROLE_FILTERS: Array<{ key: 'all' | RoleKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'tank', label: 'Tanks' },
  { key: 'healer', label: 'Healers' },
  { key: 'melee', label: 'Melee' },
  { key: 'ranged', label: 'Ranged' },
  { key: 'caster', label: 'Casters' },
];

export function JobSelector({
  selectedJobs,
  onChange,
  existingJobs = [],
  showRoleFilters = false,
  showOrderBadges = false,
  syncedJobs,
  disabled = false,
  className = '',
}: JobSelectorProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');

  const jobsByRole = useMemo(
    () =>
      RAID_JOBS.reduce((acc, job) => {
        (acc[job.role] ??= []).push(job);
        return acc;
      }, {} as Record<string, typeof RAID_JOBS>),
    []
  );

  const toggleJob = (job: string) => {
    if (disabled || existingJobs.includes(job)) return;
    if (selectedJobs.includes(job)) {
      onChange(selectedJobs.filter((j) => j !== job));
    } else {
      onChange([...selectedJobs, job]);
    }
  };

  // Synced jobs not already added/selected, in role order.
  const availableSynced = useMemo(() => {
    if (!syncedJobs?.length) return [];
    return ROLE_ORDER.flatMap((role) =>
      (jobsByRole[role] ?? [])
        .map((j) => j.abbreviation)
        .filter((abbr) => syncedJobs.includes(abbr) && !existingJobs.includes(abbr) && !selectedJobs.includes(abbr))
    );
  }, [syncedJobs, jobsByRole, existingJobs, selectedJobs]);

  const visibleRoles = roleFilter === 'all' ? ROLE_ORDER : ([roleFilter] as RoleKey[]);

  return (
    <div className={className}>
      {showRoleFilters && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ROLE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRoleFilter(key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                roleFilter === key
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-subtle text-text-muted hover:text-text-primary hover:border-border-default'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {availableSynced.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...selectedJobs, ...availableSynced])}
          className="mb-3 text-sm text-accent hover:text-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select all synced ({availableSynced.length})
        </button>
      )}

      <div className="space-y-3">
        {visibleRoles.map((role) => {
          const jobs = jobsByRole[role] ?? [];
          if (jobs.length === 0) return null;
          return (
            <div key={role}>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">{role}</div>
              <div className="grid grid-cols-5 gap-2">
                {jobs.map((job) => {
                  const existingIndex = existingJobs.indexOf(job.abbreviation);
                  const isAdded = existingIndex >= 0;
                  const selectionIndex = selectedJobs.indexOf(job.abbreviation);
                  const isSelected = selectionIndex >= 0;
                  const badgeNumber =
                    showOrderBadges && isAdded
                      ? existingIndex + 1
                      : showOrderBadges && isSelected
                      ? existingJobs.length + selectionIndex + 1
                      : null;
                  return (
                    <button
                      key={job.abbreviation}
                      type="button"
                      onClick={() => toggleJob(job.abbreviation)}
                      disabled={isAdded || disabled}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded transition-colors ${
                        isAdded
                          ? 'opacity-30 cursor-not-allowed bg-surface-interactive'
                          : isSelected
                          ? 'bg-accent/20 border-2 border-accent cursor-pointer'
                          : 'hover:bg-surface-hover cursor-pointer border-2 border-transparent'
                      }`}
                      title={isAdded ? 'Already added' : job.name}
                    >
                      {badgeNumber !== null && (
                        <span
                          className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold rounded-full ${
                            isAdded ? 'bg-text-muted text-surface-base' : 'bg-accent text-accent-contrast'
                          }`}
                        >
                          {badgeNumber}
                        </span>
                      )}
                      <JobIcon job={job.abbreviation} size="md" />
                      <span className="text-xs text-text-secondary">{job.abbreviation}</span>
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
