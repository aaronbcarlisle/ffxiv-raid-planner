/**
 * RosterCards — v2 party-grouped card grid (F6c Roster · Cards).
 *
 * The Cards view's body: groups the roster into Light Party 1 / Light Party 2
 * / Unassigned / Substitutes sections (reusing `groupPlayersByLightParty`) and
 * renders one `RosterCard` (Task 5) per configured player, or a dashed
 * `EmptyStateInvite` "open seat" card for an unconfigured position. Visual
 * target: `mockups/02-roster-cards.html` `.party-head` + `.pcards`; behaviour:
 * `design/redesign/specs/2026-07-01-f6c-roster-design.md` §5.6.
 *
 * Reorder mode (Task 7): when `reorderMode` is on, the whole card body is wrapped
 * in a single dnd-kit `DndContext` (sensors + `pointerWithin` collision + the four
 * handlers from the legacy `useDragAndDrop` hook) and every configured card is made
 * a droppable + draggable via the small `DraggableRosterCard` wrapper below —
 * mirroring the legacy `DroppablePlayerCard` (a `data-droppable-id` node the hook's
 * pointer tracking reads, plus the drag-store swap/insert visual feedback). The
 * card root itself receives the `dragHandle` (attributes/listeners from
 * `useDraggable`). When `reorderMode` is off the component renders exactly as before
 * — a plain static grid with no `DndContext` and no drag handles.
 *
 * Reuse note (source-of-truth API, NOT the brief's loose wording): `useDragAndDrop`
 * does NOT use `SortableContext`/`useSortable`. It pairs a `DndContext` +
 * `pointerWithin` with per-card `useDroppable`/`useDraggable` + a `dragStore`
 * (see `GroupViewContent`'s wiring and `DroppablePlayerCard`). We reuse that exact
 * shape; cross-group G1↔G2 swap is preserved by feeding the flat `players` array
 * and `groupView` to the hook (its `calculateSwapUpdates`/`calculateInsertUpdates`
 * do the position swap). Drag is suppressed while a card modal is open via the
 * hook's `disabled` → 999999 sensor-distance path, fed by an internal open-modal
 * counter bumped by the cards' `onModalOpen`/`onModalClose`.
 *
 * Deliberate design decisions (documented to pre-empt review false-positives):
 *   - `actionsForPlayer` is a **per-player factory**, not a shared object.
 *     Every callback in `RosterCardActions` (`useRosterCardActions.tsx:84-98`
 *     — `onUpdate`, `onCopy`, `onDuplicate`, `onRemove`, etc.) takes no
 *     `playerId` and is invoked bare inside the card/hook, so each card's
 *     actions must already be bound to that card's player — exactly like
 *     legacy `PlayerGrid`'s `PlayerCardRenderer`, which wraps playerId-taking
 *     handlers in a `useCallback` per player. `renderPlayer` calls
 *     `actionsForPlayer(player)` per card so Task 10's assembly (which wires
 *     `usePlayerActions`' playerId-taking handlers) only has to supply one
 *     factory function, not pre-bind N objects itself. `onAddPlayer` is the
 *     one genuinely global action (opens the add flow) and is a separate,
 *     ungrouped prop.
 *   - Open-seat derivation = `!player.configured` (mirrors legacy `PlayerGrid`
 *     / `EmptySlotCard`, NOT "position with no player" — an unconfigured
 *     template slot already carries a position/templateRole from the wizard,
 *     it just isn't filled in yet).
 *   - Party-tag styling is a single neutral `Tag tone="muted"` for G1/G2/SUB —
 *     this matches the *actual* `02-roster-cards.html` `.party-tag` CSS (all
 *     three share one neutral token style; only the SUB label's text color is
 *     overridden to `membership-linked`). The old legacy `LightPartyHeader`'s
 *     ad-hoc blue/red raw-color badges are NOT the reuse target — spec §7
 *     ("no raw palette") is explicit that G1/G2 do not get distinct hues in v2.
 *   - "Recruit" (Static Finder) is deferred — `EmptyStateInvite` renders a
 *     single "Add player" action wired to `onAddPlayer`. Recruiting from the
 *     Static Finder is a separate, not-yet-built screen (REDESIGN_SPEC §5.6
 *     Static Finder), out of scope here.
 */
