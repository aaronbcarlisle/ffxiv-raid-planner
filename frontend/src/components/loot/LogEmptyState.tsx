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
 *
 * Lays out its own body (icon chip, heading, description) instead of the
 * shared `EmptyState` primitive: `EmptyState` hardcodes centered, narrow
 * content for Dashboard/GroupView/History, and centering that on this card's
 * full-width (120rem) layout reads as a small blob lost in a lot of empty
 * space. Overriding `items-center`/`text-center` via className would be a
 * Tailwind cascade-order fight (same specificity, order depends on the
 * stylesheet, not the className string) rather than an honest override, so
 * this reuses the same visual vocabulary directly, left-aligned instead.
 */
import { CalendarRange } from 'lucide-react';

export function LogEmptyState() {
  return (
    <div
      data-testid="log-empty-state"
      className="rounded-lg border border-border-default bg-surface-card flex flex-col items-start py-12 px-4"
    >
      <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4 text-accent">
        <CalendarRange size={24} aria-hidden />
      </div>
      <h3 className="font-display text-lg text-text-primary mb-2">The week&apos;s record lands here</h3>
      <p className="text-text-secondary text-sm max-w-md">
        Next up: the weekly grid — four floor rows, one cell per slot — so a static can read a whole
        week at a glance. The week above sets where new drops are logged; History has the full record.
      </p>
    </div>
  );
}
