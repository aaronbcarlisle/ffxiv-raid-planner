/**
 * LootToolbar — the row above the Loot body (F6d, spec §2.3/§5.4).
 *
 * A flat flex row (RosterToolbar pattern): the Priority⇄History view toggle
 * (leftmost, PR2), the left control cluster (WeekScopeControl in Priority or
 * HistoryFilters in History — slotted by Loot), a spacer, and — for editors —
 * the Loot actions (Reset [history-only], Adjustments, Rules, Log a drop, Log
 * this week's loot).
 */
import type { ReactNode } from 'react';
import { CheckSquare, Gauge, Scan, SlidersHorizontal } from 'lucide-react';
import { Button } from '../primitives/Button';

export interface LootToolbarProps {
  /** Priority ⇄ History SegmentedToggle, slotted by Loot (leftmost). */
  viewToggle?: ReactNode;
  /** Left control cluster — WeekScopeControl (priority) or HistoryFilters (history). */
  weekControl: ReactNode;
  /** History-only Reset dropdown (canEdit), rendered inside the action cluster. */
  resetMenu?: ReactNode;
  canEdit: boolean;
  onLogDrop: () => void;
  onLogWeek: () => void;
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
            Log this week's loot
          </Button>
        </>
      )}
    </div>
  );
}
