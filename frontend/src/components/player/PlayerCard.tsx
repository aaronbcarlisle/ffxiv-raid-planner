/**
 * PlayerCard - Main player card component
 *
 * Orchestrates sub-components for a player's gear tracking display.
 * Supports drag-and-drop, context menu, and inline editing.
 */

import { useState, useEffect, memo, useMemo } from 'react';
import { PlayerCardHeader } from './PlayerCardHeader';
import { PlayerCardStatus } from './PlayerCardStatus';
import { PlayerCardGear } from './PlayerCardGear';
import { NeedsFooter } from './NeedsFooter';
import { BiSImportModal } from './BiSImportModal';
import { WeaponPriorityModal } from '../weapon-priority/WeaponPriorityModal';
import { ContextMenu, Modal, RadioGroup, type ContextMenuItem } from '../ui';
import { Button } from '../primitives';
import type { DragListeners, DragAttributes } from './DroppablePlayerCard';
import { getRoleColor, getRoleForJob, type Role } from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus, StaticSettings, ViewMode, RaidPosition, TankRole, ContentType, ResetMode } from '../../types';
import { calculatePlayerNeeds } from '../../utils/priority';
import {
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  UserMinus,
  UserPlus,
  Swords,
  RotateCcw,
  UserCheck,
  UserX,
  FileDown,
  MoreVertical,
  Link2Off,
  Link2,
} from 'lucide-react';
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
  isAdmin?: boolean;
  groupId: string;
  tierId: string;
  isHighlighted?: boolean;
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
  onCopyUrl?: () => void;
}

