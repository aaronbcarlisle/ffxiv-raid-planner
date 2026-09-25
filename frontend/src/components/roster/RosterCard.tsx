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
 *   - E2 (R-E2-D, option 2b): the header is ONE line that never wraps —
 *     avatar · name · one seat chip (TankSeatSelector for tanks, the unchanged
 *     PositionSelector otherwise, riding PlayerIdentity's name-line slot) ·
 *     iLvl · kebab. SUB and "+N" moved to the subtitle, before the job text;
 *     the job swap moved into the kebab ("Change Job"). Only the name shrinks.
 *   - Job change opens a card-owned confirm (Modal + RadioGroup). C7 (D-15)
 *     restored legacy's third outcome: the RadioGroup's modes are keep /
 *     update (change the job, then hand off to the import) / unlink, and the
 *     commit button names the chosen one. The import modal still lives in the
 *     hook — the card reaches it through the kebab's own opener rather than
 *     duplicating its state.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ExternalLink, MoreVertical, Repeat, Swords, Target } from 'lucide-react';
import {
  CardShell,
  ContextMenu,
  type ContextMenuItem,
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
import {
  buildSlotJumpTargets,
  entryJumpView,
  type JumpAnchorSlot,
  type JumpKind,
  type SlotJumpTargets,
} from './rosterLedgerJumps';
import { resolveLogWeekOverride } from '../loot/useLogWeek';
import { hasHoverData } from './gearHoverData';
import { NowVsBisPanel } from './NowVsBisPanel';
import { bisLinkTooltip, buildBisUrl } from './bisLinkMeta';
import { equippedAverageIlv } from './rosterIlv';
import { Button, IconButton, LongPressTooltip, Popover, PopoverContent, PopoverTrigger, Tooltip } from '../primitives';
import { JobPicker } from '../player/JobPicker';
import { PositionSelector } from '../player/PositionSelector';
import { TankSeatSelector } from '../player/TankSeatSelector';
import {
  useRosterCardActions,
  type RosterCardActions,
} from '../../hooks/useRosterCardActions';
import { toast } from '../../stores/toastStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import { useSharedBisStore } from '../../stores/sharedBisStore';
import type { DragAttributes, DragListeners } from './dragTypes';
import {
  calculateAverageItemLevel,
  computeGearSlotUpdate,
  fromGearState,
  requiresAugmentation,
  toGearState,
  type GearState,
} from '../../utils/calculations';
import { relevantGear } from '../../utils/offhand';
import { playerBisProgress } from '../../utils/playerBisProgress';
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
  /**
   * D12: the gear row a ledger jump landed on, pulsed inside the expanded
   * gear table. The grid forwards it to the highlighted card alone; in
   * compact density there is no table to carry it and the card's own
   * `?player=` pulse is the whole outcome (R-D12-F).
   */
  highlightedSlot?: JumpAnchorSlot | null;
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

/**
 * The three outcomes legacy's job-change confirm offered as three buttons
 * (`PlayerCard.tsx:800-840`): keep the BiS setup, update it (change job, then
 * straight into the import — legacy `confirmJobChange(true)`), or unlink.
 * v2 expresses them as the confirm's radio modes (C7, D-15).
 */
type JobChangeMode = 'keep' | 'import' | 'unlink';

/** Stable empty map for the compact card, which resolves no slot jumps. */
const EMPTY_SLOT_JUMPS: SlotJumpTargets = {};

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
  highlightedSlot = null,
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
  // precedent): the Loot spine tab (PageMode 'gear') + its Log OR History
  // sub-view (R-28's split, below) + the `entry`/`entryType` highlight params
  // both views consume (scroll, pulse, self-clearing after 2.5s).
  const [jumpParams, setSearchParams] = useSearchParams();
  const clockCurrentWeek = useLootTrackingStore((s) => s.currentWeek);
  const clockResolved = useLootTrackingStore((s) => s.weekClockKey === weekClockKeyOf(groupId, tierId));

  // ── R-28 (D12): the entry jump SPLITS by week ──
  // `lview=log` only when the entry sits in the week the Log will display;
  // everything else — older AND newer (R-D12-A) — goes to History. The
  // displayed week is resolved with `useLogWeek`'s OWN resolver (R-D12-B) so
  // the card's decision and the Log's later mount cannot disagree.
  //
  // R-D12-D, load-bearing ABSENCE: no `?week=` is written and `setWeek` is
  // never called. `?week=` is the resolver's first input, so preserving it is
  // what makes this deterministic — and writing one would arm the disclosed
  // legacy-History seeding cohort (`Loot.tsx`'s header) from a screen with no
  // week control on it.
  //
  // R-D12-C (closed by R-DC-E): the Log branch needs a week the Log's MOUNT is
  // guaranteed to land on. A concrete override (`?week=` or a stored week) is
  // one — it pins the week regardless of the clock. "Follow the clock" is one
  // too, but only once THIS tier's fetch has succeeded: `weekClockKey` names
  // the (static, tier) a server response wrote `currentWeek` for, in that same
  // `set`. Until it names this card's own `(groupId, tierId)`, the values are
  // the store's `1/1` start or another tier's (a tier switch whose fetch is
  // still in flight); the Log would mount at that week, walk to the real one
  // when `fetchCurrentWeek` lands, and the entry we asked it to pulse would
  // leave the grid with no second chance, because the highlight effect's deps
  // (`[highlightId, highlightKind]`) never move. Values alone can't tell: week
  // 1 is both the start value and a real week. So a genuinely week-1 tier now
  // routes to the Log, and an unfetched or failed clock keeps History.
  // (It is NOT the `setWeek` clobber it looks like: `Loot.tsx`'s F1/F2 guards
  // already make that unreachable. Checked at plan-vet.)
  const jumpToEntry = useCallback(
    (entryId: number, kind: JumpKind, entryWeek: number | null | undefined) => {
      const override = resolveLogWeekOverride(groupId, tierId, jumpParams.get('week'));
      const displayedWeek = override ?? (clockResolved ? clockCurrentWeek : null);
      const lview = entryJumpView(entryWeek, displayedWeek);
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', 'gear');
        params.set('lview', lview);
        params.set('entry', String(entryId));
        params.set('entryType', kind);
        // One navigation, one highlight: the Log/History views and the Books
        // card read different params on the same route, so a leftover `book`
        // would pulse a second row the user never asked for.
        params.delete('book');
        // The inbound landing params must not ride along on the outbound
        // jump (F-18 hygiene, mirror of `Loot.jumpToRecipient`): a Loot->
        // Roster landing writes `?player=`/`?slot=`, and if this jump left
        // them in place, GroupViewContent's `?player=` effect would re-run
        // on the next render and bounce straight back to Roster.
        params.delete('player');
        params.delete('slot');
        return params;
      });
    },
    // Listing `jumpParams` costs nothing extra: this callback already re-creates
    // on every URL write, because react-router rebuilds `setSearchParams`
    // whenever `searchParams` changes (the churn `NewShell.tsx:241-246`
    // records). If a stable callback is ever wanted, BOTH go behind refs,
    // `Loot.tsx`'s `setSearchParamsRef` style — one ref alone buys nothing.
    [jumpParams, clockResolved, clockCurrentWeek, groupId, tierId, setSearchParams],
  );
  // C7 (D-05): the kebab's Books jump — the same route, the Books card's own
  // highlight param (BookLedgerCard scrolls + pulses `book-row-{playerId}`).
  // Since D7 (R-14) the Books card lives on the Log view, not History — this
  // jump lands there.
  const handleBooksJump = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'gear');
      params.set('lview', 'log');
      params.set('book', player.id);
      params.delete('entry');
      params.delete('entryType');
      // The inbound landing params must not ride along on the outbound jump
      // (F-18 hygiene, mirror of `Loot.jumpToRecipient`): see `jumpToEntry`
      // above for why.
      params.delete('player');
      params.delete('slot');
      return params;
    });
  }, [player.id, setSearchParams]);
  const handleTomeMaterialJump = useCallback(() => {
    if (!tomeMaterialEntry) return;
    jumpToEntry(tomeMaterialEntry.id, 'material', tomeMaterialEntry.weekNumber);
  }, [tomeMaterialEntry, jumpToEntry]);

  // ── Gear → ledger jumps (Phase C C7, D-05) ──
  // Availability and destination come from ONE derivation (legacy split them
  // across GroupViewContent's slot maps and useViewNavigation's finders), so a
  // slot can never advertise a jump that resolves to nothing — which is also
  // why no "No loot entry found" toast is needed here (legacy's finder could
  // miss; this one cannot).
  // Only the EXPANDED card mounts the gear table, and the resolver walks both
  // logs across 11 slots per card — so a compact grid would pay that for
  // nothing (PR #200 review). The tome sub-row's own jump is unaffected: it
  // reads the single `tomeMaterialEntry` above, not this map.
  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const slotJumps = useMemo(
    () => (isExpanded ? buildSlotJumpTargets(lootLog, materialLog, player.id) : EMPTY_SLOT_JUMPS),
    [isExpanded, lootLog, materialLog, player.id]
  );
  const handleSlotJump = useCallback(
    (slot: GearSlot, kind: JumpKind) => {
      const entryId = slotJumps[slot]?.[kind];
      if (entryId == null) return;
      // The week is looked up here rather than carried on `SlotJumpTarget`:
      // that module's contract is "availability IS the target — one pass
      // produces the id", and routing is this card's concern, not its.
      const entry = kind === 'loot'
        ? lootLog.find((e) => e.id === entryId)
        : materialLog.find((e) => e.id === entryId);
      jumpToEntry(entryId, kind, entry?.weekNumber);
    },
    [slotJumps, lootLog, materialLog, jumpToEntry],
  );

  // ── Local UI state (name edit + job change) ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(player.name);
  const editingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const kebabRef = useRef<HTMLButtonElement>(null);
  const jobPickerRef = useRef<HTMLDivElement>(null);
  const [pendingJob, setPendingJob] = useState<string | null>(null);
  const [jobChangeMode, setJobChangeMode] = useState<JobChangeMode>('keep');
  const [hookModalOpen, setHookModalOpen] = useState(false);

  const booksAwareActions = useMemo(
    () => ({ ...actions, onEditBooks: handleBooksJump }),
    [actions, handleBooksJump]
  );

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
      // C7 (D-05): the Books jump is supplied HERE, not by the grid — all of
      // the card's ledger navigation writes the same URL params from one place
      // (the grid's `actionsForPlayer` stays a pure data/mutation contract).
      actions: booksAwareActions,
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
  // The seat chip and the subtitle tags now live inside the rename target
  // (R-E2-D), and their portaled popovers are its React children, so a
  // double-click that lands on a control, or outside the wrapper's own DOM,
  // belongs to that control — never a rename.
  const onIdentityDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target)) return;
    const control = target.closest('button, a, input, [role="button"]');
    if (control && e.currentTarget.contains(control)) return;
    beginNameEdit();
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
  // Closing the picker hands focus back to the kebab, its way in (R-E2-D).
  // Radix would return it to the Popover's trigger, but that is the inert
  // anchor span, so focus would fall to <body>. Only when focus was INSIDE
  // the picker (Escape, a pick): an outside click or a Tab-away already put
  // focus where the user sent it — Radix's own hasInteractedOutside rule.
  const closeJobPicker = () => {
    const focusWasInside = jobPickerRef.current?.contains(document.activeElement) ?? false;
    setShowJobPicker(false);
    if (focusWasInside) kebabRef.current?.focus();
  };
  const onJobPicked = (newJob: string) => {
    // Before the confirm opens, so the Modal records the kebab as its
    // return-focus target.
    closeJobPicker();
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
    const handOffToImport = jobChangeMode === 'import';
    setPendingJob(null);
    // A10 mutation shape — see commitName.
    try {
      await actions.onUpdate(updates);
      // C7 (D-15): the restored third outcome — legacy's "Change Job & Update
      // BiS" committed the change and then opened the import
      // (PlayerCard.confirmJobChange(true), :233). v2 reaches the SAME modal
      // through the kebab's own opener (the C5 getMenuAction pattern) rather
      // than duplicating the import's state here. Hand off only after the
      // mutation resolves: a failed job change must not drop the user into an
      // import for a job the card never switched to.
      if (handOffToImport) importAction?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change job');
    }
  };

  // ── Derived display ──
  // Relevant slots only: an empty offhand off-PLD neither renders nor counts.
  // The fraction is the shared per-player helper the Board prints too (R-E2-F).
  const countedGear = relevantGear(player.job, player.gear);
  const { completed: completedSlots, total: totalSlots } = playerBisProgress(player);
  const ratio = completedSlots / totalSlots;
  const hasBis = !!player.bisLink;

  // C5 (D-10): the readout prefers the equipped average from sync data when it
  // covers at least half the slots (legacy PlayerCardHeader parity); the
  // NowVsBisPanel hover explains the number either way. The shared helper
  // keeps this expression identical to the GearBoard subtitle (director F3).
  const bisAvgIlv = calculateAverageItemLevel(player.gear, tierId, player.job);
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
  // Without a Lodestone identity the tooltip's header has nothing to name but
  // the source, so the detail line drops it there rather than saying it twice
  // (round 7).
  const syncDetail = (() => {
    if (!syncAge) return 'Lodestone identity linked';
    const parts = [syncAge === 'just now' ? 'Synced just now' : `Last synced ${syncAge}`];
    if (player.lastSyncSource && hasLodestoneIdentity) {
      parts.push(formatSource(player.lastSyncSource));
    }
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

  const jobLine = [getJobDisplayName(player.job), player.lodestoneServer]
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

  // R-E2-D (2b): the job swap left the header for the kebab. Same gate as the
  // IconButton it replaces — present only when the card is editable (the
  // button was hidden, never disabled) — and the same flow: the JobPicker
  // popover, then the card-owned confirm. Slotted before "Flex Roles", its
  // job-shaped neighbor.
  const cardMenuItems = useMemo((): ContextMenuItem[] => {
    if (!canEdit) return menuItems;
    const changeJob: ContextMenuItem = {
      label: 'Change Job',
      icon: <Repeat className="h-4 w-4" />,
      onClick: () => setShowJobPicker(true),
    };
    const at = menuItems.findIndex((i) => 'label' in i && i.label === 'Flex Roles');
    return at < 0 ? [changeJob, ...menuItems] : [...menuItems.slice(0, at), changeJob, ...menuItems.slice(at)];
  }, [canEdit, menuItems]);

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
              {userRole && <span className="sr-only"> ({userRole})</span>}
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
                <span className="sr-only"> ({linked.membershipRole})</span>
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

  // ── R-E2-D (2b): the header's ONE seat chip ──
  // Tanks get the merged role+position chip; everyone else keeps today's
  // PositionSelector. Both call the handlers the two separate chips did.
  const seatChip =
    role === 'tank' ? (
      <TankSeatSelector
        tankRole={player.tankRole}
        position={player.position}
        onTankRoleSelect={(tankRole) => actions.onUpdate({ tankRole: tankRole ?? null })}
        onPositionSelect={(position) => actions.onUpdate({ position: position ?? null })}
        player={player}
        userRole={userRole}
        currentUserId={currentUserId ?? undefined}
        isAdmin={isAdminAccess}
      />
    ) : (
      <PositionSelector
        position={player.position}
        role={player.role}
        onSelect={(position) => actions.onUpdate({ position: position ?? null })}
        player={player}
        userRole={userRole}
        currentUserId={currentUserId ?? undefined}
        isAdmin={isAdminAccess}
      />
    );

  // ── R-E2-D (2b): SUB and "+N" ride the subtitle, BEFORE the job text ──
  // Both tags are shrink-0 and the job text truncates first. They keep the
  // claim badges' treatment (review rounds 4 + 7): LongPressTooltip for the
  // touch path, plus sr-only text so the meaning survives with no hover at
  // all — "+1" over a Swords glyph says nothing on its own.
  const hasSubtitle = Boolean(player.isSubstitute || showWeaponPriority || jobLine);
  const identitySubtitle = hasSubtitle ? (
    <span data-testid="roster-card-subtitle" className="flex min-w-0 items-center gap-1.5">
      {player.isSubstitute && (
        <LongPressTooltip
          delayDuration={200}
          content={
            <span aria-hidden="true">Substitute — a backup for the static&apos;s roster</span>
          }
        >
          <span className="inline-flex shrink-0">
            <Tag variant="label" tone="warning">
              SUB
              <span className="sr-only">
                {' '}
                Substitute — a backup for the static&apos;s roster
              </span>
            </Tag>
          </span>
        </LongPressTooltip>
      )}
      {showWeaponPriority && (
        <LongPressTooltip
          delayDuration={200}
          content={
            <span aria-hidden="true">
              +{weaponPriorityCount} additional weapon{' '}
              {weaponPriorityCount === 1 ? 'priority' : 'priorities'}
            </span>
          }
        >
          <span className="inline-flex shrink-0">
            <Tag
              variant="label"
              tone="muted"
              icon={<Swords className="h-3 w-3" aria-hidden="true" />}
            >
              +{weaponPriorityCount}
              <span className="sr-only">
                {' '}
                additional weapon {weaponPriorityCount === 1 ? 'priority' : 'priorities'}
              </span>
            </Tag>
          </span>
        </LongPressTooltip>
      )}
      {jobLine && <span className="min-w-0 truncate">{jobLine}</span>}
    </span>
  ) : undefined;

  // ── C7 (D-55, R-062): Shift+Click the card copies its deep link ──
  // The ruled superuser affordance: a modifier-click, taught by the kebab's
  // hint tooltip (R-076) rather than advertised by a control. The kebab's
  // "Copy URL" item stays alongside it (user ruling 2026-07-27) — it is the
  // keyboard-reachable route to the same link. Legacy parity down to the
  // details (`PlayerCard.tsx:517-538`): mousedown is suppressed so the modifier
  // click doesn't flash focus, the selection Shift+Click creates is cleared,
  // and focus is dropped so no focus ring is left behind.
  // dnd-kit's PointerSensor listens on pointerdown, so these never collide with
  // reorder dragging.
  const copyUrl = actions.onCopyUrl;
  // Both handlers are scoped to the card SURFACE. The card's menus and modals
  // portal out of the DOM but stay React children of this element, and React
  // bubbles synthetic events through the REACT tree — so without this guard a
  // Shift+Click on the kebab's "Copy URL" would fire the item AND this handler
  // (two writes, two toasts, on exactly the item the D-55 ruling kept as the
  // announced route), and a Shift+mousedown inside a modal would lose its
  // text-selection extend to the preventDefault below (PR #200 review).
  const fromOverlay = (e: React.MouseEvent) =>
    !!(e.target as HTMLElement | null)?.closest?.('[role="menu"],[role="dialog"]');
  const handleCardMouseDown = (e: React.MouseEvent) => {
    if (e.shiftKey && copyUrl && !fromOverlay(e)) e.preventDefault();
  };
  const handleCardClick = (e: React.MouseEvent) => {
    if (!e.shiftKey || !copyUrl || fromOverlay(e)) return;
    e.preventDefault();
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    copyUrl();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  return (
    // h-full + flex-col + interior flex-1 spacers (below) = legacy PlayerCard's
    // equal-height discipline: every card fills its grid row track, headers at
    // the top, gear + footer pinned to the bottom (C1 checkpoint feedback).
    /* design-system-ignore: the card body is NOT a control — its only click
       behaviour is the ruled Shift+Click deep-link copy (D-55), and a plain
       click deliberately does nothing. A role here would announce the whole
       card as activatable and promise a plain-click action that must never
       exist; the kebab's "Copy URL" item is the announced, keyboard-reachable
       equivalent. Legacy did the same on `PlayerCard.tsx:544`. */
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- see the design-system-ignore above: a keyboard handler here would create the plain-activation path the D-55 ruling forbids; the kebab's "Copy URL" item is the keyboard route.
    <div
      // Task 1 (feedback-polish): grab-cursor affordance while reorder mode
      // is active (PlayerCard.tsx:885 precedent) — the only visual cue that
      // the whole card is draggable, scoped to reorder mode so it never
      // implies draggability outside it.
      className={`relative h-full${reorderMode ? ' cursor-grab active:cursor-grabbing' : ''}`}
      onContextMenu={openContextMenu}
      {...dragProps}
      onMouseDown={handleCardMouseDown}
      onClick={handleCardClick}
    >
      <CardShell as="div" className="relative flex h-full flex-col overflow-hidden">
        {/* Role-colored accent edge (semantic role var → token-compliant). */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: getRoleColor(role) }}
        />

        {/* ── Header: identity · iLvl · kebab — ONE line that never wraps
               (R-E2-D, 2b). Only the name shrinks: the seat chip rides the
               name line through PlayerIdentity's slot, SUB/"+N" ride the
               subtitle, and the right block is shrink-0. ── */}
        <div data-testid="roster-card-header" className="relative flex items-start justify-between gap-3">
          {isEditingName ? (
            // The input fills the identity's whole width while editing (the
            // seat chip and subtitle step aside, as the whole identity always
            // did) — a V2-local wrapper plus Input's own `fullWidth`, so
            // `ui/Input` is untouched for its other callers.
            <div className="min-w-0 flex-1">
              <Input
                ref={nameInputRef}
                value={draftName}
                onChange={setDraftName}
                onBlur={commitName}
                onKeyDown={onNameKeyDown}
                aria-label="Player name"
                size="sm"
                fullWidth
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1" onDoubleClick={onIdentityDoubleClick}>
              {/* C5 (D-11, LEAN): the Lodestone portrait rides the expanded
                  card's identity avatar (SafeAvatar allowlist + initials
                  fallback are PlayerIdentity's own behavior); compact keeps
                  the initials mark. The name's hover text carries the full
                  name, since the name is what truncates. */}
              <PlayerIdentity
                name={player.name}
                nameTitle={canEdit ? `${player.name} — double-click to rename` : player.name}
                nameAdornment={seatChip}
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
                    job={player.job}
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
                <div tabIndex={0} className="cursor-help text-right leading-none">
                  <div
                    className={`font-display text-lg font-bold ${
                      equippedAvgIlv > 0 ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {displayILv}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-text-tertiary">iLvl</div>
                  {/* Framing rides ALONGSIDE the number, never as an aria-label
                      over it — the number is what AT must hear (round 8). */}
                  <span className="sr-only"> — average item level breakdown</span>
                </div>
              </LongPressTooltip>
            ) : (
              <div className="text-right leading-none">
                <div className="font-display text-lg font-bold text-text-primary">—</div>
                <div className="text-xs uppercase tracking-wide text-text-tertiary">iLvl</div>
              </div>
            )}
            {/* C7 (D-55, R-076): the kebab teaches the card's modifier-clicks
                — the discovery route for affordances the ruling keeps
                deliberately unadvertised. The heading repeats the trigger's
                accessible name, so it is hidden from the description Radix
                wires up (aria-describedby would otherwise announce it twice);
                the shortcut rows are the part worth hearing. The Shift row
                appears only when the card can actually copy. */}
            <Tooltip
              content={
                <div className="space-y-1.5">
                  <div aria-hidden="true" className="font-medium">
                    Player Options
                  </div>
                  <div className="space-y-1 text-xs">
                    {copyUrl && (
                      <div className="flex items-center gap-2">
                        <kbd className="rounded border border-border-default bg-surface-base px-1 py-0.5 font-mono text-xs">
                          Shift+Click
                        </kbd>
                        <span className="text-text-secondary">Copy link</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <kbd className="rounded border border-border-default bg-surface-base px-1 py-0.5 font-mono text-xs">
                        Right-click
                      </kbd>
                      <span className="text-text-secondary">More options</span>
                    </div>
                  </div>
                </div>
              }
            >
              <IconButton
                ref={kebabRef}
                aria-label="Player actions"
                variant="ghost"
                size="sm"
                icon={<MoreVertical className="h-5 w-5" />}
                // The kebab is the job picker's way in now (R-E2-D), so it
                // also closes it: `openKebab` stops the click's propagation,
                // which Radix reads as an intercepted outside click and would
                // otherwise leave the picker open under the menu.
                onClick={(e) => {
                  setShowJobPicker(false);
                  openKebab(e);
                }}
              />
            </Tooltip>
          </div>

          {canEdit && (
            // The kebab's "Change Job" opens this (R-E2-D). Task 2
            // (feedback-polish) portals it — CardShell's overflow-hidden
            // clipped the un-portaled dropdown — and neutralizes
            // PopoverContent's own decoration (!bg/!border/!shadow/!p-0) so
            // JobPicker's standalone panel is the ONLY visible box. The
            // Popover primitive exports no Anchor part, so a zero-size,
            // pointer-inert, aria-hidden trigger under the header's left
            // edge places it where the old swap button did; nothing can
            // reach it, so the menu item is the only way in.
            <Popover
              open={showJobPicker}
              onOpenChange={(open) => (open ? setShowJobPicker(true) : closeJobPicker())}
            >
              <PopoverTrigger asChild>
                <span
                  aria-hidden="true"
                  data-testid="roster-card-job-anchor"
                  className="pointer-events-none absolute bottom-0 left-0 h-0 w-0"
                />
              </PopoverTrigger>
              <PopoverContent
                ref={jobPickerRef}
                align="start"
                sideOffset={4}
                className="!border-0 !bg-transparent !p-0 !shadow-none"
              >
                <JobPicker
                  selectedJob={player.job}
                  onJobSelect={onJobPicked}
                  onRequestClose={closeJobPicker}
                  hostControlsDismissal
                />
              </PopoverContent>
            </Popover>
          )}
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
            {hasBis ? `${completedSlots}/${totalSlots} BiS` : 'No BiS'}
          </span>
          {hasBis && player.bisLink && (
            /* The tooltip is the SIGHTED path only: its text is already the
               link's accessible name, and Radix wires content as
               aria-describedby, so leaving it announced repeats the name on
               focus (review round 9). */
            <Tooltip content={<span aria-hidden="true">{bisLinkTooltip(player.bisLink)}</span>}>
              <span className="inline-flex shrink-0">
                <LinkText
                  href={buildBisUrl(player.bisLink)}
                  external
                  /* WCAG 2.5.3, Label in Name: the visible word leads the
                     accessible name, so "click BiS" works in voice control. */
                  aria-label={`BiS — ${bisLinkTooltip(player.bisLink)}`}
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
                job={player.job}
                editable={canCycleGear}
                onSlotChange={handleSlotChange}
                onSourceChange={handleSourceChange}
                onSourceFix={handleSourceFix}
                onTomeWeaponChange={handleTomeWeaponChange}
                hasTomeMaterialEntry={!!tomeMaterialEntry}
                onTomeMaterialJump={handleTomeMaterialJump}
                slotJumps={slotJumps}
                onSlotJump={handleSlotJump}
                playerId={player.id}
                highlightedSlot={highlightedSlot}
                disabledReason={gearPermission.reason}
              />
            </div>
            <div className="flex-1" />
          </>
        ) : (
          <>
            <div className="flex-1" />
            <div className="mt-3 flex flex-wrap gap-1">
              {countedGear.map((slot) => {
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
                        (player.lastSyncSource ? formatSource(player.lastSyncSource) : 'Gear sync')}
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
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- tooltip trigger; focus is the keyboard path to the Radix detail */}
                <span tabIndex={0} className="flex min-w-0 cursor-help items-center gap-1">
                  <span className="truncate">{syncName}</span>
                  {syncAge && <span className="shrink-0">· synced {syncAge}</span>}
                  {syncJobMismatch && (
                    <AlertTriangle
                      data-testid="roster-sync-mismatch"
                      aria-label="Synced job differs from the card's job"
                      className="h-3 w-3 shrink-0 text-status-warning"
                    />
                  )}
                  {/* Framing alongside the name/age, not an aria-label over
                      them (round 8). */}
                  <span className="sr-only"> — sync details</span>
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

      {/* Kept mounted with `isOpen` toggling (not `pendingJob &&`): Modal
          returns focus to its opener only on an isOpen -> false transition,
          which an unmount never delivers. */}
      <Modal
        isOpen={pendingJob !== null}
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
          <span className="font-medium text-text-primary">{getJobDisplayName(pendingJob ?? '')}</span>?
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
              value: 'import',
              label: 'Update BiS for the new job',
              description: 'Changes the job, then opens the BiS import for the new set.',
            },
            {
              value: 'unlink',
              label: 'Unlink BiS on change',
              description: 'Clears the BiS link (the new job needs its own set). Progress is kept.',
            },
          ]}
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => setPendingJob(null)}>
            Cancel
          </Button>
          {/* The commit button names the chosen outcome — in the import mode
              that is legacy's exact button string (user ruling 2026-07-27),
              so the flow reads the same as v1's three-button confirm. */}
          <Button type="button" variant="primary" onClick={commitJobChange}>
            {jobChangeMode === 'import' ? 'Change Job & Update BiS' : 'Change Job'}
          </Button>
        </div>
      </Modal>

      {contextMenu && (
        <ContextMenu
          items={cardMenuItems}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeKebab}
        />
      )}
    </div>
  );
}
