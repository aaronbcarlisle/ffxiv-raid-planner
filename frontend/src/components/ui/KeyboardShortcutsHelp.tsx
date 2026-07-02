/**
 * Keyboard Shortcuts Help Modal
 *
 * Shows available keyboard shortcuts in a grid layout when user presses '?'
 */

import { useState, useMemo } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';
import { Toggle } from './Toggle';
import { areShortcutsEnabled, setShortcutsEnabled } from '../../hooks/useKeyboardShortcuts';
import { SHORTCUT_GROUPS } from './keyboardShortcutGroups';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  /** Whether to show admin-only shortcuts */
  isAdmin?: boolean;
}

export function KeyboardShortcutsHelp({ isOpen, onClose, isAdmin = false }: KeyboardShortcutsHelpProps) {
  // Initialize from localStorage
  const [enabled, setEnabled] = useState(() => areShortcutsEnabled());

  // Filter out admin-only shortcuts if user is not admin
  const filteredGroups = useMemo(() => {
    return SHORTCUT_GROUPS.map(group => ({
      ...group,
      shortcuts: group.shortcuts.filter(s => !s.adminOnly || isAdmin),
    }));
  }, [isAdmin]);

  const handleToggle = (newValue: boolean) => {
    setEnabled(newValue);
    setShortcutsEnabled(newValue);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Keyboard className="w-5 h-5" />
          Keyboard Shortcuts
        </span>
      }
      size="4xl"
    >
      {/* Scrollable shortcuts area - constrained on mobile */}
      <div className={`max-h-[60vh] sm:max-h-none overflow-y-auto -mr-2 pr-2 transition-opacity ${enabled ? '' : 'opacity-40'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGroups.map((group) => (
            <div
              key={group.title}
              className="bg-surface-elevated rounded-lg p-4 border border-border-default min-w-[200px]"
            >
              <h3 className="text-sm font-bold text-accent mb-3 pb-2 border-b border-border-subtle">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary">{shortcut.description}</span>
                    <kbd className="font-mono px-1.5 py-0.5 bg-surface-card border border-border-default rounded text-text-muted whitespace-nowrap">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky footer - always visible */}
      <div className="mt-4 pt-4 border-t border-border-default flex justify-between items-center flex-shrink-0">
        <p className="text-xs text-text-muted">
          Shortcuts disabled when typing or in modals
        </p>
        <Toggle
          checked={enabled}
          onChange={handleToggle}
          label="Enable shortcuts"
          size="sm"
        />
      </div>
    </Modal>
  );
}
