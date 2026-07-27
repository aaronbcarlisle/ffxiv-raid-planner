/**
 * useRosterViewShortcuts — v2-side `G` (grouping) and `S` (separate subs)
 * bindings (Phase C slice C6, D-07 + plan §2.1).
 *
 * Same mechanism C1 built for `V`, for the same reason: `useGroupViewState` is
 * per-instance `useState`, so the frozen `useGroupViewKeyboardShortcuts`
 * instance mounted by the shared GroupViewContent binds these keys against a
 * hook instance v2's Roster never reads. Under v2 both handlers fire
 * INVISIBLY — and `G` is worse than inert: `setGroupView` writes legacy's
 * `group-view-groups-{id}` localStorage and the `groups` URL param
 * (`useGroupViewState.ts:415-435`), so an unowned `G` press silently changes
 * what the frozen shell renders next visit.
 *
 * Registering at capture phase and stopping immediate propagation makes this
 * hook the single owner of both keys while the v2 Roster is mounted.
 */

import { useEffect, useRef } from 'react';
import { isRosterShortcut, isSettingsPanelOpen } from './rosterShortcutGuards';

export interface UseRosterViewShortcutsOptions {
  /** Disables the actions (any roster-owned or chrome modal open). Keys stay owned. */
  shortcutsDisabled: boolean;
  /** Whether these axes are the active surface (Cards view). */
  active: boolean;
  /** Legacy parity: `S` does nothing on a roster with no substitutes. */
  hasSubstitutes: boolean;
  /**
   * Whether subs can be separated right now. False when the substitutes
   * section is hidden — the toolbar's Separate Subs toggle is disabled there
   * (C1-checkpoint correction (c)), and a shortcut must not do what its
   * disabled control cannot.
   */
  subsSeparable: boolean;
  onToggleGrouping: () => void;
  onToggleSubsView: () => void;
}

export function useRosterViewShortcuts({
  shortcutsDisabled,
  active,
  hasSubstitutes,
  subsSeparable,
  onToggleGrouping,
  onToggleSubsView,
}: UseRosterViewShortcutsOptions): void {
  // Ref-held actions so the listener re-registers only when its guards change,
  // not on every view-state flip.
  const actionsRef = useRef({ onToggleGrouping, onToggleSubsView });
  useEffect(() => {
    actionsRef.current = { onToggleGrouping, onToggleSubsView };
  }, [onToggleGrouping, onToggleSubsView]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isGrouping = isRosterShortcut(e, 'g');
      const isSubs = isRosterShortcut(e, 's');
      if (!isGrouping && !isSubs) return;

      // Own the key first: exactly one handler acts while v2 Roster is mounted,
      // and the frozen handler never fires its invisible branch.
      e.preventDefault();
      e.stopImmediatePropagation();

      if (isSettingsPanelOpen()) return;
      if (shortcutsDisabled || !active) return;

      if (isGrouping) {
        actionsRef.current.onToggleGrouping();
        return;
      }
      if (hasSubstitutes && subsSeparable) actionsRef.current.onToggleSubsView();
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [shortcutsDisabled, active, hasSubstitutes, subsSeparable]);
}
