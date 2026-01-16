/**
 * Tank Role Selector - Radix Popover-based MT/OT picker
 *
 * Simple two-button selector for tank roles.
 */

import { useState } from 'react';
import type { TankRole, SnapshotPlayer } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Tooltip } from '../primitives/Tooltip';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';

interface TankRoleSelectorProps {
  tankRole: TankRole | null | undefined;
  onSelect: (role: TankRole | undefined) => void;
  player: SnapshotPlayer;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdmin?: boolean;
}

export function TankRoleSelector({
  tankRole,
  onSelect,
  player,
  userRole,
  currentUserId,
  isAdmin,
}: TankRoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const roles: TankRole[] = ['MT', 'OT'];

  // Check edit permission
  const editPermission = canEditPlayer(userRole, player, currentUserId, isAdmin);

  const handleSelect = (role: TankRole | undefined) => {
    onSelect(role);
    setOpen(false);
  };

  // Separate base and hover classes for permission-aware styling
  const baseClasses = tankRole
    ? 'bg-role-tank/20 text-role-tank'
    : 'bg-surface-interactive text-text-muted';

  const hoverClasses = editPermission.allowed
    ? (tankRole ? 'hover:bg-role-tank/30' : 'hover:text-text-secondary')
    : '';

  const tooltipContent = !editPermission.allowed
    ? editPermission.reason
    : tankRole
      ? `Tank role: ${tankRole}`
      : 'Click to set MT/OT';

  return (
    <Popover open={open && editPermission.allowed} onOpenChange={setOpen}>
      <Tooltip content={tooltipContent}>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            {/* design-system-ignore: Badge-style button with specific toggle styling */}
            <button
              className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${baseClasses} ${hoverClasses} ${
                !editPermission.allowed ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!editPermission.allowed}
            >
              {tankRole || '--'}
            </button>
          </PopoverTrigger>
        </span>
      </Tooltip>

      <PopoverContent align="start" sideOffset={4} className="p-2">
        <div className="flex gap-1">
          {roles.map((role) => {
            const isSelected = tankRole === role;

            return (
              <button
                key={role}
                onClick={() => handleSelect(role)}
                className={`
                  px-3 py-1.5 rounded text-xs font-bold transition-colors
                  ${isSelected
                    ? 'bg-accent text-surface-base'
                    : 'bg-surface-base text-text-muted hover:bg-surface-interactive hover:text-text-secondary'
                  }
                `}
              >
                {role}
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        {tankRole && (
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
