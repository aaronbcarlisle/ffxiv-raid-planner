/**
 * Keyboard shortcut group data.
 *
 * Kept in a pure `.ts` module (no JSX, no component) so both
 * `KeyboardShortcutsHelp.tsx` and `CommandPalette.tsx` can import it
 * without triggering the `react-refresh/only-export-components` lint rule.
 */

export interface ShortcutItem {
  key: string;
  description: string;
  /** Only show if user is admin */
  adminOnly?: boolean;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
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

/**
 * v2-only additions to the shortcut reference (D11, R-D11-C).
 *
 * V1's `Shift+?` help must render byte-identical to today — so a new binding
 * that only exists on the v2 Loot screen cannot join `SHORTCUT_GROUPS` above.
 * This list is consumed separately, by callers that know they are v2 (the v2
 * branch of `Layout.tsx`'s help mount, and `CommandPalette.tsx`, which is
 * v2-only outright). Whether this seam gets generalised (a shell-aware split
 * of the whole registry) or replaced by something else is D14's decision —
 * this is the minimal append that keeps V1 unchanged until then.
 */
export const V2_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'History',
    shortcuts: [
      { key: 'Ctrl+Shift+F', description: 'Search history' },
    ],
  },
];
