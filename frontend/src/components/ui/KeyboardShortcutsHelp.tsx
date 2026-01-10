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
    title: 'Navigation',
    shortcuts: [
      { key: '1', description: 'Go to Players tab' },
      { key: '2', description: 'Go to Loot tab' },
      { key: '3', description: 'Go to Log tab' },
      { key: '4', description: 'Go to Summary tab' },
    ],
  },
  {
    title: 'View Controls (Players tab only)',
    shortcuts: [
      { key: 'V', description: 'Toggle compact/expanded view' },
      { key: 'G', description: 'Toggle G1/G2 group view' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { key: '?', description: 'Show this help' },
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
