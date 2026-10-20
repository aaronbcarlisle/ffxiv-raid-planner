/**
 * ProgressPage — the V2 Progress tab (S2a-2). The header, the matrix (the tier row first,
 * then the farms) and the members-only card for outsiders.
 *
 * `canManage` decides whether the status column reads "Everyone has it". A member
 * (owner, lead or member role) edits their own cells (F5, R-S2-10): under View As the
 * "own" cells are the viewed user's, and a write goes through the lead route aimed at
 * them (`isViewingAs`, the slot contract's R-S2-4), never at the admin's own row.
 *
 * Edit statuses (F6, R-S2-10, R-S2-12): a reader who may manage (owner, lead or admin
 * access, never a viewer) gets the one toolbar row above the matrix. The mode is held
 * here, so leaving the page forgets it, and it is derived off the moment the reader may
 * no longer manage. In it `cellWriteTarget` makes every claimed cell on an active row a
 * picker aimed at its member, and the bulk Need sends the blank ones (`blankClaimedCells`).
 *
 * Data: the page fetches the static's goals on mount and the cells of every active
 * goal (`fetchProgress`) whenever the SET of active goal ids changes, keyed on the
 * sorted ids joined into one string, never an array identity (R-S2-17, the churn
 * `NewShell.tsx` documents). Finished goals fetch on their first expand, at most 50
 * ids per request (the route 422s above that).
 *
 * R-S2-19, D-11: a viewer with no role (guest or outsider) sees the matrix holding the tier row
 * alone (the roster's BiS cells and "x/y BiS slots · Week n", no floors), above the members-only
 * card, and no `collection-`, `page-ledger` or `split-clear` request fires.
 *
 * The tier row (S2a-3b·H3, R-T-3, R-T-5, D-4, D-7, E-7): the matrix renders whenever a tier is
 * selected, farms or not, with the "Loading farms…" and error lines below it; the farm rows (and
 * the members they add as columns) wait for the first load, members only. Each column's BiS cell
 * comes from `tierBisCell`; the status line sums the counted ones (claimed and unclaimed cards,
 * never a substitute) and, for members, adds the week's cleared floors from the page ledger,
 * fetched here and copied locally keyed by (static, tier).
 *
 * The open row (S2a-3a·G2, R-S3-3, D-7, D-8): `?track=<goal id>` through `useTrackParam`,
 * one row at a time. A row is open only while its id names a goal of THIS static whose
 * goals have loaded, so a stale id opens nothing during a load; an id that matches no goal
 * is dropped from the URL only once THIS mount's goals fetch has returned (never on the
 * cached list, which a warm cache reports as loaded and idle before the refetch runs); and
 * a static switch under the mounted page clears it at once (a goal id never belongs to two
 * statics), before the new static's goals load.
 *
 * Inline Edit (S2a-3a·G5 Task TG8, D-12, R-S3-10): `editId` names the farm whose Edit block is on
 * (shown only while it is the open row), and the block reports whether it is dirty. A dirty block
 * is never dropped silently: opening another row, closing the row (its name button or Escape) and
 * Mark finished each ask "Discard changes?" first (`askToDiscard`), through `farmEditContext`.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { MembersOnlyCard } from '../auth';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../primitives/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useRosterSortPreset } from '../roster/useRosterSortPreset';
import { getTierById } from '../../gamedata';
import { useTrackParam } from '../../hooks/useTrackParam';
import { computeWeeklyLootSummary } from '../../hooks/useWeeklyLootSummary';
import { useAuthStore } from '../../stores/authStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import type { LootLogEntry, MemberRole, PageLedgerEntry, PageMode, SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';
import { buildColumns, splitFarmRows, type ProgressCell as ProgressCellModel, type ProgressData } from '../../utils/progressModel';
import { tierBisCell, tierBisTotals, tierStatusText } from '../../utils/tierBis';
import { blankClaimedCells, cellWriteTarget } from './editStatuses';
import { FarmEditContext } from './farmEditContext';
import { farmEditTitleId, farmMenuId, farmNameId } from './farmFocus';
import { EditStatusesBar } from './EditStatusesBar';
import { ProgressMatrix } from './ProgressMatrix';
import type { TierColumnCell, TierRowModel } from './TierRow';

/** The route 422s above this many `goal_id` params. */
const FINISHED_GOALS_PER_REQUEST = 50;

