import { useState, useRef, useEffect } from 'react';
import { GearTable } from './GearTable';
import { JobIcon } from '../ui/JobIcon';
import {
  getJobDisplayName,
  getRoleColor,
  getRoleForJob,
  groupJobsByRole,
  getRoleDisplayName,
  type Role,
} from '../../gamedata';
import type { Player, GearSlotStatus } from '../../types';

const roleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

interface PlayerCardProps {
  player: Player;
  onUpdate: (updates: Partial<Player>) => void;
  onRemove: () => void;
}

export function PlayerCard({ player, onUpdate, onRemove }: PlayerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const jobPickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const roleColor = getRoleColor(player.role as any);
  const jobsByRole = groupJobsByRole();

  // Calculate completion percentage
  const completedSlots = player.gear.filter((g) => {
    if (g.bisSource === 'raid') return g.hasItem;
    return g.hasItem && g.isAugmented;
  }).length;
  const totalSlots = player.gear.length;
  const completionPercent = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;

  const handleGearChange = (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) =>
      g.slot === slot ? { ...g, ...updates } : g
    );
    onUpdate({ gear: newGear });
  };

  // Close job picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jobPickerRef.current && !jobPickerRef.current.contains(event.target as Node)) {
        setShowJobPicker(false);
        setJobSearch('');
      }
    }
    if (showJobPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showJobPicker]);

  // Focus search when job picker opens
  useEffect(() => {
    if (showJobPicker && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showJobPicker]);

  // Filter jobs based on search
  const allJobs = Object.values(jobsByRole).flat();
  const filteredJobs = jobSearch.trim()
    ? allJobs.filter(
        (job) =>
          job.abbreviation.toLowerCase().includes(jobSearch.toLowerCase()) ||
          getJobDisplayName(job.abbreviation).toLowerCase().includes(jobSearch.toLowerCase())
      )
    : null;

  const handleJobChange = (newJob: string) => {
    const newRole = getRoleForJob(newJob);
    if (newRole) {
      onUpdate({ job: newJob, role: newRole });
    }
    setShowJobPicker(false);
    setJobSearch('');
  };

  const handleJobIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowJobPicker(!showJobPicker);
  };

  const handleRemoveClick = () => {
    if (showConfirmDelete) {
      onRemove();
    } else {
      setShowConfirmDelete(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="bg-bg-card border border-border-default rounded-lg overflow-visible">
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-bg-hover transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Clickable job icon with dropdown */}
            <div ref={jobPickerRef} className="relative">
              <button
                type="button"
                onClick={handleJobIconClick}
                className="p-0.5 rounded cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all"
                style={{ backgroundColor: roleColor }}
                title="Click to change job"
              >
                <JobIcon job={player.job} size="lg" className="rounded-sm" />
              </button>

              {/* Job picker dropdown */}
              {showJobPicker && (
                <div
                  className="absolute z-50 top-full left-0 mt-2 w-64 bg-bg-secondary border border-border-default rounded-lg shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Search input */}
                  <div className="p-2 border-b border-border-default">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      placeholder="Search jobs..."
                      className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowJobPicker(false);
                          setJobSearch('');
                        }
                      }}
                    />
                  </div>

                  {/* Job list */}
                  <div className="max-h-56 overflow-y-auto">
                    {filteredJobs ? (
                      filteredJobs.length > 0 ? (
                        <div className="py-1">
                          {filteredJobs.map((job) => (
                            <button
                              key={job.abbreviation}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJobChange(job.abbreviation);
                              }}
                              className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                                player.job === job.abbreviation ? 'bg-accent/10' : ''
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
                      roleOrder.map((role) => (
                        <div key={role}>
                          <div
                            className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-bg-secondary border-b border-border-default"
                            style={{ color: getRoleColor(role) }}
                          >
                            {getRoleDisplayName(role)}
                          </div>
                          <div className="py-1">
                            {jobsByRole[role].map((job) => (
                              <button
                                key={job.abbreviation}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJobChange(job.abbreviation);
                                }}
                                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                                  player.job === job.abbreviation ? 'bg-accent/10' : ''
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
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">{player.name}</span>
                {player.isSubstitute && (
                  <span className="text-xs bg-bg-hover text-text-muted px-1.5 py-0.5 rounded">
                    SUB
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: roleColor }}>{player.job}</span>
                <span className="text-text-muted">-</span>
                <span className="text-text-secondary">{getJobDisplayName(player.job)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completion percentage */}
            <div className="text-right">
              <div className="text-lg font-bold text-text-primary">{completionPercent}%</div>
              <div className="text-xs text-text-muted">BiS</div>
            </div>
            {/* Expand/collapse indicator */}
            <div className="text-text-muted">
              {isExpanded ? '▲' : '▼'}
            </div>
          </div>
        </div>

        {/* Compact gear view when collapsed */}
        {!isExpanded && (
          <div className="mt-2 ml-4">
            <GearTable gear={player.gear} onGearChange={handleGearChange} compact />
          </div>
        )}

        {/* Notes if present */}
        {player.notes && !isExpanded && (
          <div className="mt-2 ml-4 text-xs text-text-muted italic">
            {player.notes}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-default p-3">
          <GearTable gear={player.gear} onGearChange={handleGearChange} />

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-text-muted text-xs mb-1">Notes</label>
            <input
              type="text"
              value={player.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              placeholder="Add notes..."
              className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Actions */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveClick();
              }}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                showConfirmDelete
                  ? 'bg-status-error text-white'
                  : 'text-text-muted hover:text-status-error hover:bg-status-error/10'
              }`}
            >
              {showConfirmDelete ? 'Confirm Remove' : 'Remove'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
