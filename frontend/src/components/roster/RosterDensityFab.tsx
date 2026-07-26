/**
 * RosterDensityFab — phone-width floating density toggle (Phase C slice C1,
 * D-01 / ex-D-56 mobile rider).
 *
 * v2-tree replacement for legacy `RosterViewToggle` (R-015): the legacy FAB is
 * gated off under v2 inside shared `GroupViewContent` (`!slots?.roster`), and
 * that gate must not change — so the v2 roster ships its own affordance.
 * Composes `IconButton` primitives (the legacy FAB pre-dated the design system
 * and used raw buttons). `sm:hidden` matches the breakpoint of the bottom nav
 * it clears (useDevice's 640px small-screen line). Icons mirror the toolbar's
 * density pair (Rows3 = compact, List = expanded) — one glyph pair per axis.
 *
 * Re-clicking the active Expanded button fires `onReselect` — the R-023
 * expand/collapse-all leg, phone-width (ex-D-56 rider), mirroring how legacy's
 * FAB routed through the same handler as the desktop control.
 */

import { List, Rows3 } from 'lucide-react';
import { IconButton } from '../primitives';
import type { ViewMode } from '../../types';

export interface RosterDensityFabProps {
  density: ViewMode;
  onDensityChange: (mode: ViewMode) => void;
  /** Re-click of the active Expanded button (legacy R-023 expand/collapse-all). */
  onReselect?: (mode: ViewMode) => void;
}

export function RosterDensityFab({ density, onDensityChange, onReselect }: RosterDensityFabProps) {
  return (
    // bottom-[4.5rem]: clears the bottom mobile nav (the shared GroupViewContent
    // still renders MobileBottomNav under v2 at phone widths — pre-existing,
    // Stage-2 scope) — the same clearance legacy's own FAB used (R-015).
    <div className="fixed bottom-[4.5rem] left-4 z-30 flex gap-1 rounded-full border border-border-default bg-surface-raised/90 p-1 shadow-lg backdrop-blur-md sm:hidden">
      <IconButton
        aria-label="Compact cards"
        aria-pressed={density === 'compact'}
        variant={density === 'compact' ? 'primary' : 'ghost'}
        size="sm"
        icon={<Rows3 className="h-4 w-4" />}
        className="rounded-full"
        onClick={() => {
          if (density !== 'compact') onDensityChange('compact');
        }}
      />
      <IconButton
        aria-label="Expanded cards"
        aria-pressed={density === 'expanded'}
        variant={density === 'expanded' ? 'primary' : 'ghost'}
        size="sm"
        icon={<List className="h-4 w-4" />}
        className="rounded-full"
        onClick={() => {
          if (density !== 'expanded') onDensityChange('expanded');
          else onReselect?.('expanded');
        }}
      />
    </div>
  );
}
