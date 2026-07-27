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

/**
 * Mirrors the (non-exported) input guard in `useKeyboardShortcuts`. Declining
 * here is safe precisely because the frozen hook declines the same targets —
 * the key reaches the field and nothing else acts on it.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/**
 * A listbox-style control that owns bare letter keys for typeahead. C6 puts a
 * Radix `Select` in the toolbar (the sort preset), which renders a
 * `role="combobox"` BUTTON over a `role="listbox"` — the tag check above misses
 * it entirely, so `S` inside the open dropdown toggled Separate Subs behind the
 * menu (PR #199 review).
 *
 * These targets are handled differently from a text field: the roster still
 * SWALLOWS the key, it just declines to act on it. Merely declining would hand
 * the key to the frozen `useGroupViewKeyboardShortcuts`, whose own guard does
 * NOT recognise a combobox (`useKeyboardShortcuts.ts:69` checks tag names) and
 * which does not check `defaultPrevented` — so it would flip ITS `subsView` and
 * write `?subs=false`, invisible until a v2 remount read it back. Verified live:
 * declining alone left the toolbar untouched but dirtied the URL.
 *
 * Scoped to an OPEN list. Radix parks focus back on the trigger when the Select
 * closes, so treating any combobox as the owner left `V`/`G`/`S` silently dead
 * after every use of the sort control, until the user clicked elsewhere —
 * choosing a preset and then adjusting density is an ordinary sequence
 * (PR #199 review round 3). A closed trigger isn't running typeahead.
 *
 * The remaining cost is typeahead for the three bound letters while the list is
 * open; every other letter, and the arrow keys, still work.
 */
export function ownsLetterKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const owner = target.closest('[role="combobox"],[role="listbox"],[role="option"]');
  if (!owner) return false;
  // A listbox/option only exists while open; a combobox has to say so.
  return owner.getAttribute('role') !== 'combobox' || owner.getAttribute('aria-expanded') === 'true';
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
