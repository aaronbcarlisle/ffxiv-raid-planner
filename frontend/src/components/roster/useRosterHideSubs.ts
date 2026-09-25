/**
 * useRosterHideSubs — v2-side "hide subs" toggle persistence (§9, R-D14-J).
 *
 * Legacy `GroupViewContent` keeps this as component-local state, keyed by
 * `roster-hide-subs` in localStorage. v2's `Roster` used to replicate that
 * same key byte-for-byte (see its header comment, pre-D14), which meant
 * toggling the setting in one shell silently changed what the other shell
 * showed on its next visit — the same class of bleed C6/D-06 diagnosed for
 * the sort-preset key, closed here the same way.
 *
 * READ order — v2 key → legacy key → false:
 *   Reading legacy's key is a read; it costs the frozen shell nothing and
 *   lets a preference set in the old UI carry into the new one.
 * WRITE — v2 key only:
 *   Writing the legacy key would change what the frozen legacy shell renders
 *   on its next visit — a V1-visible effect with zero file diff. Same call
 *   `useRosterSortPreset` makes for `sort-preset-{tierId}`.
 */

import { useCallback, useState } from 'react';

/** v2-scoped key (strict freeze — never legacy's `roster-hide-subs`). */
export const ROSTER_HIDE_SUBS_KEY = 'v2-roster-hide-subs';

/** Legacy's key. Read-only here: continuity in, nothing out. */
const LEGACY_ROSTER_HIDE_SUBS_KEY = 'roster-hide-subs';

/** Only `'true'`/`'false'` are valid; anything else (e.g. a malformed value) isn't authoritative. */
function isBoolString(value: string | null): value is 'true' | 'false' {
  return value === 'true' || value === 'false';
}

function readStoredHideSubs(): boolean {
  try {
    const v2 = localStorage.getItem(ROSTER_HIDE_SUBS_KEY);
    if (isBoolString(v2)) return v2 === 'true';
    const legacy = localStorage.getItem(LEGACY_ROSTER_HIDE_SUBS_KEY);
    if (isBoolString(legacy)) return legacy === 'true';
  } catch {
    // Ignore localStorage errors (private mode / disabled / quota).
  }
  return false;
}

export interface UseRosterHideSubsReturn {
  subsHidden: boolean;
  /** Persists the user's choice under the v2 key only. */
  setSubsHidden: (hidden: boolean) => void;
}

export function useRosterHideSubs(): UseRosterHideSubsReturn {
  const [subsHidden, setSubsHiddenState] = useState<boolean>(readStoredHideSubs);

  const setSubsHidden = useCallback((hidden: boolean) => {
    setSubsHiddenState(hidden);
    try {
      localStorage.setItem(ROSTER_HIDE_SUBS_KEY, String(hidden));
    } catch {
      // Ignore localStorage errors (matches legacy behaviour).
    }
  }, []);

  return { subsHidden, setSubsHidden };
}
