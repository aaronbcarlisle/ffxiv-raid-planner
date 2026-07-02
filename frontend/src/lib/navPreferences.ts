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

/**
 * The site-wide navigational tab-memory mode. `'remember'` (default) reopens
 * views on the last tab; `'reset'` always opens on the default tab. This single
 * preference replaced the earlier rememberSubTabs/rememberStaticTab pair —
 * localStorage gating lives in `lib/tabMemory.ts`.
 */
export function prefTabPersistence(user: User | null | undefined): 'remember' | 'reset' {
  return user?.tabPersistence ?? 'remember';
}

/** Whether navigational tabs are remembered (vs reset to default). */
export function prefRememberTabs(user: User | null | undefined): boolean {
  return prefTabPersistence(user) !== 'reset';
}
