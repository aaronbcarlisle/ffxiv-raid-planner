/**
 * Keyboard Shortcuts Help Modal
 *
 * Shows available keyboard shortcuts when user presses '?'
 */

import { Modal } from './Modal';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tab Navigation',
    shortcuts: [
      { key: '1-4', description: 'Switch main tabs' },
      { key: 'Alt+1-3', description: 'Switch sub tabs (Loot/Log)' },
      { key: 'Shift+S', description: 'Go to My Statics' },
    ],
  },
  {
    title: 'Static/Tier Navigation',
    shortcuts: [
      { key: 'Ctrl+[  Ctrl+]', description: 'Previous/next static' },
      { key: 'Alt+[  Alt+]', description: 'Previous/next tier' },
    ],
  },
  {
    title: 'View Controls',
    shortcuts: [
      { key: 'V', description: 'Expand/collapse (all tabs)' },
      { key: 'G', description: 'G1/G2 view (Players) / Grid/List (Log)' },
      { key: 'S', description: 'Toggle substitutes (Players)' },
      { key: 'Alt+←  Alt+→', description: 'Previous/next week (Log)' },
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
    title: 'Mouse Shortcuts',
    shortcuts: [
      { key: 'Shift+Click', description: 'Copy link to clipboard' },
      { key: 'Alt+Click', description: 'Navigate to related item' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: 'Shift+?', description: 'Show this help' },
      { key: 'Esc', description: 'Close modal' },
    ],
  },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <div className="space-y-6">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-medium text-text-secondary mb-2">{group.title}</h3>
            <div className="space-y-1">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between py-1">
                  <span className="text-text-primary">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-surface-elevated border border-border-default rounded text-text-secondary">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-border-default">
        <p className="text-xs text-text-muted">
          Shortcuts are disabled when typing in text fields or when a modal is open.
        </p>
      </div>
    </Modal>
  );
}
