/**
 * useShellToggle — the ONE path every shell-toggle affordance uses to switch shells.
 * Fires the ui_shell_toggle analytics event (sunset telemetry — Phase H's
 * criteria depend on it existing from day one), persists the preference, and
 * strips any ?shell= URL override (otherwise the param would immediately
 * defeat the toggle on the very next resolution).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useShellPreferenceStore, type Shell } from '../lib/shellPreference';

export function useShellToggle(surface: 'legacy-banner' | 'legacy-user-menu' | 'v2-user-menu' | 'v2-more-page') {
  const [searchParams, setSearchParams] = useSearchParams();
  const setPreference = useShellPreferenceStore((s) => s.setPreference);
  return useCallback((target: Shell) => {
    analytics.track('navigation', 'ui_shell_toggle', {
      direction: target === 'v2' ? 'to-v2' : 'to-legacy',
      surface,
    });
    // Strip the param BEFORE clearing the override: the S2 persistence effect
    // rewrites the override from any ?shell= it observes, so the order must
    // guarantee it can never re-observe the stale param after the clear —
    // regardless of how React batches the two commits. (Pre-strip writes are
    // harmless no-ops: the override already equals the param.)
    if (searchParams.has('shell')) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('shell');
        return params;
      }, { replace: true });
    }
    setPreference(target);
  }, [surface, setPreference, searchParams, setSearchParams]);
}
