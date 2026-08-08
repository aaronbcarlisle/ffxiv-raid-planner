/**
 * LootToolbar — the row above the Loot body (F6d, spec §2.3/§5.4; D4).
 *
 * A flat flex row (RosterToolbar pattern): the Priority ⇄ Log ⇄ History view
 * toggle (leftmost, PR2), the left control cluster (the Log tab's
 * WeekScopeControl or History's HistoryFilters — slotted by Loot; Priority
 * slots nothing, since R-15 moved the week to Log and Priority is always the
 * clock's current week), a spacer, and — for editors — the Loot actions (Reset
 * [history-only], Adjustments, Rules, Log a drop, and the week-logging wizard).
 *
 * The wizard button names its week: R-22 requires the clock's mutations to say
 * which week they act on, and the same honesty applies to a write action that
 * can target a back-dated week. `logWeekLabel` carries that name when the Log
 * tab is showing a week other than the clock's; unset keeps the default copy.
 */
import type { ReactNode } from 'react';
import { CheckSquare, Gauge, Scan, SlidersHorizontal } from 'lucide-react';
import { Button } from '../primitives/Button';

export interface LootToolbarProps {
  /** Priority ⇄ Log ⇄ History SegmentedToggle, slotted by Loot (leftmost). */
  viewToggle?: ReactNode;
  /** Left control cluster — WeekScopeControl (log) or HistoryFilters (history); Priority slots nothing. */
  weekControl: ReactNode;
  /** History-only Reset dropdown (canEdit), rendered inside the action cluster. */
  resetMenu?: ReactNode;
  canEdit: boolean;
  onLogDrop: () => void;
  onLogWeek: () => void;
  /** Overrides the wizard button's copy so it can name a back-dated week (e.g. "Log Week 2 loot"). */
  logWeekLabel?: string;
  onOpenAdjustments: () => void;
  onOpenRules: () => void;
}

export function LootToolbar({
  viewToggle,
  weekControl,
  resetMenu,
  canEdit,
  onLogDrop,
  onLogWeek,
  logWeekLabel,
  onOpenAdjustments,
  onOpenRules,
}: LootToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {viewToggle}
      {weekControl}
      <div className="flex-1" />
      {canEdit && (
        <>
          {resetMenu}
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
            onClick={onOpenAdjustments}
          >
            Adjustments
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}
            onClick={onOpenRules}
          >
            Rules
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Scan className="h-3.5 w-3.5" aria-hidden />}
            onClick={onLogDrop}
          >
            Log a drop
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CheckSquare className="h-3.5 w-3.5" aria-hidden />}
            onClick={onLogWeek}
          >
            {logWeekLabel ?? "Log this week's loot"}
          </Button>
        </>
      )}
    </div>
  );
}
