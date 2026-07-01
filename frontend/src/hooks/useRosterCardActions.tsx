/**
 * useRosterCardActions — behavior layer for the v2 RosterCard kebab menu.
 *
 * NEW v2 code — NOT an extraction of the legacy `PlayerCard`. The legacy card
 * keeps its own inline menu; this hook builds a deliberately *audited* menu for
 * the redesigned roster card (REDESIGN_SPEC §5.5). It owns the kebab's modal
 * state, **reuses the existing modal components unchanged**, and returns a thin
 * surface (`menuItems` + `modalsNode` + open/close handlers) so the card stays a
 * plain composition.
 *
 * Audit vs the legacy `PlayerCard` menu:
 *   - RE-HOMED OUT (never built here): Lodestone Sync (→ character link),
 *     Adjust Priority + Edit Books (→ Loot / F6d). The whole legacy
 *     "Loot Priority" section is gone.
 *   - Reordered: Player Management now sits above Clipboard.
 *   - No trailing-arrow glyphs on any item (§4.1 lexicon).
 *   - The job-change confirm flow is OUT of scope (owned by the card header).
 *
 * Gating matches the legacy card exactly — `canEditPlayer` / `canManageRoster` /
 * `canResetGear`, each passed `isAdminAccess` as the admin arg (so "View As"
 * context is respected, as legacy does). **Take Ownership / Release** are NOT
 * gated via `canClaimPlayer`: that helper early-returns disabled for any
 * non-admin when its `hasMembership` arg is omitted, which would permanently
 * disable claim/release for every owner/lead/member. Instead we replicate the
 * legacy card's inline visibility booleans (`PlayerCard.tsx:361-364`): show
 * Take only when the card is unclaimed and the current user hasn't already
 * claimed another card; show Release only for the linked user or the owner —
 * enabled whenever shown.
 *
 * ── Params that extend the brief's documented interface (justified per the
 *    brief's "adjust the param types to match what the modals actually
 *    require") ──
 *   - `groupId` / `tierId` / `contentType` — required by the reused modal
 *     components (BiSTargetManagerModal / WeaponPriorityModal / AssignUserModal
 *     / BiSImportModal), which take them as non-optional props.
 *   - `allPlayers` / `isAdmin` — passed straight through to AssignUserModal.
 *   - `actions.onPaste` / `actions.onRemove` — the Paste and Remove confirm
 *     dialogs need these callbacks (they are core "kept" menu items).
 *   - `onModalStateChange` — an INPUT the hook FIRES when any modal opens/closes
 *     (for DnD-disable). The brief listed it under the return block, but Step 3
 *     says the hook "fires" it, so it is received as a param.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FileDown,
  GitBranch,
  Link2,
  Link2Off,
  RotateCcw,
  Swords,
  Target,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
} from 'lucide-react';
import { Modal, RadioGroup, type ContextMenuItem } from '../components/ui';
import { Button } from '../components/primitives';
import { BiSImportModal } from '../components/player/BiSImportModal';
import { BiSTargetManagerModal } from '../components/bis/BiSTargetManagerModal';
import { WeaponPriorityModal } from '../components/weapon-priority/WeaponPriorityModal';
import { FlexRolesModal } from '../components/player/FlexRolesModal';
import { AssignUserModal } from '../components/player/AssignUserModal';
import {
  canEditPlayer,
  canManageRoster,
  canResetGear,
  type PermissionCheck,
} from '../utils/permissions';
import type {
  AssignPlayerRequest,
  ContentType,
  MemberRole,
  ResetMode,
  SnapshotPlayer,
} from '../types';

/** Action callbacks the grid threads in (from usePlayerActions / context). */
export interface RosterCardActions {
  onUpdate: (updates: Partial<SnapshotPlayer>) => Promise<void> | void;
  onCopy: () => void;
  onCopyUrl?: () => void;
  onDuplicate: () => void;
  /** Needed by the Paste confirm dialog. */
  onPaste?: () => void;
  /** Needed by the Remove confirm dialog. */
  onRemove?: () => void;
  onResetGear?: (mode: ResetMode) => void;
  onClaimPlayer?: () => void;
  onReleasePlayer?: () => void;
  onAdminAssignPlayer?: (req: AssignPlayerRequest) => Promise<void> | void;
  onOwnerAssignPlayer?: (req: AssignPlayerRequest) => Promise<void> | void;
}

