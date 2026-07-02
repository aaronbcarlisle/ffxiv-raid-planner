/**
 * Roster — v2 Roster · Cards screen assembly (F6c Roster · Cards).
 *
 * The ring-0 composition that Task 11 passes as GroupViewContent's `roster`
 * slot (mirroring F6b `Home`'s prop contract). It owns the screen's view state
 * and sources every context value the card grid needs directly from stores +
 * hooks — the same derivations legacy `GroupViewContent` feeds `PlayerGrid`,
 * re-expressed for the v2 `RosterCards`. Visual target:
 * `mockups/02-roster-cards.html` `.page-head` + `.rtoolbar` + `.pcards`;
 * behaviour: `design/redesign/specs/2026-07-01-f6c-roster-design.md` §5.8.
 *
 * Boundary discipline (ring0): composes `roster/` siblings (RosterToolbar /
 * RosterCards / CharacterManageBridge) + shared `ui/` (ProgressBarLegend) + the
 * shell `PageHeader`, and reads STORES/HOOKS directly (`useGroupViewState`,
 * `usePlayerActions`, `authStore`, `viewAsStore`). It never imports a legacy
 * body or a ring1/ring3 component.
 *
 * Deliberate decisions (documented to pre-empt review false-positives):
 *   - `actionsForPlayer` is a **per-player factory** bound to each card's player
 *     — `usePlayerActions` exposes playerId-FIRST handlers, whereas
 *     `RosterCardActions` callbacks take no id (invoked bare in the card/hook).
 *     So we bind `player.id` here, once per card, exactly like legacy
 *     `PlayerGrid`'s per-player `useCallback` wrapping. `onReorder` is the one
 *     GRID-level handler (→ `usePlayerActions.handleReorder`, `PlayerUpdate[]`).
 *   - View/grouping state comes from the SAME `useGroupViewState` legacy uses
 *     (`groupView`/`subsView`/`sortPreset`/`clipboardPlayer`). `subsHidden` is
 *     GroupViewContent-LOCAL (localStorage `roster-hide-subs`), NOT part of the
 *     hook — so it is replicated here as local state with the same key, byte-for
 *     -byte. `reorderMode` is fresh local state (default off). Players are
 *     role-sorted with `sortPlayersByRole`/`SORT_PRESETS` (identical to legacy)
 *     so a custom drag order (sortPreset='custom') survives.
 *   - `onNavigate` / `onOpenRequests` are part of the slot contract (Task 11,
 *     mirroring `Home`) but the Cards slice has no navigation/recruit affordance
 *     yet — they are reserved for the Board slice / Static Finder and are
 *     intentionally not consumed here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';

import { PageHeader } from '../layout/PageHeader';
import { ProgressBarLegend, type LegendItem } from '../ui';
import { RosterToolbar } from './RosterToolbar';
import { RosterCards } from './RosterCards';
import { GearBoard } from './GearBoard';
import { CharacterManageBridge } from './CharacterManageBridge';

import { useGroupViewState } from '../../hooks/useGroupViewState';
import { usePlayerActions } from '../../hooks/usePlayerActions';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { useAuthStore } from '../../stores/authStore';
import { useViewAsStore } from '../../stores/viewAsStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';

import { sortPlayersByRole, groupPlayersByLightParty } from '../../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../../utils/constants';
import { computeNextUpgradePriorities } from '../../utils/nextUpgradePriority';
import { rosterAvgIlv, bisSlotTotals } from '../../utils/rosterReadiness';
import type { RosterCardActions } from '../../hooks/useRosterCardActions';
import type { PageMode, SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';

/** Stable empty fallback so a missing/empty tier doesn't churn memo deps. */
const EMPTY_PLAYERS: SnapshotPlayer[] = [];

/**
 * Board gear-source legend — R/T/A/empty + the F6d next-upgrade swatch.
 * The swatch color is mockup-faithful (`02-roster-board.html:553` uses
 * role-ranged); the per-cell ● is colored by the player's OWN role.
 */
const BOARD_LEGEND_ITEMS: LegendItem[] = [
  { label: 'raid (R)', token: 'var(--color-gear-raid)' },
  { label: 'tome (T)', token: 'var(--color-gear-tome)' },
  { label: 'augmented (A)', token: 'var(--color-gear-augmented)' },
  { label: 'empty', token: 'transparent' },
  { label: '● next upgrade', token: 'var(--color-role-ranged)' },
];

export interface RosterProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  /** Gates Add / Reorder / assign affordances. */
  canManage: boolean;
  /** Navigate to a primary tab (slot contract; unused in the Cards slice). */
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
  /** Open Settings ▸ Recruitment ▸ Requests (slot contract; unused in Cards). */
  onOpenRequests: () => void;
}

