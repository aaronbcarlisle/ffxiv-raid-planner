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
 * The view (S2a-4a·A2, R-F-3, R-F-4): the "Progress view" switch (Tracks, Find) for every member
 * role, `?pview=find` through `useProgressView` (one write per change; `?track` wins over it;
 * V1's `?farm=suggested|catalog` maps to Find once on mount), and Track a farm for leads, which
 * opens Find with the search focused (D-5). Find holds `FindList` (A2b): opening it fetches the
 * catalog (once), never for a guest; a failed catalog shows the built-in farms (P-67). The static's
 * suggestions (E-6) are fetched once per static per mount, Tracks included, so the footer under the
 * matrix (`FindFooter`, R-F-7) can name the first wanted farm nobody tracks yet.
 *
 * Find's actions (S2a-4a·A3, R-F-6, D-6, D-7, D-8): a lead's Track and the custom row (`findActions`)
 * create the goal, then this page makes the one URL write that opens its row (Track focuses the row's
 * name; the custom row opens Edit, so its Title takes focus). A member's I want this needs the
 * member's own intents, fetched here when a member who is not under View As opens Find: the control
 * is a busy placeholder until this mount's fetch has settled, an error line with Retry when it
 * failed, and it is never rendered under View As (the intents route ignores `X-View-As`).
 *
 * The open row (S2a-3a·G2, R-S3-3, D-7, D-8): `?track=<goal id>` through `useProgressView`,
 * one row at a time. A row is open only while its id names a goal of THIS static whose
 * goals have loaded, so a stale id opens nothing during a load; an id that matches no goal
 * is dropped from the URL only once THIS mount's goals fetch has returned (never on the
 * cached list, which a warm cache reports as loaded and idle before the refetch runs); and
 * a static switch under the mounted page clears it at once (a goal id never belongs to two
 * statics), before the new static's goals load.
 *
 * Inline Edit (S2a-3a·G5 Task TG8, D-12, R-S3-10; S2a-4a·A3 A2-M3): `?edit=<goal id>` names the
 * farm whose Edit block is on (shown only while it is the open row), written with `?track` in one
 * write and never outliving it; the block reports whether it is dirty. A dirty block is never
 * dropped silently: opening another row, closing the row (its name button or Escape) and Mark
 * finished each ask "Discard changes?" first (`askToDiscard`), through `farmEditContext`.
 *
 * The split plan (S2a-3b·H4, R-T-6, R-T-7, E-8, E-11, design §3.5): `?track=tier` opens the tier
 * row into the split planner. Members and viewers fetch the static's split-clear data on the active
 * tier, and again on a return to the tab, and the page keeps the last settled result per static.
 * Once it has settled the row opens with split clears on, for a lead with them off (Turn on split
 * clears), or after a failure (Retry). The id waits while the tier is unknown (a cold load) or the
 * fetch runs, and goes on a known past tier or once the result says the row can't open.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { MembersOnlyCard } from '../auth';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../primitives/Button';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useRosterSortPreset } from '../roster/useRosterSortPreset';
