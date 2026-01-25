/**
 * PlayerCard Header - Job icon, name, position, completion
 *
 * Contains the primary identification info for a player card.
 * Extracted from PlayerCard for maintainability.
 */

import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { JobIcon } from '../ui/JobIcon';
import { ProgressRing } from '../ui/ProgressRing';
import { Tooltip } from '../primitives/Tooltip';
import { LongPressTooltip } from '../primitives/LongPressTooltip';
import { IconButton } from '../primitives/IconButton';
import { JobPicker } from './JobPicker';
import { PositionSelector } from './PositionSelector';
import { TankRoleSelector } from './TankRoleSelector';
import {
  getRoleColor,
  type Role,
} from '../../gamedata';
import type { RaidPosition, TankRole, SnapshotPlayer, GearSlot, GearSource } from '../../types';
import { GEAR_SLOT_NAMES, GEAR_SLOTS } from '../../types';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';
import { calculateAverageItemLevel, getEffectiveCurrentSource } from '../../utils/calculations';
import { getItemLevelForCategory } from '../../gamedata/raid-tiers';

/**
 * Calculate item level for a single gear slot, mirroring calculateAverageItemLevel logic.
 */
function getSlotItemLevel(
  slot: { slot: GearSlot; hasItem: boolean; bisSource: GearSource | null; isAugmented: boolean; itemLevel?: number; currentSource?: string },
  tierId: string
): number {
  const isWeapon = slot.slot === 'weapon';

  // Special case: 'tome' BiS with item but NOT augmented
  if (slot.hasItem && slot.bisSource === 'tome' && !slot.isAugmented) {
    return getItemLevelForCategory(tierId, 'tome', isWeapon);
  }

  // Special case: 'base_tome' BiS - use base tome iLv
  if (slot.hasItem && slot.bisSource === 'base_tome') {
    return getItemLevelForCategory(tierId, 'tome', isWeapon);
  }

  // Special case: 'crafted' BiS - use crafted iLv
  if (slot.hasItem && slot.bisSource === 'crafted') {
    return getItemLevelForCategory(tierId, 'crafted', isWeapon);
  }

  // Use itemLevel from BiS import if player has the item (any bisSource including null)
  if (slot.hasItem && slot.itemLevel && slot.itemLevel > 0) {
    return slot.itemLevel;
  }

  // Fall through to currentSource calculation:
  // - For acquired items with null bisSource or no itemLevel, infer from currentSource
  // - For unacquired items, use currentSource (typically 'crafted' at tier start)
  const currentSource = getEffectiveCurrentSource(slot as Parameters<typeof getEffectiveCurrentSource>[0]);
  const effectiveSource = currentSource === 'unknown' ? 'crafted' : currentSource;
  return getItemLevelForCategory(tierId, effectiveSource, isWeapon);
}

interface PlayerCardHeaderProps {
  job: string;
  name: string;
  role: string;
  position: RaidPosition | null | undefined;
  tankRole?: TankRole | null;
  completedSlots: number;
  totalSlots: number;
  player: SnapshotPlayer;
  tierId: string;
  userRole?: MemberRole | null;
  currentUserId?: string;
  isAdmin?: boolean;
  onJobChange: (job: string) => void;
  onNameChange: (name: string) => void;
  onPositionChange: (position: RaidPosition | undefined) => void;
  onTankRoleChange?: (tankRole: TankRole | undefined) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

export function PlayerCardHeader({
  job,
  name,
  role,
  position,
  tankRole,
  completedSlots,
  totalSlots,
  player,
  tierId,
  userRole,
  currentUserId,
  isAdmin,
  onJobChange,
  onNameChange,
  onPositionChange,
  onTankRoleChange,
  onMenuClick,
}: PlayerCardHeaderProps) {
  // Calculate average iLv for display
  const averageILv = calculateAverageItemLevel(player.gear, tierId);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(role as Role) ? role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);

