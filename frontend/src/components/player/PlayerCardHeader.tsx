/**
 * PlayerCard Header - Job icon, name, position, completion
 *
 * Contains the primary identification info for a player card.
 * Extracted from PlayerCard for maintainability.
 */

import { useState, useRef, useEffect } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { PositionSelector } from './PositionSelector';
import {
  getJobDisplayName,
  getRoleColor,
  getRoleForJob,
  groupJobsByRole,
  getRoleDisplayName,
  type Role,
} from '../../gamedata';
import type { RaidPosition } from '../../types';

const defaultRoleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

interface PlayerCardHeaderProps {
  job: string;
  name: string;
  role: string;
  position: RaidPosition | null | undefined;
  completedSlots: number;
  totalSlots: number;
  onJobChange: (job: string) => void;
  onNameChange: (name: string) => void;
  onPositionChange: (position: RaidPosition | undefined) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

export function PlayerCardHeader({
  job,
  name,
  role,
  position,
  completedSlots,
  totalSlots,
  onJobChange,
  onNameChange,
  onPositionChange,
  onMenuClick,
}: PlayerCardHeaderProps) {
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const jobPickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(role as Role) ? role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);
  const jobsByRole = groupJobsByRole();

  // Sort roles with current player's role first
  const currentRole = getRoleForJob(job);
  const roleOrder = currentRole && defaultRoleOrder.includes(currentRole)
    ? [currentRole, ...defaultRoleOrder.filter((r) => r !== currentRole)]
    : defaultRoleOrder;

  // Filter jobs based on search
  const allJobs = Object.values(jobsByRole).flat();
  const filteredJobs = jobSearch.trim()
    ? allJobs.filter(
        (j) =>
          j.abbreviation.toLowerCase().includes(jobSearch.toLowerCase()) ||
          getJobDisplayName(j.abbreviation).toLowerCase().includes(jobSearch.toLowerCase())
      )
    : null;

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

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Sync editedName with name when it changes externally
  useEffect(() => {
    setEditedName(name);
  }, [name]);

  const handleJobIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowJobPicker(!showJobPicker);
  };

  const handleJobSelect = (newJob: string) => {
    onJobChange(newJob);
    setShowJobPicker(false);
    setJobSearch('');
  };

  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(name);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(name);
  };

  const handleNameSave = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== name) {
      onNameChange(trimmedName);
    } else {
      setEditedName(name);
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(name);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  return (
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
            <JobIcon job={job} size="lg" className="rounded-sm" />
          </button>

          {/* Job picker dropdown */}
          {showJobPicker && (
            <div
              className="absolute z-50 top-full left-0 mt-2 w-64 bg-[#0a0a0f] border border-border-default rounded-lg shadow-xl"
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
                  className="w-full bg-surface-base border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
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
                      {filteredJobs.map((j) => (
                        <button
                          key={j.abbreviation}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobSelect(j.abbreviation);
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                            job === j.abbreviation ? 'bg-active-bg' : ''
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
                    <div className="px-3 py-4 text-center text-text-muted text-sm">
                      No jobs found
                    </div>
                  )
                ) : (
                  roleOrder.map((r) => (
                    <div key={r}>
                      <div
                        className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-surface-overlay border-b border-border-default"
                        style={{ color: getRoleColor(r) }}
                      >
                        {getRoleDisplayName(r)}
                      </div>
                      <div className="py-1">
                        {jobsByRole[r].map((j) => (
                          <button
                            key={j.abbreviation}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJobSelect(j.abbreviation);
                            }}
                            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-surface-interactive text-left ${
                              job === j.abbreviation ? 'bg-active-bg' : ''
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
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Name and position */}
        <div>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-text-primary bg-surface-base border border-accent rounded px-2 py-0.5 w-32 focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-1">
                <span
                  className="font-medium text-text-primary cursor-pointer hover:text-accent"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={handleNameDoubleClick}
                  title="Double-click to edit name"
                >
                  {name}
                </span>
                {/* Edit button - always visible but subtle */}
                <button
                  onClick={handleEditClick}
                  className="p-0.5 rounded hover:bg-surface-interactive opacity-40 hover:opacity-100 transition-opacity"
                  title="Edit name"
                  aria-label="Edit player name"
                >
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            {/* Position badge */}
            <PositionSelector
              position={position}
              role={role}
              onSelect={onPositionChange}
            />
          </div>
        </div>
      </div>

      {/* Completion count + menu button */}
      <div className="flex items-center gap-1">
        <div className="text-lg font-bold text-text-primary">
          {completedSlots}/{totalSlots}
        </div>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-1 rounded hover:bg-surface-interactive opacity-40 hover:opacity-100 transition-opacity"
            title="Player options"
            aria-label="Player options menu"
          >
            <svg className="w-4 h-4 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