export interface RosterCardActionParams {
  player: SnapshotPlayer;
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  clipboardPlayer: SnapshotPlayer | null;
  /**
   * Whether the current user has already claimed another player card — blocks a
   * second claim, as legacy does (`PlayerCard.tsx:363` `!userHasClaimedPlayer`).
   */
  userHasClaimedPlayer?: boolean;
  /** Static id — required by BiSTargetManagerModal / WeaponPriorityModal / AssignUserModal. */
  groupId: string;
  /** Tier id — required by WeaponPriorityModal. */
  tierId: string;
  /** Content type — required by BiSImportModal. */
  contentType: ContentType;
  /** All tier players — AssignUserModal uses these to flag existing assignments. */
  allPlayers?: SnapshotPlayer[];
  /** User.isAdmin — controls AssignUserModal (admin) dropdown scope. */
  isAdmin?: boolean;
  /** Fired (true/false) whenever any modal opens/closes so the card can disable DnD. */
  onModalStateChange?: (open: boolean) => void;
  actions: RosterCardActions;
}

export interface RosterCardActionResult {
  menuItems: ContextMenuItem[];
  modalsNode: ReactNode;
  contextMenu: { x: number; y: number } | null;
  openKebab: (e: MouseEvent) => void;
  openContextMenu: (e: MouseEvent) => void;
  closeKebab: () => void;
}

/** Callbacks that open each owned modal (stable per render, cheap to recreate). */
interface MenuOpeners {
  bisImport: () => void;
  bisTargets: () => void;
  weaponPriority: () => void;
  flexRoles: () => void;
  ownerAssign: () => void;
  adminAssign: () => void;
  reset: () => void;
  remove: () => void;
  unlink: () => void;
  paste: () => void;
}

interface BuildMenuContext {
  player: SnapshotPlayer;
  clipboardPlayer: SnapshotPlayer | null;
  isLinkedToMe: boolean;
  showTake: boolean;
  showRelease: boolean;
  showOwnerAssignItem: boolean;
  showAdminAssignItem: boolean;
  editPermission: PermissionCheck;
  rosterPermission: PermissionCheck;
  resetPermission: PermissionCheck;
  actions: RosterCardActions;
  open: MenuOpeners;
}

const ICON = 'w-4 h-4';

/**
 * The audited kebab menu. Intentionally distinct from the legacy PlayerCard
 * array (re-homed items removed, sections reordered) — this is not a clone.
 */
