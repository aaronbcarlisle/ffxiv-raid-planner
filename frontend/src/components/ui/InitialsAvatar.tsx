import type { CSSProperties } from 'react';

export type InitialsAvatarFontWeight = 'medium' | 'semibold' | 'bold';
export type InitialsAvatarTextSize = 'sm' | 'xs' | '2xs';

const FONT_WEIGHT: Record<InitialsAvatarFontWeight, CSSProperties['fontWeight']> = {
  medium: 500,
  semibold: 600,
  bold: 700,
};

const TEXT_SIZE_CLASS: Record<'sm' | 'xs', string> = {
  sm: 'text-sm',
  xs: 'text-xs',
};

// Tailwind border-width utilities for the widths this component's call sites
// actually use — kept as CLASSES (not just inline style) so a pre-existing
// `toHaveClass('border-2', ...)` regression pin (RecipientPicker.test.tsx)
// keeps working: the inline `borderColor` still carries the (often dynamic,
// per-role) color, this class only supplies the width/style.
const BORDER_WIDTH_CLASS: Record<number, string> = {
  1: 'border',
  2: 'border-2',
};

export interface InitialsAvatarProps {
  /** Pre-derived initials text. Callers own the derivation (each pre-existing
   * call site had a slightly different 1-2-letter rule) — this is a pure
   * visual shell, so swapping a call site over never changes what text
   * renders, only how it's centered. */
  initials: string;
  /** Circle diameter — a px number, or any CSS length/`var()` expression
   * (e.g. `'var(--nav-item-icon-size, 24px)'`, `'100%'`). */
  size: number | string;
  /** Background fill — a CSS color/token expression (`var(--color-*)`,
   * `color-mix(...)`), for values only known at render time (e.g. a
   * per-entry accent). Omit and use `className` (e.g. `bg-surface-interactive`)
   * for a static Tailwind-expressible background instead. */
  background?: string;
  /** Border color — a CSS color/token expression (often a per-role token).
   * Omit for no border. */
  borderColor?: string;
  /** Border width in px. Only applied when `borderColor` is set. Default 2. */
  borderWidth?: number;
  /** Default 'semibold'. */
  fontWeight?: InitialsAvatarFontWeight;
  /**
   * 'xs' (12px, default — the design-system floor), 'sm' (14px), or '2xs'
   * (10px). '2xs' is BELOW the floor: only use it inside a glyph small
   * enough (<=24px) that 12px text would overflow, and only where the
   * player's name renders directly adjacent (decorative-first) — see the
   * `design-system-ignore` on that branch below, carried forward from the
   * original ui/PriorityRow.tsx ignore this component replaces.
   */
  textSize?: InitialsAvatarTextSize;
  /** Extra classes — the escape hatch for Tailwind-expressible colors
   * (e.g. `"bg-accent/20 text-accent"`) that a raw CSS expression can't
   * reproduce exactly (opacity-modified utilities use Tailwind's own
   * color-mix, not a hand-rolled one). */
  className?: string;
}

/**
 * InitialsAvatar — the shared circular initials fallback for every
 * avatar-shaped surface (rail chips, roster/loot identity rows, recipient
 * pickers, the members list). Extracted from independently hand-rolled
 * copies (Phase D feedback-polish Task 6) that all centered their initials
 * text with `flex`/`grid` + `items-center`/`place-items-center` — which a
 * GLOBAL a11y-compat rule (`index.css` — `[aria-hidden="true"] { display:
 * revert !important }`, added to stop Radix from hiding dropdown siblings)
 * silently strips from ANY `aria-hidden` element. `revert` falls back to
 * the element's blockified UA default (`display: block`, since a flex/grid
 * *item* whose own display resolves to `inline` gets blockified per the
 * CSS Display spec) — a plain block box just top-aligns its one line of
 * text instead of centering it. That's the "off-center initials" defect
 * the owner reported: measured in the browser, the rail chip's text sat
 * 4.5px above true center in a 24px circle (offset -4.5px), and the
 * Queues priority-chip's text sat 4px above center in a 22px circle.
 *
 * The global rule already carves out an escape hatch for exactly this
 * case — `:not([role="presentation"])` — so the fix is `role="presentation"`
 * alongside the existing `aria-hidden="true"`: redundant for a11y
 * (`aria-hidden` already removes the subtree from the tree), but it opts
 * this decorative circle out of the override so its own flex centering
 * renders as authored. Verified in-browser: the rail chip's offset went
 * from -4.5px to -0.5px, and the priority-chip's from -4px to 0px.
 */
export function InitialsAvatar({
  initials,
  size,
  background,
  borderColor,
  borderWidth = 2,
  fontWeight = 'semibold',
  textSize = 'xs',
  className = '',
}: InitialsAvatarProps) {
  const dimension = typeof size === 'number' ? `${size}px` : size;
  const hasBorder = borderColor !== undefined;
  const borderWidthClass = hasBorder ? (BORDER_WIDTH_CLASS[borderWidth] ?? '') : '';
  const style: CSSProperties = {
    width: dimension,
    height: dimension,
    fontWeight: FONT_WEIGHT[fontWeight],
    ...(background !== undefined ? { background } : {}),
    ...(hasBorder
      ? {
          borderColor,
          borderStyle: 'solid',
          // Only needed as inline style when no Tailwind width class covers
          // this borderWidth (BORDER_WIDTH_CLASS miss) — otherwise the class
          // already supplies the width.
          ...(borderWidthClass === '' ? { borderWidth: `${borderWidth}px` } : {}),
        }
      : {}),
  };

  if (textSize === '2xs') {
    return (
      <span
        aria-hidden="true"
        role="presentation"
        /* design-system-ignore: 10px initials inside a small (<=24px) avatar glyph — decorative,
           the player's name always renders directly adjacent. Carried forward verbatim from the
           original ui/PriorityRow.tsx ignore (Phase D feedback-polish Task 6 extraction):
           role-colored ring + neutral fill/text avoids the white-on-pastel contrast failure a
           filled circle would hit for several role colors (e.g. healer/ranged/caster). */
        className={`flex flex-none items-center justify-center rounded-full text-[10px] leading-none ${borderWidthClass} ${className}`}
        style={style}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      role="presentation"
      className={`flex flex-none items-center justify-center rounded-full leading-none ${TEXT_SIZE_CLASS[textSize]} ${borderWidthClass} ${className}`}
      style={style}
    >
      {initials}
    </span>
  );
}
