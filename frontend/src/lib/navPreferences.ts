/**
 * Navigation preferences — shared constants + default-safe accessors.
 *
 * Centralizes two things that were previously duplicated across components and
 * therefore prone to drift:
 *   - the set of URL params that must never carry across (or be restored) when
 *     switching statics, and that closing the settings panel strips, and
 *   - the per-user navigation-preference defaults (different per field), so a
 *     single stray `?? false` can't silently change behavior at one read site.
 */

import type { User } from '../types';

/** URL params that are transient/modal and should not be persisted, restored,
 *  or carried across a static switch. */
export const TRANSIENT_NAV_PARAMS = [
  'player', 'viewAs', 'adminMode', 'showSettings', 'settings',
  // Per-tab settings sub-section params (Goals / Priority / Recruitment).
  'gsub', 'psub', 'rcsub',
] as const;

/** Default values for the user navigation preferences (the fields differ). */
export const NAV_PREF_DEFAULTS = {
  rememberSubTabs: true,
  rememberStaticTab: false,
} as const;

/** Keep the last sub-tab when revisiting a view (vs reset to default). */
export function prefRememberSubTabs(user: User | null | undefined): boolean {
  return user?.rememberSubTabs ?? NAV_PREF_DEFAULTS.rememberSubTabs;
}

/** Restore a static's last tab when switching to it (vs stay on current). */
export function prefRememberStaticTab(user: User | null | undefined): boolean {
  return user?.rememberStaticTab ?? NAV_PREF_DEFAULTS.rememberStaticTab;
}