import { useCallback, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { CardShell, EmptyStateInvite, PlayerIdentity, ProgressBar, Tag } from '../ui';
import { RosterCard } from './RosterCard';
import type { DragAttributes, DragListeners } from '../player/DroppablePlayerCard';
import { useDragAndDrop, type PlayerUpdate } from '../dnd/useDragAndDrop';
import { useDragStore } from '../../stores/dragStore';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import { groupPlayersByLightParty } from '../../utils/calculations';
import { bisSlotTotals } from '../../utils/rosterReadiness';
import { TEMPLATE_ROLE_INFO } from '../../utils/constants';
import { getValidRole } from '../../gamedata';
import type { ContentType, MemberRole, SnapshotPlayer } from '../../types';

/** Mockup `.pcards`: `repeat(auto-fill, minmax(330px, 1fr))`, ~14px gap. */
const PCARDS_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-3.5';

export interface RosterCardsProps {
  players: SnapshotPlayer[];
  /** Light-Party (G1/G2/Unassigned) grouping vs a single flat grid. */
  groupView: boolean;
  /** Whether substitutes render in their own section. */
  subsView: boolean;
  /** Hides the substitutes section entirely (roster toolbar setting). */
  subsHidden: boolean;
  /** Drag-to-reorder mode. When on, cards become drag-to-reorder (see file head). */
  reorderMode: boolean;
  canManage: boolean;
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isAdminAccess: boolean;
  clipboardPlayer: SnapshotPlayer | null;
  // ── Shared context, forwarded straight through to every RosterCard ──
  groupId?: string;
  tierId?: string;
  contentType?: ContentType;
  /** All tier players (for AssignUserModal). Defaults to `players` when omitted. */
  allPlayers?: SnapshotPlayer[];
  isAdmin?: boolean;
  userHasClaimedPlayer?: boolean;
  onModalOpen?: () => void;
  onModalClose?: () => void;
  /**
   * Per-player action factory — called once per rendered `RosterCard` (and
   * NOT shared) so each card's kebab mutations are bound to that card's
   * player, mirroring legacy `PlayerGrid`'s per-player `useCallback` binding.
   */
  actionsForPlayer: (player: SnapshotPlayer) => RosterCardActions;
  /** The one genuinely global action — opens the add-player flow. */
  onAddPlayer: () => void;
  /**
   * GRID-level reorder handler (NOT a per-player action). Signature matches
   * `useDragAndDrop`'s `onReorder`: given the batch of `{ playerId, data }`
   * sortOrder/position updates a drag produced, persist them. Task 10 sources
   * this from `usePlayerActions`' reorder handler. Optional so the grid renders
   * standalone (defaults to a no-op); only invoked in reorder mode.
   */
  onReorder?: (updates: PlayerUpdate[]) => Promise<void>;
}

/** Stable no-op so reorder mode works even before Task 10 wires a real handler. */
const NOOP_REORDER = async (): Promise<void> => {};

/**
 * Per-card droppable + draggable wrapper (reorder mode only). Mirrors the legacy
 * `DroppablePlayerCard`: registers the card as a dnd-kit droppable + draggable,
 * carries the `data-droppable-id` the hook's pointer tracking reads, and paints
 * the drag-store swap/insert feedback. The card root itself gets the drag handle
 * via `render(dragHandle)`.
 */
interface DraggableRosterCardProps {
  player: SnapshotPlayer;
  /** Reorder is a roster-manage action — disables per-card DnD when false. */
  canManage: boolean;
  children: (dragHandle: { attributes: DragAttributes; listeners: DragListeners }) => ReactNode;
}

function DraggableRosterCard({ player, canManage, children }: DraggableRosterCardProps) {
  // Per-card slices of the drag store: only the dragged card + current drop
  // target re-render during a drag (not the whole grid).
  const isBeingDragged = useDragStore((s) => s.activeId === player.id);
  const dropTargetMode = useDragStore((s) =>
    s.overId === player.id && s.activeId !== player.id ? s.dropMode : null,
  );

  const { setNodeRef: setDroppableRef } = useDroppable({ id: player.id, disabled: !canManage });
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
  } = useDraggable({ id: player.id, disabled: !canManage });

  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  const showSwap = dropTargetMode === 'swap';
  const showInsertBefore = dropTargetMode === 'insert-before';
  const showInsertAfter = dropTargetMode === 'insert-after';

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={player.id}
      style={{ opacity: isBeingDragged ? 0.3 : 1 }}
      className={`relative rounded-lg transition-all duration-150 ${
        showSwap ? 'ring-2 ring-accent shadow-lg shadow-accent/20' : ''
      }`}
    >
      {showInsertBefore && (
        <div className="pointer-events-none absolute inset-y-0 -left-2 z-10 w-1 rounded-full bg-accent shadow-lg shadow-accent/50" />
      )}
      {children({ attributes, listeners })}
      {showInsertAfter && (
        <div className="pointer-events-none absolute inset-y-0 -right-2 z-10 w-1 rounded-full bg-accent shadow-lg shadow-accent/50" />
      )}
    </div>
  );
}