function buildMenuItems(ctx: BuildMenuContext): ContextMenuItem[] {
  const {
    player,
    clipboardPlayer,
    isLinkedToMe,
    showTake,
    showRelease,
    showOwnerAssignItem,
    showAdminAssignItem,
    editPermission,
    rosterPermission,
    resetPermission,
    actions,
    open,
  } = ctx;

  const editTip = editPermission.allowed ? undefined : editPermission.reason;
  const rosterTip = rosterPermission.allowed ? undefined : rosterPermission.reason;

  const items: ContextMenuItem[] = [];

  // ── BiS & Gear ─────────────────────────────────────────────
  items.push({ sectionHeader: 'BiS & Gear' });
  items.push({
    label: player.bisLink ? 'Update BiS' : 'Import BiS',
    icon: <FileDown className={ICON} />,
    onClick: open.bisImport,
    disabled: !editPermission.allowed,
    tooltip: editTip,
  });
  if (player.bisLink) {
    items.push({
      label: 'Unlink BiS',
      icon: <Link2Off className={ICON} />,
      onClick: open.unlink,
      disabled: !editPermission.allowed,
      tooltip: editTip,
    });
  }
  items.push({
    label: 'BiS Targets',
    icon: <Target className={ICON} />,
    onClick: open.bisTargets,
  });
  items.push({
    label: 'Weapon Priorities',
    icon: <Swords className={ICON} />,
    onClick: open.weaponPriority,
    disabled: !editPermission.allowed,
    tooltip: editTip,
  });
  items.push({
    label: 'Reset Gear',
    icon: <RotateCcw className={ICON} />,
    onClick: open.reset,
    disabled: !actions.onResetGear || !resetPermission.allowed,
    tooltip: !actions.onResetGear
      ? 'Feature not available'
      : resetPermission.allowed
        ? undefined
        : resetPermission.reason,
  });

  // ── Player Management ──────────────────────────────────────
  items.push({ sectionHeader: 'Player Management' });
  // Take / Release use legacy inline visibility (show-and-enabled), NOT
  // canClaimPlayer — see the file header.
  if (showTake) {
    items.push({
      label: 'Take Ownership',
      icon: <UserCheck className={ICON} />,
      onClick: actions.onClaimPlayer,
      accent: true,
    });
  }
  if (showRelease) {
    items.push({
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: <UserX className={ICON} />,
      onClick: actions.onReleasePlayer,
    });
  }
  items.push({
    label: 'Flex Roles',
    icon: <GitBranch className={ICON} />,
    onClick: open.flexRoles,
    disabled: !editPermission.allowed,
    tooltip: editTip,
  });
  items.push({
    label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
    icon: player.isSubstitute ? <UserPlus className={ICON} /> : <UserMinus className={ICON} />,
    onClick: () => actions.onUpdate({ isSubstitute: !player.isSubstitute }),
    disabled: !rosterPermission.allowed,
    tooltip: rosterTip,
  });
  if (showOwnerAssignItem) {
    items.push({
      label: 'Assign User',
      icon: <Link2 className={ICON} />,
      onClick: open.ownerAssign,
    });
  }
  if (showAdminAssignItem) {
    items.push({
      label: 'Assign User (Admin)',
      icon: <Link2 className={`${ICON} text-status-warning`} />,
      onClick: open.adminAssign,
    });
  }

  // ── Clipboard ──────────────────────────────────────────────
  items.push({ sectionHeader: 'Clipboard' });
  items.push({
    label: 'Copy',
    icon: <Copy className={ICON} />,
    onClick: actions.onCopy,
  });
  if (actions.onCopyUrl) {
    items.push({
      label: 'Copy URL',
      icon: <Link2 className={ICON} />,
      onClick: actions.onCopyUrl,
    });
  }
  items.push({
    label: 'Paste',
    icon: <ClipboardPaste className={ICON} />,
    onClick: open.paste,
    disabled: !clipboardPlayer || !editPermission.allowed || !actions.onPaste,
    tooltip: !clipboardPlayer ? 'No player copied' : editTip,
  });
  items.push({
    label: 'Duplicate',
    icon: <CopyPlus className={ICON} />,
    onClick: actions.onDuplicate,
    disabled: !rosterPermission.allowed,
    tooltip: rosterTip,
  });

  // ── Danger Zone ────────────────────────────────────────────
  items.push({ separator: true });
  items.push({
    label: 'Remove Player',
    icon: <Trash2 className={ICON} />,
    onClick: open.remove,
    danger: true,
    disabled: !rosterPermission.allowed || !actions.onRemove,
    tooltip: rosterTip,
  });

  return items;
}

