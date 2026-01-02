/**
 * PlayerCard - Main player card component
 *
 * Orchestrates sub-components for a player's gear tracking display.
 * Supports drag-and-drop, context menu, and inline editing.
 */

import { useState, useEffect } from 'react';
import { PlayerCardHeader } from './PlayerCardHeader';
import { PlayerCardStatus } from './PlayerCardStatus';
import { PlayerCardGear } from './PlayerCardGear';
import { NeedsFooter } from './NeedsFooter';
import { BiSImportModal } from './BiSImportModal';
import { WeaponPriorityModal } from '../weapon-priority/WeaponPriorityModal';
import { ContextMenu, Modal, type ContextMenuItem } from '../ui';
import type { DragListeners, DragAttributes } from './DroppablePlayerCard';
import { getRoleColor, getRoleForJob, type Role } from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus, StaticSettings, ViewMode, RaidPosition, TankRole, ContentType, ResetMode } from '../../types';
import { CONTEXT_MENU_ICONS } from '../../types';
import { calculatePlayerNeeds } from '../../utils/priority';
import { canEditPlayer, canManageRoster, canResetGear, type MemberRole } from '../../utils/permissions';

interface PlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  currentUserId?: string;
  isGroupOwner?: boolean;
  userRole?: MemberRole | null;
  userHasClaimedPlayer?: boolean;
  groupId: string;
  tierId: string;
  dragListeners?: DragListeners;
  dragAttributes?: DragAttributes;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: (mode: ResetMode) => void;
  onClaimPlayer?: () => void;
  onReleasePlayer?: () => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export function PlayerCard({
  player,
  settings: _settings,
  viewMode,
  contentType,
  clipboardPlayer,
  currentUserId,
  isGroupOwner,
  userRole,
  userHasClaimedPlayer,
  groupId,
  tierId,
  dragListeners,
  dragAttributes,
  onUpdate,
  onRemove,
  onCopy,
  onPaste,
  onDuplicate,
  onResetGear,
  onClaimPlayer,
  onReleasePlayer,
  onModalOpen,
  onModalClose,
}: PlayerCardProps) {
  const isExpanded = viewMode === 'expanded';
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMode, setResetMode] = useState<ResetMode>('progress'); // Default to progress reset
  const [showBiSImport, setShowBiSImport] = useState(false);
  const [showWeaponPriorityModal, setShowWeaponPriorityModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Get role color for left border
  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(player.role as Role) ? player.role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);

  // Calculate completion count
  const completedSlots = player.gear.filter((g) => {
    if (g.bisSource === 'raid') return g.hasItem;
    return g.hasItem && g.isAugmented;
  }).length;
  const totalSlots = player.gear.length;

  // Calculate needs for footer
  const needs = calculatePlayerNeeds(player);

  // Notify parent when modals open/close (for DnD disable)
  useEffect(() => {
    const isModalOpen = showRemoveConfirm || showResetConfirm || showBiSImport || showWeaponPriorityModal;
    if (isModalOpen) {
      onModalOpen?.();
    }
    return () => {
      if (isModalOpen) {
        onModalClose?.();
      }
    };
  }, [showRemoveConfirm, showResetConfirm, showBiSImport, showWeaponPriorityModal, onModalOpen, onModalClose]);

  // Handlers
  const handleGearChange = async (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) =>
      g.slot === slot ? { ...g, ...updates } : g
    );

    // Check if this is the raid weapon and hasItem changed
    const isWeaponSlot = slot === 'weapon';
    const updatingRaidWeapon = isWeaponSlot && player.gear.find(g => g.slot === 'weapon' && g.bisSource === 'raid');
    const hasItemChanged = 'hasItem' in updates && updatingRaidWeapon;

    try {
      // Sync raid weapon with main job's weapon priority
      if (hasItemChanged && player.job) {
        const mainJobPriority = player.weaponPriorities.find((wp) => wp.job === player.job);

        // Only update if the received status is different
        if (mainJobPriority && mainJobPriority.received !== updates.hasItem) {
          const updatedPriorities = player.weaponPriorities.map((wp) => {
            if (wp.job === player.job) {
              return {
                ...wp,
                received: Boolean(updates.hasItem),
                receivedDate: updates.hasItem ? new Date().toISOString() : undefined,
              };
            }
            return wp;
          });

          // Batch both updates in single API call
          await onUpdate({ gear: newGear, weaponPriorities: updatedPriorities });
          return;
        }
      }

      // Just update gear if no weapon priority sync needed
      await onUpdate({ gear: newGear });
    } catch (error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleTomeWeaponChange = async (updates: Partial<typeof player.tomeWeapon>) => {
    try {
      await onUpdate({ tomeWeapon: { ...player.tomeWeapon, ...updates } });
    } catch (error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleJobChange = async (newJob: string) => {
    const newRole = getRoleForJob(newJob);
    if (newRole) {
      try {
        await onUpdate({ job: newJob, role: newRole });
      } catch (error) {
        // Error already handled by api.ts (toast shown)
        // Just prevent unhandled promise rejection
      }
    }
  };

  const handleNameChange = async (name: string) => {
    try {
      await onUpdate({ name });
    } catch (error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handlePositionChange = async (position: RaidPosition | undefined) => {
    try {
      await onUpdate({ position: position ?? null });
    } catch (error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleTankRoleChange = async (tankRole: TankRole | undefined) => {
    try {
      await onUpdate({ tankRole: tankRole ?? null });
    } catch (error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMenuButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.bottom });
  };

  // Ownership status
  const isLinkedToMe = player.userId === currentUserId;
  // Can claim if: card not claimed, user is logged in, handler exists, and user hasn't claimed another card
  const canClaim = !player.userId && currentUserId && onClaimPlayer && !userHasClaimedPlayer;
  const canRelease = (isLinkedToMe || isGroupOwner) && player.userId && onReleasePlayer;

  // Permission checks
  const editPermission = canEditPlayer(userRole, player, currentUserId);
  const rosterPermission = canManageRoster(userRole);
  const resetPermission = canResetGear(userRole, player, currentUserId);

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      label: player.bisLink ? 'Update BiS' : 'Import BiS',
      icon: CONTEXT_MENU_ICONS.importBis,
      onClick: () => setShowBiSImport(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    },
    ...(player.bisLink ? [{
      label: 'Unlink BiS',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
        </svg>
      ),
      onClick: () => onUpdate({ bisLink: '' }),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    }] : []),
    { separator: true },
    {
      label: 'Weapon Priorities',
      icon: CONTEXT_MENU_ICONS.weaponPriority,
      onClick: () => setShowWeaponPriorityModal(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    },
    { separator: true },
    {
      label: 'Copy Player',
      icon: CONTEXT_MENU_ICONS.copy,
      onClick: onCopy,
      // Copy is always allowed (read-only operation)
    },
    {
      label: 'Paste Player',
      icon: CONTEXT_MENU_ICONS.paste,
      onClick: onPaste,
      disabled: !clipboardPlayer || !editPermission.allowed,
      tooltip: !clipboardPlayer ? 'No player copied' : !editPermission.allowed ? editPermission.reason : undefined,
    },
    {
      label: 'Duplicate Player',
      icon: CONTEXT_MENU_ICONS.duplicate,
      onClick: () => onDuplicate(),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    {
      label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
      icon: CONTEXT_MENU_ICONS.substitute,
      onClick: () => onUpdate({ isSubstitute: !player.isSubstitute }),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    { separator: true },
    ...(canClaim ? [{
      label: 'Take Ownership',
      icon: CONTEXT_MENU_ICONS.takeOwnership,
      onClick: onClaimPlayer,
    }] : []),
    ...(canRelease ? [{
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: CONTEXT_MENU_ICONS.releaseOwnership,
      onClick: onReleasePlayer,
    }] : []),
    { separator: true },
    {
      label: 'Reset Gear',
      icon: CONTEXT_MENU_ICONS.resetGear,
      onClick: () => setShowResetConfirm(true),
      disabled: !onResetGear || !resetPermission.allowed,
      tooltip: !onResetGear ? 'Feature not available' : resetPermission.allowed ? undefined : resetPermission.reason,
    },
    {
      label: 'Remove Player',
      icon: CONTEXT_MENU_ICONS.remove,
      onClick: () => setShowRemoveConfirm(true),
      danger: true,
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
  ];

  return (
    <div
      className="bg-surface-card border border-border-subtle rounded-lg overflow-visible flex flex-col h-full border-l-[3px]"
      style={{ borderLeftColor: roleColor }}
      onContextMenu={handleContextMenu}
    >
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title="Remove Player"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to remove <span className="text-text-primary font-medium">{player.name}</span> from the static?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowRemoveConfirm(false)}
            className="px-4 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onRemove();
              setShowRemoveConfirm(false);
            }}
            className="px-4 py-2 rounded bg-status-error text-white hover:bg-status-error/80 transition-colors"
          >
            Remove
          </button>
        </div>
      </Modal>

      {/* Reset Gear Options Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Gear Progress"
      >
        <div className="mb-6">
          <p className="text-text-secondary mb-4">
            Choose what to reset for <span className="text-text-primary font-medium">{player.name}</span> ({player.job}):
          </p>

          {/* Radio option 1: Reset progress only */}
          <label className={`flex items-start gap-3 p-3 rounded cursor-pointer mb-3 transition-colors ${
            resetMode === 'progress' ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-hover border border-transparent'
          }`}>
            <input
              type="radio"
              name="resetMode"
              value="progress"
              checked={resetMode === 'progress'}
              onChange={(e) => setResetMode(e.target.value as ResetMode)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-text-primary font-medium mb-1">Reset progress only (keep BiS configuration)</div>
              <ul className="text-text-secondary text-sm space-y-0.5">
                <li>• Unchecks all Have/Aug checkboxes</li>
                <li>• Resets tome weapon tracking</li>
                <li>• Keeps BiS link and sources</li>
              </ul>
            </div>
          </label>

          {/* Radio option 2: Unlink BiS */}
          <label className={`flex items-start gap-3 p-3 rounded cursor-pointer mb-3 transition-colors ${
            resetMode === 'unlink' ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-hover border border-transparent'
          }`}>
            <input
              type="radio"
              name="resetMode"
              value="unlink"
              checked={resetMode === 'unlink'}
              onChange={(e) => setResetMode(e.target.value as ResetMode)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-text-primary font-medium mb-1">Unlink BiS (keep progress)</div>
              <ul className="text-text-secondary text-sm space-y-0.5">
                <li>• Removes BiS reference</li>
                <li>• Clears item metadata (names, icons)</li>
                <li>• Keeps current sources and progress</li>
              </ul>
            </div>
          </label>

          {/* Radio option 3: Reset everything */}
          <label className={`flex items-start gap-3 p-3 rounded cursor-pointer mb-3 transition-colors ${
            resetMode === 'all' ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-hover border border-transparent'
          }`}>
            <input
              type="radio"
              name="resetMode"
              value="all"
              checked={resetMode === 'all'}
              onChange={(e) => setResetMode(e.target.value as ResetMode)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-text-primary font-medium mb-1">Reset everything (complete wipe)</div>
              <ul className="text-text-secondary text-sm space-y-0.5">
                <li>• Unchecks all Have/Aug checkboxes</li>
                <li>• Resets BiS sources to defaults</li>
                <li>• Removes BiS link and metadata</li>
                <li>• Resets tome weapon tracking</li>
              </ul>
            </div>
          </label>

          <p className="text-status-warning text-sm mt-4">⚠️ This action cannot be undone.</p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowResetConfirm(false)}
            className="px-4 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onResetGear?.(resetMode);
              setShowResetConfirm(false);
            }}
            className="px-4 py-2 rounded bg-status-warning text-white hover:bg-status-warning/80 transition-colors"
          >
            Reset Gear
          </button>
        </div>
      </Modal>

      {/* BiS Import Modal */}
      <BiSImportModal
        isOpen={showBiSImport}
        onClose={() => setShowBiSImport(false)}
        player={player}
        contentType={contentType}
        onImport={(updates) => onUpdate(updates)}
      />

      {/* Weapon Priority Modal */}
      <WeaponPriorityModal
        player={player}
        groupId={groupId}
        tierId={tierId}
        userRole={userRole || 'viewer'}
        isOpen={showWeaponPriorityModal}
        onClose={() => setShowWeaponPriorityModal(false)}
      />

      {/* Header - drag handle area */}
      <div
        className={`p-3 transition-colors ${dragListeners ? 'cursor-grab active:cursor-grabbing' : ''}`}
        {...dragAttributes}
        {...dragListeners}
      >
        <PlayerCardHeader
          job={player.job}
          name={player.name}
          role={player.role}
          position={player.position}
          completedSlots={completedSlots}
          totalSlots={totalSlots}
          player={player}
          userRole={userRole}
          currentUserId={currentUserId}
          onJobChange={handleJobChange}
          onNameChange={handleNameChange}
          onPositionChange={handlePositionChange}
          onMenuClick={handleMenuButtonClick}
        />

        {/* Status badges row */}
        <div className="mt-1">
          <PlayerCardStatus
            role={player.role}
            isSubstitute={player.isSubstitute}
            bisLink={player.bisLink}
            tankRole={player.tankRole}
            userId={player.userId}
            linkedUser={player.linkedUser}
            currentUserId={currentUserId}
            player={player}
            userRole={userRole}
            onTankRoleChange={handleTankRoleChange}
          />
        </div>
      </div>

      {/* Compact mode: spacer before gear (aligns icons at bottom across cards with/without badges) */}
      {!isExpanded && <div className="flex-1" />}

      {/* Gear section - compact icons or expanded table */}
      <PlayerCardGear
        gear={player.gear}
        tomeWeapon={player.tomeWeapon}
        isExpanded={isExpanded}
        player={player}
        userRole={userRole}
        currentUserId={currentUserId}
        onGearChange={handleGearChange}
        onTomeWeaponChange={handleTomeWeaponChange}
      />

      {/* Expanded mode: spacer after gear (fills remaining space, footer hidden) */}
      {isExpanded && <div className="flex-1" />}

      {/* Needs Footer - only visible in compact mode */}
      {!isExpanded && <NeedsFooter needs={needs} />}
    </div>
  );
}