/**
 * The dnd-kit drag ghost for reorder mode. Subscribes to just `activeId` so it
 * re-renders only on drag start/end. A lightweight v2 ghost (identity in a
 * CardShell) — not the legacy `DragOverlayCard` (that renders a `PlayerCard`).
 */
function RosterCardsDragOverlay({ players }: { players: SnapshotPlayer[] }) {
  const activeId = useDragStore((s) => s.activeId);
  const dragged = activeId ? players.find((p) => p.id === activeId) : null;

  return (
    <DragOverlay dropAnimation={null}>
      {dragged && dragged.configured && (
        <CardShell as="div" className="pointer-events-none w-[330px] opacity-95 shadow-xl">
          <PlayerIdentity name={dragged.name} job={dragged.job} role={getValidRole(dragged.role)} />
        </CardShell>
      )}
    </DragOverlay>
  );
}

/** "Tank" / "Healer" / "Melee" / ... label for an unconfigured seat's role. */
function emptySeatRoleLabel(player: SnapshotPlayer): string {
  if (player.templateRole) return TEMPLATE_ROLE_INFO[player.templateRole].shortLabel;
  const role = getValidRole(player.role);
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Aggregate BiS ratio (obtained / total BiS slots) across a party's roster. */
function partyBisRatio(partyPlayers: SnapshotPlayer[]): number {
  const { obtained, total } = bisSlotTotals(partyPlayers);
  return total > 0 ? obtained / total : 0;
}

interface PartyHeadProps {
  tag: string;
  label: string;
  /** Omitted entirely for the Substitutes head — no bar, per spec §5.6. */
  ratio?: number;
  tagClassName?: string;
}

/** Fresh v2 party-head row (G1/G2/SUB badge + name + aggregate BiS bar). */
function PartyHead({ tag, label, ratio, tagClassName }: PartyHeadProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Tag variant="label" tone="muted" className={tagClassName}>
        {tag}
      </Tag>
      <span className="text-xs font-bold uppercase tracking-wide text-text-tertiary">{label}</span>
      {ratio != null && (
        <div className="ml-auto flex items-center gap-2">
          <ProgressBar value={ratio} ariaLabel={`${label} BiS progress`} className="w-28" />
          <span className="text-xs text-text-tertiary">{Math.round(ratio * 100)}% BiS</span>
        </div>
      )}
    </div>
  );
}