export const PlayerCard = memo(function PlayerCard({
  player,
  settings: _settings,
  viewMode,
  contentType,
  clipboardPlayer,
  currentUserId,
  isGroupOwner,
  userRole,
  userHasClaimedPlayer,
  isAdmin,
  groupId,
  tierId,
  isHighlighted,
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
  onCopyUrl,
}: PlayerCardProps) {
  const isExpanded = viewMode === 'expanded';
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUnlinkBiSConfirm, setShowUnlinkBiSConfirm] = useState(false);
  const [showPasteConfirm, setShowPasteConfirm] = useState(false);
  const [resetMode, setResetMode] = useState<ResetMode>('progress'); // Default to progress reset
  const [showBiSImport, setShowBiSImport] = useState(false);
  const [showWeaponPriorityModal, setShowWeaponPriorityModal] = useState(false);
  const [showJobChangeConfirm, setShowJobChangeConfirm] = useState(false);
  const [pendingJobChange, setPendingJobChange] = useState<string | null>(null);
  const [localHighlight, setLocalHighlight] = useState(false);
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
    const isModalOpen = showRemoveConfirm || showResetConfirm || showUnlinkBiSConfirm || showPasteConfirm || showBiSImport || showWeaponPriorityModal || showJobChangeConfirm;
    if (isModalOpen) {
      onModalOpen?.();
    }
    return () => {
      if (isModalOpen) {
        onModalClose?.();
      }
    };
  }, [showRemoveConfirm, showResetConfirm, showUnlinkBiSConfirm, showPasteConfirm, showBiSImport, showWeaponPriorityModal, showJobChangeConfirm, onModalOpen, onModalClose]);

  // Handlers
  const handleGearChange = async (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) => {
      if (g.slot !== slot) return g;

      const merged = { ...g, ...updates };

      // Recalculate currentSource when hasItem or isAugmented changes
      // to keep iLv calculation accurate
      if ('hasItem' in updates || 'isAugmented' in updates) {
        if (merged.hasItem) {
          // Has the BiS item - set source based on what they acquired
          if (merged.bisSource === 'raid') {
            merged.currentSource = 'savage';
          } else {
            merged.currentSource = merged.isAugmented ? 'tome_up' : 'tome';
          }
        } else {
          // Doesn't have item - revert to crafted
          merged.currentSource = 'crafted';
        }
      }

      return merged;
    });

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

  // When job is selected from picker, store it and show confirmation
  const handleJobChange = (newJob: string) => {
    // Don't prompt if selecting the same job
    if (newJob === player.job) return;
    setPendingJobChange(newJob);
    setShowJobChangeConfirm(true);
  };

  // Actually apply the job change after confirmation
  const confirmJobChange = async (updateBiS: boolean) => {
    if (!pendingJobChange) return;
    const newRole = getRoleForJob(pendingJobChange);
    if (newRole) {
      try {
        await onUpdate({ job: pendingJobChange, role: newRole });
        setShowJobChangeConfirm(false);
        setPendingJobChange(null);
        // Trigger highlight and scroll
        triggerHighlight();
        // Open BiS import if requested
        if (updateBiS) {
          setShowBiSImport(true);
        }
      } catch (error) {
        // Error already handled by api.ts (toast shown)
      }
    }
  };

  // Cancel job change - close modal and clear pending
  const cancelJobChange = () => {
    setShowJobChangeConfirm(false);
    setPendingJobChange(null);
  };

  // Trigger highlight animation and scroll to card
  const triggerHighlight = () => {
    setLocalHighlight(true);
    // Scroll the card into view
    const cardElement = document.getElementById(`player-card-${player.id}`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Clear highlight after animation
    setTimeout(() => setLocalHighlight(false), 2000);
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
  const editPermission = canEditPlayer(userRole, player, currentUserId, isAdmin);
  const rosterPermission = canManageRoster(userRole, isAdmin);
  const resetPermission = canResetGear(userRole, player, currentUserId, isAdmin);

  // Memoized context menu items to prevent recreation on every render
  const contextMenuItems = useMemo<ContextMenuItem[]>(() => [
    {
      label: player.bisLink ? 'Update BiS' : 'Import BiS',
      icon: <FileDown className="w-4 h-4" />,
      onClick: () => setShowBiSImport(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    },
    ...(player.bisLink ? [{
      label: 'Unlink BiS',
      icon: <Link2Off className="w-4 h-4" />,
      onClick: () => setShowUnlinkBiSConfirm(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    }] : []),
    { separator: true },
    {
      label: 'Weapon Priorities',
      icon: <Swords className="w-4 h-4" />,
      onClick: () => setShowWeaponPriorityModal(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    },
    { separator: true },
    {
      label: 'Copy Player',
      icon: <Copy className="w-4 h-4" />,
      onClick: onCopy,
      // Copy is always allowed (read-only operation)
    },
    ...(onCopyUrl ? [{
      label: 'Copy URL',
      icon: <Link2 className="w-4 h-4" />,
      onClick: onCopyUrl,
      // Copy URL is always allowed (read-only operation)
    }] : []),
    {
      label: 'Paste Player',
      icon: <ClipboardPaste className="w-4 h-4" />,
      onClick: () => setShowPasteConfirm(true),
      disabled: !clipboardPlayer || !editPermission.allowed,
      tooltip: !clipboardPlayer ? 'No player copied' : !editPermission.allowed ? editPermission.reason : undefined,
    },
    {
      label: 'Duplicate Player',
      icon: <CopyPlus className="w-4 h-4" />,
      onClick: () => onDuplicate(),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    {
      label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
      icon: player.isSubstitute ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />,
      onClick: () => onUpdate({ isSubstitute: !player.isSubstitute }),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    { separator: true },
    ...(canClaim ? [{
      label: 'Take Ownership',
      icon: <UserCheck className="w-4 h-4" />,
      onClick: onClaimPlayer,
    }] : []),
    ...(canRelease ? [{
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: <UserX className="w-4 h-4" />,
      onClick: onReleasePlayer,
    }] : []),
    { separator: true },
    {
      label: 'Reset Gear',
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: () => setShowResetConfirm(true),
      disabled: !onResetGear || !resetPermission.allowed,
      tooltip: !onResetGear ? 'Feature not available' : resetPermission.allowed ? undefined : resetPermission.reason,
    },
    {
      label: 'Remove Player',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => setShowRemoveConfirm(true),
      danger: true,
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
  ], [
    player.bisLink,
    player.isSubstitute,
    editPermission.allowed,
    editPermission.reason,
    rosterPermission.allowed,
    rosterPermission.reason,
    resetPermission.allowed,
    resetPermission.reason,
    clipboardPlayer,
    canClaim,
    canRelease,
    isLinkedToMe,
    onResetGear,
    onCopy,
    onCopyUrl,
    onDuplicate,
    onUpdate,
    onClaimPlayer,
    onReleasePlayer,
  ]);

  return (
    <div
      id={`player-card-${player.id}`}
      className={`bg-surface-card border border-border-subtle rounded-lg overflow-visible flex flex-col h-full border-l-[3px] shadow-md shadow-black/20 ${isHighlighted || localHighlight ? 'highlight-pulse' : ''}`}
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowRemoveConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              onRemove();
              setShowRemoveConfirm(false);
            }}
          >
            Remove
          </Button>
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

          <RadioGroup
            name="resetMode"
            value={resetMode}
            onChange={(value) => setResetMode(value as ResetMode)}
            options={[
              {
                value: 'progress',
                label: 'Reset progress only (keep BiS configuration)',
                description: '• Unchecks all Have/Aug checkboxes\n• Resets tome weapon tracking\n• Keeps BiS link and sources',
              },
              {
                value: 'unlink',
                label: 'Unlink BiS (keep progress)',
                description: '• Removes BiS reference\n• Clears item metadata (names, icons)\n• Keeps current sources and progress',
              },
              {
                value: 'all',
                label: 'Reset everything (complete wipe)',
                description: '• Unchecks all Have/Aug checkboxes\n• Resets BiS sources to defaults\n• Removes BiS link and metadata\n• Resets tome weapon tracking',
              },
            ]}
          />

          <p className="text-status-warning text-sm mt-4">This action cannot be undone.</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowResetConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              onResetGear?.(resetMode);
              setShowResetConfirm(false);
            }}
          >
            Reset Gear
          </Button>
        </div>
      </Modal>

      {/* Unlink BiS Confirmation Modal */}
      <Modal
        isOpen={showUnlinkBiSConfirm}
        onClose={() => setShowUnlinkBiSConfirm(false)}
        title="Unlink BiS"
        size="sm"
      >
        <p className="text-text-secondary mb-4">
          Are you sure you want to unlink <span className="text-text-primary font-medium">{player.name}</span>'s BiS set?
        </p>
        <p className="text-text-muted text-sm mb-6">
          This will remove the BiS link and item metadata (names, icons). Current progress and sources will be kept.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowUnlinkBiSConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              onUpdate({ bisLink: '' });
              setShowUnlinkBiSConfirm(false);
            }}
          >
            Unlink BiS
          </Button>
        </div>
      </Modal>

      {/* Paste Player Confirmation Modal */}
      <Modal
        isOpen={showPasteConfirm}
        onClose={() => setShowPasteConfirm(false)}
        title="Paste Player"
        size="sm"
      >
        <p className="text-text-secondary mb-4">
          This will overwrite <span className="text-text-primary font-medium">{player.name}</span>'s gear configuration with data from <span className="text-text-primary font-medium">{clipboardPlayer?.name || 'copied player'}</span>.
        </p>
        <p className="text-text-muted text-sm mb-6">
          Job, BiS sources, progress, and weapon priorities will all be replaced.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPasteConfirm(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              onPaste();
              setShowPasteConfirm(false);
            }}
          >
            Paste
          </Button>
        </div>
      </Modal>

      {/* BiS Import Modal */}
      <BiSImportModal
        isOpen={showBiSImport}
        onClose={() => setShowBiSImport(false)}
        player={player}
        contentType={contentType}
        onImport={(updates) => {
          onUpdate(updates);
          triggerHighlight();
        }}
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

      {/* Job Change Confirmation Modal */}
      <Modal
        isOpen={showJobChangeConfirm}
        onClose={cancelJobChange}
        title={`Change ${player.name}'s Job?`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            Change job from <span className="text-text-primary font-medium">{player.job}</span> to{' '}
            <span className="text-text-primary font-medium">{pendingJobChange}</span>?
          </p>
          <p className="text-text-muted text-sm">
            Would you like to update BiS for the new job?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => confirmJobChange(true)}
              className="w-full"
            >
              Change Job & Update BiS
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => confirmJobChange(false)}
              className="w-full"
            >
              Change Job Only
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={cancelJobChange}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

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
          tierId={tierId}
          userRole={userRole}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
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
            isAdmin={isAdmin}
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
        isAdmin={isAdmin}
        onGearChange={handleGearChange}
        onTomeWeaponChange={handleTomeWeaponChange}
      />

      {/* Expanded mode: spacer after gear (fills remaining space, footer hidden) */}
      {isExpanded && <div className="flex-1" />}

      {/* Needs Footer - only visible in compact mode */}
      {!isExpanded && <NeedsFooter needs={needs} />}
    </div>
  );
});
