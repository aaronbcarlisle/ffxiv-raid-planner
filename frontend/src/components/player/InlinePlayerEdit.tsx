import { useState, useEffect, useRef, useMemo } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { RoleJobSelector } from './RoleJobSelector';
import {
  getJobsByRole,
  getJobDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRoleForJob,
  getRaidJobs,
  type Role,
  type JobInfo,
} from '../../gamedata';
import type { SnapshotPlayer } from '../../types';
import { TEMPLATE_ROLE_INFO } from '../../utils/constants';

interface InlinePlayerEditProps {
  player: SnapshotPlayer;
  onSave: (name: string, job: string, role: string) => void;
  onCancel: () => void;
}

type RoleFilter = 'tank' | 'healer' | 'dps';

const ROLE_FILTERS: { key: RoleFilter; label: string; color: string }[] = [
  { key: 'tank', label: 'Tank', color: 'var(--color-role-tank)' },
  { key: 'healer', label: 'Healer', color: 'var(--color-role-healer)' },
  { key: 'dps', label: 'DPS', color: 'var(--color-role-melee)' },
];

export function InlinePlayerEdit({ player, onSave, onCancel }: InlinePlayerEditProps) {
  const [name, setName] = useState(player.name);
  const [job, setJob] = useState(player.job);
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleFilter>>(new Set());
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [showNameError, setShowNameError] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const jobPickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const allJobs = getRaidJobs();

  // Filter jobs based on selected roles
  const filteredJobs = useMemo(() => {
    let jobs: JobInfo[] = [];

    if (selectedRoles.size === 0) {
      // No filter - show all jobs
      jobs = allJobs;
    } else {
      // Filter by selected roles
      if (selectedRoles.has('tank')) {
        jobs = [...jobs, ...getJobsByRole('tank')];
      }
      if (selectedRoles.has('healer')) {
        jobs = [...jobs, ...getJobsByRole('healer')];
      }
      if (selectedRoles.has('dps')) {
        jobs = [
          ...jobs,
          ...getJobsByRole('melee'),
          ...getJobsByRole('ranged'),
          ...getJobsByRole('caster'),
        ];
      }
    }

    // Apply search filter
    if (jobSearch.trim()) {
      const query = jobSearch.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.abbreviation.toLowerCase().includes(query) ||
          getJobDisplayName(j.abbreviation).toLowerCase().includes(query)
      );
    }

    return jobs;
  }, [selectedRoles, jobSearch, allJobs]);

  // Group jobs by role for display
  const jobsByRole = useMemo(() => {
    const groups: Record<Role, JobInfo[]> = {
      tank: [],
      healer: [],
      melee: [],
      ranged: [],
      caster: [],
    };
    for (const j of filteredJobs) {
      groups[j.role].push(j);
    }
    return groups;
  }, [filteredJobs]);

  // Auto-focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  // Handle Escape key to cancel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isJobPickerOpen) {
          setIsJobPickerOpen(false);
        } else {
          onCancel();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isJobPickerOpen]);

  // Close job picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jobPickerRef.current && !jobPickerRef.current.contains(event.target as Node)) {
        setIsJobPickerOpen(false);
        setJobSearch('');
      }
    }
    if (isJobPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isJobPickerOpen]);

  // Focus search when job picker opens
  useEffect(() => {
    if (isJobPickerOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!isJobPickerOpen) {
      setJobSearch('');
    }
  }, [isJobPickerOpen]);

  const toggleRole = (role: RoleFilter) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleJobSelect = (selectedJob: string) => {
    setJob(selectedJob);
    setIsJobPickerOpen(false);
    setJobSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate name - show error and focus if empty
    if (!name.trim()) {
      setShowNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    // Job is required but we don't block - they just need to pick one
    if (!job) return;
    const actualRole = getRoleForJob(job) || '';
    onSave(name.trim(), job, actualRole);
  };

  // Clear name error when user starts typing
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (showNameError && e.target.value.trim()) {
      setShowNameError(false);
    }
  };

  const selectedJobInfo = job ? allJobs.find((j) => j.abbreviation === job) : null;

  const roleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

  // Get role color for template slots
  const templateRoleInfo = player.templateRole ? TEMPLATE_ROLE_INFO[player.templateRole] : null;
  const roleColorVar = templateRoleInfo ? `var(--color-${templateRoleInfo.color})` : null;

  return (
    <div
      className="bg-surface-card border-2 rounded-lg p-4"
      style={{ borderColor: roleColorVar || 'var(--color-accent)' }}
    >
      <form onSubmit={handleSubmit}>
        {/* Name input - no label, placeholder is sufficient */}
        <div className="mb-4">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Enter player name"
            className={`w-full bg-surface-base border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
              showNameError
                ? 'border-status-error focus:border-status-error'
                : 'border-border-default'
            }`}
            style={{
              // Role-colored focus border when not showing error
              ...((!showNameError && roleColorVar) ? { '--focus-color': roleColorVar } as React.CSSProperties : {}),
            }}
            onFocus={(e) => {
              if (!showNameError && roleColorVar) {
                e.target.style.borderColor = roleColorVar;
              }
            }}
            onBlur={(e) => {
              if (!showNameError) {
                e.target.style.borderColor = '';
              }
            }}
          />
        </div>

        {/* Job selection - use RoleJobSelector for template slots, standard picker otherwise */}
        {player.templateRole ? (
          <div className="mb-4">
            <RoleJobSelector
              templateRole={player.templateRole}
              selectedJob={job}
              onJobSelect={handleJobSelect}
            />
          </div>
        ) : (
          <>
            {/* Role filter toggles */}
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-2">Filter by Role</label>
              <div className="flex gap-2">
                {ROLE_FILTERS.map((rf) => (
                  <button
                    key={rf.key}
                    type="button"
                    onClick={() => toggleRole(rf.key)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                      selectedRoles.has(rf.key)
                        ? 'ring-2 ring-offset-1 ring-offset-bg-card'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: selectedRoles.has(rf.key)
                        ? `color-mix(in srgb, ${rf.color} 30%, transparent)`
                        : 'var(--color-bg-hover)',
                      color: selectedRoles.has(rf.key) ? rf.color : 'var(--color-text-secondary)',
                      // @ts-expect-error ringColor is a Tailwind CSS variable
                      '--tw-ring-color': rf.color,
                    }}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Job picker dropdown */}
            <div className="mb-4 relative" ref={jobPickerRef}>
              <label className="block text-xs text-text-muted mb-1">Select Job</label>
              <button
                type="button"
                onClick={() => setIsJobPickerOpen(!isJobPickerOpen)}
                className="w-full bg-surface-base border border-border-default rounded px-3 py-2 text-left flex items-center gap-3 focus:border-accent focus:outline-none hover:border-text-muted"
              >
                {selectedJobInfo ? (
                  <>
                    <JobIcon job={selectedJobInfo.abbreviation} size="md" />
                    <span className="text-text-primary">
                      {selectedJobInfo.abbreviation} - {getJobDisplayName(selectedJobInfo.abbreviation)}
                    </span>
                  </>
                ) : (
                  <span className="text-text-muted">Select a job...</span>
                )}
                <span className="ml-auto text-text-muted">{isJobPickerOpen ? '\u25B2' : '\u25BC'}</span>
              </button>

              {/* Dropdown */}
              {isJobPickerOpen && (
                <div className="absolute z-50 mt-1 left-0 right-0 bg-surface-raised border border-border-default rounded-lg shadow-lg">
                  {/* Search input */}
                  <div className="p-2 border-b border-border-default">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      placeholder="Search jobs..."
                      className="w-full bg-surface-base border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Job list */}
                  <div className="max-h-56 overflow-y-auto">
                    {filteredJobs.length === 0 ? (
                      <div className="px-3 py-4 text-center text-text-muted text-sm">
                        No jobs found
                      </div>
                    ) : jobSearch.trim() ? (
                      // Flat list when searching
                      <div className="py-1">
                        {filteredJobs.map((j) => (
                          <button
                            key={j.abbreviation}
                            type="button"
                            onClick={() => handleJobSelect(j.abbreviation)}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                              job === j.abbreviation ? 'bg-accent/10' : ''
                            }`}
                          >
                            <JobIcon job={j.abbreviation} size="md" />
                            <span className="text-text-primary">{j.abbreviation}</span>
                            <span className="text-text-secondary text-sm">
                              {getJobDisplayName(j.abbreviation)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      // Grouped by role when not searching
                      roleOrder.map((role) => {
                        const jobs = jobsByRole[role];
                        if (jobs.length === 0) return null;
                        return (
                          <div key={role}>
                            <div
                              className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-surface-raised border-b border-border-default"
                              style={{ color: getRoleColor(role) }}
                            >
                              {getRoleDisplayName(role)}
                            </div>
                            <div className="py-1">
                              {jobs.map((j) => (
                                <button
                                  key={j.abbreviation}
                                  type="button"
                                  onClick={() => handleJobSelect(j.abbreviation)}
                                  className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                                    job === j.abbreviation ? 'bg-accent/10' : ''
                                  }`}
                                >
                                  <JobIcon job={j.abbreviation} size="md" />
                                  <span className="text-text-primary">{j.abbreviation}</span>
                                  <span className="text-text-secondary text-sm">
                                    {getJobDisplayName(j.abbreviation)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded text-sm font-medium border-2 transition-colors hover:brightness-110"
            style={{
              borderColor: roleColorVar || 'var(--color-text-muted)',
              color: roleColorVar || 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 px-3 py-2 rounded text-sm font-medium text-bg-primary transition-colors ${
              roleColorVar ? 'hover:brightness-110' : 'bg-accent hover:bg-accent-bright'
            }`}
            style={roleColorVar ? { backgroundColor: roleColorVar } : undefined}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
