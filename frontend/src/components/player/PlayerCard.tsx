/**
 * PlayerCard - Main player card component
 *
 * Orchestrates sub-components for a player's gear tracking display.
 * Supports drag-and-drop, context menu, and inline editing.
 */

import { useState, useEffect, memo, useMemo } from 'react';
import { PlayerCardHeader } from './PlayerCardHeader';
import { PlayerCardStatus } from './PlayerCardStatus';
import { PlayerSetupBanner } from './PlayerSetupBanner';
import { BiSSourceFixBanner } from './BiSSourceFixBanner';
import { PlayerCardGear } from './PlayerCardGear';
import { NeedsFooter } from './NeedsFooter';
import { BiSImportModal } from './BiSImportModal';
import { WeaponPriorityModal } from '../weapon-priority/WeaponPriorityModal';
import { AssignUserModal } from './AssignUserModal';
import { PriorityAdjustModal } from './PriorityAdjustModal';
import { ContextMenu, Modal, RadioGroup, type ContextMenuItem } from '../ui';
import { Button } from '../primitives';
import type { DragListeners, DragAttributes } from './DroppablePlayerCard';
import { getRoleColor, getRoleForJob, type Role } from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus, StaticSettings, ViewMode, RaidPosition, TankRole, ContentType, ResetMode, GearSlot, AssignPlayerRequest } from '../../types';
import { calculatePlayerNeeds } from '../../utils/priority';
import { isSlotComplete } from '../../utils/calculations';
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
  Link2Off,
  Link2,
  RefreshCw,
  BookOpen,
  Gauge,
} from 'lucide-react';
import { canEditPlayer, canManageRoster, canResetGear, type MemberRole } from '../../utils/permissions';

interface PlayerCardProps {
  player: SnapshotPlayer;
  /** All players in the tier (for assignment modal) */
  allPlayers?: SnapshotPlayer[];
  settings: StaticSettings;
  viewMode: ViewMode;
  contentType: ContentType;
  clipboardPlayer: SnapshotPlayer | null;
  currentUserId?: string;
  isGroupOwner?: boolean;
  userRole?: MemberRole | null;
  userHasClaimedPlayer?: boolean;
  isAdmin?: boolean;
  isAdminAccess?: boolean; // Admin mode active (from Admin Dashboard)
  viewAsUserId?: string; // User ID being impersonated in View As mode
  /** Hide "Unclaimed" banners (group setting) */
  hideSetupBanners?: boolean;
  /** Hide "No BiS configured" banners (group setting) */
  hideBisBanners?: boolean;
  groupId: string;
  tierId: string;
  isHighlighted?: boolean;
  highlightedSlot?: string | null;
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
  onAdminAssignPlayer?: (data: AssignPlayerRequest) => Promise<void>;
  onOwnerAssignPlayer?: (data: AssignPlayerRequest) => Promise<void>;
  onModalOpen?: () => void;
  onModalClose?: () => void;
  onCopyUrl?: () => void;
  /** Slots that have loot entries (for "Go to Loot Entry" feature) */
  slotsWithLootEntries?: Set<GearSlot>;
  /** Slots that have material entries (for "Go to Material Entry" feature) */
  slotsWithMaterialEntries?: Set<GearSlot | 'tome_weapon'>;
  /** Navigate to loot entry for a slot */
  onNavigateToLootEntry?: (slot: GearSlot) => void;
  /** Navigate to material entry for a slot */
  onNavigateToMaterialEntry?: (slot: string) => void;
  /** Navigate to Books panel and highlight this player's row */
  onNavigateToBooksPanel?: (playerId: string) => void;
}

