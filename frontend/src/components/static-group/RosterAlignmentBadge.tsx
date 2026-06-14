/**
 * RosterAlignmentBadge — compact goal alignment summary for a single roster member.
 * Used in the roster/members list to show leads how well each member aligns
 * with the static's objective goals.
 */

import { Tooltip } from '../primitives/Tooltip';
import type { GoalAlignmentSummary } from '../../stores/objectiveGoalStore';

interface RosterAlignmentBadgeProps {
  alignment: GoalAlignmentSummary;
  size?: 'sm' | 'md';
}

const DOT_COLORS = {
  aligned: 'bg-status-success',
  partial: 'bg-status-warning',
  conflict: 'bg-status-error',
  missing: 'bg-text-muted',
  unknown: 'bg-border-default',
};

function alignmentLabel(s: GoalAlignmentSummary): string {
  const parts: string[] = [];
  if (s.aligned > 0) parts.push(`${s.aligned} aligned`);
  if (s.partial > 0) parts.push(`${s.partial} partial`);
  if (s.conflicts > 0) parts.push(`${s.conflicts} conflict${s.conflicts !== 1 ? 's' : ''}`);
  if (s.missing > 0) parts.push(`${s.missing} missing`);
  if (parts.length === 0) return 'No goal data';
  return parts.join(' · ');
}

export function RosterAlignmentBadge({ alignment, size = 'sm' }: RosterAlignmentBadgeProps) {
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const hasAny =
    alignment.aligned > 0 || alignment.partial > 0 || alignment.conflicts > 0 || alignment.missing > 0;

  if (!hasAny) {
    return (
      <span className="text-xs text-text-muted italic">No data</span>
    );
  }

  return (
    <Tooltip content={alignmentLabel(alignment)}>
      <div className="flex items-center gap-1 cursor-default">
        {alignment.aligned > 0 && (
          <span className={`${dotSize} rounded-full ${DOT_COLORS.aligned} flex-shrink-0`} />
        )}
        {alignment.partial > 0 && (
          <span className={`${dotSize} rounded-full ${DOT_COLORS.partial} flex-shrink-0`} />
        )}
        {alignment.conflicts > 0 && (
          <span className={`${dotSize} rounded-full ${DOT_COLORS.conflict} flex-shrink-0`} />
        )}
        {alignment.missing > 0 && (
          <span className={`${dotSize} rounded-full ${DOT_COLORS.missing} flex-shrink-0`} />
        )}
        <span className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} text-text-muted font-mono leading-none`}>
          {[
            alignment.aligned > 0 ? alignment.aligned : null,
            alignment.partial > 0 ? alignment.partial : null,
            alignment.conflicts > 0 ? alignment.conflicts : null,
            alignment.missing > 0 ? alignment.missing : null,
          ]
            .filter(Boolean)
            .join('/')}
        </span>
      </div>
    </Tooltip>
  );
}
