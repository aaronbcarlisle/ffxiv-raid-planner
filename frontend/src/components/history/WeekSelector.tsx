/**
 * Week Selector
 *
 * Navigation component for selecting raid week.
 * Shows current week with prev/next buttons.
 * Shows type indicators (loot/books/mats) for weeks with data.
 * Includes "Add Week" button to navigate to current calculated week.
 */

import { Target, RotateCcw, Plus, Loader2 } from 'lucide-react';
import type { WeekEntryType } from '../../stores/lootTrackingStore';
import { Select } from '../ui';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Tooltip } from '../primitives/Tooltip';

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

  // Can revert if calculatedCurrentWeek > 1 (has been advanced at least once).
  // Note: This may show the button for tiers where week_start_date is None and
  // calculatedCurrentWeek > 1 due to time passing. Backend will return a clear
  // error ("no week start date set") in that case.
  const canRevertWeek = onRevertWeek && calculatedCurrentWeek > 1;

  return (
    <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-between sm:justify-center w-full sm:w-auto">
      {/* Revert Week button - shown to the left when week has been advanced */}
      {canRevertWeek && (
        <Tooltip
          content={
            <div className="flex items-start gap-2 max-w-xs">
              <RotateCcw className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Revert Week</div>
                <div className="text-text-secondary text-xs mt-0.5">
                  Moves the week calculation back by one week. Use this to undo an accidental "Start Next Week". Your logged data stays intact.
                </div>
              </div>
            </div>
          }
        >
          <IconButton
            aria-label="Revert to previous week"
            icon={isRevertingWeek ? <Loader2 className="w-4 h-4 animate-spin text-status-warning" /> : <RotateCcw className="w-4 h-4 text-status-warning" />}
            size="sm"
            onClick={onRevertWeek}
            disabled={disabled || isRevertingWeek}
            className="bg-status-warning/20 border-status-warning/30 text-status-warning hover:bg-status-warning/30"
          />
        </Tooltip>
      )}

      <Tooltip
        content={
          <div>
            <div className="flex items-center gap-2 font-medium">
              Previous Week
              <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">←</kbd>
            </div>
            <div className="text-text-secondary text-xs mt-0.5">Navigate to the previous week</div>
          </div>
        }
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrevWeek}
          disabled={disabled || prevWeek === null}
        >
          ←
        </Button>
      </Tooltip>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
        <Tooltip
          content={
            <div>
              <div className="font-medium">Week {currentWeek}</div>
              <div className="text-text-secondary text-xs mt-0.5">
                {weekDataTypes && weekDataTypes.has(currentWeek)
                  ? `Logged: ${formatEntryTypes(weekDataTypes.get(currentWeek)!)}`
                  : 'No entries logged'}
              </div>
            </div>
          }
        >
          <span className="hidden sm:inline text-sm text-text-muted cursor-help">Week</span>
        </Tooltip>
        <div className="flex-1 sm:flex-none">
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
      </div>

      <Tooltip
        content={
          <div>
            <div className="flex items-center gap-2 font-medium">
              Next Week
              <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">→</kbd>
            </div>
            <div className="text-text-secondary text-xs mt-0.5">Navigate to the next week</div>
          </div>
        }
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNextWeek}
          disabled={disabled || nextWeek === null}
        >
          →
        </Button>
      </Tooltip>

      {/* Go to Current Week button - shown when viewing a past/future week */}
      {showGoToCurrentWeek && (
        <Tooltip content={`Go to current week (Week ${calculatedCurrentWeek})`}>
          <IconButton
            aria-label={`Go to current week (Week ${calculatedCurrentWeek})`}
            icon={<Target className="w-4 h-4" />}
            variant="primary"
            size="sm"
            onClick={handleGoToCurrentWeek}
            disabled={disabled}
          />
        </Tooltip>
      )}

      {/* Start Next Week button - for manually advancing when auto-calculation is behind */}
      {onStartNextWeek && (
        <Tooltip
          content={
            <div className="flex items-start gap-2 max-w-xs">
              <Plus className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Start Next Week</div>
                <div className="text-text-secondary text-xs mt-0.5">
                  Manually advances the week calculation by one week. Use when your raid schedule is ahead of the automatic calculation.
                </div>
              </div>
            </div>
          }
        >
          <IconButton
            aria-label="Start next week"
            icon={isStartingNextWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            variant="default"
            size="sm"
            onClick={onStartNextWeek}
            disabled={disabled || isStartingNextWeek}
          />
        </Tooltip>
      )}
    </div>
  );
}
