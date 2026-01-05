/**
 * Position Selector - Radix Popover-based raid position picker
 *
 * Displays a 4x2 grid of raid positions (T1-R2) with role-based suggestions.
 */

import { useState } from 'react';
import type { RaidPosition, SnapshotPlayer } from '../../types';
import { RAID_POSITIONS } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';

interface PositionSelectorProps {
  position: RaidPosition | null | undefined;
  role: string;
  onSelect: (position: RaidPosition | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
}

// Get suggested positions based on role
function getSuggestedPositions(role: string): RaidPosition[] {
  switch (role) {
    case 'tank':
      return ['T1', 'T2'];
    case 'healer':
      return ['H1', 'H2'];
    case 'melee':
      return ['M1', 'M2'];
    case 'ranged':
    case 'caster':
      return ['R1', 'R2'];
    default:
      return [];
  }
}

function getPositionBgClasses(pos: RaidPosition, isSelected: boolean, isSuggested: boolean): string {
  if (isSelected) {
    // Use dark text for better contrast on bright role colors
    if (pos.startsWith('T')) return 'bg-role-tank text-surface-base font-bold';
    if (pos.startsWith('H')) return 'bg-role-healer text-surface-base font-bold';
    return 'bg-role-melee text-surface-base font-bold';
  }
  if (isSuggested) {
    if (pos.startsWith('T')) return 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30';
    if (pos.startsWith('H')) return 'bg-role-healer/20 text-role-healer hover:bg-role-healer/30';
    return 'bg-role-melee/20 text-role-melee hover:bg-role-melee/30';
  }
  return 'bg-surface-base text-text-muted hover:bg-surface-interactive hover:text-text-secondary';
}

// Base colors only (no hover) - for permission-disabled trigger
function getBaseClasses(position: RaidPosition | null | undefined): string {
  if (!position) {
    return 'bg-surface-interactive text-text-muted';
  }
  if (position.startsWith('T')) return 'bg-role-tank/20 text-role-tank';
  if (position.startsWith('H')) return 'bg-role-healer/20 text-role-healer';
  return 'bg-role-melee/20 text-role-melee';
}

// Hover effects only - conditionally applied based on permission
function getHoverClasses(position: RaidPosition | null | undefined): string {
  if (!position) {
    return 'hover:text-text-secondary';
  }
  if (position.startsWith('T')) return 'hover:bg-role-tank/30';
  if (position.startsWith('H')) return 'hover:bg-role-healer/30';
  return 'hover:bg-role-melee/30';
}

export function PositionSelector({
  position,
  role,
  onSelect,
  player,
  userRole,
  currentUserId,
}: PositionSelectorProps) {
  const [open, setOpen] = useState(false);
  const suggested = getSuggestedPositions(role);

  // Check edit permission
  const editPermission = canEditPlayer(userRole, player, currentUserId);

  const handleSelect = (pos: RaidPosition | undefined) => {
    onSelect(pos);
    setOpen(false);
  };

  return (
    <Popover open={open && editPermission.allowed} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${getBaseClasses(position)} ${
            editPermission.allowed ? getHoverClasses(position) : ''
          } ${!editPermission.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={
            !editPermission.allowed
              ? editPermission.reason
              : position
                ? `Position: ${position}`
                : 'Click to set position'
          }
          disabled={!editPermission.allowed}
        >
          {position || '--'}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={4} className="p-2 min-w-[140px]">
        {/* 4x2 grid of positions */}
        <div className="grid grid-cols-4 gap-1 w-max">
          {RAID_POSITIONS.map((pos) => {
            const isSelected = position === pos;
            const isSuggested = suggested.includes(pos);

            return (
              <button
                key={pos}
                onClick={() => handleSelect(pos)}
                className={`
                  px-2 py-1.5 rounded text-xs font-bold transition-colors
                  ${getPositionBgClasses(pos, isSelected, isSuggested)}
                `}
                title={isSuggested ? `Suggested for ${role}` : undefined}
              >
                {pos}
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        {position && (
          <button
            onClick={() => handleSelect(undefined)}
            className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