export const PlayerCard = memo(function PlayerCard({
  player,
  allPlayers,
  settings: _settings,
  viewMode,
  contentType,
  clipboardPlayer,
  currentUserId,
  isGroupOwner,
  userRole,
  userHasClaimedPlayer,
  isAdmin,
  isAdminAccess,
  viewAsUserId,
  hideSetupBanners,
  hideBisBanners,
  groupId,
  tierId,
  isHighlighted,
  highlightedSlot,
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
  onAdminAssignPlayer,
  onOwnerAssignPlayer,
  onModalOpen,
  onModalClose,
  onCopyUrl,
  slotsWithLootEntries,
  slotsWithMaterialEntries,
  onNavigateToLootEntry,
  onNavigateToMaterialEntry,
  onNavigateToBooksPanel,
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
  const [showAdminAssignModal, setShowAdminAssignModal] = useState(false);
  const [showOwnerAssignModal, setShowOwnerAssignModal] = useState(false);
  const [showPriorityAdjustModal, setShowPriorityAdjustModal] = useState(false);
  const [localHighlight, setLocalHighlight] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Get role color for left border
  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(player.role as Role) ? player.role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);

  // Calculate completion count using shared isSlotComplete logic
  // This properly handles all BiS sources and augmentation requirements
  const completedSlots = player.gear.filter((g) => isSlotComplete(g)).length;
  const totalSlots = player.gear.length;

  // Calculate needs for footer
  const needs = calculatePlayerNeeds(player);

  // Notify parent when modals open/close (for DnD disable)
  useEffect(() => {
    const isModalOpen = showRemoveConfirm || showResetConfirm || showUnlinkBiSConfirm || showPasteConfirm || showBiSImport || showWeaponPriorityModal || showJobChangeConfirm || showAdminAssignModal || showOwnerAssignModal || showPriorityAdjustModal;
    if (isModalOpen) {
      onModalOpen?.();
    }
    return () => {
      if (isModalOpen) {
        onModalClose?.();
      }
    };
  }, [showRemoveConfirm, showResetConfirm, showUnlinkBiSConfirm, showPasteConfirm, showBiSImport, showWeaponPriorityModal, showJobChangeConfirm, showAdminAssignModal, showOwnerAssignModal, showPriorityAdjustModal, onModalOpen, onModalClose]);

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
    } catch (_error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleTomeWeaponChange = async (updates: Partial<typeof player.tomeWeapon>) => {
    try {
      await onUpdate({ tomeWeapon: { ...player.tomeWeapon, ...updates } });
    } catch (_error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  // Handler for fixing multiple BiS sources at once (from BiSSourceFixBanner)
  const handleFixAllBisSources = async (fixes: Array<{ slot: string; bisSource: GearSlotStatus['bisSource'] }>) => {
    // Apply all fixes to gear array (only update bisSource, preserve other fields)
    const newGear = player.gear.map((g) => {
      const fix = fixes.find((f) => f.slot === g.slot);
      if (fix) {
        return { ...g, bisSource: fix.bisSource };
      }
      return g;
    });

    try {
      await onUpdate({ gear: newGear });
    } catch (_error) {
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
      } catch (_error) {
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
    } catch (_error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handlePositionChange = async (position: RaidPosition | undefined) => {
    try {
      await onUpdate({ position: position ?? null });
    } catch (_error) {
      // Error already handled by api.ts (toast shown)
    }
  };

  const handleTankRoleChange = async (tankRole: TankRole | undefined) => {
    try {
      await onUpdate({ tankRole: tankRole ?? null });
    } catch (_error) {
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

  // Permission checks - use isAdminAccess (not isAdmin) to respect View As context
  const editPermission = canEditPlayer(userRole, player, currentUserId, isAdminAccess);
  const rosterPermission = canManageRoster(userRole, isAdminAccess);
  const resetPermission = canResetGear(userRole, player, currentUserId, isAdminAccess);

  // Check if player management section has any items
  const hasPlayerManagementItems = canClaim || canRelease ||
    (isGroupOwner && !isAdminAccess && onOwnerAssignPlayer) ||
    (isAdminAccess && onAdminAssignPlayer) ||
    rosterPermission.allowed; // Mark as Sub/Main

  // Memoized context menu items to prevent recreation on every render
  // Note: This useMemo has many dependencies intentionally - don't simplify
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Many dependencies intentional
  const contextMenuItems = useMemo<ContextMenuItem[]>(() => [
    // === BiS & Gear Section ===
    { sectionHeader: 'BiS & Gear' },
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
    {
      label: 'Weapon Priorities',
      icon: <Swords className="w-4 h-4" />,
      onClick: () => setShowWeaponPriorityModal(true),
      disabled: !editPermission.allowed,
      tooltip: editPermission.allowed ? undefined : editPermission.reason,
    },
    {
      label: 'Reset Gear',
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: () => setShowResetConfirm(true),
      disabled: !onResetGear || !resetPermission.allowed,
      tooltip: !onResetGear ? 'Feature not available' : resetPermission.allowed ? undefined : resetPermission.reason,
    },

    // === Loot Priority Section ===
    { sectionHeader: 'Loot Priority' },
    {
      label: 'Adjust Priority',
      icon: <Gauge className="w-4 h-4" />,
      onClick: () => setShowPriorityAdjustModal(true),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    // Edit Books - visible to owners/leads/admins on any card, members on their own card
    ...(onNavigateToBooksPanel && (
      userRole === 'owner' ||
      userRole === 'lead' ||
      isAdminAccess ||
      (userRole === 'member' && player.userId === currentUserId)
    ) ? [{
      label: 'Edit Books',
      icon: <BookOpen className="w-4 h-4" />,
      onClick: () => onNavigateToBooksPanel(player.id),
    }] : []),

    // === Clipboard Section ===
    { sectionHeader: 'Clipboard' },
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

    // === Player Management Section ===
    ...(hasPlayerManagementItems ? [{ sectionHeader: 'Player Management' }] : []),
    ...(canClaim ? [{
      label: 'Take Ownership',
      icon: <UserCheck className="w-4 h-4" />,
      onClick: onClaimPlayer,
      accent: true,
    }] : []),
    ...(canRelease ? [{
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: <UserX className="w-4 h-4" />,
      onClick: onReleasePlayer,
    }] : []),
    {
      label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
      icon: player.isSubstitute ? <UserPlus className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />,
      onClick: () => onUpdate({ isSubstitute: !player.isSubstitute }),
      disabled: !rosterPermission.allowed,
      tooltip: rosterPermission.allowed ? undefined : rosterPermission.reason,
    },
    ...(isGroupOwner && !isAdminAccess && onOwnerAssignPlayer ? [{
      label: 'Assign User (Owner)',
      icon: <Link2 className="w-4 h-4" />,
      onClick: () => {
        setShowOwnerAssignModal(true);
        setContextMenu(null);
      },
    }] : []),
    ...(isAdminAccess && onAdminAssignPlayer ? [{
      label: 'Assign User (Admin)',
      icon: <Link2 className="w-4 h-4 text-status-warning" />,
      onClick: () => {
        setShowAdminAssignModal(true);
        setContextMenu(null);
      },
    }] : []),

    // === Danger Zone ===
    { separator: true },
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
    player.userId,
    player.id,
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
    isGroupOwner,
    isAdminAccess,
    onOwnerAssignPlayer,
    onAdminAssignPlayer,
    userRole,
    currentUserId,
    onNavigateToBooksPanel,
  ]);

  // Prevent focus flash when Shift+Click starts
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey && onCopyUrl) {
      // Prevent the mousedown from causing focus
      e.preventDefault();
    }
  };

  // Handle Shift+Click to copy URL
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onCopyUrl) {
      e.preventDefault();
      e.stopPropagation();
      // Clear any text selection caused by Shift+Click
      window.getSelection()?.removeAllRanges();
      onCopyUrl();
      // Remove focus to prevent focus-visible ring after Shift+Click
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  };

  return (
      <div
        id={`player-card-${player.id}`}
        className={`bg-surface-card border border-border-subtle rounded-lg overflow-visible flex flex-col h-full border-l-[3px] shadow-md shadow-black/20 select-none ${isHighlighted || localHighlight ? 'highlight-pulse' : ''}`}
        style={{ borderLeftColor: roleColor }}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
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
        title={
          <span className="flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-status-error" />
            Remove Player
          </span>
        }
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
        title={
          <span className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-status-warning" />
            Reset Gear Progress
          </span>
        }
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
        title={
          <span className="flex items-center gap-2">
            <Link2Off className="w-5 h-5 text-status-warning" />
            Unlink BiS
          </span>
        }
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
        title={
          <span className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5" />
            Paste Player
          </span>
        }
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

      {/* Priority Adjust Modal */}
      <PriorityAdjustModal
        isOpen={showPriorityAdjustModal}
        onClose={() => setShowPriorityAdjustModal(false)}
        player={player}
        onSave={async (_playerId, adjustment) => {
          await onUpdate({ priorityModifier: adjustment });
        }}
      />

      {/* Job Change Confirmation Modal */}
      <Modal
        isOpen={showJobChangeConfirm}
        onClose={cancelJobChange}
        title={
          <span className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Change {player.name}'s Job?
          </span>
        }
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

      {/* Admin Assign User Modal */}
      {showAdminAssignModal && (
        <AssignUserModal
          player={player}
          groupId={groupId}
          isAdmin={isAdmin || false}
          allPlayers={allPlayers}
          onClose={() => setShowAdminAssignModal(false)}
          onAssign={async (data) => {
            if (onAdminAssignPlayer) {
              await onAdminAssignPlayer(data);
              setShowAdminAssignModal(false);
            }
          }}
        />
      )}

      {/* Owner Assign User Modal */}
      {showOwnerAssignModal && (
        <AssignUserModal
          player={player}
          groupId={groupId}
          isAdmin={false}
          allPlayers={allPlayers}
          onClose={() => setShowOwnerAssignModal(false)}
          onAssign={async (data) => {
            if (onOwnerAssignPlayer) {
              await onOwnerAssignPlayer(data);
              setShowOwnerAssignModal(false);
            }
          }}
        />
      )}

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
          tankRole={player.tankRole}
          completedSlots={completedSlots}
          totalSlots={totalSlots}
          player={player}
          tierId={tierId}
          userRole={userRole}
          currentUserId={currentUserId}
          isAdmin={isAdminAccess}
          onJobChange={handleJobChange}
          onNameChange={handleNameChange}
          onPositionChange={handlePositionChange}
          onTankRoleChange={handleTankRoleChange}
          onMenuClick={handleMenuButtonClick}
        />

        {/* Status badges row */}
        <div className="mt-1">
          <PlayerCardStatus
            role={player.role}
            isSubstitute={player.isSubstitute}
            bisLink={player.bisLink}
            userId={player.userId}
            linkedUser={player.linkedUser}
            currentUserId={currentUserId}
            player={player}
            userRole={userRole}
            isAdmin={isAdminAccess}
          />
        </div>
      </div>

      {/* Setup Banner - shows when card needs configuration */}
      <PlayerSetupBanner
        player={player}
        currentUserId={currentUserId ?? null}
        userRole={userRole}
        userHasClaimedPlayer={userHasClaimedPlayer ?? false}
        isAdminAccess={!!viewAsUserId}
        viewAsUserId={viewAsUserId}
        hideSetupBanners={hideSetupBanners}
        hideBisBanners={hideBisBanners}
        onClaimPlayer={onClaimPlayer}
        onOpenAssignModal={() => {
          if (isAdminAccess) {
            setShowAdminAssignModal(true);
          } else {
            setShowOwnerAssignModal(true);
          }
        }}
        onAssignViewAsUser={viewAsUserId && onAdminAssignPlayer ? () => {
          onAdminAssignPlayer({ userId: viewAsUserId });
        } : undefined}
        onOpenBiSImport={() => setShowBiSImport(true)}
      />

      {/* BiS Source Fix Banner - shows when gear slots need source correction */}
      {isExpanded && (
        <BiSSourceFixBanner
          gear={player.gear}
          player={player}
          userRole={userRole}
          currentUserId={currentUserId ?? null}
          isAdminAccess={isAdminAccess ?? false}
          onFixAllSources={handleFixAllBisSources}
        />
      )}

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
        isAdminAccess={isAdminAccess}
        onGearChange={handleGearChange}
        onTomeWeaponChange={handleTomeWeaponChange}
        slotsWithLootEntries={slotsWithLootEntries}
        slotsWithMaterialEntries={slotsWithMaterialEntries}
        highlightedSlot={highlightedSlot}
        onNavigateToLootEntry={onNavigateToLootEntry}
        onNavigateToMaterialEntry={onNavigateToMaterialEntry}
      />

      {/* Expanded mode: spacer after gear (fills remaining space, footer hidden) */}
      {isExpanded && <div className="flex-1" />}

      {/* Needs Footer - only visible in compact mode */}
      {!isExpanded && <NeedsFooter needs={needs} />}
    </div>
  );
});
