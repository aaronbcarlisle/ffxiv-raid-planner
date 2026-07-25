import type { ReactNode } from 'react';

interface TwoRegionDashboardProps {
  /** Actionable left region (1.85fr) — primary actions and attention items */
  main: ReactNode;
  /** Ambient right region (1fr) — contextual / glanceable info */
  side: ReactNode;
  /** Extra Tailwind classes forwarded to the grid wrapper */
  className?: string;
}

/**
 * TwoRegionDashboard — shared two-column layout shell.
 *
 * Renders a CSS grid with an actionable left column (1.85fr) and an ambient
 * right column (1fr), separated by an 18px gap. Collapses to a single column
 * at ≤1180px via the `min-[1181px]` arbitrary breakpoint (matching the mockup
 * exactly). Pure layout — no store, no color, no business logic.
 *
 * Used by: Home (ring-0), Schedule (ring-1). Shared placement is required
 * because both rings consume it; `ui/` is the only layer importable by both.
 */
export function TwoRegionDashboard({ main, side, className }: TwoRegionDashboardProps) {
  const base = 'grid grid-cols-1 min-[1181px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-[18px] items-start';
  const cls = className ? `${base} ${className}` : base;

  return (
    <div className={cls}>
      <div>{main}</div>
      <div>{side}</div>
    </div>
  );
}