/** "8 raiders · 2 light parties + 1 substitute · avg 735 iLvl" — mockup page-head. */
function buildSubtitle(players: SnapshotPlayer[], groupView: boolean, subsView: boolean): string {
  const active = players.filter((p) => p.configured && !p.isSubstitute);
  const subs = players.filter((p) => p.configured && p.isSubstitute);

  const parts: string[] = [`${active.length} raider${active.length === 1 ? '' : 's'}`];

  let grouping: string;
  if (groupView) {
    const grouped = groupPlayersByLightParty(players, subsView);
    const partyCount = (grouped.group1.length > 0 ? 1 : 0) + (grouped.group2.length > 0 ? 1 : 0);
    grouping = partyCount > 0
      ? `${partyCount} light part${partyCount === 1 ? 'y' : 'ies'}`
      : 'light party';
  } else {
    grouping = 'standard comp';
  }
  if (subs.length > 0) {
    grouping += ` + ${subs.length} substitute${subs.length === 1 ? '' : 's'}`;
  }
  parts.push(grouping);

  const avg = rosterAvgIlv(players);
  if (avg != null) parts.push(`avg ${avg} iLvl`);

  return parts.join(' · ');
}

export function Roster({ group, tier, canManage }: RosterProps) {
  // ── View/grouping state (same hook legacy GroupViewContent owns) ──
  const {
    searchParams,
    groupView,
    setGroupView,
    subsView,
    sortPreset,
    setSortPreset,
    setEditingPlayerId,
    clipboardPlayer,
    setClipboardPlayer,
  } = useGroupViewState();

  // `subsHidden` is GroupViewContent-local (NOT in the hook) — replicate its
  // localStorage-backed local state, same key, so the setting persists.
  const [subsHidden, setSubsHidden] = useState<boolean>(() => {
    try { return localStorage.getItem('roster-hide-subs') === 'true'; } catch { return false; }
  });
  const setSubsHiddenPersist = useCallback((hidden: boolean) => {
    setSubsHidden(hidden);
    try { localStorage.setItem('roster-hide-subs', String(hidden)); } catch { /* ignore */ }
  }, []);

  // Drag-to-reorder is a transient, screen-local mode (off by default).
  const [reorderMode, setReorderMode] = useState(false);

  // Cards ⇄ Board view — URL-backed (deep-link + reload-safe via `rview`).
  const [rosterView, setRosterView] = useUrlTabState('rview', ['cards', 'board'] as const, 'cards');

  // ── Shared context, sourced exactly as GroupViewContent does ──
  const user = useAuthStore((s) => s.user);
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);

  // Loot state — the Board's next-upgrade (●) highlight must AGREE with the Loot
  // queue, so it reads the SAME loot log + REAL clock week the Loot screen uses.
  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const clockWeek = useLootTrackingStore((s) => s.currentWeek);
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchCurrentWeek = useLootTrackingStore((s) => s.fetchCurrentWeek);

  const adminModeParam = searchParams.get('adminMode') === 'true';
  const isAdmin = user?.isAdmin ?? false;
  const isAdminAccess = !viewAsUser && isAdmin && adminModeParam;
  // Ignore an admin-elevated role when not in admin mode (matches legacy).
  const actualUserRole = (group.isAdminAccess && !adminModeParam) ? null : group.userRole;
  const userRole = viewAsUser ? viewAsUser.role : actualUserRole;
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  const players = tier?.players ?? EMPTY_PLAYERS;
  const tierId = tier?.tierId;
  const contentType = tier?.contentType ?? 'savage';

  // Role-sort (identical to legacy `sortedPlayers`) — a custom drag order
  // (sortPreset='custom' → sortOrder) survives here too.
  const sortedPlayers = useMemo(() => {
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    return sortPlayersByRole(players, displayOrder, sortPreset);
  }, [players, sortPreset]);

  const mainRosterPlayers = useMemo(
    () => sortedPlayers.filter((p) => p.configured && !p.isSubstitute),
    [sortedPlayers],
  );

  // ── Board next-upgrade (●) highlight (F6d, spec §5.8) ──
  // Merge settings exactly as Loot does so the priority gate matches.
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...group.settings }), [group.settings]);

  // Mount fetch — the Board must not depend on the Loot tab having been visited
  // (Loot.tsx:126-133 rationale). Unconditional refetch; state converges to the
  // server response (Loot mount-fetch parity).
  useEffect(() => {
    if (group.id && tierId) {
      void fetchLootLog(group.id, tierId);
      void fetchCurrentWeek(group.id, tierId);
    }
  }, [group.id, tierId, fetchLootLog, fetchCurrentWeek]);

  // Only compute for the Board view. MUST pass the REAL clock week (not a scoped
  // view week) and the SAME main-roster set the Loot screen uses — else the
  // Board's ● can silently disagree with the Loot queue #1.
  const priorities = useMemo(
    () => rosterView === 'board'
      ? computeNextUpgradePriorities({ players: mainRosterPlayers, settings, lootLog, currentWeek: clockWeek })
      : undefined,
    [rosterView, mainRosterPlayers, settings, lootLog, clockWeek],
  );

  const hasSubstitutes = useMemo(() => sortedPlayers.some((p) => p.isSubstitute), [sortedPlayers]);

  const userHasClaimedPlayer = useMemo(() => {
    const checkUserId = viewAsUser ? viewAsUser.userId : user?.id;
    if (!checkUserId) return false;
    return players.some((p) => p.userId === checkUserId);
  }, [viewAsUser, user?.id, players]);

  const subtitle = useMemo(
    () => buildSubtitle(sortedPlayers, groupView, subsView),
    [sortedPlayers, groupView, subsView],
  );

  // Board subtitle names its own metric — total obtained BiS slots across roster.
  const boardSubtitle = useMemo(() => {
    const { obtained, total } = bisSlotTotals(sortedPlayers);
    return `Board view · the gear matrix · ${obtained} / ${total} BiS slots obtained`;
  }, [sortedPlayers]);

  // ── Player actions (playerId-first handlers) ──
  const setSortPresetWithTier = useCallback(
    (preset: SortPreset) => setSortPreset(preset, tierId),
    [setSortPreset, tierId],
  );
  const playerActions = usePlayerActions({
    groupId: group.id,
    tierId,
    players,
    setEditingPlayerId,
    setSortPreset: setSortPresetWithTier,
  });

  // Copy a deep-link to a player card (replicates GroupViewContent.handleCopyUrl).
  const handleCopyUrl = useCallback((playerId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'roster');
    url.searchParams.set('player', playerId);
    void navigator.clipboard.writeText(url.toString());
    toast.success('Link copied to clipboard');
  }, []);

  // Paste = overwrite a card's config from the clipboard player (legacy parity).
  const handlePastePlayer = useCallback((playerId: string, source: SnapshotPlayer) => {
    void playerActions.handleUpdatePlayer(playerId, {
      job: source.job,
      role: source.role,
      gear: source.gear,
      tomeWeapon: source.tomeWeapon,
      isSubstitute: source.isSubstitute,
      notes: source.notes,
      bisLink: source.bisLink,
    });
  }, [playerActions]);

  // Per-player action factory — bind `player.id` into each id-first handler so
  // the card's bare callbacks act on that card's player (see file head).
  const actionsForPlayer = useCallback(
    (player: SnapshotPlayer): RosterCardActions => ({
      onUpdate: (updates) => playerActions.handleUpdatePlayer(player.id, updates),
      onCopy: () => setClipboardPlayer(player),
      onCopyUrl: () => handleCopyUrl(player.id),
      onDuplicate: () => playerActions.handleDuplicatePlayer(player),
      onPaste: () => { if (clipboardPlayer) handlePastePlayer(player.id, clipboardPlayer); },
      onRemove: () => playerActions.handleRemovePlayer(player.id),
      onResetGear: (mode) => playerActions.handleResetGear(player.id, mode),
      onClaimPlayer: () => playerActions.handleClaimPlayer(player.id),
      onReleasePlayer: () => playerActions.handleReleasePlayer(player.id),
      onAdminAssignPlayer: (req) => playerActions.handleAdminAssignPlayer(player.id, req),
      onOwnerAssignPlayer: (req) => playerActions.handleOwnerAssignPlayer(player.id, req),
    }),
    [playerActions, setClipboardPlayer, handleCopyUrl, clipboardPlayer, handlePastePlayer],
  );

  const handleAddPlayer = useCallback(() => {
    void playerActions.handleAddPlayer();
  }, [playerActions]);

  return (
    <div data-testid="roster-screen">
      <PageHeader
        icon={<Users size={14} className="text-accent" />}
        title="Roster"
        subtitle={rosterView === 'board' ? boardSubtitle : subtitle}
        actions={
          <CharacterManageBridge
            groupId={group.id}
            players={mainRosterPlayers}
            canEdit={canManage}
          />
        }
      />

      <div className="mb-5">
        <RosterToolbar
          rosterView={rosterView}
          onRosterViewChange={setRosterView}
          groupView={groupView}
          onGroupViewChange={(v) => setGroupView(v, group.id)}
          subsHidden={subsHidden}
          onSubsHiddenChange={setSubsHiddenPersist}
          hasSubstitutes={hasSubstitutes}
          reorderMode={reorderMode}
          onReorderModeChange={setReorderMode}
          canManage={canManage}
          onAddPlayer={handleAddPlayer}
        />
      </div>

      {rosterView === 'board' ? (
        <GearBoard
          players={sortedPlayers}
          tierId={tierId}
          canManage={canManage}
          actionsForPlayer={actionsForPlayer}
          priorities={priorities}
        />
      ) : (
        <RosterCards
          players={sortedPlayers}
          groupView={groupView}
          subsView={subsView}
          subsHidden={subsHidden}
          reorderMode={reorderMode}
          canManage={canManage}
          userRole={userRole}
          currentUserId={effectiveUserId ?? null}
          isAdminAccess={isAdminAccess}
          clipboardPlayer={clipboardPlayer}
          groupId={group.id}
          tierId={tierId}
          contentType={contentType}
          isAdmin={isAdmin}
          userHasClaimedPlayer={userHasClaimedPlayer}
          actionsForPlayer={actionsForPlayer}
          onAddPlayer={handleAddPlayer}
          onReorder={playerActions.handleReorder}
        />
      )}

      <div className="mt-6">
        <ProgressBarLegend items={rosterView === 'board' ? BOARD_LEGEND_ITEMS : undefined} />
      </div>
    </div>
  );
}
