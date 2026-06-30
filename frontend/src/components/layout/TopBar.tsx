/**
 * TopBar (F6a, Task 9) — the v2 shell's top chrome bar.
 *
 *   [StaticPicker] › [TierSelector] [⋮]   [Week n ‹ ›]   ──spacer──   [⌘K][🔔][⚙][☾]
 *
 * Composed from the new conformant `StaticPicker` + the `TierBreadcrumb`
 * composition fragment (which reuses the legacy `TierSelector` as-is; it lives
 * in `pages/` because Shell may not import Ring 0 under the F4 boundaries):
 *   • `StaticPicker`   — new (Task 9), replaces the legacy ContextSwitcher Static segment.
 *   • `TierBreadcrumb` — `› TierSelector [⋮]`, reuses TierSelector via `onTierChange`.
 *   • week indicator   — minimal, reads `currentWeek` from lootTrackingStore.
 *   • affordances      — ⌘K / bell / gear / theme placeholders wired in Tasks 10/11
 *                        (⌘K already calls the passed `onOpenPalette`).
 *
 * Conformant + boundary-clean by construction: design-system primitives only,
 * semantic tokens, 12px+ text, no raw `<button>`, and no Ring 0 imports. Legacy
 * Header/ContextSwitcher/TierSelector internals are untouched (byte-for-byte).
 */

import { ChevronLeft, ChevronRight, Command, Bell, Settings, Sun } from 'lucide-react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import { TierBreadcrumb } from '../../pages/TierBreadcrumb';
import { IconButton, Tooltip } from '../primitives';
import { StaticPicker } from './StaticPicker';

interface TopBarProps {
  /** Open the command palette (Task 10 builds the palette itself). */
  onOpenPalette: () => void;
}

/** Minimal read-only-ish week indicator. Reads `currentWeek` from the loot store
 *  and renders `Week {n}`; prev/next nudge the store's displayed week (clamped to
 *  [1, maxWeek]) via the canonical Zustand setter — no new week state lives here.
 *  Full week navigation is a Task 10/11 concern. */
function WeekIndicator() {
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);
  const maxWeek = useLootTrackingStore((s) => s.maxWeek);

  const canPrev = currentWeek > 1;
  const canNext = currentWeek < maxWeek;

  const goto = (week: number) => {
    if (week < 1 || week > maxWeek) return;
    useLootTrackingStore.setState({ currentWeek: week });
  };

  return (
    <div className="hidden md:flex items-center gap-1">
      <IconButton
        aria-label="Previous week"
        icon={<ChevronLeft className="w-4 h-4" />}
        variant="ghost"
        size="sm"
        disabled={!canPrev}
        onClick={() => goto(currentWeek - 1)}
      />
      <span className="text-xs font-medium text-text-secondary tabular-nums select-none min-w-[3.5rem] text-center">
        Week {currentWeek}
      </span>
      <IconButton
        aria-label="Next week"
        icon={<ChevronRight className="w-4 h-4" />}
        variant="ghost"
        size="sm"
        disabled={!canNext}
        onClick={() => goto(currentWeek + 1)}
      />
    </div>
  );
}

export function TopBar({ onOpenPalette }: TopBarProps) {
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const groups = useStaticGroupStore((s) => s.groups);
  const fetchGroups = useStaticGroupStore((s) => s.fetchGroups);
  const tiers = useTierStore((s) => s.tiers);

  const { userRole, isMember } = useStaticPermissions();

  return (
    <header
      className="sticky top-0 z-40 border-b border-border-default"
      style={{ background: 'var(--color-surface-nav, var(--color-surface-raised))' }}
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 h-14 min-w-0">
        {/* Breadcrumb: static › tier [⋮] */}
        <div className="flex items-center gap-1.5 min-w-0">
          <StaticPicker
            currentGroup={currentGroup}
            groups={groups}
            onFetchGroups={fetchGroups}
            isMember={isMember || groups.length > 0}
            userRole={userRole ?? undefined}
          />
          <TierBreadcrumb />
        </div>

        {/* Week indicator */}
        {currentGroup && tiers.length > 0 && <WeekIndicator />}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Affordance placeholders (Tasks 10/11) */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Tooltip content="Command palette">
            <IconButton
              aria-label="Command palette"
              icon={<Command className="w-5 h-5" />}
              variant="ghost"
              size="md"
              onClick={onOpenPalette}
            />
          </Tooltip>
          <Tooltip content="Notifications (coming soon)">
            <IconButton
              aria-label="Notifications"
              icon={<Bell className="w-5 h-5" />}
              variant="ghost"
              size="md"
              disabled
            />
          </Tooltip>
          <Tooltip content="Settings (coming soon)">
            <IconButton
              aria-label="Settings"
              icon={<Settings className="w-5 h-5" />}
              variant="ghost"
              size="md"
              disabled
            />
          </Tooltip>
          <Tooltip content="Toggle theme (coming soon)">
            <IconButton
              aria-label="Toggle theme"
              icon={<Sun className="w-5 h-5" />}
              variant="ghost"
              size="md"
              disabled
            />
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
