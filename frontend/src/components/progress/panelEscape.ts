/**
 * The open farm row's Escape filter (S2a-3a·G2 Task TG3; R-S3-4, vet I-2). Escape closes the
 * panel only when no layer took the key already (`defaultPrevented`: `Modal` and Radix's
 * `Popover` prevent the Escape they dismiss on) and when it was pressed inside the panel's own
 * DOM. React bubbles a portal's events through the React tree, so an Escape in a portalled
 * picker or confirm reaches the panel's handler too, with a target outside it, and is left to
 * that layer.
 */
import type { KeyboardEvent } from 'react';

export function escapeClosesPanel(
  event: Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'target'>,
  panel: HTMLElement | null,
): boolean {
  return event.key === 'Escape' && !event.defaultPrevented && panel !== null && panel.contains(event.target as Node);
}
