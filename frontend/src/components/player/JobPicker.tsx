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
  getRaidJobs,
  getHealerType,
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
  reverseLayout?: boolean; // Optional - render search at bottom (for dropdowns that open upward)
}

// Detailed category order for dropdown sections (splits healers into Pure/Barrier)
type JobCategory = 'tank' | 'pure-healer' | 'barrier-healer' | 'melee' | 'ranged' | 'caster';
const categoryOrder: JobCategory[] = ['tank', 'pure-healer', 'barrier-healer', 'melee', 'ranged', 'caster'];

// Category display names and colors
const CATEGORY_CONFIG: Record<JobCategory, { name: string; color: string }> = {
  'tank': { name: 'Tank', color: 'var(--color-role-tank)' },
  'pure-healer': { name: 'Pure Healer', color: 'var(--color-role-healer)' },
  'barrier-healer': { name: 'Barrier Healer', color: 'var(--color-role-healer)' },
  'melee': { name: 'Melee DPS', color: 'var(--color-role-melee)' },
  'ranged': { name: 'Physical Ranged', color: 'var(--color-role-ranged)' },
  'caster': { name: 'Magical Ranged', color: 'var(--color-role-caster)' },
};

export function JobPicker({ selectedJob, onJobSelect, templateRole, onRequestClose, reverseLayout = false }: JobPickerProps) {
  // For non-template cards, start with picker open; for template cards, start closed
  const [showFullPicker, setShowFullPicker] = useState(!templateRole);
  const [jobSearch, setJobSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get jobs for template role (if provided)
  const templateJobs = useMemo(
    () => (templateRole ? getJobsForTemplateRole(templateRole) : []),
    [templateRole]
  );

  const allJobs = getRaidJobs();
  const roleInfo = templateRole ? TEMPLATE_ROLE_INFO[templateRole] : null;
  const roleColorVar = roleInfo ? `var(--color-${roleInfo.color})` : null;

  // Generate search tags for a job (includes role, category, job name, abbreviation)
  const getJobSearchTags = useMemo(() => {
    return (job: JobInfo): string[] => {
      const tags: string[] = [
        job.abbreviation.toLowerCase(),
        getJobDisplayName(job.abbreviation).toLowerCase(),
        job.role,
      ];

      // Add role-specific tags
      if (job.role === 'tank') {
        tags.push('tank', 'tanks');
      } else if (job.role === 'healer') {
        tags.push('healer', 'healers');
        const healerType = getHealerType(job.abbreviation);
        if (healerType === 'pure') {
          tags.push('pure', 'pure healer', 'pure healers', 'regen', 'regen healer');
        } else {
          tags.push('barrier', 'barrier healer', 'barrier healers', 'shield', 'shield healer');
        }
      } else if (job.role === 'melee') {
        tags.push('melee', 'melee dps', 'dps');
      } else if (job.role === 'ranged') {
        tags.push('ranged', 'physical ranged', 'phys ranged', 'dps');
      } else if (job.role === 'caster') {
        tags.push('caster', 'casters', 'magical ranged', 'magic', 'dps');
      }

      return tags;
    };
  }, []);

  // Filter all jobs for the expanded picker (tag-based search)
  const filteredJobs = useMemo(() => {
    if (!jobSearch.trim()) return allJobs;
    const query = jobSearch.toLowerCase().trim();

    // Filter jobs where any tag starts with or contains the query
    return allJobs.filter((job) => {
      const tags = getJobSearchTags(job);
      return tags.some((tag) => tag.includes(query) || tag.startsWith(query));
    });
  }, [jobSearch, allJobs, getJobSearchTags]);

  // Group jobs by category for the expanded picker (healers split into Pure/Barrier)
  const jobsByCategory = useMemo(() => {
    const groups: Record<JobCategory, JobInfo[]> = {
      'tank': [],
      'pure-healer': [],
      'barrier-healer': [],
      'melee': [],
      'ranged': [],
      'caster': [],
    };
    for (const j of filteredJobs) {
      if (j.role === 'healer') {
        const healerType = getHealerType(j.abbreviation);
        if (healerType === 'pure') {
          groups['pure-healer'].push(j);
        } else {
          groups['barrier-healer'].push(j);
        }
      } else {
        groups[j.role as JobCategory].push(j);
      }
    }
    return groups;
  }, [filteredJobs]);

  // Flat list of navigable jobs for keyboard navigation
  // Order is always the same: tanks first (index 0 = PLD), casters last
  // Visual reversal is handled by CSS flex-col-reverse
  const navigableJobs = useMemo(() => {
    if (jobSearch.trim()) {
      return filteredJobs;
    } else {
      return categoryOrder.flatMap((category) => jobsByCategory[category]);
    }
  }, [jobSearch, filteredJobs, jobsByCategory]);

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

  // Focus search when picker opens, and scroll to show tanks if upward layout
  useEffect(() => {
    if (showFullPicker) {
      searchInputRef.current?.focus();
      // With flex-col-reverse, tanks (index 0) are at DOM start but visual bottom.
      // scrollTop = 0 shows DOM start, which is the visual bottom (tanks closest to search).
      if (reverseLayout && listRef.current) {
        listRef.current.scrollTop = 0;
      }
    }
  }, [showFullPicker, reverseLayout]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showFullPicker) {
        setShowFullPicker(false);
        setJobSearch('');
        setHighlightedIndex(-1);
        onRequestClose?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showFullPicker, onRequestClose]);

  // Reset highlight when search changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset derived state when filter changes
    setHighlightedIndex(-1);
  }, [jobSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleJobClick = (job: string) => {
    onJobSelect(job);
    setShowFullPicker(false);
    setJobSearch('');
    setHighlightedIndex(-1);
    // Notify parent to close if this is a controlled picker
    onRequestClose?.();
  };

  // Handle keyboard navigation in search input
  // With flex-direction: column-reverse for upward dropdowns:
  //   - Index 0 is visually at the bottom (closest to search)
  //   - Higher indices are visually at the top
  // So when reverseLayout=true:
  //   - Up arrow moves away from search = increment index
  //   - Down arrow moves toward search = decrement index
  //   - First press initializes to index 0 (closest to search)
  // When reverseLayout=false (normal):
  //   - Down arrow moves away from search = increment index
  //   - Up arrow moves toward search = decrement index
  //   - First press initializes to index 0 (closest to search)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowFullPicker(false);
      setJobSearch('');
      setHighlightedIndex(-1);
      onRequestClose?.();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (reverseLayout) {
        // Reversed (column-reverse): Down moves toward search = decrement index
        setHighlightedIndex((prev) => {
          if (prev === -1) return 0; // Initialize to closest to search
          return prev > 0 ? prev - 1 : prev;
        });
      } else {
        // Normal: Down moves away from search = increment index
        setHighlightedIndex((prev) =>
          prev < navigableJobs.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (reverseLayout) {
        // Reversed (column-reverse): Up moves away from search = increment index
        setHighlightedIndex((prev) => {
          if (prev === -1) return 0; // Initialize to closest to search
          return prev < navigableJobs.length - 1 ? prev + 1 : prev;
        });
      } else {
        // Normal: Up moves toward search = decrement index
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < navigableJobs.length) {
      e.preventDefault();
      handleJobClick(navigableJobs[highlightedIndex].abbreviation);
    }
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
              className={`p-2.5 sm:p-1.5 rounded-lg transition-all ${
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
                className={`p-2.5 sm:p-1.5 rounded-lg transition-all ${
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
          <div className={templateRole ? 'absolute z-[100] top-0 left-0 right-0 min-w-[280px] bg-surface-raised border border-border-default rounded-lg shadow-lg' : 'w-80 bg-surface-raised border border-border-default rounded-lg shadow-lg'}>
            {/* Search input - at top normally, at bottom when reversed */}
            {!reverseLayout && (
              <div className="p-2 border-b border-border-default">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs..."
                  className="w-full bg-surface-base border border-border-default rounded px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-accent focus:outline-none"
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            )}

            {/* Job list - use flex-col-reverse on container AND job lists for upward dropdowns */}
            {/* This makes index 0 (PLD) appear at visual bottom, closest to search */}
            <div
              className={`max-h-56 overflow-y-auto ${reverseLayout ? 'flex flex-col-reverse' : ''}`}
              ref={listRef}
            >
              {filteredJobs.length === 0 ? (
                <div className="px-3 py-4 text-center text-text-muted text-sm">No jobs found</div>
              ) : jobSearch.trim() ? (
                // Flat list when searching
                <div className={`py-1 ${reverseLayout ? 'flex flex-col-reverse' : ''}`}>
                  {filteredJobs.map((j, idx) => {
                    const isHighlighted = highlightedIndex === idx;
                    const roleColor = getRoleColor(j.role);
                    return (
                      <button
                        key={j.abbreviation}
                        type="button"
                        data-index={idx}
                        onClick={() => handleJobClick(j.abbreviation)}
                        className={`w-full px-3 py-3 sm:py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                          selectedJob === j.abbreviation ? 'bg-accent/10' : ''
                        }`}
                        style={isHighlighted ? {
                          backgroundColor: `color-mix(in srgb, ${roleColor} 20%, transparent)`,
                          borderTop: `1px solid ${roleColor}`,
                          borderBottom: `1px solid ${roleColor}`,
                          marginTop: '-1px',
                          paddingTop: 'calc(0.5rem + 1px)',
                        } : undefined}
                      >
                        <JobIcon job={j.abbreviation} size="md" />
                        <span className="text-text-primary">{j.abbreviation}</span>
                        <span className="text-text-secondary text-sm">
                          {getJobDisplayName(j.abbreviation)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Grouped by category when not searching (healers split into Pure/Barrier)
                (() => {
                  let runningIndex = 0;
                  return categoryOrder.map((category) => {
                    const jobs = jobsByCategory[category];
                    if (jobs.length === 0) return null;
                    const startIndex = runningIndex;
                    runningIndex += jobs.length;
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <div key={category}>
                        <div
                          className={`px-3 py-1.5 text-xs font-medium bg-surface-raised border-b border-border-default ${reverseLayout ? '' : 'sticky top-0'}`}
                          style={{ color: config.color }}
                        >
                          {config.name}
                        </div>
                        {/* Reverse jobs within category for upward layout */}
                        <div className={`py-1 ${reverseLayout ? 'flex flex-col-reverse' : ''}`}>
                          {jobs.map((j, idx) => {
                            const globalIndex = startIndex + idx;
                            const isHighlighted = highlightedIndex === globalIndex;
                            const roleColor = getRoleColor(j.role);
                            return (
                              <button
                                key={j.abbreviation}
                                type="button"
                                data-index={globalIndex}
                                onClick={() => handleJobClick(j.abbreviation)}
                                className={`w-full px-3 py-3 sm:py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                                  selectedJob === j.abbreviation ? 'bg-accent/10' : ''
                                }`}
                                style={isHighlighted ? {
                                  backgroundColor: `color-mix(in srgb, ${roleColor} 20%, transparent)`,
                                  borderTop: `1px solid ${roleColor}`,
                                  borderBottom: `1px solid ${roleColor}`,
                                  marginTop: '-1px',
                                  paddingTop: 'calc(0.5rem + 1px)',
                                } : undefined}
                              >
                                <JobIcon job={j.abbreviation} size="md" />
                                <span className="text-text-primary">{j.abbreviation}</span>
                                <span className="text-text-secondary text-sm">
                                  {getJobDisplayName(j.abbreviation)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Search input at bottom when reversed */}
            {reverseLayout && (
              <div className="p-2 border-t border-border-default">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs..."
                  className="w-full bg-surface-base border border-border-default rounded px-3 py-2.5 sm:py-1.5 text-base sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-accent focus:outline-none"
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
            )}
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
