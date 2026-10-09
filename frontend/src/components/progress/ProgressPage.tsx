/**
 * ProgressPage — the V2 Progress tab (S2a-2). The header, the tier row, the farm
 * matrix (F3, read-only) and the members-only card for outsiders.
 *
 * `canManage` decides whether the status column reads "Everyone has it"; the
 * remaining `isViewingAs` is part of the slot contract (R-S2-4) and is consumed by
 * the cell controls in later tasks.
 *
 * Data: the page fetches the static's goals on mount and the cells of every active
 * goal (`fetchProgress`) whenever the SET of active goal ids changes, keyed on the
 * sorted ids joined into one string, never an array identity (R-S2-17, the churn
 * `NewShell.tsx` documents). Finished goals fetch on their first expand, at most 50
 * ids per request (the route 422s above that).
 *
 * R-S2-19: a viewer with no role (guest or outsider) sees the tier row and the
 * members-only card in place of the matrix, and no `collection-` request fires.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { MembersOnlyCard } from '../auth';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../primitives/Button';
import { useRosterSortPreset } from '../roster/useRosterSortPreset';
import { getTierById } from '../../gamedata';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useLootTrackingStore, weekClockKeyOf } from '../../stores/lootTrackingStore';
import type { MemberRole, PageMode, SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';
import { buildColumns, splitFarmRows } from '../../utils/progressModel';
import { ProgressMatrix } from './ProgressMatrix';
import { TierRow } from './TierRow';

/** The route 422s above this many `goal_id` params. */
const FINISHED_GOALS_PER_REQUEST = 50;

const NO_PLAYERS: SnapshotPlayer[] = [];

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

export function ProgressPage({ group, tier, canManage, userRole, currentUserId, onNavigate }: ProgressPageProps) {
  // The shared week clock (Home/Schedule precedent). The store holds a number
  // from the first render, so "known" means a server response has written it for
  // THIS tier (RosterCard's `clockResolved`).
  const storeWeek = useLootTrackingStore((s) => s.currentWeek);
  const clockResolved = useLootTrackingStore(
    (s) => tier != null && s.weekClockKey === weekClockKeyOf(group.id, tier.tierId),
  );
  const week = clockResolved && Number.isFinite(storeWeek) ? storeWeek : null;

  const tierName = tier ? (getTierById(tier.tierId)?.name ?? tier.tierId) : null;
  const isMember = userRole != null;

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
  const fetchKey = `${group.id}|${activeKey}|${attempt}`;
  // The first load of this static has settled, and how the last ACTIVE fetch ended. Later key
  // changes refetch behind the mounted matrix (stale-while-revalidate), so Finished stays open.
  const [settled, setSettled] = useState<{ groupId: string; error: string | null } | null>(null);

  useEffect(() => {
    if (!isMember) return;
    void useCollectionGoalStore.getState().fetchGoals(group.id);
  }, [isMember, group.id, attempt]);

  useEffect(() => {
    if (!isMember || !goalsReady) return;
    let cancelled = false;
    // Nothing active means nothing to fetch, and any earlier failure belongs to farms that
    // are gone; otherwise fetchProgress clears the error as it starts, so what it leaves is
    // this fetch's outcome.
    const settle =
      activeKey === ''
        ? Promise.resolve(null)
        : useCollectionGoalStore
            .getState()
            .fetchProgress(group.id)
            .then(() => useCollectionGoalStore.getState().progressError);
    void settle.then((error) => {
      if (!cancelled) setSettled({ groupId: group.id, error });
    });
    return () => {
      cancelled = true;
    };
  }, [isMember, goalsReady, activeKey, group.id, fetchKey]);

  // A goals failure never reaches `goalsReady`, so it would read as loading forever.
  const goalsFailed = isMember && !goalsReady && goalsError !== null;
  const settledHere = settled?.groupId === group.id;
  const loading = isMember && !goalsFailed && (!goalsReady || !settledHere);
  const error = !isMember || loading ? null : goalsFailed ? goalsError : activeKey !== '' ? (settled?.error ?? null) : null;

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
    void Promise.all(chunks.map((ids) => useCollectionGoalStore.getState().fetchProgress(group.id, ids))).then(() => {
      // Its own line inside Finished: the active rows stay on screen.
      setFinishedError(useCollectionGoalStore.getState().progressError);
      setFinishedLoading(false);
    });
  }, [finishedIds, group.id]);

  // ── The matrix ──
  // The roster sort preset, hydrated read-only: this page never persists a choice.
  const [preset, setPreset] = useState<SortPreset>('standard');
  useRosterSortPreset({ tierId: tier?.tierId, urlSort: null, applyPreset: setPreset });

  const players = tier?.players ?? NO_PLAYERS;
  const { columns, active, finished } = useMemo(() => {
    // Columns come from the ACTIVE goals only: Finished never adds or shifts one.
    const columns = buildColumns(players, preset, { goals: activeGoals, participants, recordOnly });
    const rows = splitFarmRows({ goals: groupGoals, participants, recordOnly }, columns, { currentUserId, userRole });
    return { columns, ...rows };
  }, [players, preset, activeGoals, groupGoals, participants, recordOnly, currentUserId, userRole]);

  const retry = () => {
    setSettled(null);
    setAttempt((n) => n + 1);
  };

  return (
    <div data-testid="progress-screen">
      <PageHeader
        icon={<Target size={14} className="text-accent" />}
        title="Progress"
        subtitle={`Every track ${group.name} is working on, the tier first${week !== null ? ` · Week ${week}` : ''}`}
      />
      <div className="space-y-4">
        {tierName !== null && (
          <TierRow
            tierName={tierName}
            week={week}
            onOpenBoard={() => onNavigate('roster', { rview: 'board' })}
          />
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
        {isMember && !loading && error === null && groupGoals.length > 0 && (
          <ProgressMatrix
            columns={columns}
            active={active}
            finished={finished}
            canManage={canManage}
            finishedLoading={finishedLoading}
            finishedError={finishedError}
            onExpandFinished={expandFinished}
          />
        )}
      </div>
    </div>
  );
}
