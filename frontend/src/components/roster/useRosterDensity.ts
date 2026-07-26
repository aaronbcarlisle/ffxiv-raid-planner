/**
 * useRosterDensity — v2-scoped roster card density axis (Phase C slice C1, D-01).
 *
 * Restores the legacy expanded ⇄ compact card axis (R-014/R-023/R-065/R-066/
 * R-165) as V2-LOCAL state per `phase-c-roster-plan.md` §2.1: `useGroupViewState`
 * is per-instance `useState`, so the shared hook's `viewMode`/`V` handler can
 * never reach this screen live — v2 owns its own density state and its own `V`
 * binding, with ZERO shared-file edits.
 *
 * Persistence key is V2-SCOPED (`v2-roster-density`, plan §5 silent default):
 * reusing legacy's `party-view-mode` key would make a v2 toggle change what the
 * frozen legacy shell renders on its next visit — a V1-visible effect with zero
 * file diff. Per-card overrides are transient (legacy's persisted folds are the
 * per-SECTION chevrons, D-08 → slice C6; the per-card override is a v2 axis).
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
import { areShortcutsEnabled } from '../../hooks/useKeyboardShortcuts';
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

/** Mirrors the (non-exported) input guard in `useKeyboardShortcuts`. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
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
  /** The global density every card follows unless individually overridden. */
  density: ViewMode;
  /** Set the global density: persists, emits `view_mode_change`, clears overrides. */
  setDensity: (mode: ViewMode) => void;
  /** Effective density for one card (global, inverted while overridden). */
  cardDensity: (playerId: string) => ViewMode;
  /** Invert one card against the global density (transient). */
  toggleCardOverride: (playerId: string) => void;
  /**
   * Legacy R-023 re-click behaviour at card granularity: re-clicking the active
   * "Expanded" control re-expands every overridden card if any is collapsed,
   * else collapses them all.
   */
  handleExpandedReselect: (visibleIds: string[]) => void;
}

export function useRosterDensity({
  shortcutsDisabled,
  active,
}: UseRosterDensityOptions): UseRosterDensityReturn {
  const [density, setDensityState] = useState<ViewMode>(readStoredDensity);
  const [overrides, setOverrides] = useState<ReadonlySet<string>>(() => new Set<string>());

  const setDensity = useCallback((mode: ViewMode) => {
    setDensityState(mode);
    // A global density change resets per-card exceptions — an override is an
    // inversion of the mode it was made under, meaningless once the mode flips.
    setOverrides(new Set<string>());
    try {
      localStorage.setItem(ROSTER_DENSITY_KEY, mode);
    } catch {
      // Ignore localStorage errors (matches legacy setViewMode).
    }
    analytics.track('feature', 'view_mode_change', { mode, shell: 'v2' });
  }, []);

  const cardDensity = useCallback(
    (playerId: string): ViewMode => {
      if (!overrides.has(playerId)) return density;
      return density === 'expanded' ? 'compact' : 'expanded';
    },
    [density, overrides],
  );

  const toggleCardOverride = useCallback((playerId: string) => {
    setOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const handleExpandedReselect = useCallback((visibleIds: string[]) => {
    setOverrides((prev) => (prev.size > 0 ? new Set<string>() : new Set(visibleIds)));
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
      if (e.key.toLowerCase() !== 'v') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      // These two guards mirror the shared hook's own early-returns, so NOT
      // swallowing here changes nothing — the legacy handler would no-op too.
      if (!areShortcutsEnabled() || isTypingTarget(e.target)) return;
      // Own the key: exactly one handler acts on `V` while v2 Roster is mounted.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (shortcutsDisabled || !active) return;
      toggleRef.current();
    }
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [shortcutsDisabled, active]);

  return useMemo(
    () => ({ density, setDensity, cardDensity, toggleCardOverride, handleExpandedReselect }),
    [density, setDensity, cardDensity, toggleCardOverride, handleExpandedReselect],
  );
}
