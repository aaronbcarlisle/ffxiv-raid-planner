/**
 * Tank Role Selector - Radix Popover-based MT/OT picker
 *
 * Simple two-button selector for tank roles.
 */

import { useState } from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import type { TankRole, SnapshotPlayer } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Tooltip } from '../primitives/Tooltip';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';

// Tank role descriptions for tooltips
const TANK_ROLE_INFO: Record<TankRole, { label: string; group: string; icon: typeof Shield }> = {
  MT: {
    label: 'Main Tank',
    group: 'Usually in Light Party 1 (G1)',
    icon: Shield,
  },
  OT: {
    label: 'Off Tank',
    group: 'Usually in Light Party 2 (G2)',
    icon: ShieldAlert,
  },
};

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
      ? (
        <div className="flex items-start gap-2">
          {(() => {
            const Icon = TANK_ROLE_INFO[tankRole].icon;
            return <Icon className="w-4 h-4 text-role-tank flex-shrink-0 mt-0.5" />;
          })()}
          <div>
            <div className="font-medium">{TANK_ROLE_INFO[tankRole].label} ({tankRole})</div>
            <div className="text-text-secondary text-xs mt-0.5">
              {TANK_ROLE_INFO[tankRole].group}
            </div>
          </div>
        </div>
      )
      : (
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-role-tank flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Set Tank Role</div>
            <div className="text-text-secondary text-xs mt-0.5">
              MT (Main Tank) or OT (Off Tank)
            </div>
          </div>
        </div>
      );

  return (
    <Popover open={open && editPermission.allowed} onOpenChange={setOpen}>
      <Tooltip content={tooltipContent}>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            {/* design-system-ignore: Badge-style button with specific toggle styling */}
            <button
              className={`px-2 py-1 sm:px-1.5 sm:py-0.5 min-h-[44px] sm:min-h-0 rounded text-xs font-bold transition-colors ${baseClasses} ${hoverClasses} ${
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
                  px-4 py-2 sm:px-3 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded text-xs font-bold transition-colors
                  ${isSelected
                    ? 'bg-role-tank text-surface-base'
                    : 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30'
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
            className="w-full mt-2 px-2 py-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
