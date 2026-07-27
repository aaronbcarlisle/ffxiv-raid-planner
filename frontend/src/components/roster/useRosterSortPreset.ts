/**
 * useRosterSortPreset — v2-side per-tier sort-preset hydration (Phase C slice
 * C6, D-06).
 *
 * The apply machinery was never lost: v2 still runs `SORT_PRESETS` through
 * `sortPlayersByRole`, and dragging still writes `'custom'`. What was missing is
 * the *hydration*. `useGroupViewState` is per-instance `useState`, and its
 * sortPreset initializer resolves URL param → `'standard'` with the comment
 * "Will be overwritten by tier-specific localStorage in useEffect" — but that
 * effect exists only in the legacy hosts (`GroupViewContent.tsx:205-215`,
 * `GroupView.tsx:174`) and calls the raw state setter, writing no URL. So it
 * mutates a hook instance v2's Roster never reads, and v2 silently ignored a
 * stored "Healer First" (matrix D-06, corrected by the Phase-C vet).
 *
 * This hook is the v2-side half, in the shape §2.1 sanctions: v2-local, zero
 * edits to the shared view-state machinery.
 *
 * READ order — v2 key → legacy key → `'standard'`:
 *   Reading legacy's key is a read; it costs the frozen shell nothing and it is
 *   the whole point of the restore (a preset the user set in the old UI should
 *   carry into the new one).
 * WRITE — v2 key only:
 *   Writing `sort-preset-{tierId}` would change what the frozen legacy shell
 *   renders on its next visit — a V1-visible effect with zero file diff. Same
 *   call C1 made for the density key (plan §5). Continuity therefore flows
 *   legacy → v2, never back.
 *
 * An explicit `?sort=` wins over both and suppresses hydration entirely, so a
 * deep link is never overwritten (legacy's hydration guards the same way).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SortPreset } from '../../types';

const PRESETS: readonly SortPreset[] = ['standard', 'dps-first', 'healer-first', 'custom'];

function isPreset(value: string | null): value is SortPreset {
  return value !== null && (PRESETS as readonly string[]).includes(value);
}

/** v2-scoped write key (strict freeze — never legacy's `sort-preset-{tierId}`). */
export function rosterSortPresetKey(tierId: string): string {
  return `v2-sort-preset-${tierId}`;
}

/** Legacy's per-tier key. Read-only here: continuity in, nothing out. */
function legacySortPresetKey(tierId: string): string {
  return `sort-preset-${tierId}`;
}

function readStoredPreset(tierId: string): SortPreset {
  try {
    const v2 = localStorage.getItem(rosterSortPresetKey(tierId));
    if (isPreset(v2)) return v2;
    const legacy = localStorage.getItem(legacySortPresetKey(tierId));
    if (isPreset(legacy)) return legacy;
  } catch {
    // Ignore localStorage errors (private mode / disabled / quota).
  }
  return 'standard';
}

export interface UseRosterSortPresetOptions {
  /** Current tier. Hydration re-runs when this changes — the roster stays mounted across switches. */
  tierId: string | undefined;
  /** The `sort` URL param, if any. An explicit deep link suppresses hydration. */
  urlSort: string | null;
  /**
   * Applies the hydrated preset to the caller's view state. Should be the RAW
   * state setter, not the URL-writing wrapper: hydration restores a preference,
   * it does not navigate (legacy hydrates the same way).
   */
  applyPreset: (preset: SortPreset) => void;
}

export interface UseRosterSortPresetReturn {
  /** Persist the user's choice under the v2 key. */
  persistPreset: (preset: SortPreset) => void;
}

export function useRosterSortPreset({
  tierId,
  urlSort,
  applyPreset,
}: UseRosterSortPresetOptions): UseRosterSortPresetReturn {
  // Ref-held so a caller passing an inline lambda doesn't re-run hydration on
  // every render — the effect must fire on TIER changes, nothing else.
  const applyRef = useRef(applyPreset);
  useEffect(() => {
    applyRef.current = applyPreset;
  }, [applyPreset]);

  const hasUrlSort = isPreset(urlSort);

  useEffect(() => {
    if (!tierId || hasUrlSort) return;
    applyRef.current(readStoredPreset(tierId));
  }, [tierId, hasUrlSort]);

  const persistPreset = useCallback(
    (preset: SortPreset) => {
      if (!tierId) return;
      try {
        localStorage.setItem(rosterSortPresetKey(tierId), preset);
      } catch {
        // Ignore localStorage errors (matches legacy setSortPreset).
      }
    },
    [tierId]
  );

  return useMemo(() => ({ persistPreset }), [persistPreset]);
}