import { getTierById } from '../../gamedata';
import { useVisibilityRefresh } from '../../hooks/useVisibilityRefresh';
import { computeWeeklyLootSummary } from '../../hooks/useWeeklyLootSummary';
import { FALLBACK_CATALOG } from '../../data/curatedCatalog';
import { useAuthStore } from '../../stores/authStore';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore, type StaticCollectionSuggestion } from '../../stores/collectionIntentStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import { useSplitClearStore } from '../../stores/splitClearStore';
import { toast } from '../../stores/toastStore';
import type { LootLogEntry, MemberRole, PageLedgerEntry, PageMode, SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';
import { buildColumns, splitFarmRows, type ProgressCell as ProgressCellModel, type ProgressData } from '../../utils/progressModel';
import { buildFindList, topWanted, type FindFilters, type FindItem } from '../../utils/findModel';
import { tierBisCell, tierBisTotals, tierStatusText } from '../../utils/tierBis';
import { blankClaimedCells, cellWriteTarget } from './editStatuses';
import { FarmEditContext } from './farmEditContext';
import { farmEditTitleId, farmMenuId, farmNameId, tierNameId } from './farmFocus';
import { EditStatusesBar } from './EditStatusesBar';
import { CustomTrackRow, LeadFindAction, MemberFindAction, type MemberIntentsStatus } from './findActions';
import { FindFooter } from './FindFooter';
import { FindList } from './FindList';
import { ProgressMatrix } from './ProgressMatrix';
import { messageOf } from './undoToasts';
import { ProgressToolbar } from './ProgressToolbar';
import { useProgressView, type ProgressViewName } from './useProgressView';
import { TIER_TRACK, type TierPanelModel } from './TierExpansion';
import type { TierColumnCell, TierRowModel } from './TierRow';

/** The route 422s above this many `goal_id` params. */
const FINISHED_GOALS_PER_REQUEST = 50;

const NO_PLAYERS: SnapshotPlayer[] = [];
/** The weekly summary's loot log: the floors part reads only the ledger (R-T-5). */
const NO_LOOT: LootLogEntry[] = [];
/** The farm data while the farms are not shown (a guest, or before the first load). */
const NO_FARMS: ProgressData = { goals: [], participants: {}, recordOnly: {} };
const NO_SUGGESTIONS: StaticCollectionSuggestion[] = [];
const NO_FILTERS: FindFilters = { category: null, source: null, expansion: null };

/** The last settled split-clear fetch: for which static, and what it said (R-T-7). */
interface SplitResult {
  groupId: string | null;
  enabled: boolean;
  failed: boolean;
}
const NO_SPLIT: SplitResult = { groupId: null, enabled: false, failed: false };

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

  // ── The view (S2a-4a·A2, R-F-3, E-1, D-9) ──
  // `?pview=find` is Find, for members only. A `?track` wins over it (rule 1), so the render that
  // meets both is already Tracks and the effect below drops `pview`.
  const { pview, track, edit, setProgressView } = useProgressView();
  const view: ProgressViewName = isMember && pview === 'find' && track === null ? 'find' : 'tracks';

  // ── Find (S2a-4a·A2b, R-F-5, E-5, E-6, P-67) ──
  // The catalog and the static's suggestions are the stores' own (V1 reads the same ones). The
  // catalog fetches when Find opens; the suggestions once per static per mount (the footer reads
  // them in Tracks, R-F-7). A guest (who never reaches `view === 'find'`) triggers neither.
  const catalog = useCollectionGoalStore((s) => s.catalog);
  const catalogLoaded = useCollectionGoalStore((s) => s.catalogLoaded);
  const catalogLoading = useCollectionGoalStore((s) => s.catalogLoading);
  const catalogError = useCollectionGoalStore((s) => s.catalogError);
  const findSuggestions = useCollectionIntentStore((s) => s.suggestions[group.id]);
  const suggestionsError = useCollectionIntentStore((s) => s.suggestionsError[group.id] ?? null);
  const [findQuery, setFindQuery] = useState('');
  const [findFilters, setFindFilters] = useState<FindFilters>(NO_FILTERS);
  const [expandedFind, setExpandedFind] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const findOpen = view === 'find';
  useEffect(() => {
    if (!findOpen) return;
    const goalStore = useCollectionGoalStore.getState();
    if (!goalStore.catalogLoaded && !goalStore.catalogLoading) void goalStore.fetchCatalog();
  }, [findOpen]);
  useEffect(() => {
    if (!isMember) return;
    void useCollectionIntentStore.getState().fetchSuggestions(group.id);
  }, [isMember, group.id]);
  // A failed or empty live catalog shows the built-in farms (V1's CatalogBrowse does the same).
  const catalogFallback = !catalogLoading && catalogLoaded && (catalogError !== null || catalog.length === 0);
  const findCatalog = catalogFallback ? FALLBACK_CATALOG : catalog;
  const findList = useMemo(
    () =>
      findOpen
        ? buildFindList({
            catalog: findCatalog,
            suggestions: findSuggestions ?? NO_SUGGESTIONS,
            goals,
            groupId: group.id,
            query: findQuery,
            filters: findFilters,
          })
        : null,
    [findOpen, findCatalog, findSuggestions, goals, group.id, findQuery, findFilters],
  );
  const findLoading = !catalogLoaded || catalogLoading || (findSuggestions === undefined && suggestionsError === null);

  // ── The footer (R-F-7) ──
  // The first wanted item nobody tracks yet, from the whole wanted list (no search or filter), once
  // the goals are in (an item never reads as untracked while its goal is still loading). The catalog
  // need not be loaded: a wanted item it lacks is built from its suggestion row.
  const footerItem = useMemo(() => {
    if (!isMember || !goalsReady || findSuggestions === undefined) return null;
    return topWanted(buildFindList({ catalog: findCatalog, suggestions: findSuggestions, goals, groupId: group.id, query: '', filters: NO_FILTERS }).wanted);
  }, [isMember, goalsReady, findCatalog, findSuggestions, goals, group.id]);

  // ── A member's intents (R-F-6, D-6, M-5a) ──
  // I want this belongs to a member role that is not under View As (the intents route ignores
  // `X-View-As`, so a write there would be the admin's own). Their rows are fetched when such a
  // member opens Find; until THIS mount's fetch has settled nothing can be written.
  const memberActions = isMember && !mayEdit && userRole !== 'viewer' && !isViewingAs;
  const myIntents = useCollectionIntentStore((s) => s.myIntents);
  const myIntentsLoaded = useCollectionIntentStore((s) => s.myIntentsLoaded);
  const [intentsAttempt, setIntentsAttempt] = useState(0);
  const [intentsSettled, setIntentsSettled] = useState<{ attempt: number; error: string | null } | null>(null);
  useEffect(() => {
    if (!findOpen || !memberActions) return;
    const attempt = intentsAttempt;
    let cancelled = false;
    useCollectionIntentStore
      .getState()
      .fetchMyIntents()
      .then(
        () => {
          if (!cancelled) setIntentsSettled({ attempt, error: null });
        },
        (err: unknown) => {
          if (!cancelled) setIntentsSettled({ attempt, error: messageOf(err) });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [findOpen, memberActions, intentsAttempt]);
  const intentsStatus: MemberIntentsStatus =
    intentsSettled?.attempt !== intentsAttempt ? 'loading' : intentsSettled.error !== null ? 'failed' : myIntentsLoaded ? 'ready' : 'loading';
  const retryIntents = useCallback(() => setIntentsAttempt((n) => n + 1), []);

  const [mode, setMode] = useState(false);
  // Reset during the render that loses the bar (React's adjust-state-on-change pattern), so the
  // mode never outlives it: it cannot resume when the role, or an active farm, comes back. Find
  // ends it too (C-4).
  if (mode && (!barShown || view === 'find')) setMode(false);
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
  // `?edit` belongs to the open row (A2-M3): every move of `?track` drops it, in the same write.
  const setTrack = useCallback((id: string | null) => setProgressView({ track: id, edit: null }), [setProgressView]);
  // Rule 1: `?track` wins over `?pview=find`, in one write that drops `pview`.
  useEffect(() => {
    if (pview === 'find' && track !== null) setProgressView({ pview: 'tracks' });
  }, [pview, track, setProgressView]);
  // Rule 2: V1's `?farm=suggested|catalog` opens Find once, on mount, and goes from the URL.
  const [searchParams] = useSearchParams();
  // The shell seeds `?tier=` on a cold entry in the same tick, and React Router builds each write
  // from the params of its render, so that write can land after this one and bring `farm` back.
  // The map therefore stays pending until a render has seen `farm` gone, and writes again (from
  // the latest params, each write removing `farm`) while it is still there. Once gone it is done.
  const farmParam = searchParams.get('farm');
  // `searchParams` is a dependency on purpose: a clobbering write can bring `farm` back with the same
  // value, and only a new params object re-arms this effect to write again.
  const farmPending = useRef(farmParam === 'suggested' || farmParam === 'catalog');
  useEffect(() => {
    if (!farmPending.current) return;
    if (farmParam !== 'suggested' && farmParam !== 'catalog') {
      farmPending.current = false;
      return;
    }
    if (isMember) setProgressView({ pview: 'find', farm: null });
  }, [farmParam, isMember, searchParams, setProgressView]);
  // Open only while the id names a goal of this static and the goals have loaded.
  const openId = track !== null && goalsReady && groupGoals.some((g) => g.id === track) ? track : null;
  // An id that matches no goal here is dropped once this mount's goals fetch has returned and the
  // store holds this static's goals; never on the cached list alone (R-S3-3, "never during loading").
  const goalsFetched = goalsSettled?.groupId === group.id && goalsSettled.attempt === attempt;
  useEffect(() => {
    // `?track=tier` names no goal: the tier's own rule below decides it (E-3).
    if (track === null || track === TIER_TRACK || !goalsReady || !goalsFetched) return;
    if (!groupGoals.some((g) => g.id === track)) setTrack(null);
  }, [track, goalsReady, goalsFetched, groupGoals, setTrack]);

  // ── The split plan (S2a-3b·H4; R-T-6, R-T-7, E-8, E-11) ──
  // Members and viewers fetch it on the active tier, and again on a return to the tab. The store is
  // shared and unkeyed, and a refetch blanks its `data` first, so the page keeps the last settled
  // result per static and the panel reads that: a refetch never closes it, and `failed` is this
  // fetch's own outcome, never the store's `error`, which every write sets. Guests never fetch
  // (D-11), and Progress never clears the store (V1's roster tab owns that).
  const tierActive = tier?.isActive === true;
  const [split, setSplit] = useState<SplitResult>(NO_SPLIT);
  const [splitAttempt, setSplitAttempt] = useState(0);
  useEffect(() => {
    if (!isMember || !tierActive) return;
    const groupId = group.id;
    let cancelled = false;
    // `fetchData` keeps its errors (the store's `error`, `data` left null), so this resolves either way.
    void useSplitClearStore
      .getState()
      .fetchData(groupId)
      .then(() => {
        if (cancelled) return;
        const { data } = useSplitClearStore.getState();
        setSplit({ groupId, enabled: data?.enabled === true, failed: data === null });
      });
    return () => {
      cancelled = true;
    };
  }, [isMember, group.id, tierActive, splitAttempt]);
  const refetchSplit = useCallback(() => setSplitAttempt((n) => n + 1), []);
  useVisibilityRefresh(refetchSplit);
  const turnOnSplit = useCallback(() => {
    const groupId = group.id;
    void useSplitClearStore
      .getState()
      .toggleMode(groupId, true)
      .then(
        () => {
          setSplit((s) => (s.groupId === groupId ? { groupId, enabled: true, failed: false } : s));
          toast.success('Split clears on');
        },
        (err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't turn on split clears"),
      );
  }, [group.id]);

  // The row opens once this static's result has settled: with split clears on (everyone), off (a
  // lead, to turn them on) or failed (the error and Retry inside). Guests never (R-T-11).
  const splitHere = split.groupId === group.id;
  const tierOpenable = isMember && tierActive && splitHere && (split.enabled || split.failed || mayEdit);
  const tierOpen = track === TIER_TRACK && tierOpenable;
  // `?track=tier` waits while the tier is unknown (a cold load) and while the fetch runs; it goes on
  // a known past tier (E-8), or once the result says the row can't open (a member, split clears off).
  const tierPast = tier !== null && !tierActive;
  useEffect(() => {
    if (track !== TIER_TRACK) return;
    if (tierPast || (splitHere && !tierOpenable)) setTrack(null);
  }, [track, tierPast, splitHere, tierOpenable, setTrack]);
  // The one open row: the tier's, else a farm's.
  const openRowId = tierOpen ? TIER_TRACK : openId;
  // The planner's players (R-T-8): configured, non-substitute cards, in column order.
  const plannerPlayers = useMemo(
    () => columns.flatMap((c) => (c.player !== null && c.player.configured && !c.player.isSubstitute ? [c.player] : [])),
    [columns],
  );

  // A static switch under the mounted page clears `?track` (and the edit with it) at once (the
  // switches that navigate with no query clear it already); the id belongs to the static it was
  // read under.
  const trackedGroupId = useRef(group.id);
  useEffect(() => {
    if (trackedGroupId.current === group.id) return;
    trackedGroupId.current = group.id;
    setTrack(null);
  }, [group.id, setTrack]);

  // ── Inline Edit (G5, D-12; A2-M3) ──
  // `?edit` is the farm whose block is on, and the block is on screen only while that row is the
  // open one. The page writes `edit` with `track` only, so an `edit` that names another id (a
  // hand-written or foreign URL) is dropped.
  const editingId = edit !== null && edit === openId ? edit : null;
  useEffect(() => {
    if (edit !== null && edit !== track) setProgressView({ edit: null });
  }, [edit, track, setProgressView]);
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
  // A goal id or `TIER_TRACK`, against the effective open row, so the open tier row's name closes it.
  const toggleRow = useCallback(
    (rowId: string) => askToDiscard(openId, () => setTrack(openRowId === rowId ? null : rowId), rowId === TIER_TRACK ? tierNameId : farmNameId(rowId)),
    [openId, openRowId, setTrack, askToDiscard],
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
        // ONE write opens the row in Tracks with its block on; the block's mount focuses its Title.
        askToDiscard(editingId, () => setProgressView({ pview: 'tracks', track: goalId, edit: goalId }), undefined, opener);
      },
      finish: (goalId: string) => {
        setProgressView({ edit: null });
        dirtyRef.current = false;
        document.getElementById(farmMenuId(goalId))?.focus();
      },
      setDirty,
      guard: (goalId: string, proceed: () => void, opener?: HTMLElement | null) =>
        askToDiscard(
          goalId,
          () => {
            // Only this farm's own block goes; another row's Mark finished leaves an edit elsewhere alone.
            if (goalId === editingId) setProgressView({ edit: null });
            proceed();
          },
          undefined,
          opener,
          true,
        ),
    }),
    [editingId, askToDiscard, setProgressView, setDirty],
  );

  // ── The switch (S2a-4a·A2, R-F-3 rule 3, D-9, C-4) ──
  // To Find: the discard guard first, then ONE write that sets `pview=find` and clears the open row
  // and its edit; edit-statuses mode ends by itself (a Find view has no mode). Back to Tracks drops
  // `pview` and opens nothing.
  const goFind = () =>
    askToDiscard(
      openId,
      () => setProgressView({ pview: 'find', track: null, edit: null }),
      undefined,
      undefined,
      // Focus goes back to the switch, which stays mounted, after a Discard.
      true,
    );
  const onView = (next: ProgressViewName) => (next === 'find' ? goFind() : setProgressView({ pview: 'tracks' }));

  // ── Where focus lands after a view change (D-5, R-F-7, design §3.3) ──
  // Each is settled in a layout effect of the commit that shows the target, so it is never aimed at
  // an element that is not there yet: the search when Track a farm opens Find (after a Discard too,
  // which is why Track a farm asks with no return), the Wanted row's toggle after the footer's
  // Find, and the row's name after Track. The URL write is a transition (React Router), so its
  // commit comes after the handler's own state commit: each effect also keys on what that write shows.
  const pendingSearchFocus = useRef(false);
  // Bumped so the effect runs even when Find is already open and the write changes nothing.
  const [searchFocusTick, setSearchFocusTick] = useState(0);
  useLayoutEffect(() => {
    if (!pendingSearchFocus.current || searchRef.current === null) return;
    pendingSearchFocus.current = false;
    searchRef.current.focus();
  }, [searchFocusTick, findOpen]);
  const trackFarm = () =>
    askToDiscard(openId, () => {
      pendingSearchFocus.current = true;
      setProgressView({ pview: 'find', track: null, edit: null });
      setSearchFocusTick((n) => n + 1);
    });

  const findSectionRef = useRef<HTMLElement>(null);
  const pendingFindFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = pendingFindFocus.current;
    if (id === null || !findOpen || findList === null) return;
    pendingFindFocus.current = null;
    // The Wanted twin, not the All one: the wanted section is the first section of the list, and
    // its rows follow `findList.wanted` one to one.
    const index = findList.wanted.findIndex((i) => i.id === id);
    if (index < 0) return;
    findSectionRef.current?.querySelector('section')?.querySelectorAll<HTMLElement>('button[aria-expanded]')[index]?.focus();
  }, [findOpen, findList]);
  const findFromFooter = (item: FindItem) =>
    askToDiscard(openId, () => {
      pendingFindFocus.current = item.id;
      // The farm must be on screen: the search and filters start clean.
      setFindQuery('');
      setFindFilters(NO_FILTERS);
      setExpandedFind(item.id);
      setProgressView({ pview: 'find', track: null, edit: null });
    });

  const pendingRowFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = pendingRowFocus.current;
    if (id === null || id !== openRowId) return;
    pendingRowFocus.current = null;
    document.getElementById(farmNameId(id))?.focus();
  }, [openRowId]);
  // Track's row exists and its cells are fetched: ONE write opens it in Tracks (R-F-6, §3.3).
  const onTracked = useCallback(
    (goalId: string) => {
      pendingRowFocus.current = goalId;
      setProgressView({ pview: 'tracks', track: goalId, edit: null });
    },
    [setProgressView],
  );
  const renderAction = (item: FindItem) => {
    if (mayEdit) return <LeadFindAction item={item} groupId={group.id} onTracked={onTracked} />;
    if (memberActions && item.trackable) {
      return <MemberFindAction item={item} groupId={group.id} existing={myIntents[item.id]} intents={intentsStatus} onRetry={retryIntents} />;
    }
    return null;
  };

  // The tier panel's model, only while the row can open (R-T-8): failed first, then on, then off.
  const tierPanel: TierPanelModel | undefined = tierOpenable
    ? {
        groupId: group.id,
        state: split.failed ? 'failed' : split.enabled ? 'on' : 'off',
        players: plannerPlayers,
        canEdit: canManage,
        onRetry: refetchSplit,
        onTurnOn: turnOnSplit,
      }
    : undefined;
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
          panel: tierPanel,
        };

  return (
    <div data-testid="progress-screen">
      <PageHeader
        icon={<Target size={14} className="text-accent" />}
        title="Progress"
        subtitle={`Every track ${group.name} is working on, the tier first${week !== null ? ` · Week ${week}` : ''}`}
      />
      <div className="space-y-4">
        {isMember && (
          <ProgressToolbar
            view={view}
            onView={onView}
            lead={canManage}
            onTrackFarm={trackFarm}
            editBar={
              barShown ? (
                <EditStatusesBar
                  groupId={group.id}
                  editing={editing}
                  onEdit={() => setMode(true)}
                  onDone={() => setMode(false)}
                  blankCells={blankCells}
                />
              ) : null
            }
          />
        )}
        {view === 'find' && (
          <section ref={findSectionRef} aria-label="Find">
            {findList !== null && (
              <FindList
                list={findList}
                query={findQuery}
                onQuery={setFindQuery}
                filters={findFilters}
                onFilters={setFindFilters}
                renderAction={renderAction}
                names={memberNames}
                expandedId={expandedFind}
                onExpand={(id) => setExpandedFind((cur) => (cur === id ? null : id))}
                footer={
                  mayEdit ? (
                    <CustomTrackRow
                      query={findQuery}
                      groupId={group.id}
                      onCreated={(id) => {
                        // The text became a farm: a return to Find must not offer it again (no server duplicate check, E-4).
                        setFindQuery('');
                        editControls.start(id);
                      }}
                    />
                  ) : undefined
                }
                error={suggestionsError}
                onRetry={() => void useCollectionIntentStore.getState().fetchSuggestions(group.id)}
                catalogFallback={catalogFallback}
                onRetryCatalog={() => void useCollectionGoalStore.getState().fetchCatalog()}
                searchRef={searchRef}
                readerIsViewer={userRole === 'viewer'}
                loading={findLoading}
              />
            )}
          </section>
        )}
        {view === 'tracks' && (tierRow !== undefined || (farmsShown && groupGoals.length > 0)) && (
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
              openId={openRowId}
              onToggle={toggleRow}
              groupId={group.id}
              userRole={userRole}
              clock={clock}
              tier={tierRow}
            />
          </FarmEditContext.Provider>
        )}
        {!isMember && <MembersOnlyCard staticName={group.name} subject="Farms" />}
        {view === 'tracks' && loading && (
          <p role="status" data-testid="progress-loading" className="px-1 text-sm text-text-secondary">
            Loading farms…
          </p>
        )}
        {view === 'tracks' && error !== null && (
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
        {view === 'tracks' && footerItem !== null && <FindFooter item={footerItem} names={memberNames} onFind={() => findFromFooter(footerItem)} />}
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
