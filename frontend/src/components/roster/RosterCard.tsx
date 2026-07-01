/**
 * RosterCard — v2 presentational player card (F6c Roster · Cards).
 *
 * NEW v2 code — does NOT modify or extend the legacy `PlayerCard`. It composes
 * the F6b shared `ui/` set (CardShell / PlayerIdentity / ProgressBar /
 * GearStatusCircle) with the already-built `useRosterCardActions` hook (Task 4)
 * for the kebab menu + modals, and reuses the existing job/position/tank-role
 * selectors for inline edits. Visual target: `mockups/02-roster-cards.html`
 * `.pcard`; behaviour: REDESIGN_SPEC §5.5.
 *
 * Deliberate design decisions (documented to pre-empt review false-positives):
 *   - CardShell can't forward DOM handlers or a `style`, so the context-menu /
 *     drag wiring and the role-colored accent edge live on a thin wrapper around
 *     CardShell (CardShell stays the card *surface*, per the brief's intent).
 *   - The gear pip strip is READ-ONLY (display-only): gear editing is the Board's
 *     job (§2.2). We render `GearStatusCircle` `disabled` with a no-op `onChange`
 *     rather than mirroring `PlayerCard.handleGearChange` (that would duplicate a
 *     logic block → jscpd).
 *   - Job change opens a card-owned confirm (Modal + RadioGroup). The legacy
 *     "also import BiS on job change" convenience is OUT of scope — the BiS import
 *     modal lives in the hook; the user re-imports via the kebab after changing
 *     jobs. The RadioGroup offers the in-scope BiS choice (keep vs unlink).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreVertical, Repeat } from 'lucide-react';
import {
  CardShell,
  ContextMenu,
  Input,
  Modal,
  PlayerIdentity,
  ProgressBar,
  RadioGroup,
} from '../ui';
import { GearStatusCircle } from '../ui/GearStatusCircle';
import { Button, IconButton } from '../primitives';
import { JobPicker } from '../player/JobPicker';
import { PositionSelector } from '../player/PositionSelector';
import { TankRoleSelector } from '../player/TankRoleSelector';
import {
  useRosterCardActions,
  type RosterCardActions,
} from '../../hooks/useRosterCardActions';
import type { DragAttributes, DragListeners } from '../player/DroppablePlayerCard';
import {
  calculateAverageItemLevel,
  isSlotComplete,
  requiresAugmentation,
  toGearState,
} from '../../utils/calculations';
import { calculatePlayerNeeds } from '../../utils/priority';
import { canEditPlayer, type MemberRole } from '../../utils/permissions';
import {
  getJobDisplayName,
  getRoleColor,
  getRoleForJob,
  getValidRole,
} from '../../gamedata';
import type { ContentType, SnapshotPlayer } from '../../types';

const TOTAL_SLOTS = 11;

export interface RosterCardProps {
  player: SnapshotPlayer;
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  /** Whether the current user can manage the roster (assign/remove). */
  canManage: boolean;
  clipboardPlayer: SnapshotPlayer | null;
  /** When true, the card root carries the drag-handle attributes/listeners. */
  reorderMode: boolean;
  /** Drag handle supplied by the grid (Task 7). */
  dragHandle?: { attributes?: DragAttributes; listeners?: DragListeners };
  actions: RosterCardActions;
  // ── Forwarded straight to useRosterCardActions (sourced from tier/context by
  //    the grid/assembly — Tasks 6/10). Defaulted so the card renders standalone.
  groupId?: string;
  tierId?: string;
  contentType?: ContentType;
  allPlayers?: SnapshotPlayer[];
  isAdmin?: boolean;
  userHasClaimedPlayer?: boolean;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

/** Relative "2h ago"-style age for a Lodestone sync timestamp. */
function formatSyncAge(iso?: string): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type JobChangeMode = 'keep' | 'unlink';

