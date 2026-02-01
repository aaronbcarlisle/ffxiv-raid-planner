/**
 * Week Stepper
 *
 * Navigation component for selecting raid week using Dot Stepper design.
 * Static width - all controls always visible (disabled when not applicable).
 * Shows up to 3 dots with the current week taking 60% of dot area (100% if only 1 week).
 */

import { useState } from 'react';
import { Target, RotateCcw, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WeekEntryType } from '../../stores/lootTrackingStore';
import { Tooltip } from '../primitives/Tooltip';

interface WeekStepperProps {
  currentWeek: number;
  maxWeek: number;
  calculatedCurrentWeek: number;
  onWeekChange: (week: number) => void;
  disabled?: boolean;
  /** Set of weeks that have loot entries (for highlighting/skipping) */
  weeksWithEntries?: Set<number>;
  /** Map of week -> entry types for enhanced display */
  weekDataTypes?: Map<number, WeekEntryType[]>;
  /** Callback to start the next week */
  onStartNextWeek?: () => Promise<void>;
  /** Whether the start next week action is in progress */
  isStartingNextWeek?: boolean;
  /** Callback to revert to previous week */
  onRevertWeek?: () => Promise<void>;
  /** Whether the revert week action is in progress */
  isRevertingWeek?: boolean;
}

/** Entry type colors matching app's material/status colors */
const ENTRY_TYPE_COLORS: Record<WeekEntryType, string> = {
  loot: 'var(--color-accent)',           // Teal
  books: 'var(--color-membership-lead)', // Purple
  mats: 'var(--color-status-warning)',   // Amber
};

