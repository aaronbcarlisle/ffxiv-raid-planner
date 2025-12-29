/**
 * Job Picker - Popover-based job selection with search
 *
 * Displays jobs grouped by role with search filtering.
 * Uses Radix Popover for accessibility.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import {
  groupJobsByRole,
  getRoleDisplayName,
  getJobDisplayName,
  getRoleColor,
  getRaidJobs,
  type Role,
} from '../../gamedata';

interface JobPickerProps {
  value: string;
  onChange: (job: string) => void;
}

const roleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

export function JobPicker({ value, onChange }: JobPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const jobsByRole = groupJobsByRole();
  const allJobs = getRaidJobs();

  // Filter jobs based on search
  const filteredJobs = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase();
    return allJobs.filter(
      (job) =>
        job.abbreviation.toLowerCase().includes(query) ||
        getJobDisplayName(job.abbreviation).toLowerCase().includes(query)
    );
  }, [search, allJobs]);

  // Focus search input when dropdown opens, clear on close
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Small delay to ensure popover is mounted
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const handleSelect = (job: string) => {
    onChange(job);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-left flex items-center gap-3 focus:border-accent focus:outline-none hover:border-text-muted"
        >
          {value ? (
            <>
              <JobIcon job={value} size="md" />
              <span className="text-text-primary">
                {value} - {getJobDisplayName(value)}
              </span>
            </>
          ) : (
            <span className="text-text-muted">Select a job...</span>
          )}
          <span className="ml-auto text-text-muted">{open ? '▲' : '▼'}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        {/* Search input */}
        <div className="p-2 border-b border-border-default">
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full bg-surface-base border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        {/* Job list */}
        <div className="max-h-56 overflow-y-auto">
          {filteredJobs ? (
            // Show filtered results as flat list
            filteredJobs.length > 0 ? (
              <div className="py-1">
                {filteredJobs.map((job) => (
                  <button
                    key={job.abbreviation}
                    type="button"
                    onClick={() => handleSelect(job.abbreviation)}
                    className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                      value === job.abbreviation ? 'bg-active-bg' : ''
                    }`}
                  >
                    <JobIcon job={job.abbreviation} size="md" />
                    <span className="text-text-primary">{job.abbreviation}</span>
                    <span className="text-text-secondary text-sm">
                      {getJobDisplayName(job.abbreviation)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-text-muted text-sm">
                No jobs found
              </div>
            )
          ) : (
            // Show grouped by role when not searching
            roleOrder.map((role) => (
              <div key={role}>
                {/* Role header */}
                <div
                  className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-surface-overlay border-b border-border-default"
                  style={{ color: getRoleColor(role) }}
                >
                  {getRoleDisplayName(role)}
                </div>
                {/* Jobs in role */}
                <div className="py-1">
                  {jobsByRole[role].map((job) => (
                    <button
                      key={job.abbreviation}
                      type="button"
                      onClick={() => handleSelect(job.abbreviation)}
                      className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                        value === job.abbreviation ? 'bg-active-bg' : ''
                      }`}
                    >
                      <JobIcon job={job.abbreviation} size="md" />
                      <span className="text-text-primary">{job.abbreviation}</span>
                      <span className="text-text-secondary text-sm">
                        {getJobDisplayName(job.abbreviation)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