export function RosterCard({
  player,
  userRole,
  currentUserId,
  isAdminAccess,
  canManage,
  clipboardPlayer,
  reorderMode,
  dragHandle,
  actions,
  groupId = '',
  tierId = '',
  contentType = 'savage',
  allPlayers,
  isAdmin,
  userHasClaimedPlayer,
  onModalOpen,
  onModalClose,
}: RosterCardProps) {
  const role = getValidRole(player.role);
  const editPermission = canEditPlayer(userRole, player, currentUserId ?? undefined, isAdminAccess);
  const canEdit = editPermission.allowed;

  // ── Local UI state (name edit + job change) ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(player.name);
  const editingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [pendingJob, setPendingJob] = useState<string | null>(null);
  const [jobChangeMode, setJobChangeMode] = useState<JobChangeMode>('keep');
  const [hookModalOpen, setHookModalOpen] = useState(false);

  // ── Kebab + modals from the audited hook (Task 4) ──
  const { menuItems, modalsNode, contextMenu, openKebab, openContextMenu, closeKebab } =
    useRosterCardActions({
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
      onModalStateChange: setHookModalOpen,
      actions,
    });

  // Any overlay (hook modal / job picker / job-change confirm) disables grid DnD.
  const overlayOpen = hookModalOpen || showJobPicker || pendingJob !== null;
  const prevOverlay = useRef(false);
  useEffect(() => {
    if (prevOverlay.current === overlayOpen) return;
    prevOverlay.current = overlayOpen;
    if (overlayOpen) onModalOpen?.();
    else onModalClose?.();
  }, [overlayOpen, onModalOpen, onModalClose]);

  // If the card unmounts while an overlay is still open (e.g. an external
  // refresh drops the player mid-modal), the balanced close above never fires,
  // leaking the grid's `openModalCount` and stuck-disabling reorder DnD until
  // reload. Release it on unmount. Ref-held callback (synced in an effect, not
  // during render) + empty-dep cleanup so this fires exactly once on unmount,
  // never on a mid-life callback-identity change.
  const onModalCloseRef = useRef(onModalClose);
  useEffect(() => {
    onModalCloseRef.current = onModalClose;
  }, [onModalClose]);
  useEffect(
    () => () => {
      if (prevOverlay.current) onModalCloseRef.current?.();
    },
    []
  );

  // Focus the rename field on entry (ref+effect, avoiding the autoFocus a11y warning).
  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  // ── Name inline edit (editingRef guards a double-commit on Enter→blur) ──
  const beginNameEdit = () => {
    if (!canEdit) return;
    editingRef.current = true;
    setDraftName(player.name);
    setIsEditingName(true);
  };
  const commitName = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== player.name) void actions.onUpdate({ name: trimmed });
    setIsEditingName(false);
  };
  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') commitName();
    else if (e.key === 'Escape') {
      editingRef.current = false;
      setDraftName(player.name);
      setIsEditingName(false);
    }
  };

  // ── Job change → card-owned confirm → onUpdate({ job, role }) ──
  const onJobPicked = (newJob: string) => {
    setShowJobPicker(false);
    if (newJob !== player.job) {
      setJobChangeMode('keep');
      setPendingJob(newJob);
    }
  };
  const commitJobChange = () => {
    if (!pendingJob) return;
    const nextRole = getRoleForJob(pendingJob);
    const updates: Partial<SnapshotPlayer> = { job: pendingJob };
    if (nextRole) updates.role = nextRole;
    if (jobChangeMode === 'unlink') updates.bisLink = '';
    void actions.onUpdate(updates);
    setPendingJob(null);
  };

  // ── Derived display ──
  const completedSlots = player.gear.filter(isSlotComplete).length;
  const ratio = completedSlots / TOTAL_SLOTS;
  const hasBis = !!player.bisLink;
  const displayILv = calculateAverageItemLevel(player.gear, tierId);

  const hasLodestoneIdentity = Boolean(
    player.lodestoneId && (player.lodestoneName || player.lodestoneServer)
  );
  const syncAge = formatSyncAge(player.lastSync);
  const syncLabel = hasLodestoneIdentity
    ? syncAge
      ? `Linked · synced ${syncAge}`
      : 'Linked'
    : 'Not synced';

  const identitySubtitle = [getJobDisplayName(player.job), player.lodestoneServer]
    .filter(Boolean)
    .join(' · ');

  // Resolve a kebab menu item's onClick by label (footer CTAs reuse the hook's
  // modals rather than duplicating open/close state).
  const getMenuAction = (label: string): (() => void) | undefined => {
    const item = menuItems.find(
      (i) => !('separator' in i) && !('sectionHeader' in i) && (i as { label?: string }).label === label
    );
    return (item as { onClick?: () => void } | undefined)?.onClick;
  };
  const importAction = getMenuAction('Import BiS') ?? getMenuAction('Update BiS');
  const assignAction = getMenuAction('Assign User') ?? getMenuAction('Assign User (Admin)');

  const renderStatus = (): ReactNode => {
    if (!player.userId && canManage && assignAction) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-status-warning">Unclaimed</span>
          <Button variant="ghost" size="xs" onClick={assignAction}>
            Assign
          </Button>
        </span>
      );
    }
    if (!hasBis) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-status-warning">No BiS</span>
          {canEdit && importAction && (
            <Button variant="ghost" size="xs" onClick={importAction}>
              Import
            </Button>
          )}
        </span>
      );
    }
    if (completedSlots >= TOTAL_SLOTS) {
      return <span className="font-medium text-accent">BiS set</span>;
    }
    const needs = calculatePlayerNeeds(player);
    const needCount = needs.raidNeed + needs.tomeNeed + needs.upgrades;
    return <span className="text-text-secondary">needs {needCount}</span>;
  };

  const dragProps = reorderMode ? { ...dragHandle?.attributes, ...dragHandle?.listeners } : {};

  return (
    <div className="relative" onContextMenu={openContextMenu} {...dragProps}>
      <CardShell as="div" className="relative overflow-hidden">
        {/* Role-colored accent edge (semantic role var → token-compliant). */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: getRoleColor(role) }}
        />

        {/* ── Header: identity + inline edits · iLvl · kebab ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {isEditingName ? (
              <Input
                ref={nameInputRef}
                value={draftName}
                onChange={setDraftName}
                onBlur={commitName}
                onKeyDown={onNameKeyDown}
                aria-label="Player name"
                size="sm"
                className="w-40"
              />
            ) : (
              <div
                className="min-w-0"
                onDoubleClick={beginNameEdit}
                title={canEdit ? 'Double-click to rename' : undefined}
              >
                <PlayerIdentity name={player.name} job={player.job} role={role} subtitle={identitySubtitle} />
              </div>
            )}

            {role === 'tank' && (
              <TankRoleSelector
                tankRole={player.tankRole}
                onSelect={(tankRole) => actions.onUpdate({ tankRole: tankRole ?? null })}
                player={player}
                userRole={userRole}
                currentUserId={currentUserId ?? undefined}
                isAdmin={isAdminAccess}
              />
            )}
            <PositionSelector
              position={player.position}
              role={player.role}
              onSelect={(position) => actions.onUpdate({ position: position ?? null })}
              player={player}
              userRole={userRole}
              currentUserId={currentUserId ?? undefined}
              isAdmin={isAdminAccess}
            />

            {canEdit && (
              <div className="relative">
                <IconButton
                  aria-label="Change job"
                  variant="ghost"
                  size="sm"
                  icon={<Repeat className="h-4 w-4" />}
                  onClick={() => setShowJobPicker((v) => !v)}
                />
                {showJobPicker && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border-default bg-surface-raised p-2 shadow-lg">
                    <JobPicker
                      selectedJob={player.job}
                      onJobSelect={onJobPicked}
                      onRequestClose={() => setShowJobPicker(false)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right leading-none">
              <div className="font-display text-lg font-bold text-text-primary">
                {displayILv > 0 ? displayILv : '—'}
              </div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary">iLvl</div>
            </div>
            <IconButton
              aria-label="Player actions"
              variant="ghost"
              size="sm"
              icon={<MoreVertical className="h-5 w-5" />}
              onClick={openKebab}
            />
          </div>
        </div>

        {/* ── BiS progress line ── */}
        <div className="mt-3 flex items-center gap-2">
          <ProgressBar
            value={hasBis ? ratio : 0}
            color={hasBis ? (ratio < 0.5 ? 'warning' : 'accent') : 'warning'}
            ariaLabel={`${player.name} BiS progress`}
            className="flex-1"
          />
          <span
            className={`shrink-0 text-xs font-semibold ${hasBis ? 'text-text-secondary' : 'text-status-warning'}`}
          >
            {hasBis ? `${completedSlots}/${TOTAL_SLOTS} BiS` : 'no BiS'}
          </span>
        </div>

        {/* ── Gear pip strip (read-only / display-only) ── */}
        <div className="mt-3 flex flex-wrap gap-1">
          {player.gear.map((slot) => (
            <GearStatusCircle
              key={slot.slot}
              state={toGearState(slot.hasItem, slot.isAugmented)}
              bisSource={slot.bisSource}
              requiresAugmentation={requiresAugmentation(slot)}
              onChange={() => {}}
              disabled
              size="sm"
            />
          ))}
        </div>

        {/* ── Footer: character link/sync · status CTA ── */}
        <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3 text-xs text-text-tertiary">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${hasLodestoneIdentity ? 'bg-membership-linked' : 'bg-text-muted'}`}
            />
            <span className="truncate">{syncLabel}</span>
          </span>
          <span className="flex-1" />
          {renderStatus()}
        </div>
      </CardShell>

      {/* Kebab modals (hook-owned) + card-owned job-change confirm (both portal). */}
      {modalsNode}

      {pendingJob && (
        <Modal
          isOpen
          onClose={() => setPendingJob(null)}
          size="sm"
          title={
            <span className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-accent" />
              Change Job
            </span>
          }
        >
          <p className="mb-4 text-text-secondary">
            Change <span className="font-medium text-text-primary">{player.name}</span> from{' '}
            <span className="font-medium text-text-primary">{getJobDisplayName(player.job)}</span> to{' '}
            <span className="font-medium text-text-primary">{getJobDisplayName(pendingJob)}</span>?
          </p>
          <RadioGroup
            name="rosterJobChangeBis"
            value={jobChangeMode}
            onChange={(value) => setJobChangeMode(value as JobChangeMode)}
            options={[
              {
                value: 'keep',
                label: 'Keep current BiS setup',
                description: 'Position, gear progress, and the BiS link are left unchanged.',
              },
              {
                value: 'unlink',
                label: 'Unlink BiS on change',
                description: 'Clears the BiS link (the new job needs its own set). Progress is kept.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-text-muted">
            Re-import BiS from the card menu after switching jobs.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setPendingJob(null)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={commitJobChange}>
              Change Job
            </Button>
          </div>
        </Modal>
      )}

      {contextMenu && (
        <ContextMenu
          items={menuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeKebab}
        />
      )}
    </div>
  );
}
