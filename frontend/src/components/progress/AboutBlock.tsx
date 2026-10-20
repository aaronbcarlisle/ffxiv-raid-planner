/**
 * AboutBlock — the panel's read-only "About" (S2a-3a·G2b Task TG4; design Q-3): the farm's
 * content, priority mode and notes (`summary`), for every role. A part with nothing to show is
 * left out, and an unset mode with nothing else beside it reads as no details at all.
 */
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import { CONTENT_TYPE_LABELS, PRIORITY_MODE_OPTIONS } from '../../utils/goalTypeMeta';

export interface AboutBlockProps {
  goal: CollectionGoal;
}

/** The mode's label; an unset mode queues as Everyone gets one, and says so. */
function modeLabel(goal: CollectionGoal): string {
  const mode = goal.priorityMode ?? 'everyone_gets_one';
  return PRIORITY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

export function AboutBlock({ goal }: AboutBlockProps) {
  const content = [goal.contentType ? CONTENT_TYPE_LABELS[goal.contentType] : null, goal.contentKey?.trim() || null]
    .filter((part): part is string => part !== null && part !== undefined)
    .join(' · ');
  const notes = goal.summary?.trim() ?? '';

  const details: { label: string; value: string }[] = [];
  if (content) details.push({ label: 'Content', value: content });
  if (goal.priorityMode || content || notes) details.push({ label: 'Priority mode', value: modeLabel(goal) });
  if (notes) details.push({ label: 'Notes', value: notes });

  if (details.length === 0) return <p className="text-sm text-text-muted">No details yet</p>;
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {details.map((detail) => (
        <div key={detail.label} className="flex gap-2">
          <dt className="w-24 shrink-0 text-text-muted">{detail.label}</dt>
          <dd className="min-w-0 break-words whitespace-pre-line text-text-primary">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}
