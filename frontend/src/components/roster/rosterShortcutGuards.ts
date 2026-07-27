/**
 * Shared guards for the v2 roster's capture-phase key bindings (Phase C).
 *
 * Extracted at C6 so `useRosterDensity` (`V`, C1) and `useRosterViewShortcuts`
 * (`G`/`S`, C6) apply exactly the same rules — a second copy would be four
 * behaviours that could silently drift apart, and would count against the
 * jscpd gate.
 */

import { areShortcutsEnabled } from '../../hooks/useKeyboardShortcuts';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';

/** Mirrors the (non-exported) input guard in `useKeyboardShortcuts`. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/**
 * Whether this keypress is a bare (unmodified) press of `key` that the v2
 * roster should claim at all. These two conditions mirror the shared hook's own
 * early-returns, so declining here changes nothing — the legacy handler would
 * no-op too.
 */
export function isRosterShortcut(e: KeyboardEvent, key: string): boolean {
  if (e.key.toLowerCase() !== key) return false;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false;
  return areShortcutsEnabled() && !isTypingTarget(e.target);
}

/**
 * Read imperatively — subscribing would re-render the whole roster on every
 * panel toggle (the settingsPanelStore ~500ms lesson).
 */
export function isSettingsPanelOpen(): boolean {
  return useSettingsPanelStore.getState().isOpen;
}
