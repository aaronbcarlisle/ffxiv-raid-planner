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
  /** Callback to start the next week (advances the week calculation). Only shown if provided. */
  onStartNextWeek?: () => Promise<void>;
  /** Whether the start next week action is in progress */
  isStartingNextWeek?: boolean;
  /** Callback to revert to previous week (undoes start next week). Only shown if provided and week > 1. */
  onRevertWeek?: () => Promise<void>;
  /** Whether the revert week action is in progress */
  isRevertingWeek?: boolean;
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
  onStartNextWeek,
  isStartingNextWeek = false,
  onRevertWeek,
  isRevertingWeek = false,
}: WeekSelectorProps) {
  // Simple sequential navigation - always allow moving to adjacent weeks
  const prevWeek = currentWeek > 1 ? currentWeek - 1 : null;
  const nextWeek = currentWeek < maxWeek ? currentWeek + 1 : null;

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

  // Always show all weeks from 1 to maxWeek in the dropdown
  const getDisplayedWeeks = (): number[] => {
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  };

  // Show "Go to Current Week" when viewing a different week than the calculated current week
  const showGoToCurrentWeek = calculatedCurrentWeek > 0 && currentWeek !== calculatedCurrentWeek;

  const handleGoToCurrentWeek = () => {
    onWeekChange(calculatedCurrentWeek);
  };

  const displayedWeeks = getDisplayedWeeks();

  // Can revert if calculatedCurrentWeek > 1 (has been advanced at least once)
  const canRevertWeek = onRevertWeek && calculatedCurrentWeek > 1;

  return (
    <div className="flex items-center gap-3">
      {/* Revert Week button - shown to the left when week has been advanced */}
      {canRevertWeek && (
        <button
          onClick={onRevertWeek}
          disabled={disabled || isRevertingWeek}
          className="px-3 py-1.5 rounded bg-status-warning/20 hover:bg-status-warning/30 text-status-warning text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-status-warning/30"
          title="Revert to previous week (undo Start Next Week)"
        >
          {isRevertingWeek ? 'Reverting...' : '← Revert Week'}
        </button>
      )}

      <button
        onClick={handlePrevWeek}
        disabled={disabled || prevWeek === null}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title="Previous Week"
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
        />
      </div>

      <button
        onClick={handleNextWeek}
        disabled={disabled || nextWeek === null}
        className="px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary"
        title="Next Week"
      >
        →
      </button>

      {/* Go to Current Week button - shown when viewing a past/future week */}
      {showGoToCurrentWeek && (
        <button
          onClick={handleGoToCurrentWeek}
          disabled={disabled}
          className="ml-2 px-3 py-1.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={`Go to Week ${calculatedCurrentWeek}`}
        >
          Go to Current Week
        </button>
      )}

      {/* Start Next Week button - for manually advancing when auto-calculation is behind */}
      {onStartNextWeek && (
        <button
          onClick={onStartNextWeek}
          disabled={disabled || isStartingNextWeek}
          className="ml-2 px-3 py-1.5 rounded bg-surface-interactive hover:bg-surface-hover text-text-secondary text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-border-default"
          title="Start the next week (use when week calculation is behind your actual raid schedule)"
        >
          {isStartingNextWeek ? 'Starting...' : 'Start Next Week'}
        </button>
      )}
    </div>
  );
}
