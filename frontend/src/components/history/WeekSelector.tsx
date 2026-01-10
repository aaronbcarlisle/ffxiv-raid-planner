/**
 * Week Selector
 *
 * Navigation component for selecting raid week.
 * Shows current week with prev/next buttons.
 * Shows type indicators (loot/books/mats) for weeks with data.
 * Includes "Add Week" button to navigate to current calculated week.
 */

import type { WeekEntryType } from '../../stores/lootTrackingStore';
import { Select } from '../ui';

interface WeekSelectorProps {
  currentWeek: number;
  maxWeek: number;
  calculatedCurrentWeek: number; // The actual current week based on tier start date
  onWeekChange: (week: number) => void;
  disabled?: boolean;
  /** Set of weeks that have loot entries (for highlighting/skipping) */
  weeksWithEntries?: Set<number>;
  /** Map of week -> entry types for enhanced display */
  weekDataTypes?: Map<number, WeekEntryType[]>;
}

/** Format entry types for display (e.g., "loot/books") */
function formatEntryTypes(types: WeekEntryType[]): string {
  if (types.length === 0) return '';
  // Sort for consistent display: loot, books, mats
  const order: WeekEntryType[] = ['loot', 'books', 'mats'];
  const sorted = types.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.join('/');
}

export function WeekSelector({
  currentWeek,
  maxWeek,
  calculatedCurrentWeek,
  onWeekChange,
  disabled = false,
  weeksWithEntries,
  weekDataTypes,
}: WeekSelectorProps) {
  // Find previous week with entries (or just prev week if no tracking)
  const findPrevWeek = (): number | null => {
    if (!weeksWithEntries || weeksWithEntries.size === 0) {
      return currentWeek > 1 ? currentWeek - 1 : null;
    }
    // Find the highest week with entries that's less than current
    for (let w = currentWeek - 1; w >= 1; w--) {
      if (weeksWithEntries.has(w)) return w;
    }
    return null;
  };

  // Find next week with entries (or just next week if no tracking)
  const findNextWeek = (): number | null => {
    if (!weeksWithEntries || weeksWithEntries.size === 0) {
      return currentWeek < maxWeek ? currentWeek + 1 : null;
    }
    // Find the lowest week with entries that's greater than current
    for (let w = currentWeek + 1; w <= maxWeek; w++) {
      if (weeksWithEntries.has(w)) return w;
    }
    return null;
  };

  const prevWeek = findPrevWeek();
  const nextWeek = findNextWeek();

  const handlePrevWeek = () => {
    if (prevWeek !== null) {
      onWeekChange(prevWeek);
    }
  };

  const handleNextWeek = () => {
    if (nextWeek !== null) {
      onWeekChange(nextWeek);
    }
  };

  // Check if a week has entries
  const hasEntries = (week: number): boolean => {
    return !weeksWithEntries || weeksWithEntries.size === 0 || weeksWithEntries.has(week);
  };

  // Get week label with type indicators
  const getWeekLabel = (week: number): string => {
    if (weekDataTypes && weekDataTypes.has(week)) {
      const types = weekDataTypes.get(week)!;
      const typeStr = formatEntryTypes(types);
      return typeStr ? `${week} (${typeStr})` : `${week}`;
    }
    // Fallback to old behavior
    if (!hasEntries(week)) {
      return `${week} (empty)`;
    }
    return `${week}`;
  };

  // Get weeks to show in dropdown - only weeks with entries, plus current calculated week
  const getDisplayedWeeks = (): number[] => {
    if (!weeksWithEntries || weeksWithEntries.size === 0) {
      // No data - show all weeks up to max
      return Array.from({ length: maxWeek }, (_, i) => i + 1);
    }

    // Include weeks with entries plus the current selected week
    const weeks = new Set(weeksWithEntries);
    weeks.add(currentWeek);

    // Sort and return
    return Array.from(weeks).sort((a, b) => a - b);
  };

  // Check if we can add a new week (calculated week doesn't have entries yet)
  const canAddWeek = calculatedCurrentWeek > 0 && !weeksWithEntries?.has(calculatedCurrentWeek);

  const handleAddWeek = () => {
    onWeekChange(calculatedCurrentWeek);
  };

  const displayedWeeks = getDisplayedWeeks();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePrevWeek}
        disabled={disabled || prevWeek === null}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title={weeksWithEntries?.size ? "Previous week with entries" : "Previous Week"}
      >
        ←
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">Week</span>
        <Select
          value={String(currentWeek)}
          onChange={(value) => onWeekChange(Number(value))}
          disabled={disabled}
          options={displayedWeeks.map((week) => ({
            value: String(week),
            label: getWeekLabel(week),
          }))}
          size="sm"
        />
      </div>

      <button
        onClick={handleNextWeek}
        disabled={disabled || nextWeek === null}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title={weeksWithEntries?.size ? "Next week with entries" : "Next Week"}
      >
        →
      </button>

      {/* Add Week button */}
      {canAddWeek && (
        <button
          onClick={handleAddWeek}
          disabled={disabled}
          className="ml-2 px-3 py-1.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Navigate to Week ${calculatedCurrentWeek}`}
        >
          + Week {calculatedCurrentWeek}
        </button>
      )}
    </div>
  );
}
