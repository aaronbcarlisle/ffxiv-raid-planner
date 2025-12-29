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

interface PlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  currentUserId?: string;
  isGroupOwner?: boolean;
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
    const isModalOpen = showRemoveConfirm || showBiSImport;
    if (isModalOpen) {
      onModalOpen?.();
    }
    return () => {
      if (isModalOpen) {
        onModalClose?.();
      }
    };
  }, [showRemoveConfirm, showBiSImport, onModalOpen, onModalClose]);

  // Handlers
  const handleGearChange = (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) =>
      g.slot === slot ? { ...g, ...updates } : g
    );
    onUpdate({ gear: newGear });
  };

  const handleTomeWeaponChange = (updates: Partial<typeof player.tomeWeapon>) => {
    onUpdate({ tomeWeapon: { ...player.tomeWeapon, ...updates } });
  };

  const handleJobChange = (newJob: string) => {
    const newRole = getRoleForJob(newJob);
    if (newRole) {
      onUpdate({ job: newJob, role: newRole });
    }
  };

  const handleNameChange = (name: string) => {
    onUpdate({ name });
  };

  const handlePositionChange = (position: RaidPosition | undefined) => {
    onUpdate({ position: position ?? null });
  };

  const handleTankRoleChange = (tankRole: TankRole | undefined) => {
    onUpdate({ tankRole: tankRole ?? null });
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
    }] : []),
    { separator: true },
    {
      label: 'Copy Player',
      icon: CONTEXT_MENU_ICONS.copy,
      onClick: onCopy,
    },
    {
      label: 'Paste Player',
      icon: CONTEXT_MENU_ICONS.paste,
      onClick: onPaste,
      disabled: !clipboardPlayer,
    },
    {
      label: 'Duplicate Player',
      icon: CONTEXT_MENU_ICONS.duplicate,
      onClick: () => onDuplicate(),
    },
    {
      label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
      icon: CONTEXT_MENU_ICONS.substitute,
      onClick: () => onUpdate({ isSubstitute: !player.isSubstitute }),
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
      onClick: onResetGear,
      disabled: !onResetGear,
    },
    {
      label: 'Remove Player',
      icon: CONTEXT_MENU_ICONS.remove,
      onClick: () => setShowRemoveConfirm(true),
      danger: true,
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
        className={`p-3 transition-colors relative z-20 ${dragListeners ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
            onTankRoleChange={handleTankRoleChange}
          />
        </div>
      </div>

      {/* Spacer to push gear and footer to bottom (aligns cards with/without badges) */}
      <div className="flex-1" />

      {/* Gear section - compact icons or expanded table */}
      <PlayerCardGear
        gear={player.gear}
        tomeWeapon={player.tomeWeapon}
        isExpanded={isExpanded}
        onGearChange={handleGearChange}
        onTomeWeaponChange={handleTomeWeaponChange}
      />

      {/* Needs Footer - always visible at bottom */}
      <NeedsFooter needs={needs} />
    </div>
  );
}
