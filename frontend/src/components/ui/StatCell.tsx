import type { ReactNode } from 'react';

/**
 * StatCell — the shared value/label(/detail) stat idiom (R-E2-H). Extracted
 * from RosterReadinessCard's original `Stat`, which owned this exact markup
 * first; FairnessSummary's four `StatCard` tiles were the other, divergent
 * copy of the same idea (rounded tile, radius, background) this replaces.
 *
 * `valueClassName` overrides the value's color; the repo has no tailwind-merge,
 * so `text-text-primary` is applied only when no `valueClassName` is passed —
 * two color classes on one element would otherwise resolve by CSS declaration
 * order, not by which one the caller meant.
 */
export interface StatCellProps {
  value: ReactNode;
  label: string;
  /**
   * Optional third line — a caption below the label (e.g. "4/5 obtained").
   * A block slot (rendered in a `<div>`), so it may carry block children —
   * FairnessSummary passes two stacked `<div>` lines.
   */
  detail?: ReactNode;
  /** Overrides the value's color token; omit for the default text-text-primary. */
  valueClassName?: string;
  /** Text alignment for the whole cell. Default 'center'. */
  align?: 'center' | 'start';
}

export function StatCell({ value, label, detail, valueClassName, align = 'center' }: StatCellProps) {
  const alignClass = align === 'start' ? 'text-left' : 'text-center';
  const valueColor = valueClassName ?? 'text-text-primary';
  // Explicit check, not truthiness: a numeric `detail` of 0 must render inside
  // the detail block, not leak a bare "0" text node (`{0 && …}` renders 0).
  const hasDetail = detail !== undefined && detail !== null && detail !== false;

  return (
    <div className={alignClass}>
      <p className={`text-lg font-display font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-text-tertiary leading-none">{label}</p>
      {hasDetail && <div className="mt-1 text-xs text-text-tertiary">{detail}</div>}
    </div>
  );
}
