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
import { useEffect } from 'react';
import { create } from 'zustand';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
// (tabMemory.ts already imports authStore from lib/ — no boundary violation)

export type Shell = 'legacy' | 'v2';

export const SHELL_STORAGE_KEY = 'ui-shell';

/** S2: per-browser-tab sticky override, written from an explicit `?shell=`
 *  deep-link. sessionStorage (not localStorage) so it dies with the tab and is
 *  never mirrored to the account — a deep-link is a session convenience, not a
 *  durable preference. */
export const SESSION_STORAGE_KEY = 'ui-shell-session';

function readStoredPreference(): Shell | null {
  try {
    const v = localStorage.getItem(SHELL_STORAGE_KEY);
    return v === 'legacy' || v === 'v2' ? v : null;
  } catch {
    return null;
  }
}

function readSessionOverride(): Shell | null {
  try {
    const v = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return v === 'legacy' || v === 'v2' ? v : null;
  } catch {
    return null;
  }
}

interface ShellPreferenceState {
  /** null = user has never chosen; resolution falls through to the default. */
  preference: Shell | null;
  /** S2: per-tab sticky override from an explicit `?shell=` deep-link. Resolves
   *  ABOVE the persisted preference but BELOW a fresh `?shell=` param. Never
   *  mirrored to the account. */
  sessionOverride: Shell | null;
  setPreference: (shell: Shell) => void;
  setSessionOverride: (shell: Shell) => void;
}

export const useShellPreferenceStore = create<ShellPreferenceState>((set) => ({
  preference: readStoredPreference(),
  sessionOverride: readSessionOverride(),
  setPreference: (shell) => {
    // An explicit preference choice supersedes any transient session override:
    // clear it so a stale `?shell=` deep-link can't keep out-resolving the new
    // choice on the next navigation (the URL param itself is stripped separately
    // by useShellToggle). Both fields set atomically.
    set({ preference: shell, sessionOverride: null });
    // Separate try/catches: if localStorage throws (private mode / blocked
    // storage), the session-override removal must STILL run — otherwise a
    // stale SESSION_STORAGE_KEY rehydrates on reload and out-resolves the
    // preference the user just chose.
    try {
      localStorage.setItem(SHELL_STORAGE_KEY, shell);
    } catch {
      // Private-mode storage failures degrade to session-only preference.
    }
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // removeItem threw but the stale value may still be readable on the
      // next reload, where it would outrank the preference just chosen.
      // Align it with the new choice instead — an override equal to the
      // preference resolves identically. If this write also throws, the
      // reload's readSessionOverride() will almost certainly throw too and
      // degrade to null.
      try { sessionStorage.setItem(SESSION_STORAGE_KEY, shell); } catch { /* fully degraded */ }
    }
    // Authed users mirror the preference server-side (cross-device). Fire and
    // forget: a failed PATCH must not block the local toggle.
    const { user, updatePreferences } = useAuthStore.getState();
    if (user) void updatePreferences({ uiShell: shell }).catch(() => {});
  },
  setSessionOverride: (shell) => {
    set({ sessionOverride: shell });
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, shell);
    } catch {
      // Private-mode sessionStorage failures degrade to in-memory-only stickiness.
    }
  },
}));

/** Resolve which shell should render right now. One resolver, two consumers
 *  (GroupRoute + Layout's Header suppression) — precedence lives ONLY here. */
export function useResolvedShell(): Shell {
  const [searchParams] = useSearchParams();
  const preference = useShellPreferenceStore((s) => s.preference);
  const sessionOverride = useShellPreferenceStore((s) => s.sessionOverride);
  const param = searchParams.get('shell');
  if (param === 'legacy' || param === 'v2') return param;
  // S2: a `?shell=` deep-link earlier this tab sticks until an explicit toggle
  // clears it — sits above the persisted preference, below a fresh param.
  if (sessionOverride === 'legacy' || sessionOverride === 'v2') return sessionOverride;
  return preference ?? 'legacy';
}

/** S2 companion write-effect — kept OUT of useResolvedShell so the resolver
 *  stays a pure read (no render-phase writes; no StrictMode double-fire on the
 *  V1 render path). When an explicit `?shell=` param is present, remember it as
 *  the per-tab session override so subsequent param-less navigations keep the
 *  chosen shell. No param ⇒ no write, so the (near-universal) no-param legacy
 *  population is byte-for-byte unaffected. Mount once, high in the tree (Layout),
 *  where it observes every route. */
export function useShellParamPersistence(): void {
  const [searchParams] = useSearchParams();
  const param = searchParams.get('shell');
  const setSessionOverride = useShellPreferenceStore((s) => s.setSessionOverride);
  useEffect(() => {
    if (param !== 'legacy' && param !== 'v2') return;
    if (useShellPreferenceStore.getState().sessionOverride !== param) {
      setSessionOverride(param);
    }
  }, [param, setSessionOverride]);
}

/** Backend-wins hydration (Phase R §4): when /me delivers a uiShell, adopt
 *  it into the store + localStorage so subsequent paints agree. setState
 *  (not setPreference) on purpose — hydration must never PATCH back. */
export function useShellPreferenceSync(): void {
  const uiShell = useAuthStore((s) => s.user?.uiShell);
  const authInitialized = useAuthStore((s) => s.authInitialized);
  useEffect(() => {
    // Until initializeAuth() completes, `user` is authStore's zustand-PERSISTED
    // snapshot, which can be STALER than localStorage's ui-shell (sharpest
    // case: a local toggle whose PATCH mirror failed offline would be reverted
    // by the user's own stale snapshot). Only adopt a uiShell delivered by a
    // real /me response — never the rehydrated snapshot.
    if (!authInitialized) return;
    if (uiShell !== 'legacy' && uiShell !== 'v2') return;
    if (useShellPreferenceStore.getState().preference !== uiShell) {
      useShellPreferenceStore.setState({ preference: uiShell });
      try { localStorage.setItem(SHELL_STORAGE_KEY, uiShell); } catch { /* noop */ }
    }
  }, [authInitialized, uiShell]);
}
