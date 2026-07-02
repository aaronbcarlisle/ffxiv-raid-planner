/**
 * LootToolbar — the row above the Loot floor cards (F6d, spec §2.3/§5.4).
 *
 * A flat flex row (RosterToolbar pattern): the shared week-scope control slotted
 * on the left, a spacer, and — for editors — the Loot actions (Adjustments,
 * Rules, Log a drop, Log this week's loot). No view SegmentedToggle in PR1:
 * Priority is the only view; the Priority⇄History toggle arrives with History
 * in PR2.
 */
import type { ReactNode } from 'react';
import { CheckSquare, Gauge, Scan, SlidersHorizontal } from 'lucide-react';
import { Button } from '../primitives/Button';

export interface LootToolbarProps {
  /** The <WeekScopeControl/> instance, slotted by Loot (owns the shared clock). */
  weekControl: ReactNode;
  canEdit: boolean;
  onLogDrop: () => void;
  onLogWeek: () => void;
  onOpenAdjustments: () => void;
  onOpenRules: () => void;
}

export function LootToolbar({
  weekControl,
  canEdit,
  onLogDrop,
  onLogWeek,
  onOpenAdjustments,
  onOpenRules,
}: LootToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {weekControl}
      <div className="flex-1" />
      {canEdit && (
        <>
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
