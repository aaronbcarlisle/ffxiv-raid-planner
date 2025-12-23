import { useState, useRef, useEffect, useMemo } from 'react';
import { JobIcon } from '../ui/JobIcon';
import {
  getJobsForTemplateRole,
  getJobDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRoleForJob,
  getRaidJobs,
  getJobsByRole,
  type Role,
  type JobInfo,
} from '../../gamedata';
import type { TemplateRole } from '../../types';
import { TEMPLATE_ROLE_INFO, getRoleIconUrl } from '../../utils/constants';

// Icon for "Other jobs" button
const OTHER_JOBS_ICON_ID = 1;

interface RoleJobSelectorProps {
  templateRole: TemplateRole;
  selectedJob: string;
  onJobSelect: (job: string) => void;
}

export function RoleJobSelector({ templateRole, selectedJob, onJobSelect }: RoleJobSelectorProps) {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get jobs for this template role
  const templateJobs = useMemo(() => getJobsForTemplateRole(templateRole), [templateRole]);
  const allJobs = getRaidJobs();
  const roleInfo = TEMPLATE_ROLE_INFO[templateRole];
  const roleColorVar = `var(--color-${roleInfo.color})`;

  // Filter all jobs for the expanded picker
  const filteredJobs = useMemo(() => {
    if (!jobSearch.trim()) return allJobs;
    const query = jobSearch.toLowerCase();
    return allJobs.filter(
      (j) =>
        j.abbreviation.toLowerCase().includes(query) ||
        getJobDisplayName(j.abbreviation).toLowerCase().includes(query)
    );
  }, [jobSearch, allJobs]);

  // Group jobs by role for the expanded picker
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

  // Close picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowFullPicker(false);
        setJobSearch('');
      }
    }
    if (showFullPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFullPicker]);

  // Focus search when picker opens
  useEffect(() => {
    if (showFullPicker && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showFullPicker]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showFullPicker) {
        setShowFullPicker(false);
        setJobSearch('');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFullPicker]);

  const handleJobClick = (job: string) => {
    onJobSelect(job);
    setShowFullPicker(false);
    setJobSearch('');
  };

  const roleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

  return (
    <div className="space-y-3" ref={pickerRef}>
      {/* Template role label */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Select Job for</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            backgroundColor: `var(--color-${roleInfo.color})/0.2`,
            color: `var(--color-${roleInfo.color})`,
          }}
        >
          {roleInfo.label}
        </span>
      </div>

      {/* Quick select job icons + "Other" icon */}
      <div className="flex flex-wrap gap-2 relative" ref={pickerRef}>
        {templateJobs.map((job) => (
          <button
            key={job.abbreviation}
            type="button"
            onClick={() => handleJobClick(job.abbreviation)}
            className={`p-1.5 rounded-lg transition-all ${
              selectedJob === job.abbreviation
                ? 'ring-2'
                : 'bg-bg-hover hover:bg-bg-tertiary hover:ring-1 hover:ring-border-default'
            }`}
            style={
              selectedJob === job.abbreviation
                ? {
                    boxShadow: `0 0 0 2px ${roleColorVar}`,
                    backgroundColor: `color-mix(in srgb, ${roleColorVar} 20%, transparent)`,
                  }
                : undefined
            }
            title={`${job.abbreviation} - ${getJobDisplayName(job.abbreviation)}`}
          >
            <JobIcon job={job.abbreviation} size="lg" />
          </button>
        ))}

        {/* "Other jobs" icon button */}
        {(() => {
          // Only show selected styling if picker is open AND selected job is not a template job
          const isTemplateJob = templateJobs.some((j) => j.abbreviation === selectedJob);
          const showSelected = showFullPicker && !isTemplateJob;
          return (
            <button
              type="button"
              onClick={() => setShowFullPicker(!showFullPicker)}
              className={`p-1.5 rounded-lg transition-all ${
                showSelected
                  ? 'ring-2'
                  : 'bg-bg-hover hover:bg-bg-tertiary hover:ring-1 hover:ring-border-default'
              }`}
              style={
                showSelected
                  ? {
                      boxShadow: `0 0 0 2px ${roleColorVar}`,
                      backgroundColor: `color-mix(in srgb, ${roleColorVar} 20%, transparent)`,
                    }
                  : undefined
              }
              title="Other jobs..."
            >
              <img
                src={getRoleIconUrl(OTHER_JOBS_ICON_ID)}
                alt="Other jobs"
                className="w-10 h-10"
              />
            </button>
          );
        })()}
      </div>

      {/* Expanded picker dropdown - positioned below the icons */}
      {showFullPicker && (
        <div className="relative">
          <div className="absolute z-50 top-0 left-0 right-0 min-w-[280px] bg-bg-secondary border border-border-default rounded-lg shadow-lg">
            {/* Search input */}
            <div className="p-2 border-b border-border-default">
              <input
                ref={searchInputRef}
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search jobs..."
                className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Job list */}
            <div className="max-h-56 overflow-y-auto">
              {filteredJobs.length === 0 ? (
                <div className="px-3 py-4 text-center text-text-muted text-sm">No jobs found</div>
              ) : jobSearch.trim() ? (
                // Flat list when searching
                <div className="py-1">
                  {filteredJobs.map((j) => (
                    <button
                      key={j.abbreviation}
                      type="button"
                      onClick={() => handleJobClick(j.abbreviation)}
                      className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                        selectedJob === j.abbreviation ? 'bg-accent/10' : ''
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
                        className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-bg-secondary border-b border-border-default"
                        style={{ color: getRoleColor(role) }}
                      >
                        {getRoleDisplayName(role)}
                      </div>
                      <div className="py-1">
                        {jobs.map((j) => (
                          <button
                            key={j.abbreviation}
                            type="button"
                            onClick={() => handleJobClick(j.abbreviation)}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                              selectedJob === j.abbreviation ? 'bg-accent/10' : ''
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
        </div>
      )}

      {/* Selected job display */}
      {selectedJob && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>Selected:</span>
          <JobIcon job={selectedJob} size="sm" />
          <span className="text-text-primary font-medium">{selectedJob}</span>
          <span>- {getJobDisplayName(selectedJob)}</span>
        </div>
      )}
    </div>
  );
}
