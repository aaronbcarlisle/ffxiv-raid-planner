/**
 * GoalAlignmentSummary — shows alignment between a player's public goals
 * and the static's objective goals, for use in the join request review modal.
 *
 * When `snapshot` is provided (captured at apply time), renders directly from
 * that data without triggering a live API fetch.
 */

import { useEffect } from 'react';
import { Spinner } from '../ui/Spinner';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';

interface AlignmentSnapshot {
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
  unknown: number;
}

interface GoalAlignmentSummaryProps {
  groupId: string;
  profileId: string;
  /** Application-time snapshot. When present, renders from this instead of live fetch. */
  snapshot?: AlignmentSnapshot | null;
}

export function GoalAlignmentSummary({ groupId, profileId, snapshot }: GoalAlignmentSummaryProps) {
  const { alignment, loading, error, fetchAlignment } = useObjectiveGoalStore();

  useEffect(() => {
    if (snapshot) return; // snapshot takes precedence — skip live fetch
    if (groupId && profileId) {
      fetchAlignment(groupId, profileId);
    }
  }, [groupId, profileId, fetchAlignment, snapshot]);

  // Render from snapshot data when available
  if (snapshot) {
    const s = snapshot;
    const hasData = s.aligned > 0 || s.partial > 0 || s.conflicts > 0 || s.missing > 0;
    if (!hasData) {
      return <p className="text-xs text-text-tertiary italic">No goal data at time of application.</p>;
    }
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-text-muted italic mb-1">Captured at time of application</p>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {s.aligned > 0 && <span className="text-status-success font-medium">{s.aligned} aligned</span>}
          {s.partial > 0 && <span className="text-status-warning font-medium">{s.partial} partial</span>}
          {s.conflicts > 0 && (
            <span className="text-status-error font-medium">
              {s.conflicts} conflict{s.conflicts !== 1 ? 's' : ''}
            </span>
          )}
          {s.missing > 0 && <span className="text-text-tertiary">{s.missing} missing</span>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-tertiary py-2">
        <Spinner size="sm" />
        <span>Checking goal alignment…</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-text-tertiary italic">
        Could not load goal alignment.
      </p>
    );
  }

  if (!alignment) return null;

  if (alignment.items.length === 0) {
    return (
      <p className="text-xs text-text-tertiary italic">
        Static has not set any objectives yet.
      </p>
    );
  }

  const { summary, items } = alignment;

  const conflicts = items.filter((i) => i.status === 'conflict');
  const missing = items.filter((i) => i.status === 'missing');

  return (
    <div className="space-y-2">
      {/* Summary line */}
      <div className="flex items-center gap-3 text-sm flex-wrap">
        {summary.aligned > 0 && (
          <span className="text-status-success font-medium">
            {summary.aligned} aligned
          </span>
        )}
        {summary.partial > 0 && (
          <span className="text-status-warning font-medium">
            {summary.partial} partial
          </span>
        )}
        {summary.conflicts > 0 && (
          <span className="text-status-error font-medium">
            {summary.conflicts} conflict{summary.conflicts !== 1 ? 's' : ''}
          </span>
        )}
        {summary.missing > 0 && (
          <span className="text-text-tertiary">
            {summary.missing} missing
          </span>
        )}
        {summary.aligned === 0 && summary.partial === 0 && summary.conflicts === 0 && summary.missing === 0 && (
          <span className="text-text-tertiary">No matching data</span>
        )}
      </div>

      {/* Conflict detail */}
      {conflicts.map((item, i) => (
        <div key={i} className="text-xs text-status-error">
          ⚠ Conflict: applicant{' '}
          <span className="font-medium">{item.playerIntent?.replace('_', ' ')}</span>{' '}
          {item.category.replace('_', ' ')}, static requires{' '}
          <span className="font-medium">{item.staticTitle}</span>.
        </div>
      ))}

      {/* Missing detail */}
      {missing.map((item, i) => (
        <div key={i} className="text-xs text-text-tertiary">
          — Missing: no goal set for{' '}
          <span className="font-medium">{item.staticTitle}</span> (required by static).
        </div>
      ))}
    </div>
  );
}
