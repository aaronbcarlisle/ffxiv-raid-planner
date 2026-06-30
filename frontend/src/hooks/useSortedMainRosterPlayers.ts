import { useMemo } from 'react';
import type { TierSnapshot, SnapshotPlayer } from '../types';
import { sortPlayersByRole } from '../utils/calculations';
import { SORT_PRESETS, DEFAULT_SETTINGS } from '../utils/constants';

/**
 * Main-roster derivation shared by the legacy `GroupView` chrome and the v2
 * `StaticSettingsHost` mount. Replicates `GroupView`'s sorted main-roster set
 * (`sortPlayersByRole(...)` then `configured && !isSubstitute`) so the settings
 * panel's player list matches the content.
 *
 * Unlike `GroupView`, the v2 host has no URL-backed sort state, so it uses the
 * default sort preset (`DEFAULT_SETTINGS.sortPreset`) — a stable role-order,
 * which is correct for the settings player list.
 */
export function useSortedMainRosterPlayers(tier: TierSnapshot | null): SnapshotPlayer[] {
  return useMemo(() => {
    if (!tier?.players) return [];
    const sortPreset = DEFAULT_SETTINGS.sortPreset;
    const displayOrder = SORT_PRESETS[sortPreset]?.order ?? DEFAULT_SETTINGS.displayOrder;
    const sorted = sortPlayersByRole(tier.players, displayOrder, sortPreset);
    return sorted.filter((p) => p.configured && !p.isSubstitute);
  }, [tier]);
}
