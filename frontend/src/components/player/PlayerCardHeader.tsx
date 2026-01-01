/**
 * PlayerCard Header - Job icon, name, position, completion
 *
 * Contains the primary identification info for a player card.
 * Extracted from PlayerCard for maintainability.
 */

import { useState, useRef, useEffect } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { JobPicker } from './JobPicker';
import { PositionSelector } from './PositionSelector';
import {
  getRoleColor,
  type Role,
} from '../../gamedata';
import type { RaidPosition, SnapshotPlayer } from '../../types';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';

interface PlayerCardHeaderProps {
  job: string;
  name: string;
  role: string;
  position: RaidPosition | null | undefined;
  completedSlots: number;
  totalSlots: number;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
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
  player,
  userRole,
  currentUserId,
  onJobChange,
  onNameChange,
  onPositionChange,
  onMenuClick,
}: PlayerCardHeaderProps) {
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(role as Role) ? role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);

  // Check edit permission
  const editPermission = canEditPlayer(userRole, player, currentUserId);

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
    // Check permission before opening job picker
    if (!editPermission.allowed) return;
    setShowJobPicker(!showJobPicker);
  };

  const handleJobSelect = (newJob: string) => {
    onJobChange(newJob);
    setShowJobPicker(false);
  };

  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Check permission before entering edit mode
    if (!editPermission.allowed) return;
    setIsEditingName(true);
    setEditedName(name);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Check permission before entering edit mode
    if (!editPermission.allowed) return;
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
        <div className="relative">
          <button
            type="button"
            onClick={handleJobIconClick}
            className={`p-0.5 rounded transition-all ${
              editPermission.allowed
                ? 'cursor-pointer hover:ring-2 hover:ring-accent/50'
                : 'cursor-not-allowed opacity-75'
            }`}
            style={{ backgroundColor: roleColor }}
            title={
              editPermission.allowed
                ? 'Click to change job'
                : editPermission.reason
            }
            disabled={!editPermission.allowed}
          >
            <JobIcon job={job} size="lg" className="rounded-sm" />
          </button>

          {/* Job picker dropdown */}
          {showJobPicker && (
            <div
              className="absolute z-50 top-full left-0 mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <JobPicker
                selectedJob={job}
                onJobSelect={handleJobSelect}
                onRequestClose={() => setShowJobPicker(false)}
              />
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
                  className={`font-medium text-text-primary ${editPermission.allowed ? 'cursor-pointer hover:text-accent' : 'cursor-not-allowed'}`}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={handleNameDoubleClick}
                  title={
                    !editPermission.allowed
                      ? editPermission.reason
                      : "Double-click to edit name"
                  }
                >
                  {name}
                </span>
                {/* Edit button - always visible but subtle */}
                <button
                  onClick={handleEditClick}
                  className={`p-0.5 rounded opacity-40 transition-opacity ${
                    editPermission.allowed
                      ? 'hover:bg-surface-interactive hover:opacity-100'
                      : 'cursor-not-allowed opacity-30'
                  }`}
                  title={
                    !editPermission.allowed
                      ? editPermission.reason
                      : "Edit name"
                  }
                  disabled={!editPermission.allowed}
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
              player={player}
              userRole={userRole}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>

      {/* Completion count + menu button */}
      <div className="flex items-center gap-2">
        <div className="text-lg font-bold text-text-primary">
          {completedSlots}/{totalSlots}
        </div>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-0.5 rounded hover:bg-surface-interactive opacity-60 hover:opacity-100 transition-opacity"
            title="Player options"
            aria-label="Player options menu"
          >
            <img
              src="/icons/player-options.png"
              alt="Player options"
              className="w-6 h-6"
            />
          </button>
        )}
      </div>
    </div>
  );
}
