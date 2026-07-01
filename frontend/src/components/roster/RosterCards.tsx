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
 * Reorder/DnD wrapping is Task 7 — this component renders statically
 * (`reorderMode` is forwarded as-is to each `RosterCard`; no drag handles).
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
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { CardShell, EmptyStateInvite, ProgressBar, Tag } from '../ui';
import { RosterCard } from './RosterCard';
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
  /** Drag-to-reorder mode. Forwarded as-is; Task 7 wraps this in DnD. */
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
}: RosterCardsProps) {
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

    return (
      <RosterCard
        key={player.id}
        player={player}
        userRole={userRole}
        currentUserId={currentUserId}
        isAdminAccess={isAdminAccess}
        canManage={canManage}
        clipboardPlayer={clipboardPlayer}
        reorderMode={reorderMode}
        actions={actionsForPlayer(player)}
        groupId={groupId}
        tierId={tierId}
        contentType={contentType}
        allPlayers={allPlayers ?? players}
        isAdmin={isAdmin}
        userHasClaimedPlayer={userHasClaimedPlayer}
        onModalOpen={onModalOpen}
        onModalClose={onModalClose}
      />
    );
  };

  if (groupView) {
    const grouped = groupPlayersByLightParty(players, subsView);
    const showSubs = subsView && !subsHidden && grouped.substitutes.length > 0;

    return (
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
  }

  // Standard (flat) view — main grid, optional Substitutes section.
  const mainPlayers = subsView || subsHidden ? players.filter((p) => !p.isSubstitute) : players;
  const subs = players.filter((p) => p.isSubstitute);
  const showSubs = subsView && !subsHidden && subs.length > 0;

  return (
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
