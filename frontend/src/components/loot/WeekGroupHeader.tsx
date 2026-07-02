/**
 * WeekGroupHeader — the History table's per-week group divider (spec §5.6).
 * Presentational only: no store access, props in.
 */

export interface WeekGroupHeaderProps {
  week: number;
  isCurrent: boolean;
  /** `useWeekClock.rangeOfWeek` shape. */
  range: { start: Date; end: Date } | null;
  count: number;
}

/** UTC-pinned so the shown date never shifts a day (WeekScopeControl precedent). */
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function formatRange(range: { start: Date; end: Date }): string {
  return `${DATE_FMT.format(range.start)} – ${DATE_FMT.format(range.end)}`;
}

export function WeekGroupHeader({ week, isCurrent, range, count }: WeekGroupHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`font-display text-xs font-extrabold rounded-full px-2.5 py-0.5 ${
            isCurrent ? 'bg-accent/15 text-accent' : 'bg-surface-elevated text-text-secondary'
          }`}
        >
          {`WEEK ${week}`}
        </span>
        {range && <span className="text-xs text-text-tertiary">{formatRange(range)}</span>}
      </div>
      <span className="text-xs text-text-tertiary">{`${count} drop${count === 1 ? '' : 's'}`}</span>
    </div>
  );
}
