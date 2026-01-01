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
import { ContextMenu, Modal, type ContextMenuItem } from '../ui';
import type { DragListeners, DragAttributes } from './DroppablePlayerCard';
import { getRoleColor, getRoleForJob, type Role } from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus, StaticSettings, ViewMode, RaidPosition, TankRole, ContentType } from '../../types';
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
  dragListeners?: DragListeners;
  dragAttributes?: DragAttributes;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: () => void;
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
  const [showBiSImport, setShowBiSImport] = useState(false);
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
    const isModalOpen = showRemoveConfirm || showResetConfirm || showBiSImport;
    if (isModalOpen) {
      onModalOpen?.();
    }
    return () => {
      if (isModalOpen) {
        onModalClose?.();
      }
    };
  }, [showRemoveConfirm, showResetConfirm, showBiSImport, onModalOpen, onModalClose]);

  // Handlers
  const handleGearChange = async (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) =>
      g.slot === slot ? { ...g, ...updates } : g
    );
    try {
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
  const canClaim = !player.userId && currentUserId && onClaimPlayer;
  const canRelease = (isLinkedToMe || isGroupOwner) && player.userId && onReleasePlayer;

  // Permission checks
  const editPermission = canEditPlayer(userRole, player, currentUserId);
  const rosterPermission = canManageRoster(userRole);
  const resetPermission = canResetGear(userRole, player, currentUserId);

  // Context menu items
  const contextMenuItems: ContextMenuItem[] = [
    {
      label: player.bisLink ? 'Update BiS' : 'Import BiS',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
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
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: onClaimPlayer,
    }] : []),
    ...(canRelease ? [{
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
        </svg>
      ),
      onClick: onReleasePlayer,
    }] : []),
    { separator: true },
    {
      label: 'Reset Gear',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
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

      {/* Reset Gear Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Gear Progress"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to reset all gear progress for <span className="text-text-primary font-medium">{player.name}</span>?
          This will uncheck all gear slots and cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowResetConfirm(false)}
            className="px-4 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onResetGear?.();
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
