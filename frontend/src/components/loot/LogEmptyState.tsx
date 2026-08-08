/**
 * LogEmptyState — the Log tab's body until the weekly grid arrives (D4).
 *
 * D4 makes Log a real destination: it owns the displayed week and hosts the
 * week control, but its *body* is still a placeholder. This card names what
 * lands here rather than faking it — no disabled buttons and no skeleton cells
 * standing in for D5's grid, because a control that can't do anything is worse
 * than an honest statement of what's next.
 *
 * Its lifetime is longer than "until D5": the phase dependency graph puts D8
 * before D5, so this stub survives at least two more slices.
 */
import { CalendarRange } from 'lucide-react';

import { EmptyState } from '../ui/EmptyState';

export function LogEmptyState() {
  return (
    <div
      data-testid="log-empty-state"
      className="rounded-lg border border-border-default bg-surface-card"
    >
      <EmptyState
        icon={<CalendarRange size={24} aria-hidden />}
        heading="The week's record lands here"
        description="Next up: the weekly grid — four floor rows, one cell per slot — so a static can read a whole week at a glance. Until then, pick a week with the control above, and use History for the full record."
      />
    </div>
  );
}
