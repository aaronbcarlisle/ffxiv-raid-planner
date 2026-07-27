/**
 * useRosterDensity — v2-scoped roster card density axis (Phase C slice C1, D-01).
 *
 * Restores the legacy expanded ⇄ compact card axis (R-014/R-065/R-066/R-165)
 * as V2-LOCAL state per `phase-c-roster-plan.md` §2.1: `useGroupViewState` is
 * per-instance `useState`, so the shared hook's `viewMode`/`V` handler can
 * never reach this screen live — v2 owns its own density state and its own `V`
 * binding, with no edits to the shared view-state/keyboard machinery
 * (`useGroupViewState` / `useGroupViewKeyboardShortcuts` / `GroupViewContent`).
 * The C1 PR's only shared-file hunks are elsewhere and enumerated in its body
 * (`SegmentedToggle.onReselect`, the eslint lock).
 *
 * The density is a GLOBAL view toggle — every card follows it. Per-card
 * collapse was built in the first C1 cut and REMOVED at the user checkpoint
 * (ruling 2026-07-26): "Cards should never be able to manually be collapsed
 * individually." The legacy re-click-Expanded behaviour (R-023) operates on
 * the LIGHT-PARTY SECTIONS, not cards — it lands in C6 together with the
 * section-collapse chevrons it needs.
 *
 * Persistence key is V2-SCOPED (`v2-roster-density`, plan §5 silent default):
 * reusing legacy's `party-view-mode` key would make a v2 toggle change what the
 * frozen legacy shell renders on its next visit — a V1-visible effect with zero
 * file diff.
 *
 * The `V` key listener registers at CAPTURE phase and stops immediate
 * propagation: the frozen `useGroupViewKeyboardShortcuts` instance (mounted by
 * the shared GroupViewContent) still registers a bubble-phase `V` handler whose
 * roster branch fires INVISIBLY under v2 — emitting a shell-less
 * `view_mode_change` and writing legacy's `party-view-mode` key. While the v2
 * Roster is mounted, this hook owns `V`, so a v2 keypress produces exactly one
 * emit (with the `shell` discriminator) and never mutates legacy's stored view.
 *
 * Analytics: every density change emits `view_mode_change` with
 * `{ mode, shell: 'v2' }` — same event name as legacy (the matrix's most
 * load-bearing datapoint) with the shell field the plan §2.1 requires.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analytics } from '../../services/analytics';
import { isRosterShortcut, isSettingsPanelOpen } from './rosterShortcutGuards';
import type { ViewMode } from '../../types';

/** v2-scoped persistence key (plan §5: strict freeze — never `party-view-mode`). */
export const ROSTER_DENSITY_KEY = 'v2-roster-density';

function readStoredDensity(): ViewMode {
  try {
    return localStorage.getItem(ROSTER_DENSITY_KEY) === 'expanded' ? 'expanded' : 'compact';
  } catch {
    return 'compact';
  }
}

export interface UseRosterDensityOptions {
  /** Disables the `V` toggle action (any roster-owned or chrome modal open). */
  shortcutsDisabled: boolean;
  /**
   * Whether the density axis is the active surface (Cards view). When false
   * (Board view) the `V` key is still owned — swallowed, so the frozen shared
   * handler can't fire its invisible legacy branch — but toggles nothing.
   */
  active: boolean;
}

export interface UseRosterDensityReturn {
  /** The global density every card follows. */
  density: ViewMode;
  /** Set the global density: persists and emits `view_mode_change`. */
  setDensity: (mode: ViewMode) => void;
}

export function useRosterDensity({
  shortcutsDisabled,
  active,
}: UseRosterDensityOptions): UseRosterDensityReturn {
  const [density, setDensityState] = useState<ViewMode>(readStoredDensity);

  const setDensity = useCallback((mode: ViewMode) => {
    setDensityState(mode);
    try {
      localStorage.setItem(ROSTER_DENSITY_KEY, mode);
    } catch {
      // Ignore localStorage errors (matches legacy setViewMode).
    }
    analytics.track('feature', 'view_mode_change', { mode, shell: 'v2' });
  }, []);

  // ── v2-side `V` binding (capture phase — see file head) ──
  // Ref-held action so the listener re-registers only when its guards change,
  // not on every density flip.
  const toggleRef = useRef<() => void>(() => {});
  useEffect(() => {
    toggleRef.current = () => setDensity(density === 'compact' ? 'expanded' : 'compact');
  }, [density, setDensity]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Guards shared with the C6 `G`/`S` bindings (`rosterShortcutGuards`) so
      // all three keys behave identically.
      if (!isRosterShortcut(e, 'v')) return;
      // Own the key: exactly one handler acts on `V` while v2 Roster is mounted.
      e.preventDefault();
      e.stopImmediatePropagation();
      // Settings panel open → swallowed but inert: density must not flip behind
      // the panel. Read imperatively — a subscription here would re-render the
      // roster on every panel toggle (settingsPanelStore.ts's ~500ms lesson).
      // Accepted v2 delta (director change-review, 2026-07-26): the Priority
      // tab's own `v` (ST-14/ST-15) doesn't fire while the panel covers the
      // ROSTER tab — under legacy both handlers fired at once.
      if (isSettingsPanelOpen()) return;
      if (shortcutsDisabled || !active) return;
      toggleRef.current();
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [shortcutsDisabled, active]);

  return useMemo(() => ({ density, setDensity }), [density, setDensity]);
}
