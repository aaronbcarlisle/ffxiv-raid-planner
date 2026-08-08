/**
 * The status-circle cycle hint, shared by both card densities.
 *
 * Lived in `RosterGearTable` until the compact strip needed it too (2026-07-28):
 * compact wraps its ICON in the item hover card, so the PIP needs its own
 * tooltip or hovering a pip would explain the item rather than the control.
 *
 * Names the BiS source, because that is what decides whether the circle is a
 * 2-state toggle or the 3-state tome cycle with its augment step.
 */

import type { ReactNode } from 'react';
import { BIS_SOURCE_FULL_NAMES, type GearSource } from '../../types';

export function cycleHint(bisSource: GearSource, requiresAug: boolean, label?: string): ReactNode {
  const threeStep = bisSource === 'tome' && requiresAug;
  return (
    <div className="max-w-[15rem]">
      <div className="font-medium">{label ?? `${BIS_SOURCE_FULL_NAMES[bisSource]} status`}</div>
      <div className="mt-1 text-xs text-text-secondary">
        {threeStep
          ? 'Click or press Enter/Space to cycle: empty → base obtained (ring) → augmented (filled).'
          : 'Click or press Enter/Space to toggle: empty ↔ obtained (filled).'}
      </div>
    </div>
  );
}
