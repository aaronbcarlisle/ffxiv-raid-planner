/**
 * ProgressBar + ProgressBarLegend
 *
 * Linear progress primitive for Home cards and other consumers across rings.
 * Shared `ui/` layer — design-system error rules apply:
 *   - No raw color (token vars only)
 *   - Readable text floor: text-xs (12 px)
 *   - jsx-a11y compliant
 *
 * Usage:
 *   <ProgressBar value={0.72} color="role-tank" ariaLabel="Tank BiS progress" />
 *   <ProgressBarLegend />  — renders the default 4 gear-source swatches
 */

/** All valid color keys — maps to a CSS variable token (no hex literals). */
export type ProgressBarColor =
  | 'accent'
  | 'role-tank'
  | 'role-healer'
  | 'role-melee'
  | 'role-ranged'
  | 'role-caster'
  | 'gear-raid'
  | 'gear-tome'
  | 'gear-augmented'
  | 'success'
  | 'warning'
  | 'membership-linked';

/** Maps each color key to the corresponding CSS variable. */
const COLOR_TOKEN: Record<ProgressBarColor, string> = {
  accent: 'var(--color-accent)',
  'role-tank': 'var(--color-role-tank)',
  'role-healer': 'var(--color-role-healer)',
  'role-melee': 'var(--color-role-melee)',
  'role-ranged': 'var(--color-role-ranged)',
  'role-caster': 'var(--color-role-caster)',
  'gear-raid': 'var(--color-gear-raid)',
  'gear-tome': 'var(--color-gear-tome)',
  'gear-augmented': 'var(--color-gear-augmented)',
  success: 'var(--color-status-success)',
  warning: 'var(--color-status-warning)',
  'membership-linked': 'var(--color-membership-linked)',
};

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export interface ProgressBarProps {
  /**
   * Progress ratio in [0, 1]. Values outside that range are clamped.
   * 0 = empty, 1 = full.
   */
  value: number;
  /**
   * Semantic color key. Resolves to the matching CSS token var — never a
   * hex literal (design-system rule: no-arbitrary-color).
   * Defaults to 'accent'.
   */
  color?: ProgressBarColor;
  /**
   * When provided, the track becomes an accessible progressbar with
   * aria-label, aria-valuenow/min/max. Omit for purely decorative bars.
   */
  ariaLabel?: string;
  /** Additional Tailwind classes applied to the outer track element. */
  className?: string;
}

/**
 * A horizontal linear progress bar backed by design-system token colors.
 *
 * Accessible: when `ariaLabel` is set, the track carries `role="progressbar"`
 * with `aria-valuenow` (0–100, rounded integer), `aria-valuemin=0`, and
 * `aria-valuemax=100`. Without `ariaLabel` the bar is purely decorative
 * (no progressbar role emitted).
 */
export function ProgressBar({
  value,
  color = 'accent',
  ariaLabel,
  className = '',
}: ProgressBarProps) {
  const clamped = clamp01(value);
  const pct = Math.round(clamped * 100);
  const fillToken = COLOR_TOKEN[color];

  const a11yProps = ariaLabel
    ? {
        role: 'progressbar' as const,
        'aria-label': ariaLabel,
        'aria-valuenow': pct,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
      }
    : {};

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-surface-interactive${className ? ` ${className}` : ''}`}
      {...a11yProps}
    >
      <div
        data-testid="progress-fill"
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{ width: `${pct}%`, background: fillToken }}
      />
    </div>
  );
}

/** A single swatch + label entry in the legend. */
export interface LegendItem {
  /** Display label — e.g. "raid", "tome (aug)". Must use text-xs floor. */
  label: string;
  /**
   * CSS value for the swatch background. Pass a CSS variable string
   * (e.g. 'var(--color-gear-raid)') or 'transparent' for the "needed" swatch.
   */
  token: string;
}

/** Default gear-source legend items (raid / tome aug / augmented / needed). */
const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { label: 'raid', token: 'var(--color-gear-raid)' },
  { label: 'tome (aug)', token: 'var(--color-gear-tome)' },
  { label: 'augmented', token: 'var(--color-gear-augmented)' },
  { label: 'needed', token: 'transparent' },
];

export interface ProgressBarLegendProps {
  /**
   * Swatch + label pairs. Defaults to the 4 standard gear-source swatches.
   * Supply custom items when used outside the gear-source context.
   */
  items?: LegendItem[];
}

/**
 * Once-per-screen gear-source legend. Renders a row of colour swatches with
 * labels explaining the bar fill colours shown in role-BiS and loot cards.
 *
 * Swatch backgrounds use CSS var tokens (no hex). The "needed" swatch is
 * transparent with a visible border to show it's an empty category.
 */
export function ProgressBarLegend({ items = DEFAULT_LEGEND_ITEMS }: ProgressBarLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Gear source legend">
      {items.map(({ label, token }) => (
        <span key={label} className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm border border-border-default"
            style={{ background: token }}
            aria-hidden="true"
          />
          <span className="text-xs text-text-tertiary leading-none">{label}</span>
        </span>
      ))}
    </div>
  );
}