/** Vertical status dots - always shows 3 dots, colors only active ones */
function StatusDots({ types }: { types: WeekEntryType[] }) {
  const typeSet = new Set(types);

  // Always show all 3 in order: loot, books, mats
  const allTypes: WeekEntryType[] = ['loot', 'books', 'mats'];

  return (
    <Tooltip
      content={
        types.length > 0 ? (
          <div className="text-xs">
            {types.map((t) => (
              <div key={t} className="capitalize">{t} logged</div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-text-secondary">No entries logged</span>
        )
      }
    >
      <div className="flex flex-col gap-0.5 ml-1">
        {allTypes.map((type) => (
          <div
            key={type}
            className="rounded-full"
            style={{
              width: 5,
              height: 5,
              background: typeSet.has(type)
                ? ENTRY_TYPE_COLORS[type]
                : 'var(--color-border-default)',
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
}

// Fixed width for the dots area (px)
const DOTS_AREA_WIDTH = 72;
// Gap between dots (px)
const DOTS_GAP = 6;
// Maximum visible dots
const MAX_VISIBLE_DOTS = 3;

export function WeekStepper({
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
}: WeekStepperProps) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  // Calculate visible weeks (sliding window of up to 3, centered on current)
  const visibleWeeks = (() => {
    if (maxWeek <= MAX_VISIBLE_DOTS) {
      return Array.from({ length: maxWeek }, (_, i) => i + 1);
    }

    // Center current week in the window
    let start = currentWeek - 1; // Try to put current in middle
    if (start < 1) start = 1;
    if (start + MAX_VISIBLE_DOTS - 1 > maxWeek) {
      start = maxWeek - MAX_VISIBLE_DOTS + 1;
    }

    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, i) => start + i);
  })();

  // Calculate dot widths based on number of visible weeks
  const getDotWidth = (isActive: boolean): number => {
    const numDots = visibleWeeks.length;
    const totalGaps = (numDots - 1) * DOTS_GAP;
    const availableWidth = DOTS_AREA_WIDTH - totalGaps;

    if (numDots === 1) {
      return availableWidth; // 100%
    }

    if (isActive) {
      return availableWidth * 0.6; // 60% for active
    }

    // Remaining 40% split among inactive dots
    const inactiveDots = numDots - 1;
    return (availableWidth * 0.4) / inactiveDots;
  };

  // Check if a week has entries
  const hasEntries = (week: number): boolean => {
    return weekDataTypes?.has(week) ?? weeksWithEntries?.has(week) ?? false;
  };

  // Get entry types for a week
  const getEntryTypes = (week: number): WeekEntryType[] => {
    return weekDataTypes?.get(week) ?? [];
  };

  // Navigation handlers
  const handlePrevWeek = () => {
    if (currentWeek > 1 && !disabled) {
      onWeekChange(currentWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (currentWeek < maxWeek && !disabled) {
      onWeekChange(currentWeek + 1);
    }
  };

  const handleGoToCurrentWeek = () => {
    if (calculatedCurrentWeek > 0 && currentWeek !== calculatedCurrentWeek) {
      onWeekChange(calculatedCurrentWeek);
    }
  };

  // Button states (always shown, but may be disabled)
  const canGoPrev = currentWeek > 1;
  const canGoNext = currentWeek < maxWeek;
  const canRevert = onRevertWeek && calculatedCurrentWeek > 1;
  const canGoToCurrent = calculatedCurrentWeek > 0 && currentWeek !== calculatedCurrentWeek;

  // Current week entry types for status display
  const currentWeekTypes = getEntryTypes(currentWeek);

  return (
    <div
      className="inline-flex items-center gap-2 bg-surface-card rounded-xl border border-border-default shadow-md"
      style={{ padding: '8px 12px' }}
    >
      {/* Revert Week button - always visible */}
      <Tooltip
        content={
          canRevert ? (
            <div className="flex items-start gap-2 max-w-xs">
              <RotateCcw className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Revert Week</div>
                <div className="text-text-secondary text-xs mt-0.5">
                  Moves the week calculation back by one week. Your logged data stays intact.
                </div>
              </div>
            </div>
          ) : (
            <span className="text-text-secondary">Cannot revert from week 1</span>
          )
        }
      >
        <button
          type="button"
          onClick={canRevert ? onRevertWeek : undefined}
          disabled={disabled || !canRevert || isRevertingWeek}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
            canRevert && !disabled
              ? 'text-status-warning/60 hover:text-status-warning hover:bg-status-warning/10'
              : 'text-text-disabled/30 cursor-not-allowed'
          }`}
        >
          {isRevertingWeek ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </button>
      </Tooltip>

      {/* Separator */}
      <div className="w-px h-4 bg-border-default" />

      {/* Prev button - always visible */}
      <button
        type="button"
        onClick={handlePrevWeek}
        disabled={disabled || !canGoPrev}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
          canGoPrev && !disabled
            ? 'text-text-muted hover:text-accent hover:bg-accent/10'
            : 'text-text-disabled/30 cursor-not-allowed'
        }`}
        aria-label="Previous week"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Dot Stepper - fixed width */}
      <div
        className="flex items-center justify-center"
        style={{ width: `${DOTS_AREA_WIDTH}px`, gap: `${DOTS_GAP}px` }}
      >
        {visibleWeeks.map((week) => {
          const isActive = week === currentWeek;
          const hasData = hasEntries(week);
          const isHovered = hoveredWeek === week;
          const types = getEntryTypes(week);
          const dotWidth = getDotWidth(isActive);

          return (
            <Tooltip
              key={week}
              content={
                <div>
                  <div className="font-medium">Week {week}</div>
                  {types.length > 0 ? (
                    <div className="text-text-secondary text-xs mt-0.5">
                      Logged: {types.join(', ')}
                    </div>
                  ) : (
                    <div className="text-text-secondary text-xs mt-0.5">
                      No entries logged
                    </div>
                  )}
                </div>
              }
            >
              <button
                type="button"
                onClick={() => !disabled && onWeekChange(week)}
                disabled={disabled}
                onMouseEnter={() => setHoveredWeek(week)}
                onMouseLeave={() => setHoveredWeek(null)}
                className="transition-all duration-200 ease-out p-0 flex-shrink-0"
                style={{
                  width: dotWidth,
                  height: 8,
                  borderRadius: 4,
                  background: isActive
                    ? 'linear-gradient(90deg, var(--color-accent-hover), var(--color-accent))'
                    : isHovered && !disabled
                      ? 'var(--color-accent-dim)'
                      : hasData
                        ? 'rgba(20, 184, 166, 0.3)'
                        : 'var(--color-surface-interactive)',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: isActive ? '0 0 8px rgba(20, 184, 166, 0.3)' : 'none',
                }}
                aria-label={`Week ${week}`}
                aria-current={isActive ? 'true' : undefined}
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Next button - always visible */}
      <button
        type="button"
        onClick={handleNextWeek}
        disabled={disabled || !canGoNext}
        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
          canGoNext && !disabled
            ? 'text-text-muted hover:text-accent hover:bg-accent/10'
            : 'text-text-disabled/30 cursor-not-allowed'
        }`}
        aria-label="Next week"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-px h-4 bg-border-default" />

      {/* Week label - fixed width */}
      <span className="font-mono text-sm font-semibold text-text-primary" style={{ width: '56px' }}>
        Week {currentWeek}
      </span>

      {/* Status dots */}
      <StatusDots types={currentWeekTypes} />

      {/* Go to Current Week button - always visible */}
      <Tooltip
        content={
          canGoToCurrent
            ? `Go to current week (Week ${calculatedCurrentWeek})`
            : 'Already viewing current week'
        }
      >
        <button
          type="button"
          onClick={canGoToCurrent ? handleGoToCurrentWeek : undefined}
          disabled={disabled || !canGoToCurrent}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            canGoToCurrent && !disabled
              ? 'text-accent/60 hover:text-accent hover:bg-accent/10'
              : 'text-text-disabled/30 cursor-not-allowed'
          }`}
        >
          <Target className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* Start Next Week button - always visible */}
      <Tooltip
        content={
          <div className="flex items-start gap-2 max-w-xs">
            <Plus className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Start Next Week</div>
              <div className="text-text-secondary text-xs mt-0.5">
                Manually advances the week calculation by one week.
              </div>
            </div>
          </div>
        }
      >
        <button
          type="button"
          onClick={onStartNextWeek}
          disabled={disabled || isStartingNextWeek || !onStartNextWeek}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
            onStartNextWeek && !disabled
              ? 'text-text-muted hover:text-accent hover:bg-accent/10'
              : 'text-text-disabled/30 cursor-not-allowed'
          }`}
        >
          {isStartingNextWeek ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}

export default WeekStepper;
