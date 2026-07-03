/**
 * WeekNavigatorStrip — the Schedule page's week stepper (spec §5.1).
 * Presentational only: the shared `WeekClock` arrives as a prop, and this
 * component never mutates it — `startNextWeek`/`revertWeek` stay homed in
 * Loot's `WeekScopeControl` (one clock, one mutation host).
 */
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton } from '../primitives';
import { Tag } from '../ui';
import type { WeekClock } from '../../hooks/useWeekClock';

export interface WeekNavigatorStripProps {
  clock: WeekClock;
  scopedWeek: number;
  onScopedWeekChange: (week: number) => void;
  tierLabel?: string;
  recurringSummary?: string | null;
  canManage: boolean;
  onAddSession: () => void;
}

/** UTC-pinned so the shown date never shifts a day from the mid-day UTC anchor (WeekScopeControl.tsx:36-38). */
function formatUtcDate(d: Date): string {
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/** Rolling null-anchor window derives from `new Date()`, so local formatting is correct here. */
function formatLocalDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WeekNavigatorStrip({
  clock,
  scopedWeek,
  onScopedWeekChange,
  tierLabel,
  recurringSummary,
  canManage,
  onAddSession,
}: WeekNavigatorStripProps) {
  const isNullAnchor = clock.weekStartDate === null;
  const prevDisabled = isNullAnchor || scopedWeek <= 1;
  const nextDisabled = isNullAnchor || scopedWeek >= clock.currentWeek + 12;

  let line1: ReactNode;
  let line2: ReactNode;

  if (isNullAnchor) {
    const today = new Date();
    const end = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    line1 = 'This week';
    line2 = `${formatLocalDate(today)} – ${formatLocalDate(end)}`;
  } else {
    const isCurrent = clock.isCurrent(scopedWeek);
    line1 = (
      <>
        <span className={isCurrent ? 'text-accent' : 'text-text-primary'}>{`Week ${scopedWeek}`}</span>
        {isCurrent && <span className="text-text-tertiary font-normal"> · this week</span>}
      </>
    );
    const range = clock.rangeOfWeek(scopedWeek);
    line2 = (
      <>
        {range && `${formatUtcDate(range.start)} – ${formatUtcDate(range.end)}`}
        {tierLabel && ` · ${tierLabel}`}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <IconButton
        aria-label="Previous week"
        variant="ghost"
        size="sm"
        icon={<ChevronLeft size={16} />}
        disabled={prevDisabled}
        onClick={() => onScopedWeekChange(scopedWeek - 1)}
      />
      <div>
        <div className="font-display font-bold">{line1}</div>
        <div className="text-xs text-text-tertiary">{line2}</div>
      </div>
      <IconButton
        aria-label="Next week"
        variant="ghost"
        size="sm"
        icon={<ChevronRight size={16} />}
        disabled={nextDisabled}
        onClick={() => onScopedWeekChange(scopedWeek + 1)}
      />
      <div className="flex-1" />
      {recurringSummary && (
        <Tag variant="label" tone="muted">{recurringSummary}</Tag>
      )}
      {canManage && (
        <Button variant="primary" size="sm" onClick={onAddSession}>
          Add session
        </Button>
      )}
    </div>
  );
}
