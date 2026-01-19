/**
 * Keyboard Shortcuts Help Modal
 *
 * Shows available keyboard shortcuts in a grid layout when user presses '?'
 */

import { useState, useMemo } from 'react';
import { Keyboard } from 'lucide-react';
import { Modal } from './Modal';
import { areShortcutsEnabled, setShortcutsEnabled } from '../../hooks/useKeyboardShortcuts';

interface ShortcutItem {
  key: string;
  description: string;
  /** Only show if user is admin */
  adminOnly?: boolean;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tab Navigation',
    shortcuts: [
      { key: '1-4', description: 'Switch main tabs' },
      { key: 'Alt+1-3', description: 'Switch sub tabs' },
      { key: 'Shift+S', description: 'My Statics' },
      { key: 'Ctrl+Shift+S', description: 'Admin Dashboard', adminOnly: true },
    ],
  },
  {
    title: 'Static/Tier',
    shortcuts: [
      { key: 'Ctrl+[ ]', description: 'Prev/next static' },
      { key: 'Alt+[ ]', description: 'Prev/next tier' },
    ],
  },
  {
    title: 'View Controls',
    shortcuts: [
      { key: 'V', description: 'Expand/collapse' },
      { key: 'G', description: 'Toggle grid view' },
      { key: 'S', description: 'Toggle subs' },
      { key: 'Alt+← →', description: 'Change week' },
    ],
  },
  {
    title: 'Management',
    shortcuts: [
      { key: 'Alt+Shift+P', description: 'Add Player' },
      { key: 'Alt+Shift+N', description: 'New Tier' },
      { key: 'Alt+Shift+R', description: 'Copy to New Tier' },
      { key: 'Alt+Shift+S', description: 'Static Settings' },
    ],
  },
  {
    title: 'Quick Actions',
    shortcuts: [
      { key: 'Alt+L', description: 'Log Loot' },
      { key: 'Alt+M', description: 'Log Material' },
      { key: 'Alt+B', description: 'Mark Floor Cleared' },
    ],
  },
  {
    title: 'Mouse',
    shortcuts: [
      { key: 'Shift+Click', description: 'Copy link' },
      { key: 'Alt+Click', description: 'Navigate to item' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: 'Shift+?', description: 'Show shortcuts' },
      { key: 'Esc', description: 'Close modal' },
    ],
  },
];

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

  const handleToggle = () => {
    const newValue = !enabled;
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
      size="3xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((group) => (
          <div
            key={group.title}
            className="bg-surface-elevated rounded-lg p-4 border border-border-default"
          >
            <h3 className="text-sm font-bold text-accent mb-3 pb-2 border-b border-border-subtle">
              {group.title}
            </h3>
            <div className="space-y-1.5">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{shortcut.description}</span>
                  <kbd className="font-mono px-1.5 py-0.5 bg-surface-card border border-border-default rounded text-text-muted">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border-default flex justify-between items-center">
        <p className="text-xs text-text-muted">
          Shortcuts disabled when typing or in modals
        </p>
        <label // design-system-ignore - toggle switch wrapper, not a form field label
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="text-xs text-text-secondary">Enable shortcuts</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
              ${enabled ? 'bg-accent' : 'bg-surface-interactive'}
            `}
          >
            <span
              className={`
                inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform
                ${enabled ? 'translate-x-5' : 'translate-x-1'}
              `}
            />
          </button>
        </label>
      </div>
    </Modal>
  );
}
