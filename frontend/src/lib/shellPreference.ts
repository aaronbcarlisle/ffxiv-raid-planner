/**
 * shellPreference — the dual-shell gate state (Phase R, ROLLOUT_ROADMAP §2).
 *
 * Which chrome renders /group/:shareCode is a PERSISTED USER PREFERENCE:
 *   resolution precedence = `?shell=` URL param (support/deep-link override,
 *   never written back) → stored preference → default 'legacy'.
 *
 * Zustand-outside-the-URL for the same reason as settingsPanelStore: toggling
 * must remount the shell in place without a reload, and the preference must
 * never leak into per-static tab memory (navPreferences keeps 'shell' in
 * TRANSIENT_NAV_PARAMS). localStorage covers guests + pre-auth paint; the
 * authed backend mirror (User.ui_shell) hydrates over it on login (Task 8).
 */
import { create } from 'zustand';
import { useSearchParams } from 'react-router-dom';

export type Shell = 'legacy' | 'v2';

export const SHELL_STORAGE_KEY = 'ui-shell';

function readStoredPreference(): Shell | null {
  try {
    const v = localStorage.getItem(SHELL_STORAGE_KEY);
    return v === 'legacy' || v === 'v2' ? v : null;
  } catch {
    return null;
  }
}

interface ShellPreferenceState {
  /** null = user has never chosen; resolution falls through to the default. */
  preference: Shell | null;
  setPreference: (shell: Shell) => void;
}

export const useShellPreferenceStore = create<ShellPreferenceState>((set) => ({
  preference: readStoredPreference(),
  setPreference: (shell) => {
    set({ preference: shell });
    try {
      localStorage.setItem(SHELL_STORAGE_KEY, shell);
    } catch {
      // Private-mode localStorage failures degrade to session-only preference.
    }
  },
}));

/** Resolve which shell should render right now. One resolver, two consumers
 *  (GroupRoute + Layout's Header suppression) — precedence lives ONLY here. */
export function useResolvedShell(): Shell {
  const [searchParams] = useSearchParams();
  const preference = useShellPreferenceStore((s) => s.preference);
  const param = searchParams.get('shell');
  if (param === 'legacy' || param === 'v2') return param;
  return preference ?? 'legacy';
}
