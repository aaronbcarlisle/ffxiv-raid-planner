/**
 * useShellToggle — the ONE path both toggle affordances use to switch shells.
 * Fires the ui_shell_toggle analytics event (sunset telemetry — Phase H's
 * criteria depend on it existing from day one), persists the preference, and
 * strips any ?shell= URL override (otherwise the param would immediately
 * defeat the toggle on the very next resolution).
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analytics } from '../services/analytics';
import { useShellPreferenceStore, type Shell } from '../lib/shellPreference';

export function useShellToggle(surface: 'legacy-banner' | 'v2-user-menu') {
  const [searchParams, setSearchParams] = useSearchParams();
  const setPreference = useShellPreferenceStore((s) => s.setPreference);
  return useCallback((target: Shell) => {
    analytics.track('navigation', 'ui_shell_toggle', {
      direction: target === 'v2' ? 'to-v2' : 'to-legacy',
      surface,
    });
    setPreference(target);
    if (searchParams.has('shell')) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('shell');
        return params;
      }, { replace: true });
    }
  }, [surface, setPreference, searchParams, setSearchParams]);
}
