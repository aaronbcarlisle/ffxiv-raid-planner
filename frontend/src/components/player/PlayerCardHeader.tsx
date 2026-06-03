/* eslint-disable design-system/no-raw-button */
/**
 * PlayerCard Header - Job icon, name, position, completion
 *
 * Contains the primary identification info for a player card.
 * Extracted from PlayerCard for maintainability.
 */

import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, MoreVertical } from 'lucide-react';
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

function formatLastSync(lastSync?: string, syncSource?: string, syncedJob?: string): string {
  if (!lastSync) return 'Lodestone identity linked';

  const timestamp = new Date(lastSync).getTime();
  if (Number.isNaN(timestamp)) return 'Lodestone identity linked';

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  let timeStr: string;
  if (diffMinutes < 1) timeStr = 'Synced just now';
  else if (diffMinutes < 60) timeStr = `Last synced ${diffMinutes}m ago`;
  else {
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) timeStr = `Last synced ${diffHours}h ago`;
    else timeStr = `Last synced ${Math.floor(diffHours / 24)}d ago`;
  }

  const parts = [timeStr];
  if (syncSource && syncSource !== 'xivapi') parts.push(`via ${syncSource}`);
  if (syncedJob) parts.push(`as ${syncedJob}`);
  return parts.join(' ');
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
  // BiS target average iLv (existing calculation based on hasItem / bisSource / currentSource)
  const averageILv = calculateAverageItemLevel(player.gear, tierId);

  // Current equipped average iLv from Tomestone sync data.
  // Only computed when at least half the player's gear slots have been synced.
  const equippedIlvSlots = player.gear.filter((g) => (g.equippedItemLevel ?? 0) > 0);
  const hasEnoughEquippedData = equippedIlvSlots.length >= Math.ceil(player.gear.length / 2);
  const equippedAvgIlv = hasEnoughEquippedData
    ? Math.round(
        equippedIlvSlots.reduce((sum, g) => sum + g.equippedItemLevel!, 0) /
          equippedIlvSlots.length
      )
    : 0;
  // Display equipped avg iLv when sync data covers enough slots; fall back to BiS target avg.
  const displayILv = equippedAvgIlv > 0 ? equippedAvgIlv : averageILv;
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  useEffect(() => {
    setAvatarFailed(false);
  }, [player.lodestoneAvatarUrl]);

  const hasLodestoneIdentity = Boolean(player.lodestoneId && (player.lodestoneName || player.lodestoneServer));
  const showLodestoneAvatar = Boolean(hasLodestoneIdentity && player.lodestoneAvatarUrl && !avatarFailed);
  const flexRoles = player.flexRoles ?? [];
  const hasRosterPersonalization = Boolean(player.rosterTitle || player.rosterNote || flexRoles.length > 0);

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
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Clickable identity mark with dropdown */}
        <div className="relative shrink-0">
          <Tooltip
            content={
              hasLodestoneIdentity
                ? `Linked to ${player.lodestoneName || 'Lodestone character'}${player.lodestoneServer ? ` on ${player.lodestoneServer}` : ''}`
                : editPermission.allowed ? 'Click to change job' : editPermission.reason
            }
          >
            <button
              type="button"
              onClick={handleJobIconClick}
              title={
                hasLodestoneIdentity
                  ? `Linked to ${[player.lodestoneName, player.lodestoneServer].filter(Boolean).join(' • ')}`
                  : undefined
              }
              className={`relative rounded transition-all ${
                editPermission.allowed
                  ? 'cursor-pointer hover:ring-2 hover:ring-accent/50'
                  : 'cursor-not-allowed opacity-75'
              }`}
              style={{ backgroundColor: showLodestoneAvatar ? undefined : roleColor }}
              disabled={!editPermission.allowed}
              data-testid={showLodestoneAvatar ? 'lodestone-avatar-frame' : 'job-icon-button'}
            >
              {showLodestoneAvatar ? (
                <img
                  src={player.lodestoneAvatarUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-accent/60 object-cover opacity-95 shadow-lg shadow-accent/20 transition-opacity duration-200 hover:opacity-100"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  data-testid="lodestone-character-avatar"
                />
              ) : (
                <span data-testid={hasLodestoneIdentity ? 'lodestone-avatar-fallback-icon' : undefined}>
                  <JobIcon job={job} size="lg" className="rounded-sm" />
                </span>
              )}
              {hasLodestoneIdentity && (
                <span
                  className="absolute -bottom-1 -right-1 rounded-md border border-surface-card bg-surface-overlay p-0.5 shadow-md"
                  style={{ boxShadow: `0 0 0 1px ${roleColor}` }}
                  data-testid="lodestone-job-badge"
                >
                  <JobIcon job={job} size="xs" className="rounded-sm" />
                </span>
              )}
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
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
                    className={`font-medium text-text-primary text-sm sm:text-base break-words ${editPermission.allowed ? 'cursor-pointer hover:text-accent' : 'cursor-not-allowed'}`}
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
          {hasLodestoneIdentity && (
            <div className="mt-1 space-y-0.5">
              <p className="truncate text-xs text-text-secondary" data-testid="lodestone-character-subtitle">
                {[player.lodestoneName, player.lodestoneServer].filter(Boolean).join(' • ')}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-accent/80" data-testid="lodestone-sync-status">
                <CheckCircle2 className="h-3 w-3" />
                {formatLastSync(player.lastSync, player.lastSyncSource, player.lastSyncedJob)}
              </p>
              {player.lastSyncedJob && player.job && player.lastSyncedJob.toUpperCase() !== player.job.toUpperCase() && (
                <p className="text-[11px] text-status-warning" data-testid="lodestone-job-mismatch-warning">
                  Synced as {player.lastSyncedJob}, player set as {player.job}. Provider may be showing old gear.
                </p>
              )}
            </div>
          )}
          {hasRosterPersonalization && (
            <div className="mt-1 space-y-1" data-testid="player-roster-personalization">
              {player.rosterTitle && (
                <p className="truncate text-[11px] font-medium text-accent/90" data-testid="player-roster-title">
                  {player.rosterTitle}
                </p>
              )}
              {player.rosterNote && (
                <p className="line-clamp-2 text-[11px] leading-snug text-text-muted" data-testid="player-roster-note">
                  {player.rosterNote}
                </p>
              )}
              {flexRoles.length > 0 && (
                <div className="flex flex-wrap items-center gap-1" data-testid="player-flex-roles">
                  <span className="text-[10px] uppercase tracking-wide text-text-muted">Flex roles</span>
                  {flexRoles.map((flexRole) => (
                    <span
                      key={flexRole}
                      className="rounded-full border border-border-subtle bg-surface-elevated/80 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary"
                    >
                      {flexRole}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress ring, iLv, + menu button */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Progress ring */}
          <ProgressRing
            value={completedSlots}
            max={totalSlots}
            size="md"
            showLabel
          />
          {/* Average iLv with slot breakdown tooltip */}
          {displayILv > 0 && (
            <LongPressTooltip
              delayDuration={200}
              content={
                <div className={equippedAvgIlv > 0 ? 'min-w-[200px]' : 'min-w-[140px]'}>
                  <div className="font-medium mb-1.5">Average Item Level</div>
                  <div className="space-y-0.5 text-xs">
                    {equippedAvgIlv > 0 ? (
                      // Two-column layout: current equipped | BiS target
                      <>
                        <div className="flex justify-between gap-3 mb-1 text-[10px] text-text-muted">
                          <span className="w-16" />
                          <span className="w-8 text-right">Now</span>
                          <span className="w-8 text-right">BiS</span>
                        </div>
                        {GEAR_SLOTS.map((slotKey) => {
                          const gearSlot = player.gear.find((g) => g.slot === slotKey);
                          if (!gearSlot) return null;
                          const bisILv = getSlotItemLevel(gearSlot, tierId);
                          const nowILv = gearSlot.equippedItemLevel ?? 0;
                          const diff = nowILv > 0 ? nowILv - bisILv : 0;
                          return (
                            <div key={slotKey} className="flex justify-between gap-3">
                              <span className="text-text-secondary">{GEAR_SLOT_NAMES[slotKey]}</span>
                              <span className={nowILv > 0 ? (nowILv >= bisILv ? 'text-status-success' : 'text-status-warning') : 'text-text-muted'}>
                                {nowILv > 0 ? nowILv : '—'}
                              </span>
                              <span className={gearSlot.hasItem ? 'text-status-success' : 'text-text-muted'}>
                                {bisILv}
                                {diff < 0 && <span className="ml-0.5 text-status-warning">({diff})</span>}
                              </span>
                            </div>
                          );
                        })}
                        <div className="border-t border-border-subtle mt-1.5 pt-1.5 space-y-0.5">
                          <div className="flex justify-between font-medium">
                            <span className="text-text-muted">Equipped avg</span>
                            <span className="text-accent">i{equippedAvgIlv}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-text-muted">BiS target avg</span>
                            <span className="text-text-secondary">i{averageILv}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Single-column fallback when no sync data
                      <>
                        {GEAR_SLOTS.map((slotKey) => {
                          const gearSlot = player.gear.find((g) => g.slot === slotKey);
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
                        <div className="border-t border-border-subtle mt-1.5 pt-1.5 flex justify-between font-medium">
                          <span>Average</span>
                          <span className="text-accent">i{averageILv}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              }
            >
              <div className="text-sm cursor-help" title={equippedAvgIlv > 0 ? 'Current equipped avg iLv (hover for BiS target)' : undefined}>
                <span className={equippedAvgIlv > 0 ? 'text-accent' : 'text-text-muted'}>
                  i{displayILv}
                </span>
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