export function useRosterCardActions(params: RosterCardActionParams): RosterCardActionResult {
  const {
    player,
    userRole,
    currentUserId,
    isAdminAccess,
    clipboardPlayer,
    userHasClaimedPlayer,
    groupId,
    tierId,
    contentType,
    allPlayers,
    isAdmin,
    onModalStateChange,
    actions,
  } = params;

  // ── Modal state (owned here so the card is a thin composition) ──
  const [showBiSImport, setShowBiSImport] = useState(false);
  const [showBiSTargets, setShowBiSTargets] = useState(false);
  const [showWeaponPriority, setShowWeaponPriority] = useState(false);
  const [showFlexRoles, setShowFlexRoles] = useState(false);
  const [showOwnerAssign, setShowOwnerAssign] = useState(false);
  const [showAdminAssign, setShowAdminAssign] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [resetMode, setResetMode] = useState<ResetMode>('progress');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Notify the consumer whenever any modal opens/closes (card disables DnD).
  const anyModalOpen =
    showBiSImport ||
    showBiSTargets ||
    showWeaponPriority ||
    showFlexRoles ||
    showOwnerAssign ||
    showAdminAssign ||
    showReset ||
    showRemove ||
    showUnlink ||
    showPaste;
  useEffect(() => {
    onModalStateChange?.(anyModalOpen);
  }, [anyModalOpen, onModalStateChange]);

  // ── Permissions (isAdminAccess as the admin arg, matching the legacy card) ──
  const uid = currentUserId ?? undefined;
  const editPermission = canEditPlayer(userRole, player, uid, isAdminAccess);
  const rosterPermission = canManageRoster(userRole, isAdminAccess);
  const resetPermission = canResetGear(userRole, player, uid, isAdminAccess);

  // Claim/Release visibility replicates the legacy card's inline booleans
  // (PlayerCard.tsx:361-364), NOT canClaimPlayer (which would early-return
  // disabled without a hasMembership arg — see the file header). `isGroupOwner`
  // is `userRole === 'owner'`, the equivalent of legacy's separate prop.
  const isGroupOwner = userRole === 'owner';
  const isLinkedToMe = !!player.userId && player.userId === currentUserId;
  const showTake =
    !player.userId && !!currentUserId && !!actions.onClaimPlayer && !userHasClaimedPlayer;
  const showRelease =
    (isLinkedToMe || isGroupOwner) && !!player.userId && !!actions.onReleasePlayer;
  // Owner-assign shows for an actual owner (not via admin access); admin-assign
  // shows only under admin access. Mirrors legacy's two Assign User variants.
  const showOwnerAssignItem = userRole === 'owner' && !isAdminAccess && !!actions.onOwnerAssignPlayer;
  const showAdminAssignItem = isAdminAccess && !!actions.onAdminAssignPlayer;

  const menuItems = buildMenuItems({
    player,
    clipboardPlayer,
    isLinkedToMe,
    showTake,
    showRelease,
    showOwnerAssignItem,
    showAdminAssignItem,
    editPermission,
    rosterPermission,
    resetPermission,
    actions,
    open: {
      bisImport: () => setShowBiSImport(true),
      bisTargets: () => setShowBiSTargets(true),
      weaponPriority: () => setShowWeaponPriority(true),
      flexRoles: () => setShowFlexRoles(true),
      ownerAssign: () => {
        setShowOwnerAssign(true);
        setContextMenu(null);
      },
      adminAssign: () => {
        setShowAdminAssign(true);
        setContextMenu(null);
      },
      reset: () => setShowReset(true),
      remove: () => setShowRemove(true),
      unlink: () => setShowUnlink(true),
      paste: () => setShowPaste(true),
    },
  });

  const openContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const openKebab = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.bottom });
  }, []);

  const closeKebab = useCallback(() => setContextMenu(null), []);

  const modalsNode = (
    <>
      {/* ── Reused modal COMPONENTS (imported unchanged) ── */}
      <BiSImportModal
        isOpen={showBiSImport}
        onClose={() => setShowBiSImport(false)}
        player={player}
        contentType={contentType}
        onImport={(updates) => {
          void actions.onUpdate(updates);
        }}
      />

      {showBiSTargets && (
        <BiSTargetManagerModal
          ownerType="roster_member_job"
          ownerId={player.id}
          groupId={groupId}
          job={player.job}
          canEdit={editPermission.allowed}
          onClose={() => setShowBiSTargets(false)}
        />
      )}

      <WeaponPriorityModal
        player={player}
        groupId={groupId}
        tierId={tierId}
        userRole={userRole ?? 'viewer'}
        isOpen={showWeaponPriority}
        onClose={() => setShowWeaponPriority(false)}
      />

      <FlexRolesModal
        isOpen={showFlexRoles}
        onClose={() => setShowFlexRoles(false)}
        player={player}
        onSave={(updates) => actions.onUpdate(updates)}
      />

      {showOwnerAssign && (
        <AssignUserModal
          player={player}
          groupId={groupId}
          isAdmin={false}
          allPlayers={allPlayers}
          onClose={() => setShowOwnerAssign(false)}
          onAssign={async (data) => {
            if (actions.onOwnerAssignPlayer) {
              await actions.onOwnerAssignPlayer(data);
              setShowOwnerAssign(false);
            }
          }}
        />
      )}

      {showAdminAssign && (
        <AssignUserModal
          player={player}
          groupId={groupId}
          isAdmin={isAdmin ?? false}
          allPlayers={allPlayers}
          onClose={() => setShowAdminAssign(false)}
          onAssign={async (data) => {
            if (actions.onAdminAssignPlayer) {
              await actions.onAdminAssignPlayer(data);
              setShowAdminAssign(false);
            }
          }}
        />
      )}

      {/* ── Inline confirm dialogs (reused Modal + RadioGroup from ui) ── */}
      <Modal
        isOpen={showRemove}
        onClose={() => setShowRemove(false)}
        title={
          <span className="flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-status-error" />
            Remove Player
          </span>
        }
        size="sm"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to remove{' '}
          <span className="text-text-primary font-medium">{player.name}</span> from the static?
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setShowRemove(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              actions.onRemove?.();
              setShowRemove(false);
            }}
          >
            Remove
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        title={
          <span className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-status-warning" />
            Reset Gear Progress
          </span>
        }
      >
        <div className="mb-6">
          <p className="text-text-secondary mb-4">
            Choose what to reset for{' '}
            <span className="text-text-primary font-medium">{player.name}</span> ({player.job}):
          </p>

          <RadioGroup
            name="rosterResetMode"
            value={resetMode}
            onChange={(value) => setResetMode(value as ResetMode)}
            options={[
              {
                value: 'progress',
                label: 'Reset progress only (keep BiS configuration)',
                description:
                  '• Unchecks all Have/Aug checkboxes\n• Resets tome weapon tracking\n• Keeps BiS link and sources',
              },
              {
                value: 'unlink',
                label: 'Unlink BiS (keep progress)',
                description:
                  '• Removes BiS reference\n• Clears item metadata (names, icons)\n• Keeps current sources and progress',
              },
              {
                value: 'all',
                label: 'Reset everything (complete wipe)',
                description:
                  '• Unchecks all Have/Aug checkboxes\n• Resets BiS sources to defaults\n• Removes BiS link and metadata\n• Resets tome weapon tracking',
              },
            ]}
          />

          <p className="text-status-warning text-sm mt-4">This action cannot be undone.</p>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setShowReset(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              actions.onResetGear?.(resetMode);
              setShowReset(false);
            }}
          >
            Reset Gear
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showUnlink}
        onClose={() => setShowUnlink(false)}
        title={
          <span className="flex items-center gap-2">
            <Link2Off className="w-5 h-5 text-status-warning" />
            Unlink BiS
          </span>
        }
        size="sm"
      >
        <p className="text-text-secondary mb-4">
          Are you sure you want to unlink{' '}
          <span className="text-text-primary font-medium">{player.name}</span>'s BiS set?
        </p>
        <p className="text-text-muted text-sm mb-6">
          This will remove the BiS link and item metadata (names, icons). Current progress and
          sources will be kept.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setShowUnlink(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              void actions.onUpdate({ bisLink: '' });
              setShowUnlink(false);
            }}
          >
            Unlink BiS
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showPaste}
        onClose={() => setShowPaste(false)}
        title={
          <span className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5" />
            Paste Player
          </span>
        }
        size="sm"
      >
        <p className="text-text-secondary mb-4">
          This will overwrite{' '}
          <span className="text-text-primary font-medium">{player.name}</span>'s gear configuration
          with data from{' '}
          <span className="text-text-primary font-medium">
            {clipboardPlayer?.name || 'copied player'}
          </span>
          .
        </p>
        <p className="text-text-muted text-sm mb-6">
          Job, BiS sources, progress, and weapon priorities will all be replaced.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setShowPaste(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={() => {
              actions.onPaste?.();
              setShowPaste(false);
            }}
          >
            Paste
          </Button>
        </div>
      </Modal>
    </>
  );

  return {
    menuItems,
    modalsNode,
    contextMenu,
    openKebab,
    openContextMenu,
    closeKebab,
  };
}
