/**
 * Test support for the shortcut registry (D14 Task 3, R-D14-I).
 *
 * `V1_SHORTCUT_GROUPS_LITERAL` is a LITERAL copy of `SHORTCUT_GROUPS` as it
 * stood on `main` before the shell-aware split — every group title, key,
 * description and `adminOnly` flag, in order. The V1 guards (T-28 in
 * `KeyboardShortcutsHelp.test.tsx`, T-29's legacy case in
 * `Layout.chrome.test.tsx`, and `keyboardShortcutGroups.test.ts`) compare the
 * rendered help and the export against THIS, never against the export itself:
 * a comparison against the export passes vacuously the moment the list is
 * edited. Editing this literal is editing V1's help — it needs a ruling.
 *
 * Not a test file (vitest collects `*.test.ts(x)` only), so it can be imported
 * by suites in more than one directory.
 */
import type { ShortcutGroup } from './keyboardShortcutGroups';

export const V1_SHORTCUT_GROUPS_LITERAL: ShortcutGroup[] = [
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
    title: 'Tier & Roster',
    shortcuts: [
      { key: 'Alt+Shift+P', description: 'Add Player' },
      { key: 'Alt+Shift+N', description: 'New Tier' },
      { key: 'Alt+Shift+R', description: 'Copy to New Tier' },
    ],
  },
  {
    title: 'Static Settings',
    shortcuts: [
      { key: 'Alt+G', description: 'General' },
      { key: 'Alt+P', description: 'Priority' },
      { key: 'Alt+M', description: 'Members' },
      { key: 'Alt+I', description: 'Recruitment' },
    ],
  },
  {
    title: 'Quick Actions',
    shortcuts: [
      { key: 'Alt+L', description: 'Log Loot' },
      { key: 'Alt+U', description: 'Log Material' },
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

/** One rendered help card: its title and its (key, description) rows, in order. */
export interface RenderedShortcutGroup {
  title: string;
  rows: Array<[key: string, description: string]>;
}

/**
 * What `KeyboardShortcutsHelp` should render for `groups`: the `adminOnly`
 * rows drop out unless `isAdmin`, everything else keeps its order.
 */
export function expectedHelpGroups(groups: ShortcutGroup[], isAdmin = false): RenderedShortcutGroup[] {
  return groups.map((g) => ({
    title: g.title,
    rows: g.shortcuts
      .filter((s) => !s.adminOnly || isAdmin)
      .map((s) => [s.key, s.description] as [string, string]),
  }));
}

/**
 * Reads the help modal's rendered cards back out of the DOM, in document order.
 * `dialog` is the help modal's `[role="dialog"]` element (the v2 chrome keeps
 * another dialog mounted, so callers scope to the one titled "Keyboard
 * Shortcuts"). Each card is an `h3` title with sibling rows of
 * `<span>description</span><kbd>key</kbd>`.
 */
export function readRenderedHelpGroups(dialog: Element): RenderedShortcutGroup[] {
  return Array.from(dialog.querySelectorAll('h3')).map((h3) => {
    const card = h3.parentElement;
    if (!card) throw new Error(`help card for "${h3.textContent}" has no parent`);
    const rows = Array.from(card.querySelectorAll(':scope > div > div')).map(
      (row) => [row.querySelector('kbd')?.textContent ?? '', row.querySelector('span')?.textContent ?? ''] as [string, string],
    );
    return { title: h3.textContent ?? '', rows };
  });
}
