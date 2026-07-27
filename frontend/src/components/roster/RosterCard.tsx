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
 *   - The gear pip strip (compact density) is NON-EDITING, matching legacy's
 *     compact view: circles render `disabled`, but pips with item data carry
 *     the hover item card for inspection (C2, D-02). EDITING lives in the
 *     expanded gear table (C2) and on the Board — both through the one shared
 *     mutation path (`computeGearSlotUpdate`, mirrored from
 *     `PlayerCard.handleGearChange`).
 *   - Job change opens a card-owned confirm (Modal + RadioGroup). The legacy
 *     "also import BiS on job change" convenience is OUT of scope — the BiS import
 *     modal lives in the hook; the user re-imports via the kebab after changing
 *     jobs. The RadioGroup offers the in-scope BiS choice (keep vs unlink).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, MoreVertical, Repeat, Swords, Target } from 'lucide-react';
import {
  CardShell,
  ContextMenu,
  Input,
  LinkText,
  Modal,
  PlayerIdentity,
  ProgressBar,
  RadioGroup,
  Tag,
} from '../ui';
import { GearStatusCircle } from '../ui/GearStatusCircle';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { SafeAvatar } from '../ui/SafeAvatar';
import { RosterGearTable } from './RosterGearTable';
import { hasHoverData } from './gearHoverData';
import { NowVsBisPanel } from './NowVsBisPanel';
import { bisLinkTooltip, buildBisUrl } from './bisLinkMeta';
import { equippedAverageIlv } from './rosterIlv';
import { Button, IconButton, LongPressTooltip, Tooltip } from '../primitives';
import { JobPicker } from '../player/JobPicker';
import { PositionSelector } from '../player/PositionSelector';
import { TankRoleSelector } from '../player/TankRoleSelector';
import {
  useRosterCardActions,
  type RosterCardActions,
} from '../../hooks/useRosterCardActions';
import { toast } from '../../stores/toastStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import type { DragAttributes, DragListeners } from './dragTypes';
import {
  calculateAverageItemLevel,
  computeGearSlotUpdate,
  fromGearState,
  isSlotComplete,
  requiresAugmentation,
  toGearState,
  type GearState,
} from '../../utils/calculations';
import { canEditGear, canEditPlayer, type MemberRole } from '../../utils/permissions';
import { formatSource } from '../profile/freshness';
import { eventBus, Events } from '../../lib/eventBus';
import {
  getJobDisplayName,
  getRoleColor,
  getRoleForJob,
  getValidRole,
} from '../../gamedata';
import type {
  ContentType,
  GearSlot,
  GearSlotStatus,
  GearSource,
  SnapshotPlayer,
  TomeWeaponStatus,
  ViewMode,
} from '../../types';
import { BiSSourceFixBanner } from '../player/BiSSourceFixBanner';

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
  /**
   * Global card density (Phase C C1, D-01): compact = pip strip, expanded =
   * the read-only gear-table shell. A view toggle for ALL cards — per-card
   * collapse was explicitly rejected at the C1 checkpoint (2026-07-26).
   * Defaults to compact (pre-C1 rendering).
   */
  density?: ViewMode;
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
  density = 'compact',
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
  // Gear cells gate on canEditGear (plan §2.2) — same rules, gear-specific
  // messaging: owner/lead edit all, a member their own claimed card.
  const gearPermission = canEditGear(userRole, player, currentUserId ?? undefined, isAdminAccess);
  const canCycleGear = gearPermission.allowed;
  const isExpanded = density === 'expanded';

  // ── On-card gear editing (Phase C C2, D-02) ──
  // The table's circle reports the cycled state; the mutation goes through the
  // SHARED path (computeGearSlotUpdate — same as legacy PlayerCard and the
  // Board). The analytics emit lives HERE, in the v2 card, with the shell
  // discriminator — never inside the shared mutation path (plan §3 C2: a
  // shared-path emit would make frozen V1 start POSTing analytics).
  const handleSlotChange = async (slot: GearSlot, next: GearState) => {
    try {
      await actions.onUpdate(computeGearSlotUpdate(player, slot, fromGearState(next)));
      eventBus.emit(Events.PLAYER_GEAR_CHANGED, { slot, state: next, shell: 'v2' });
    } catch {
      // Inherited V1 behavior (PlayerCard.handleGearChange): the api layer
      // toasts 403s only; other failures roll the circle back silently via
      // the tierStore rollback. Kept for parity — revisit with the store.
    }
  };

  // ── BiS-source tools (Phase C C3, D-03) ──
  // A real source change (or clear) resets progress + item metadata so state
  // stays consistent — the exact legacy GearTable.handleSourceChange shape,
  // committed through the same shared computeGearSlotUpdate path. The
  // reset-warning confirm lives inside the shared BiSSourceSelector leaf.
  const handleSourceChange = async (slot: GearSlot, source: GearSource | null) => {
    const current = player.gear.find((g) => g.slot === slot);
    const changing = source !== (current?.bisSource ?? null);
    const updates: Partial<GearSlotStatus> =
      source === null || changing
        ? {
            bisSource: source,
            hasItem: false,
            isAugmented: false,
            currentSource: undefined,
            itemName: undefined,
            itemLevel: undefined,
            itemIcon: undefined,
            itemStats: undefined,
          }
        : { bisSource: source };
    try {
      await actions.onUpdate(computeGearSlotUpdate(player, slot, updates));
    } catch {
      // Inherited V1: api layer toasts 403s; store rollback otherwise.
    }
  };

  // Fix corrects a miscategorized bisSource while PRESERVING progress and
  // item metadata (legacy handleBisSourceFix).
  const handleSourceFix = async (slot: GearSlot, source: GearSource) => {
    try {
      await actions.onUpdate(computeGearSlotUpdate(player, slot, { bisSource: source }));
    } catch {
      // Inherited V1: api layer toasts 403s; store rollback otherwise.
    }
  };

  // Bulk fix from the shared banner — ONE update over the mapped gear array
  // (legacy PlayerCard.handleFixAllBisSources). No catch: the banner awaits
  // this and owns both the success and the failure toast.
  const handleFixAllSources = (fixes: Array<{ slot: string; bisSource: GearSource }>) => {
    const newGear = player.gear.map((g) => {
      const fix = fixes.find((f) => f.slot === g.slot);
      return fix ? { ...g, bisSource: fix.bisSource } : g;
    });
    return actions.onUpdate({ gear: newGear });
  };

  // ── Tome-weapon sub-row (Phase C C4, D-04) ──
  // Both weapon-row affordances (the "+" toggle, the sub-row circle) commit
  // through the LEGACY tomeWeapon spread (PlayerCard.handleTomeWeaponChange
  // parity) — tomeWeapon is its own player field, so computeGearSlotUpdate
  // never touches it. NO analytics emit: the C2 player_gear_changed ruling
  // covers the 11 gear-slot cycles only; legacy never emitted tome events.
  // The kebab's Track/Stop item mutates the same store field, so the two
  // affordances stay in sync with no extra wiring.
  const handleTomeWeaponChange = async (updates: Partial<TomeWeaponStatus>) => {
    try {
      await actions.onUpdate({ tomeWeapon: { ...player.tomeWeapon, ...updates } });
    } catch {
      // Inherited V1: api layer toasts 403s; store rollback otherwise.
    }
  };

  // The material entry marking this player's tome weapon (the legacy
  // GroupViewContent detection predicate): slotAugmented === 'tome_weapon',
  // or a universal tomestone with no slotAugmented.
  const materialLog = useLootTrackingStore((s) => s.materialLog);
  const tomeMaterialEntry = useMemo(
    () =>
      materialLog.find(
        (e) =>
          e.recipientPlayerId === player.id &&
          (e.slotAugmented === 'tome_weapon' ||
            (e.materialType === 'universal_tomestone' && !e.slotAugmented))
      ),
    [materialLog, player.id]
  );

  // Jump = same-route URL params (the v2 nav pattern; Loot.tsx copyLink
  // precedent): the Loot spine tab (PageMode 'gear') + its History sub-view +
  // the highlight params LootHistoryTable consumes (scroll, pulse,
  // self-clearing after 2.5s).
  const [, setSearchParams] = useSearchParams();
  const handleTomeMaterialJump = useCallback(() => {
    if (!tomeMaterialEntry) return;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'gear');
      params.set('lview', 'history');
      params.set('entry', String(tomeMaterialEntry.id));
      params.set('entryType', 'material');
      return params;
    });
  }, [tomeMaterialEntry, setSearchParams]);

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
  const commitName = async () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const trimmed = draftName.trim();
    setIsEditingName(false);
    if (trimmed && trimmed !== player.name) {
      // A10 mutation shape: onUpdate chains to tierStore.updatePlayer, which
      // re-throws after rollback — await + toast so a failed rename can't
      // become an unhandled rejection (phantom /api/analytics/errors POST).
      try {
        await actions.onUpdate({ name: trimmed });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to rename player');
      }
    }
  };
  const onNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') void commitName();
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
  const commitJobChange = async () => {
    if (!pendingJob) return;
    const nextRole = getRoleForJob(pendingJob);
    const updates: Partial<SnapshotPlayer> = { job: pendingJob };
    if (nextRole) updates.role = nextRole;
    if (jobChangeMode === 'unlink') updates.bisLink = '';
    setPendingJob(null);
    // A10 mutation shape — see commitName.
    try {
      await actions.onUpdate(updates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change job');
    }
  };

  // ── Derived display ──
  const completedSlots = player.gear.filter(isSlotComplete).length;
  const ratio = completedSlots / TOTAL_SLOTS;
  const hasBis = !!player.bisLink;

  // C5 (D-10): the readout prefers the equipped average from sync data when it
  // covers at least half the slots (legacy PlayerCardHeader parity); the
  // NowVsBisPanel hover explains the number either way. The shared helper
  // keeps this expression identical to the GearBoard subtitle (director F3).
  const bisAvgIlv = calculateAverageItemLevel(player.gear, tierId);
  const equippedAvgIlv = equippedAverageIlv(player.gear);
  const displayILv = equippedAvgIlv > 0 ? equippedAvgIlv : bisAvgIlv;

  // C5 (D-09): badge facts. The "+N" count excludes the main job (legacy
  // R-081); the claim story below owns "You"/linked-user.
  const weaponPriorityCount = Math.max(0, (player.weaponPriorities?.length ?? 0) - 1);
  const showWeaponPriority = (player.weaponPriorities?.length ?? 0) > 1;

  const hasLodestoneIdentity = Boolean(
    player.lodestoneId && (player.lodestoneName || player.lodestoneServer)
  );
  const syncAge = formatSyncAge(player.lastSync);
  // C5 (D-12 rider): the sync line carries the character's name; server and
  // sync provenance live in the hover detail (leaner than v1's sync block).
  // Rendered as two segments so the NAME truncates and the age never does
  // (director F5). Sync STATUS keys on lastSync itself, not Lodestone
  // identity — a Player Hub claim auto-links sync data with no lodestone
  // fields (tiers.py _auto_link_bis_from_hub), and the footer must never say
  // "Not synced" while the headline shows the synced equipped average
  // (PR #193 review).
  const showsSync = hasLodestoneIdentity || Boolean(syncAge);
  const syncName =
    player.lodestoneName ??
    (hasLodestoneIdentity
      ? 'Linked'
      : player.lastSyncSource === 'player_hub'
        ? 'Player Hub'
        : 'Synced');
  const syncJobMismatch = Boolean(
    showsSync &&
      player.lastSyncedJob &&
      player.job &&
      player.lastSyncedJob.toUpperCase() !== player.job.toUpperCase()
  );
  // Provenance renders through the shared formatSource labels — raw storage
  // identifiers like "player_hub" never reach copy (PR #193 review round 4).
  const syncDetail = (() => {
    if (!syncAge) return 'Lodestone identity linked';
    const parts = [syncAge === 'just now' ? 'Synced just now' : `Last synced ${syncAge}`];
    if (player.lastSyncSource) parts.push(formatSource(player.lastSyncSource));
    if (player.lastSyncedJob) parts.push(`as ${player.lastSyncedJob}`);
    return parts.join(' · ');
  })();

  // C5 (D-01 remainder): the active BiS target for this player+job. INHERIT
  // ruling — the store is populated only once the BiS Targets modal has run
  // (no roster-level prefetch, no backend work); until then the chip stays off.
  const activeBisTarget = useSharedBisStore((s) =>
    s.getActive('roster_member_job', player.id, player.job)
  );
  const bisTargetCount = useSharedBisStore(
    (s) =>
      s.getTargets('roster_member_job', player.id).filter(
        (t) => t.job.toUpperCase() === player.job.toUpperCase()
      ).length
  );

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
  const bisTargetsAction = getMenuAction('BiS Targets');

  // One axis per location (C1 checkpoint ruling, 2026-07-26): the footer's
  // right side carries ONLY the claim/ownership state — every BiS concern
  // (count, "No BiS", the Import action) lives on the progress line above.
  // Actions render as bordered buttons, never bare accent text (a clickable
  // thing must LOOK clickable). C5 (D-09) completes the claim story: a claimed
  // card names its owner here — "You" for the current user, the linked user's
  // avatar + name otherwise (membership role in the tooltip, not a color code).
  const renderClaimStatus = (): ReactNode => {
    if (!player.userId) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-status-warning">Unclaimed</span>
          {canManage && assignAction && (
            <Button variant="secondary" size="xs" onClick={assignAction}>
              Assign
            </Button>
          )}
        </span>
      );
    }
    if (player.userId === currentUserId) {
      // The membership role rides the tooltip (director F2) — legacy conveyed
      // it by badge color; the D-09 delta names the tooltip as its new home.
      // LongPressTooltip keeps a touch path, and the sr-only role text keeps
      // AT informed with no hover at all (PR #193 review round 4).
      return (
        <LongPressTooltip
          delayDuration={200}
          content={`This card is claimed by you${userRole ? ` (${userRole})` : ''}`}
        >
          <span className="inline-flex">
            <Tag variant="label" tone="accent">
              You
              {userRole && <span className="sr-only">({userRole})</span>}
            </Tag>
          </span>
        </LongPressTooltip>
      );
    }
    if (player.linkedUser) {
      const linked = player.linkedUser;
      const label = linked.displayName || linked.discordUsername;
      return (
        <LongPressTooltip
          delayDuration={200}
          content={`Claimed by ${label}${linked.membershipRole ? ` (${linked.membershipRole})` : ''}`}
        >
          <span className="inline-flex">
            <Tag
              variant="label"
              tone="muted"
              icon={
                linked.avatarUrl ? (
                  <SafeAvatar
                    src={linked.avatarUrl}
                    alt=""
                    className="h-3 w-3 shrink-0 rounded-full"
                  />
                ) : undefined
              }
            >
              <span className="max-w-16 truncate">{label}</span>
              {linked.membershipRole && (
                <span className="sr-only">({linked.membershipRole})</span>
              )}
            </Tag>
          </span>
        </LongPressTooltip>
      );
    }
    // Claimed, but `linked_user` didn't come down (it's optional in the API
    // schema). The footer owns the entire claim story under the one-axis
    // ruling, so it must not go blank on a claimed card — name the state even
    // when we can't name the owner (PR #193 review round 5).
    return (
      <Tag variant="label" tone="muted">
        Claimed
      </Tag>
    );
  };

  const dragProps = reorderMode ? { ...dragHandle?.attributes, ...dragHandle?.listeners } : {};

  return (
    // h-full + flex-col + interior flex-1 spacers (below) = legacy PlayerCard's
    // equal-height discipline: every card fills its grid row track, headers at
    // the top, gear + footer pinned to the bottom (C1 checkpoint feedback).
    <div className="relative h-full" onContextMenu={openContextMenu} {...dragProps}>
      <CardShell as="div" className="relative flex h-full flex-col overflow-hidden">
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
                {/* C5 (D-11, LEAN): the Lodestone portrait rides the expanded
                    card's identity avatar (SafeAvatar allowlist + initials
                    fallback are PlayerIdentity's own behavior); compact keeps
                    the initials mark. */}
                <PlayerIdentity
                  name={player.name}
                  job={player.job}
                  role={role}
                  subtitle={identitySubtitle}
                  avatarUrl={
                    isExpanded && hasLodestoneIdentity
                      ? player.lodestoneAvatarUrl ?? undefined
                      : undefined
                  }
                />
              </div>
            )}

            {player.isSubstitute && (
              <Tooltip content="Substitute — a backup for the static's roster">
                <span className="inline-flex">
                  <Tag variant="label" tone="warning">
                    SUB
                  </Tag>
                </span>
              </Tooltip>
            )}
            {showWeaponPriority && (
              <Tooltip
                content={`+${weaponPriorityCount} additional weapon ${
                  weaponPriorityCount === 1 ? 'priority' : 'priorities'
                }`}
              >
                <span className="inline-flex">
                  <Tag
                    variant="label"
                    tone="muted"
                    icon={<Swords className="h-3 w-3" aria-hidden="true" />}
                  >
                    +{weaponPriorityCount}
                  </Tag>
                </span>
              </Tooltip>
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
            {/* C5 (D-10): the Now-vs-BiS breakdown panel explains the readout;
                the placeholder "—" has nothing to explain and stays un-wired.
                The accent color IS the discriminator (legacy parity, director
                F3): accent = equipped average, default = BiS-target average.
                No native title — the panel already says both (director F4). */}
            {displayILv > 0 ? (
              <LongPressTooltip
                delayDuration={200}
                content={
                  <NowVsBisPanel
                    gear={player.gear}
                    tierId={tierId}
                    equippedAvgIlv={equippedAvgIlv}
                    bisAvgIlv={bisAvgIlv}
                  />
                }
              >
                {/* Focusable trigger (PR #193 review round 4): Radix opens the
                    panel on focus, so keyboard users reach the breakdown. Not a
                    button — focusing only reveals information, activation would
                    be a lie. */}
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- tooltip trigger; focus is the keyboard path to the Radix panel */}
                <div
                  tabIndex={0}
                  aria-label="Average item level breakdown"
                  className="cursor-help text-right leading-none"
                >
                  <div
                    className={`font-display text-lg font-bold ${
                      equippedAvgIlv > 0 ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {displayILv}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">iLvl</div>
                </div>
              </LongPressTooltip>
            ) : (
              <div className="text-right leading-none">
                <div className="font-display text-lg font-bold text-text-primary">—</div>
                <div className="text-xs uppercase tracking-wide text-text-tertiary">iLvl</div>
              </div>
            )}
            <IconButton
              aria-label="Player actions"
              variant="ghost"
              size="sm"
              icon={<MoreVertical className="h-5 w-5" />}
              onClick={openKebab}
            />
          </div>
        </div>

        {/* C5 (D-11, LEAN): the roster title is the one personalization line
            the expanded card carries (note + flex chips stay in the editor). */}
        {isExpanded && player.rosterTitle && (
          <p
            className="mt-1 truncate text-xs font-medium text-accent/90"
            data-testid="roster-card-title"
          >
            {player.rosterTitle}
          </p>
        )}

        {/* ── BiS progress line — owns the WHOLE BiS story (one axis per
               location, C1 checkpoint ruling): count when linked, "No BiS" +
               the Import action when not. C5 (D-09) adds the external gearset
               link, and C5 (D-01) extends the block with the expanded-only
               active-target chip below — every BiS concern stays on this axis. ── */}
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
            {hasBis ? `${completedSlots}/${TOTAL_SLOTS} BiS` : 'No BiS'}
          </span>
          {hasBis && player.bisLink && (
            <Tooltip content={bisLinkTooltip(player.bisLink)}>
              <span className="inline-flex shrink-0">
                <LinkText
                  href={buildBisUrl(player.bisLink)}
                  external
                  aria-label={bisLinkTooltip(player.bisLink)}
                  icon={<ExternalLink className="h-3 w-3" aria-hidden="true" />}
                  className="text-xs font-medium"
                >
                  BiS
                </LinkText>
              </span>
            </Tooltip>
          )}
          {!hasBis && canEdit && importAction && (
            <Button variant="secondary" size="xs" onClick={importAction}>
              Import BiS
            </Button>
          )}
        </div>

        {/* C5 (D-01 remainder): expanded-only active BiS target, riding the
            BiS block. Opens the same manager as the kebab's "BiS Targets".
            A nav Tag, not legacy's ghost button — the pill goes somewhere, so
            it carries the chevron (director F7: a clickable thing must LOOK
            clickable). */}
        {isExpanded && activeBisTarget && bisTargetsAction && (
          <div className="mt-1.5">
            <Tag
              variant="nav"
              tone="accent"
              onNavigate={bisTargetsAction}
              icon={<Target className="h-3 w-3" aria-hidden="true" />}
              className="max-w-full"
            >
              <span className="truncate">
                Target: <span className="font-medium">{activeBisTarget.name}</span>
                {activeBisTarget.itemLevel ? ` · iLv ${activeBisTarget.itemLevel}` : ''}
                {bisTargetCount > 1 ? ` (+${bisTargetCount - 1})` : ''}
              </span>
            </Tag>
          </div>
        )}

        {/* ── Gear section: pip strip (compact) or gear table (expanded).
               Either/or, matching legacy PlayerCardGear — the table replaces the
               pips, never stacks under them. The table EDITS (C2, canEditGear-
               gated); the pips inspect-only (hover item card, no cycling —
               legacy compact parity). Spacer placement mirrors legacy
               PlayerCard: compact pads ABOVE the gear (pips + footer align at
               the bottom across cards), expanded pads BELOW the table (footer
               still pinned). ── */}
        {isExpanded ? (
          <>
            <div className="mt-3 border-t border-border-subtle pt-2">
              {/* C3 (D-03): shared fix-all banner — expanded-only, like
                  legacy PlayerCard; permission gating lives inside the leaf. */}
              <BiSSourceFixBanner
                gear={player.gear}
                player={player}
                userRole={userRole}
                currentUserId={currentUserId ?? null}
                isAdminAccess={isAdminAccess}
                onFixAllSources={handleFixAllSources}
              />
              <RosterGearTable
                gear={player.gear}
                tomeWeapon={player.tomeWeapon}
                editable={canCycleGear}
                onSlotChange={handleSlotChange}
                onSourceChange={handleSourceChange}
                onSourceFix={handleSourceFix}
                onTomeWeaponChange={handleTomeWeaponChange}
                hasTomeMaterialEntry={!!tomeMaterialEntry}
                onTomeMaterialJump={handleTomeMaterialJump}
                disabledReason={gearPermission.reason}
              />
            </div>
            <div className="flex-1" />
          </>
        ) : (
          <>
            <div className="flex-1" />
            <div className="mt-3 flex flex-wrap gap-1">
              {player.gear.map((slot) => {
                const pip = (
                  <GearStatusCircle
                    state={toGearState(slot.hasItem, slot.isAugmented)}
                    bisSource={slot.bisSource}
                    requiresAugmentation={requiresAugmentation(slot)}
                    onChange={() => {}}
                    disabled
                    size="sm"
                  />
                );
                // Hover-inspect (C2, D-02 / legacy R-065): pips with item data
                // show the shared item card. The div wrapper takes Radix's
                // Trigger props (GearStatusCircle doesn't forward refs).
                return hasHoverData(slot) ? (
                  <LongPressTooltip
                    key={slot.slot}
                    delayDuration={200}
                    content={
                      <ItemHoverCard
                        itemName={slot.itemName}
                        itemLevel={slot.itemLevel}
                        itemId={slot.itemId}
                        itemIcon={slot.itemIcon}
                        itemStats={slot.itemStats}
                        bisSource={slot.bisSource}
                        hasItem={slot.hasItem}
                        isAugmented={slot.isAugmented}
                        materia={slot.materia}
                        equippedItemId={slot.equippedItemId}
                        equippedItemName={slot.equippedItemName}
                        equippedItemLevel={slot.equippedItemLevel}
                        equippedItemIcon={slot.equippedItemIcon}
                      />
                    }
                  >
                    <div className="inline-flex">{pip}</div>
                  </LongPressTooltip>
                ) : (
                  <div key={slot.slot} className="inline-flex">
                    {pip}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Footer: character link/sync · claim story ──
               C5 (D-12 rider): the sync line names the character; server + sync
               provenance + the job-mismatch explanation live in the hover
               detail (leaner than v1's three-line sync block). A mismatch also
               shows a warning glyph + dot so it never hides behind the hover. ── */}
        <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3 text-xs text-text-tertiary">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${
                showsSync
                  ? syncJobMismatch
                    ? 'bg-status-warning'
                    : 'bg-membership-linked'
                  : 'bg-text-muted'
              }`}
            />
            {showsSync ? (
              /* LongPressTooltip, matching the iLvl panel twelve lines up —
                 same slice, same detail-hover pattern, and it keeps a touch
                 path (director F6). */
              <LongPressTooltip
                delayDuration={200}
                content={
                  <div className="max-w-60 space-y-1">
                    <div className="font-medium">
                      {[player.lodestoneName, player.lodestoneServer].filter(Boolean).join(' • ') ||
                        (player.lastSyncSource === 'player_hub' ? 'Player Hub sync' : 'Gear sync')}
                    </div>
                    <div className="text-xs text-text-secondary">{syncDetail}</div>
                    {syncJobMismatch && (
                      <div className="text-xs text-status-warning">
                        Synced as {player.lastSyncedJob}, player set as {player.job}. The provider
                        may be showing old gear.
                      </div>
                    )}
                  </div>
                }
              >
                <span className="flex min-w-0 cursor-help items-center gap-1">
                  <span className="truncate">{syncName}</span>
                  {syncAge && <span className="shrink-0">· synced {syncAge}</span>}
                  {syncJobMismatch && (
                    <AlertTriangle
                      data-testid="roster-sync-mismatch"
                      aria-label="Synced job differs from the card's job"
                      className="h-3 w-3 shrink-0 text-status-warning"
                    />
                  )}
                </span>
              </LongPressTooltip>
            ) : (
              <span className="truncate">Not synced</span>
            )}
          </span>
          <span className="flex-1" />
          {renderClaimStatus()}
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