const NO_PLAYERS: SnapshotPlayer[] = [];
/** The weekly summary's loot log: the floors part reads only the ledger (R-T-5). */
const NO_LOOT: LootLogEntry[] = [];
/** The farm data while the farms are not shown (a guest, or before the first load). */
const NO_FARMS: ProgressData = { goals: [], participants: {}, recordOnly: {} };

interface ProgressPageProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  canManage: boolean;
  /** The effective role (View As aware); null/undefined for a guest or outsider. */
  userRole: MemberRole | null | undefined;
  currentUserId: string | null;
  isViewingAs: boolean;
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
}

export function ProgressPage({ group, tier, canManage, userRole, currentUserId, isViewingAs, onNavigate }: ProgressPageProps) {
  // The shared week clock (Home/Schedule precedent). The store holds a number
  // from the first render, so "known" means a server response has written it for
  // THIS tier (RosterCard's `clockResolved`).
  const storeWeek = useLootTrackingStore((s) => s.currentWeek);
  const clockResolved = useLootTrackingStore(
    (s) => tier != null && s.weekClockKey === weekClockKeyOf(group.id, tier.tierId),
  );
  const week = clockResolved && Number.isFinite(storeWeek) ? storeWeek : null;
  // Week 1's start, behind the same gate (R-S3-9): the drops' "Week n" labels read both.
  const storeWeekStart = useLootTrackingStore((s) => s.weekStartDate);
  const weekStartDate = clockResolved ? storeWeekStart : null;
  const clock = useMemo(() => ({ currentWeek: week, weekStartDate }), [week, weekStartDate]);

  const tierName = tier ? (getTierById(tier.tierId)?.name ?? tier.tierId) : null;
  const tierId = tier?.tierId ?? null;
  const isMember = userRole != null;

  // ── The tier's floors (R-T-5, E-7) ──
  // Members (viewers too) fetch the page ledger for (static, tier) on mount and when either changes.
  // The store's `pageLedger` is one unkeyed slot any response may write, so this mount copies it on
  // resolve, keyed by (static, tier); a resolve for a key no longer current is dropped. A failure
  // leaves no copy, so the floors part stays out, with no toast. Guests never fetch (D-11).
  const ledgerKey = isMember && tierId !== null ? `${group.id}:${tierId}` : null;
  const [ledger, setLedger] = useState<{ key: string; entries: PageLedgerEntry[] } | null>(null);
  useEffect(() => {
    if (!isMember || tierId === null) return;
    const key = `${group.id}:${tierId}`;
    let cancelled = false;
    void useLootTrackingStore
      .getState()
      .fetchPageLedger(group.id, tierId)
      .then(
        () => {
          if (!cancelled) setLedger({ key, entries: useLootTrackingStore.getState().pageLedger });
        },
        () => undefined,
      );
    return () => {
      cancelled = true;
    };
  }, [isMember, group.id, tierId]);
  const floors = useMemo(() => {
    if (ledgerKey === null || tierId === null || ledger?.key !== ledgerKey || week === null) return null;
    const tierFloors = getTierById(tierId)?.floors ?? [];
    // A tier the game data doesn't know has no floors to count: the part stays out, never "0 of 0".
    if (tierFloors.length === 0) return null;
    const cleared = computeWeeklyLootSummary(tierFloors, NO_LOOT, ledger.entries, week).filter((f) => f.cleared).length;
    return { cleared, of: tierFloors.length };
  }, [ledgerKey, tierId, ledger, week]);

  // ── Data ──
  const goals = useCollectionGoalStore((s) => s.goals);
  const loadedGroupId = useCollectionGoalStore((s) => s.loadedGroupId);
  const goalsError = useCollectionGoalStore((s) => s.error);
  const participants = useCollectionGoalStore((s) => s.participants);
  const recordOnly = useCollectionGoalStore((s) => s.recordOnly);
  const progressLoading = useCollectionGoalStore((s) => s.progressLoading);

  const groupGoals = useMemo(() => goals.filter((g) => g.staticGroupId === group.id), [goals, group.id]);
  const activeGoals = useMemo(() => groupGoals.filter((g) => g.status !== 'complete'), [groupGoals]);
  // The refetch key: the same set of active goals is the same string, whatever the array identity.
  const activeKey = useMemo(
    () =>
      activeGoals
        .map((g) => g.id)
        .sort()
        .join(','),
    [activeGoals],
  );
  const goalsReady = loadedGroupId === group.id;

  // Retry bumps this, so both effects run again.
  const [attempt, setAttempt] = useState(0);
  // The first load of this static has settled, and how the last ACTIVE fetch ended. Later key
  // changes refetch behind the mounted matrix (stale-while-revalidate), so Finished stays open.
  const [settled, setSettled] = useState<{ groupId: string; error: string | null } | null>(null);
  // The static whose active cells have loaded successfully once: from then on a failed refetch
  // keeps the matrix (stale cells) and shows the error line beside it, never in place of it.
  const [loadedOnce, setLoadedOnce] = useState<string | null>(null);

  // The (static, attempt) whose goals THIS mount's fetch has brought back. The `?track` drop
  // below waits for it, never for the store's flags: a warm cache reads as loaded and idle at the
  // first render, while the refetch (which flips `isLoading`) runs in the same effect flush.
  const [goalsSettled, setGoalsSettled] = useState<{ groupId: string; attempt: number } | null>(null);
  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;
    // `fetchGoals` keeps its errors (the store's `error`), so this resolves either way.
    void Promise.resolve(useCollectionGoalStore.getState().fetchGoals(group.id)).then(() => {
      if (!cancelled) setGoalsSettled({ groupId: group.id, attempt });
    });
    return () => {
      cancelled = true;
    };
  }, [isMember, group.id, attempt]);

  useEffect(() => {
    if (!isMember || !goalsReady) return;
    let cancelled = false;
    // Nothing active means nothing to fetch, and any earlier failure belongs to farms that
    // are gone. Otherwise the outcome is THIS call's own result, never the store's shared
    // `progressError`, which a Finished fetch also writes.
    const settle =
      activeKey === ''
        ? Promise.resolve({ error: null })
        : useCollectionGoalStore.getState().fetchProgress(group.id);
    void settle.then(({ error }) => {
      if (cancelled) return;
      setSettled({ groupId: group.id, error });
      if (error === null) setLoadedOnce(group.id);
    });
    return () => {
      cancelled = true;
    };
  }, [isMember, goalsReady, activeKey, group.id, attempt]);

  // A goals failure never reaches `goalsReady`, so it would read as loading forever.
  const goalsFailed = isMember && !goalsReady && goalsError !== null;
  const settledHere = settled?.groupId === group.id;
  const loading = isMember && !goalsFailed && (!goalsReady || !settledHere);
  const error = !isMember || loading ? null : goalsFailed ? goalsError : activeKey !== '' ? (settled?.error ?? null) : null;
  const matrixLoaded = loadedOnce === group.id;
  // The farm rows, and the members they add as columns: members only, once the first load is in
  // (a failed refetch keeps them, stale, beside the error line).
  const farmsShown = isMember && !loading && (error === null || matrixLoaded);

  // ── Finished: fetch the finished goals' cells on the first expand ──
  const [finishedLoading, setFinishedLoading] = useState(false);
  const [finishedError, setFinishedError] = useState<string | null>(null);
  const finishedIds = useMemo(
    () => groupGoals.filter((g) => g.status === 'complete').map((g) => g.id),
    [groupGoals],
  );
  const expandFinished = useCallback(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < finishedIds.length; i += FINISHED_GOALS_PER_REQUEST) {
      chunks.push(finishedIds.slice(i, i + FINISHED_GOALS_PER_REQUEST));
    }
    setFinishedLoading(true);
    setFinishedError(null);
    void Promise.all(chunks.map((ids) => useCollectionGoalStore.getState().fetchProgress(group.id, ids))).then((results) => {
      // Its own line inside Finished, from its own calls' results: the active rows stay on screen.
      setFinishedError(results.find((r) => r.error !== null)?.error ?? null);
      setFinishedLoading(false);
    });
  }, [finishedIds, group.id]);

  // ── The matrix ──
  // The roster sort preset, hydrated read-only: this page never persists a choice.
  const [preset, setPreset] = useState<SortPreset>('standard');
  useRosterSortPreset({ tierId: tier?.tierId, urlSort: null, applyPreset: setPreset });

  const players = tier?.players ?? NO_PLAYERS;
  const { columns, active, finished } = useMemo(() => {
    // Columns come from the ACTIVE goals only: Finished never adds or shifts one. Until the farms
    // show, the columns are the roster's alone.
    const columns = buildColumns(players, preset, farmsShown ? { goals: activeGoals, participants, recordOnly } : NO_FARMS);
    const rows = splitFarmRows(farmsShown ? { goals: groupGoals, participants, recordOnly } : NO_FARMS, columns, { currentUserId, userRole });
    return { columns, ...rows };
  }, [players, preset, farmsShown, activeGoals, groupGoals, participants, recordOnly, currentUserId, userRole]);

  // ── The tier row (R-T-3, D-4, D-7, E-7) ──
  // A card's column has its BiS cell; a column with no card has none. Substitutes show theirs but
  // stay out of the total, as Home's `bisSlotTotals` leaves them out.
  const tierCells = useMemo(
    () =>
      columns.map(
        (c): TierColumnCell => (c.player ? { cell: tierBisCell(c.player), counted: !c.player.isSubstitute } : { cell: null, counted: false }),
      ),
    [columns],
  );
  const statusText = tierStatusText({ totals: tierBisTotals(tierCells.map((c) => (c.counted ? c.cell : null))), week, floors });
  const tierRow: TierRowModel | undefined =
    tierName === null
      ? undefined
      : {
          name: tierName,
          cells: tierCells,
          statusText,
          onOpenBoard: () => onNavigate('roster', { rview: 'board' }),
          // D-5, E-9, R-T-9: a tier cell's Alt+Click and the breakdown's Open on board land on that card's Board row.
          onJump: (playerId) => onNavigate('roster', { rview: 'board', player: playerId }),
        };

  // Names for "set by {name}": the signed-in user first, so a member's entry below wins. The
  // signed-in user is there for View As: the admin writes the viewed user's row, and an
  // admin who is no member of this static has no other name here (TF7 ruling 8).
  const authUserId = useAuthStore((s) => s.user?.id ?? null);
  const authUserName = useAuthStore((s) => s.user?.displayName ?? s.user?.discordUsername ?? null);
  const memberNames = useMemo(() => {
    const names = new Map<string, string>();
    if (authUserId !== null && authUserName) names.set(authUserId, authUserName);
    for (const m of group.members ?? []) {
      const name = m.user?.displayName ?? m.user?.discordUsername;
      if (name) names.set(m.userId, name);
    }
    return names;
  }, [group.members, authUserId, authUserName]);

  // Members the lead route can aim at: the server rejects a viewer, and a member demoted to
  // viewer keeps their roster card (a claimed column), so Edit statuses and the bulk Need skip them.
  const trackableUserIds = useMemo(
    () => new Set((group.members ?? []).filter((m) => m.role !== 'viewer').map((m) => m.userId)),
    [group.members],
  );

  // ── Edit statuses (F6, R-S2-10) ──
  // Who gets the mode: NewShell's canManage (owner, lead, admin access), never a viewer, and
  // only while there is an active farm to edit (the bar renders under the same condition).
  const mayEdit = canManage && isMember && userRole !== 'viewer';
  const barShown = mayEdit && active.length > 0;
  const [mode, setMode] = useState(false);
  // Reset during the render that loses the bar (React's adjust-state-on-change pattern), so the
  // mode never outlives it: it cannot resume when the role, or an active farm, comes back.
  if (mode && !barShown) setMode(false);
  const editing = mode && barShown;

  // Where each active cell writes (R-S2-10): one's own (View As: the lead route aimed at the
  // viewed user), and in the mode every claimed cell, aimed at its member.
  const editFor = useCallback(
    (cell: ProgressCellModel) => cellWriteTarget(cell, { groupId: group.id, currentUserId, userRole, canManage, isViewingAs, editing, trackableUserIds }),
    [group.id, currentUserId, userRole, canManage, isViewingAs, editing, trackableUserIds],
  );
  const blankCells = useMemo(() => blankClaimedCells(active, trackableUserIds), [active, trackableUserIds]);

  const retry = () => {
    // Behind a mounted matrix the stale cells stay on screen while the retry runs.
    if (!matrixLoaded) setSettled(null);
    setAttempt((n) => n + 1);
  };

  // ── The open row (S2a-3a·G2, R-S3-3) ──
  const [track, setTrack] = useTrackParam();
  // Open only while the id names a goal of this static and the goals have loaded.
  const openId = track !== null && goalsReady && groupGoals.some((g) => g.id === track) ? track : null;
  // An id that matches no goal here is dropped once this mount's goals fetch has returned and the
  // store holds this static's goals; never on the cached list alone (R-S3-3, "never during loading").
  const goalsFetched = goalsSettled?.groupId === group.id && goalsSettled.attempt === attempt;
  useEffect(() => {
    if (track === null || !goalsReady || !goalsFetched) return;
    if (!groupGoals.some((g) => g.id === track)) setTrack(null);
  }, [track, goalsReady, goalsFetched, groupGoals, setTrack]);
  const [editId, setEditId] = useState<string | null>(null);
  // The edit belongs to the static it started under: dropped in the render that sees another one.
  const [editGroupId, setEditGroupId] = useState(group.id);
  if (editGroupId !== group.id) {
    setEditGroupId(group.id);
    setEditId(null);
  }
  // A static switch under the mounted page clears `?track` at once (the switches that navigate with
  // no query clear it already); the id belongs to the static it was read under.
  const trackedGroupId = useRef(group.id);
  useEffect(() => {
    if (trackedGroupId.current === group.id) return;
    trackedGroupId.current = group.id;
    setTrack(null);
  }, [group.id, setTrack]);

  // ── Inline Edit (G5, D-12) ──
  // The block is on screen only while its row is the open one.
  const editingId = editId !== null && editId === openId ? editId : null;
  // Read in event handlers only: the block reports it from an effect, the handlers read it fresh.
  const dirtyRef = useRef(false);
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  // "Discard changes?" while it is asked: what each answer does (functions, so held in an object).
  const [discarding, setDiscarding] = useState<{ keep: () => void; discard: () => void } | null>(null);
  // The confirm is unmounted, not closed, so its own focus restore never runs: the answer says where
  // focus goes and this puts it there once the confirm is gone (it would otherwise fall to <body>).
  const restoreFocus = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (discarding !== null) return;
    const restore = restoreFocus.current;
    restoreFocus.current = null;
    restore?.();
  }, [discarding]);
  // Runs `proceed` now, or once the lead has agreed to drop the dirty block of `editedId`. Keep
  // editing returns focus to the control that asked (the block's Title when it is gone); Discard to
  // `landingId`, the element the action was heading for, when it names one, else (`returnOnDiscard`,
  // a write that may fail and leave the control in place) to the control that asked.
  const askToDiscard = useCallback(
    (editedId: string | null, proceed: () => void, landingId?: string, openedBy?: HTMLElement | null, returnOnDiscard = false) => {
      if (editedId === null || editedId !== editingId || !dirtyRef.current) {
        proceed();
        return;
      }
      const opener = openedBy ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const openerBack = () => (opener !== null && opener !== document.body && opener.isConnected ? opener : null);
      setDiscarding({
        keep: () => {
          restoreFocus.current = () => (openerBack() ?? document.getElementById(farmEditTitleId(editedId)))?.focus();
        },
        discard: () => {
          if (landingId !== undefined) restoreFocus.current = () => document.getElementById(landingId)?.focus();
          // The confirm's unmount drops focus to <body>; the write that follows (the finished row's
          // own claim wins when it lands) must not start from there, nor end there if it fails.
          else if (returnOnDiscard) restoreFocus.current = () => openerBack()?.focus();
          proceed();
        },
      });
    },
    [editingId],
  );
  const toggleRow = useCallback(
    (goalId: string) =>
      askToDiscard(
        openId,
        () => {
          setEditId(null);
          setTrack(openId === goalId ? null : goalId);
        },
        farmNameId(goalId),
      ),
    [openId, setTrack, askToDiscard],
  );
  const editControls = useMemo(
    () => ({
      editingId,
      start: (goalId: string, opener?: HTMLElement | null) => {
        if (goalId === editingId) {
          // Already editing it: the menu has just returned focus to its button; the title takes it back.
          queueMicrotask(() => document.getElementById(farmEditTitleId(goalId))?.focus());
          return;
        }
        askToDiscard(
          editingId,
          () => {
            setEditId(goalId);
            setTrack(goalId);
          },
          undefined,
          opener,
        );
      },
      finish: (goalId: string) => {
        setEditId(null);
        dirtyRef.current = false;
        document.getElementById(farmMenuId(goalId))?.focus();
      },
      setDirty,
      guard: (goalId: string, proceed: () => void, opener?: HTMLElement | null) =>
        askToDiscard(
          goalId,
          () => {
            // Only this farm's own block goes; another row's Mark finished leaves an edit elsewhere alone.
            if (goalId === editingId) setEditId(null);
            proceed();
          },
          undefined,
          opener,
          true,
        ),
    }),
    [editingId, askToDiscard, setTrack, setDirty],
  );

  return (
    <div data-testid="progress-screen">
      <PageHeader
        icon={<Target size={14} className="text-accent" />}
        title="Progress"
        subtitle={`Every track ${group.name} is working on, the tier first${week !== null ? ` · Week ${week}` : ''}`}
      />
      <div className="space-y-4">
        {barShown && (
          <EditStatusesBar
            groupId={group.id}
            editing={editing}
            onEdit={() => setMode(true)}
            onDone={() => setMode(false)}
            blankCells={blankCells}
          />
        )}
        {(tierRow !== undefined || (farmsShown && groupGoals.length > 0)) && (
          <FarmEditContext.Provider value={editControls}>
            {/* Keyed by static: it stays mounted through a load now, and Finished's state belongs to one static. */}
            <ProgressMatrix
              key={group.id}
              columns={columns}
              active={active}
              finished={finished}
              canManage={canManage}
              currentUserId={currentUserId}
              memberNames={memberNames}
              editFor={editFor}
              finishedLoading={finishedLoading}
              finishedError={finishedError}
              onExpandFinished={expandFinished}
              openId={openId}
              onToggle={toggleRow}
              groupId={group.id}
              userRole={userRole}
              clock={clock}
              tier={tierRow}
            />
          </FarmEditContext.Provider>
        )}
        {!isMember && <MembersOnlyCard staticName={group.name} subject="Farms" />}
        {loading && (
          <p role="status" data-testid="progress-loading" className="px-1 text-sm text-text-secondary">
            Loading farms…
          </p>
        )}
        {error !== null && (
          <div
            role="alert"
            data-testid="progress-error"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-text-primary"
          >
            <span>{`Couldn't load farms: ${error}`}</span>
            <Button variant="secondary" size="sm" loading={progressLoading} onClick={retry}>
              Retry
            </Button>
          </div>
        )}
      </div>
      {discarding !== null && (
        <ConfirmModal
          isOpen
          variant="warning"
          title="Discard changes?"
          message="This farm has unsaved edits. Discarding them can't be undone."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => {
            discarding.keep();
            setDiscarding(null);
          }}
          onConfirm={() => {
            discarding.discard();
            setDiscarding(null);
          }}
        />
      )}
    </div>
  );
}