export function RosterCards({
  players,
  groupView,
  subsView,
  subsHidden,
  reorderMode,
  canManage,
  userRole,
  currentUserId,
  isAdminAccess,
  clipboardPlayer,
  groupId,
  tierId,
  contentType,
  allPlayers,
  isAdmin,
  userHasClaimedPlayer,
  onModalOpen,
  onModalClose,
  actionsForPlayer,
  onAddPlayer,
  onReorder,
}: RosterCardsProps) {
  // Open-modal counter → drives the hook's `disabled` (999999 sensor distance),
  // suppressing drag while any card modal is open. The cards report open/close via
  // `onModalOpen`/`onModalClose`; we bump the counter AND forward to the parent so
  // upstream (Task 10 assembly) can still observe modal state.
  const [openModalCount, setOpenModalCount] = useState(0);
  const handleCardModalOpen = useCallback(() => {
    setOpenModalCount((n) => n + 1);
    onModalOpen?.();
  }, [onModalOpen]);
  const handleCardModalClose = useCallback(() => {
    setOpenModalCount((n) => Math.max(0, n - 1));
    onModalClose?.();
  }, [onModalClose]);

  // Legacy DnD hook — sensors + drag handlers + cross-group swap logic. Called
  // unconditionally (hooks rule); its output is only consumed in reorder mode.
  const dnd = useDragAndDrop({
    players,
    groupView,
    canEdit: canManage,
    disabled: !reorderMode || !canManage || openModalCount > 0,
    onReorder: onReorder ?? NOOP_REORDER,
  });

  const renderConfiguredCard = (
    player: SnapshotPlayer,
    dragHandle?: { attributes: DragAttributes; listeners: DragListeners },
  ): ReactNode => (
    <RosterCard
      key={player.id}
      player={player}
      userRole={userRole}
      currentUserId={currentUserId}
      isAdminAccess={isAdminAccess}
      canManage={canManage}
      clipboardPlayer={clipboardPlayer}
      reorderMode={reorderMode}
      dragHandle={dragHandle}
      actions={actionsForPlayer(player)}
      groupId={groupId}
      tierId={tierId}
      contentType={contentType}
      allPlayers={allPlayers ?? players}
      isAdmin={isAdmin}
      userHasClaimedPlayer={userHasClaimedPlayer}
      onModalOpen={handleCardModalOpen}
      onModalClose={handleCardModalClose}
    />
  );

  const renderPlayer = (player: SnapshotPlayer): ReactNode => {
    if (!player.configured) {
      const roleLabel = emptySeatRoleLabel(player);
      return (
        <div key={player.id} className="relative">
          <CardShell as="div" className="relative overflow-hidden border-dashed">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
              style={{ backgroundColor: 'var(--color-border-default)' }}
            />
            <EmptyStateInvite
              icon={<Plus className="h-5 w-5" />}
              title={`Open seat · ${roleLabel}`}
              description={
                player.position
                  ? `Add a player to fill the ${player.position} slot.`
                  : `Add a player to fill this ${roleLabel.toLowerCase()} slot.`
              }
              action={{ label: 'Add player', onClick: onAddPlayer }}
            />
          </CardShell>
        </div>
      );
    }

    // Reorder mode: only configured players are draggable (mirrors legacy —
    // empty seats stay static). Off: a plain card.
    if (reorderMode) {
      return (
        <DraggableRosterCard key={player.id} player={player} canManage={canManage}>
          {(dragHandle) => renderConfiguredCard(player, dragHandle)}
        </DraggableRosterCard>
      );
    }
    return renderConfiguredCard(player);
  };

  let body: ReactNode;
  if (groupView) {
    const grouped = groupPlayersByLightParty(players, subsView);
    const showSubs = subsView && !subsHidden && grouped.substitutes.length > 0;

    body = (
      <div className="space-y-7">
        {grouped.group1.length > 0 && (
          <div>
            <PartyHead tag="G1" label="Light Party 1" ratio={partyBisRatio(grouped.group1)} />
            <div className={`mt-3 ${PCARDS_GRID}`}>{grouped.group1.map(renderPlayer)}</div>
          </div>
        )}

        {grouped.group2.length > 0 && (
          <div>
            <PartyHead tag="G2" label="Light Party 2" ratio={partyBisRatio(grouped.group2)} />
            <div className={`mt-3 ${PCARDS_GRID}`}>{grouped.group2.map(renderPlayer)}</div>
          </div>
        )}

        {grouped.unassigned.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
              Unassigned
            </h3>
            <div className={`mt-3 ${PCARDS_GRID}`}>{grouped.unassigned.map(renderPlayer)}</div>
          </div>
        )}

        {showSubs && (
          <div>
            <PartyHead tag="SUB" label="Substitutes" tagClassName="text-membership-linked" />
            <div className={`mt-3 ${PCARDS_GRID}`}>{grouped.substitutes.map(renderPlayer)}</div>
          </div>
        )}
      </div>
    );
  } else {
    // Standard (flat) view — main grid, optional Substitutes section.
    const mainPlayers = subsView || subsHidden ? players.filter((p) => !p.isSubstitute) : players;
    const subs = players.filter((p) => p.isSubstitute);
    const showSubs = subsView && !subsHidden && subs.length > 0;

    body = (
      <div className="space-y-7">
        <div className={PCARDS_GRID}>{mainPlayers.map(renderPlayer)}</div>
        {showSubs && (
          <div>
            <PartyHead tag="SUB" label="Substitutes" tagClassName="text-membership-linked" />
            <div className={`mt-3 ${PCARDS_GRID}`}>{subs.map(renderPlayer)}</div>
          </div>
        )}
      </div>
    );
  }

  // Off: a plain static grid (no DndContext, no drag handles) — exactly as before.
  if (!reorderMode) return body;

  // On: one DndContext around every section so cross-group G1↔G2 drags are valid.
  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={pointerWithin}
      onDragStart={dnd.handleDragStart}
      onDragOver={dnd.handleDragOver}
      onDragEnd={dnd.handleDragEnd}
      onDragCancel={dnd.handleDragCancel}
    >
      {body}
      <RosterCardsDragOverlay players={players} />
    </DndContext>
  );
}
