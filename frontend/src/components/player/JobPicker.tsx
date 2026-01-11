/**
 * Unified Job Picker Component
 *
 * Reusable job selector for both template and configured player cards.
 * - With templateRole: Shows role-specific quick-select icons + dropdown
 * - Without templateRole: Just shows dropdown with all jobs
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { JobIcon } from '../ui/JobIcon';
import {
  getJobsForTemplateRole,
  getJobDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRaidJobs,
  type Role,
  type JobInfo,
} from '../../gamedata';
import type { TemplateRole } from '../../types';
import { TEMPLATE_ROLE_INFO, getRoleIconUrl } from '../../utils/constants';

// Icon for "Other jobs" button
const OTHER_JOBS_ICON_ID = 1;

interface JobPickerProps {
  selectedJob: string;
  onJobSelect: (job: string) => void;
  templateRole?: TemplateRole; // Optional - only for template cards
  onRequestClose?: () => void; // Optional - called when picker wants to close (click outside, escape)
}

const roleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

export function JobPicker({ selectedJob, onJobSelect, templateRole, onRequestClose }: JobPickerProps) {
  // For non-template cards, start with picker open; for template cards, start closed
  const [showFullPicker, setShowFullPicker] = useState(!templateRole);
  const [jobSearch, setJobSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get jobs for template role (if provided)
  const templateJobs = useMemo(
    () => (templateRole ? getJobsForTemplateRole(templateRole) : []),
    [templateRole]
  );

  const allJobs = getRaidJobs();
  const roleInfo = templateRole ? TEMPLATE_ROLE_INFO[templateRole] : null;
  const roleColorVar = roleInfo ? `var(--color-${roleInfo.color})` : null;

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
        // Notify parent if this is a controlled picker
        onRequestClose?.();
      }
    }
    // Only listen when picker is shown
    if (showFullPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFullPicker, onRequestClose]);

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
        onRequestClose?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFullPicker, onRequestClose]);

  const handleJobClick = (job: string) => {
    onJobSelect(job);
    setShowFullPicker(false);
    setJobSearch('');
    // Notify parent to close if this is a controlled picker
    onRequestClose?.();
  };

  return (
    <div className="space-y-3" ref={pickerRef}>
      {/* Template role label - only show if templateRole provided */}
      {templateRole && roleInfo && (
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
      )}

      {/* Quick select job icons - only show if templateRole provided */}
      {templateRole && roleInfo && templateJobs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templateJobs.map((job) => (
            <button
              key={job.abbreviation}
              type="button"
              onClick={() => handleJobClick(job.abbreviation)}
              className={`p-1.5 rounded-lg transition-all ${
                selectedJob === job.abbreviation
                  ? 'ring-2'
                  : 'bg-surface-interactive hover:bg-surface-elevated hover:ring-1 hover:ring-border-default'
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
            const isTemplateJob = templateJobs.some((j) => j.abbreviation === selectedJob);
            const showSelected = showFullPicker && !isTemplateJob;
            return (
              <button
                type="button"
                onClick={() => setShowFullPicker(!showFullPicker)}
                className={`p-1.5 rounded-lg transition-all ${
                  showSelected
                    ? 'ring-2'
                    : 'bg-surface-interactive hover:bg-surface-elevated hover:ring-1 hover:ring-border-default'
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
      )}

      {/* Expanded picker dropdown */}
      {showFullPicker && (
        <div className={templateRole ? 'relative' : ''}>
          <div className={templateRole ? 'absolute z-50 top-0 left-0 right-0 min-w-[280px] bg-surface-raised border border-border-default rounded-lg shadow-lg' : 'w-80 bg-surface-raised border border-border-default rounded-lg shadow-lg'}>
            {/* Search input */}
            <div className="p-2 border-b border-border-default">
              <input
                ref={searchInputRef}
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search jobs..."
                className="w-full bg-surface-base border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-accent focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowFullPicker(false);
                    setJobSearch('');
                  }
                }}
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
                      className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
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
                            onClick={() => handleJobClick(j.abbreviation)}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
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

      {/* Selected job display - for template cards */}
      {templateRole && selectedJob && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>Selected:</span>
          <JobIcon job={selectedJob} size="sm" />
          <span className="text-text-primary font-medium">{selectedJob}</span>
          <span>- {getJobDisplayName(selectedJob)}</span>
        </div>
      )}

      {/* Selected job display with re-open button - for non-template cards when picker is closed */}
      {!templateRole && !showFullPicker && (
        <button
          type="button"
          onClick={() => setShowFullPicker(true)}
          className="w-full flex items-center gap-3 p-3 bg-surface-interactive hover:bg-surface-elevated border border-border-default rounded-lg transition-colors"
        >
          {selectedJob ? (
            <>
              <JobIcon job={selectedJob} size="lg" />
              <div className="flex-1 text-left">
                <span className="text-text-primary font-medium">{selectedJob}</span>
                <span className="text-text-secondary ml-2">- {getJobDisplayName(selectedJob)}</span>
              </div>
              <span className="text-text-muted text-sm">Change</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 bg-surface-base rounded flex items-center justify-center">
                <span className="text-text-muted text-xl">?</span>
              </div>
              <span className="text-text-muted">Select a job...</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
