/**
 * floorClasses — FloorNumber → static Tailwind utilities for the R-45 floor
 * tokens (Phase-D D1).
 *
 * Static maps, never template strings: Tailwind only generates classes it can
 * see verbatim at build time, so `text-floor-${n}` would silently produce
 * nothing. The utilities exist because `--color-floor-1…4` live in the
 * generated `@theme` block (D0) — the same mechanism as `text-material-twine`.
 *
 * v2-only by construction (R-45): legacy keeps `FLOOR_COLORS` from
 * `gamedata/loot-tables` untouched.
 */
import type { FloorNumber } from '../../gamedata/loot-tables';

/** Floor-coloured text — gear names (R-8), header floor names (mockup `.fname`). */
export const FLOOR_TEXT_CLASS: Record<FloorNumber, string> = {
  1: 'text-floor-1',
  2: 'text-floor-2',
  3: 'text-floor-3',
  4: 'text-floor-4',
};

/**
 * The 3px left accent stripe — R-8's "floor identity stated once, on the
 * card/section header" (mockup `.floor-card { border-left: 3px solid … }`).
 */
export const FLOOR_ACCENT_CLASS: Record<FloorNumber, string> = {
  1: 'border-l-[3px] border-l-floor-1',
  2: 'border-l-[3px] border-l-floor-2',
  3: 'border-l-[3px] border-l-floor-3',
  4: 'border-l-[3px] border-l-floor-4',
};
