/**
 * Keyboard Shortcuts Hook
 *
 * Provides global keyboard shortcuts for common actions.
 * Shortcuts are disabled when typing in inputs/textareas or when modals are open.
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  /** Require modifier key (ctrl/cmd) */
  requireMod?: boolean;
  /** Require shift key */
  requireShift?: boolean;
  /** Require alt key */
  requireAlt?: boolean;
  /** If true, this shortcut works even when disabled=true (e.g., when modals are open) */
  alwaysEnabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /** Shortcuts to register */
  shortcuts: KeyboardShortcut[];
  /** Disable all shortcuts (e.g., when modal is open) */
  disabled?: boolean;
}

/**
 * Check if the event target is an input element
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

/** localStorage key for global shortcut enable/disable */
export const SHORTCUTS_ENABLED_KEY = 'shortcuts-enabled';

/**
 * Check if shortcuts are globally enabled
 */
export function areShortcutsEnabled(): boolean {
  return localStorage.getItem(SHORTCUTS_ENABLED_KEY) !== 'false';
}

/**
 * Set global shortcut enabled state
 */
export function setShortcutsEnabled(enabled: boolean): void {
  localStorage.setItem(SHORTCUTS_ENABLED_KEY, enabled ? 'true' : 'false');
  // Dispatch event so components can react to the change
  window.dispatchEvent(new CustomEvent('shortcuts-enabled-change', { detail: enabled }));
}

/**
 * Hook to register keyboard shortcuts
 */
export function useKeyboardShortcuts({ shortcuts, disabled = false }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if globally disabled or typing in an input
    if (!areShortcutsEnabled() || isInputElement(event.target)) return;

    // Find matching shortcut
    const shortcut = shortcuts.find(s => {
      const keyMatch = event.key.toLowerCase() === s.key.toLowerCase();
      const modMatch = s.requireMod ? (event.metaKey || event.ctrlKey) : !(event.metaKey || event.ctrlKey);
      const shiftMatch = s.requireShift ? event.shiftKey : !event.shiftKey;
      const altMatch = s.requireAlt ? event.altKey : !event.altKey;
      return keyMatch && modMatch && shiftMatch && altMatch;
    });

    // Skip if disabled (unless shortcut is always enabled)
    if (shortcut && (shortcut.alwaysEnabled || !disabled)) {
      event.preventDefault();
      shortcut.action();
    }
  }, [shortcuts, disabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
