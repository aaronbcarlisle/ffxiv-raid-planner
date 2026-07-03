/**
 * Navigation preferences — shared constants + default-safe accessors.
 *
 * Centralizes two things that were previously duplicated across components and
 * therefore prone to drift:
 *   - the set of URL params that must never carry across (or be restored) when
 *     switching statics, and that must never be baked into per-static tab
 *     memory (`static-nav-{code}`) — read/written by `buildStaticNavHref` and
 *     `useStaticNavMemory`. (Closing the settings panel strips its own,
 *     separate subset inline in `useGroupViewState.ts` — not this const.)
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
 * Builds the URL to navigate/link to a given static, honoring the "remember
 * tab per static" preference:
 *  • `remember: true`  → restore that static's last saved tab + sub-tabs
 *    (per-static memory, read from `static-nav-{shareCode}`).
 *  • `remember: false` → carry `currentParams` (the current tab + sub-tabs)
 *    across, dropping `tier` so the target picks its own active tier. When
 *    `currentParams` is omitted (not currently viewing a static), this
 *    degrades to the bare href.
 *
 * `extraParams` are applied last via `URLSearchParams.set`, so a caller-
 * supplied key overrides any same-named persisted/carried key rather than
 * appearing twice.
 *
 * Promoted verbatim from `ContextSwitcher`'s `buildStaticHref` (the legacy
 * component keeps calling this with `extraParams: {}` for byte-identical
 * output); `StaticPicker` is the first caller to pass `extraParams`.
 */
export function buildStaticNavHref(
  shareCode: string,
  opts: { remember: boolean; currentParams?: URLSearchParams; extraParams?: Record<string, string> }
): string {
  const { remember, currentParams, extraParams = {} } = opts;
  const base = `/group/${shareCode}`;

  let params = new URLSearchParams();
  if (remember) {
    try {
      const saved = localStorage.getItem(`static-nav-${shareCode}`);
      if (saved) {
        params = new URLSearchParams(saved);
        TRANSIENT_NAV_PARAMS.forEach((k) => params.delete(k));
      }
    } catch {
      // Ignore localStorage errors — fall through with empty params.
    }
  } else {
    params = new URLSearchParams(currentParams);
    [...TRANSIENT_NAV_PARAMS, 'tier'].forEach((k) => params.delete(k));
  }

  Object.entries(extraParams).forEach(([key, value]) => params.set(key, value));

  const s = params.toString();
  return s ? `${base}?${s}` : base;
}

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
