/**
 * TrackCard (ring0 `home/`)
 *
 * Display-only summary of the lead non-flagship track (mount farm).
 * Spec §5.13. Renders nothing if no track data is loaded or the trials list
 * is empty.
 *
 * Boundary discipline (ring0): reads mountFarmStore (store → ring0 allowed)
 * and composes shared ui/ components only. Never imports a ring1/ring3
 * component — in particular, never imports components/mount-farms/** (ring3).
 *
 * No click target — the per-track detail view is Ring 3 (deferred).
 */
import { Trophy } from 'lucide-react';
import { useMountFarmStore } from '../../stores/mountFarmStore';
import { CardShell } from '../ui/CardShell';
import { ProgressBar } from '../ui/ProgressBar';
import { Tag } from '../ui/Tag';

export function TrackCard() {
  const data = useMountFarmStore((s) => s.data);

  if (!data || data.trials.length === 0) {
    return null;
  }

  const trial = data.trials[0];
  const { trialId, totalMembers, membersComplete } = trial;
  const value = totalMembers > 0 ? membersComplete / totalMembers : 0;

  return (
    <CardShell
      as="div"
      title={trialId}
      icon={<Trophy size={14} className="text-membership-linked" />}
      headerRight={<Tag variant="label">Ring 3</Tag>}
    >
      <p className="text-xs text-text-secondary leading-snug mb-3">
        {membersComplete} of {totalMembers} have it
        <span className="text-text-tertiary">
          {' '}· same Progress Engine, no loot priority
        </span>
      </p>
      <ProgressBar
        value={value}
        color="membership-linked"
        ariaLabel={`${trialId} mount farm progress`}
      />
    </CardShell>
  );
}
