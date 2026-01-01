/**
 * Week Selector
 *
 * Navigation component for selecting raid week.
 * Shows current week with prev/next buttons.
 */

interface WeekSelectorProps {
  currentWeek: number;
  maxWeek: number;
  onWeekChange: (week: number) => void;
  disabled?: boolean;
}

export function WeekSelector({
  currentWeek,
  maxWeek,
  onWeekChange,
  disabled = false,
}: WeekSelectorProps) {
  const handlePrevWeek = () => {
    if (currentWeek > 1) {
      onWeekChange(currentWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (currentWeek < maxWeek) {
      onWeekChange(currentWeek + 1);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePrevWeek}
        disabled={disabled || currentWeek <= 1}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title="Previous Week"
      >
        ←
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">Week</span>
        <select
          value={currentWeek}
          onChange={(e) => onWeekChange(Number(e.target.value))}
          disabled={disabled}
          className="px-3 py-1.5 rounded bg-surface-interactive text-text-primary border border-border-default hover:border-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {Array.from({ length: maxWeek }, (_, i) => i + 1).map((week) => (
            <option key={week} value={week}>
              {week}
            </option>
          ))}
        </select>
        <span className="text-sm text-text-muted">of {maxWeek}</span>
      </div>

      <button
        onClick={handleNextWeek}
        disabled={disabled || currentWeek >= maxWeek}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title="Next Week"
      >
        →
      </button>
    </div>
  );
}
