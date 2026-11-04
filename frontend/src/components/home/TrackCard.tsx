/**
 * TrackCard (ring0 `home/`; S2a-4b·B1 Task TB1, R-F-10, D-11, D-12, E-9): the static's top active
 * farm, the one Progress lists first. Its title opens that row. It replaces the old mount-farm card.
 *
 * It agrees with Progress because it reads the same way: the sort preset as `ProgressPage` hydrates
 * it, the columns from `progressInputs`, the farm and its next member from `trackCardModel`. The
 * reader is the effective one, View As included (E-9). Farms are the static's, not the tier's, so
 * the card shows with no tier picked and on a past tier.
 *
 * It sends nothing: Home fetches (E-8). It shows only what's loaded for THIS static, so it hides
 * until the goals are this static's and every active farm has its cells, while cells load, after
 * either fetch fails, for a guest, and with no active farm.
 *
 * Boundary discipline (ring0): reads stores and pure `utils/`, and never imports `progress/` (ring3).
 */
import { useMemo, useState } from 'react';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useAuthStore } from '../../stores/authStore';
import { useViewAsStore } from '../../stores/viewAsStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import type { PageMode, SnapshotPlayer, SortPreset, StaticGroup, TierSnapshot } from '../../types';
import { progressInputs } from '../../utils/progressView';
import { nextText, trackCardFor } from '../../utils/trackCardModel';
import { useRosterSortPreset } from '../roster/useRosterSortPreset';
import { CardShell } from '../ui/CardShell';
import { LinkText } from '../ui/LinkText';
import { FarmPips } from './FarmPips';

const NO_PLAYERS: SnapshotPlayer[] = [];

interface TrackCardProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  /** Navigate to a primary tab (optionally with extra URL params). */
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
}

export function TrackCard({ group, tier, onNavigate }: TrackCardProps) {
  const goals = useCollectionGoalStore((s) => s.goals);
  const participants = useCollectionGoalStore((s) => s.participants);
  const recordOnly = useCollectionGoalStore((s) => s.recordOnly);
  const loadedGroupId = useCollectionGoalStore((s) => s.loadedGroupId);
  const goalsError = useCollectionGoalStore((s) => s.error);
  const progressLoading = useCollectionGoalStore((s) => s.progressLoading);
  const progressError = useCollectionGoalStore((s) => s.progressError);

  const { userRole } = useStaticPermissions();
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);
  const authUserId = useAuthStore((s) => s.user?.id);
  const currentUserId = viewAsUser?.userId ?? authUserId ?? null;

  // The roster sort preset, hydrated read-only as Progress hydrates it.
  const [preset, setPreset] = useState<SortPreset>('standard');
  useRosterSortPreset({ tierId: tier?.tierId, urlSort: null, applyPreset: setPreset });

  const players = tier?.players ?? NO_PLAYERS;
  const model = useMemo(() => {
    const { activeGoals, columns } = progressInputs({
      goals,
      groupId: group.id,
      players,
      sortPreset: preset,
      data: { participants, recordOnly },
    });
    // The route answers for every active goal, so a missing entry means its cells aren't here yet:
    // the goals land first, and an empty list is a loaded one.
    if (activeGoals.some((g) => participants[g.id] === undefined)) return null;
    return trackCardFor({
      data: { goals: activeGoals, participants, recordOnly },
      columns,
      reader: { currentUserId, userRole },
      readerIsViewer: userRole === 'viewer',
    });
  }, [goals, group.id, players, preset, participants, recordOnly, currentUserId, userRole]);

  const loaded = loadedGroupId === group.id && !progressLoading && goalsError === null && progressError === null;
  if (userRole == null || !loaded || model === null) return null;

  const { goalId, title, typeLabel, typeIcon: TypeIcon, tally, pips, next } = model;
  return (
    <CardShell as="div" title="Farm" icon={<TypeIcon size={14} />}>
      <div className="flex flex-col gap-2 text-xs text-text-secondary">
        <p>
          <LinkText className="text-sm font-medium" onClick={() => onNavigate('goals', { track: goalId })}>
            {title}
          </LinkText>
          <span> · {typeLabel}</span>
        </p>
        <p>
          {tally.n} of {tally.m} have it
        </p>
        <FarmPips pips={pips} />
        {next && <p>{nextText(next)}</p>}
      </div>
    </CardShell>
  );
}