  // Check edit permission
  const editPermission = canEditPlayer(userRole, player, currentUserId, isAdmin);

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
      e.stopPropagation(); // Prevent triggering drag listeners
      handleNameSave();
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // Prevent triggering drag listeners
      handleNameCancel();
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Clickable job icon with dropdown */}
        <div className="relative">
          <Tooltip
            content={editPermission.allowed ? 'Click to change job' : editPermission.reason}
          >
            <button
              type="button"
              onClick={handleJobIconClick}
              className={`p-0.5 rounded transition-all ${
                editPermission.allowed
                  ? 'cursor-pointer hover:ring-2 hover:ring-accent/50'
                  : 'cursor-not-allowed opacity-75'
              }`}
              style={{ backgroundColor: roleColor }}
              disabled={!editPermission.allowed}
            >
              <JobIcon job={job} size="lg" className="rounded-sm" />
            </button>
          </Tooltip>

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
                <Tooltip
                  content={editPermission.allowed ? 'Double-click to edit name' : editPermission.reason}
                >
                  <span
                    className={`font-medium text-text-primary ${editPermission.allowed ? 'cursor-pointer hover:text-accent' : 'cursor-not-allowed'}`}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={handleNameDoubleClick}
                  >
                    {name}
                  </span>
                </Tooltip>
                {/* Edit button - always visible but subtle */}
                <Tooltip content={editPermission.allowed ? 'Edit name' : editPermission.reason}>
                  <button
                    onClick={handleEditClick}
                    className={`p-0.5 rounded opacity-40 transition-opacity ${
                      editPermission.allowed
                        ? 'hover:bg-surface-interactive hover:opacity-100'
                        : 'cursor-not-allowed opacity-30'
                    }`}
                    disabled={!editPermission.allowed}
                    aria-label="Edit player name"
                  >
                    <svg className="w-3.5 h-3.5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            )}
            {/* Tank role selector (MT/OT) - before position */}
            {role === 'tank' && onTankRoleChange && (
              <TankRoleSelector
                tankRole={tankRole}
                onSelect={onTankRoleChange}
                player={player}
                userRole={userRole}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
              />
            )}
            {/* Position badge */}
            <PositionSelector
              position={position}
              role={role}
              onSelect={onPositionChange}
              player={player}
              userRole={userRole}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>

      {/* Progress ring, iLv, + menu button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <ProgressRing
            value={completedSlots}
            max={totalSlots}
            size="md"
            showLabel
          />
          {/* Average iLv with slot breakdown tooltip */}
          {averageILv > 0 && (
            <LongPressTooltip
              delayDuration={200}
              content={
                <div className="min-w-[140px]">
                  <div className="font-medium mb-1.5">Average Item Level</div>
                  <div className="space-y-0.5 text-xs">
                    {GEAR_SLOTS.map((slotKey) => {
                      const gearSlot = player.gear.find(g => g.slot === slotKey);
                      if (!gearSlot) return null;
                      const slotILv = getSlotItemLevel(gearSlot, tierId);
                      return (
                        <div key={slotKey} className="flex justify-between gap-3">
                          <span className="text-text-secondary">{GEAR_SLOT_NAMES[slotKey]}</span>
                          <span className={gearSlot.hasItem ? 'text-status-success' : 'text-text-muted'}>
                            {slotILv}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border-subtle mt-1.5 pt-1.5 flex justify-between font-medium">
                    <span>Average</span>
                    <span className="text-accent">i{averageILv}</span>
                  </div>
                </div>
              }
            >
              <div className="text-sm text-text-muted cursor-help">
                i{averageILv}
              </div>
            </LongPressTooltip>
          )}
        </div>
        {onMenuClick && (
          <Tooltip
            content={
              <div className="space-y-1.5">
                <div className="font-medium">Player Options</div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Shift+Click</kbd>
                    <span className="text-text-secondary">Copy link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Right-click</kbd>
                    <span className="text-text-secondary">More options</span>
                  </div>
                </div>
              </div>
            }
          >
            <IconButton
              aria-label="Player options menu"
              icon={<MoreVertical className="w-5 h-5" />}
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
              className="opacity-60 hover:opacity-100"
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}
