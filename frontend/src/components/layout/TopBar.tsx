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

import { Command, Bell, Settings, Sun } from 'lucide-react';
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

/** Display-only week label. Reads `currentWeek` from the server-authoritative loot
 *  store — never writes it. `currentWeek` is mutated only by `fetchCurrentWeek` /
 *  `startNextWeek` / `revertWeek` (API-persisted); a plain setter does not exist by
 *  design, and silently writing it would corrupt priority math and log-week defaults.
 *  Full week navigation belongs to F6d (the Loot slice / week-clock owner). */
function WeekIndicator() {
  const currentWeek = useLootTrackingStore((s) => s.currentWeek);

  return (
    <div className="hidden md:flex items-center">
      <span className="text-xs font-medium text-text-secondary tabular-nums select-none">
        Week {currentWeek}
      </span>
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
