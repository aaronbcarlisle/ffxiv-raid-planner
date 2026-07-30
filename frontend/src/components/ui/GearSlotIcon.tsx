/**
 * GearSlotIcon — the generic, monochrome gear-slot glyph (Phase-D R-8 / R-39).
 *
 * R-8 replaces the coloured letter squares that encoded slot AND status AND
 * floor in one 16px element. Splitting those means each element says one thing:
 * the icon says *which slot*, the gear name (floor-coloured, R-8) says *which
 * floor*, and status is carried elsewhere. So this glyph is deliberately
 * **status-free and colour-free** — "it reads as an icon, not as a status".
 *
 * Monochrome via CSS mask + `currentColor` rather than the pre-tinted PNG sets
 * under `public/images/gear-slots/{white,black,…}`: a fixed white asset is
 * invisible on the light theme, and picking a variant per theme would hard-code
 * a colour decision the token layer already owns. Masking makes the glyph take
 * the inherited text colour, so it follows the theme for free and a caller can
 * tint it by setting `color` — which R-8 says not to do on Priority/Log/History
 * rows, but which the design-system reference page needs in order to show it.
 *
 * Consumers (Phase D): the v2 Need matrix (D3), the Log grid (D5/D6), and
 * History's Slot cell (D9a).
 */
import { GEAR_SLOT_ICONS, GEAR_SLOT_NAMES } from '../../types';
import type { LootSlot } from '../../types';

export interface GearSlotIconProps {
  /** `LootSlot`, so a logged entry's bare `'ring'` works without normalising first. */
  slot: LootSlot;
  /** Square edge in px. Default 16 — the row-leading size R-39 specifies. */
  size?: number;
  className?: string;
  /**
   * Accessible name. Omitted = decorative, which is the R-39 case: the glyph
   * leads a cell that already spells the slot out, so announcing it would
   * double-read. Pass `true` for the slot's own display name, or a string to
   * override it, where the glyph stands alone.
   */
  label?: string | true;
}

/** `'ring'` is a loot-log value with no gear-slot entry of its own; both rings share art. */
function iconFor(slot: LootSlot): string {
  return slot === 'ring' ? GEAR_SLOT_ICONS.ring1 : GEAR_SLOT_ICONS[slot];
}

/**
 * Display name for the accessible fallback; `'ring'` reads as the generic "Ring".
 * Deliberately NOT exported — `react-refresh/only-export-components` is an error
 * in this repo, and callers that need the name already import `GEAR_SLOT_NAMES`.
 */
function gearSlotLabel(slot: LootSlot): string {
  return slot === 'ring' ? 'Ring' : GEAR_SLOT_NAMES[slot];
}

export function GearSlotIcon({ slot, size = 16, className = '', label }: GearSlotIconProps) {
  const url = `url(${iconFor(slot)})`;
  const accessibleName = label === true ? gearSlotLabel(slot) : label;

  return (
    <span
      // design-system-ignore: mask-image has no Tailwind utility; the only
      // colour here is `currentColor` via bg-current, so no token is bypassed.
      role={accessibleName ? 'img' : undefined}
      aria-label={accessibleName}
      aria-hidden={accessibleName ? undefined : true}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
