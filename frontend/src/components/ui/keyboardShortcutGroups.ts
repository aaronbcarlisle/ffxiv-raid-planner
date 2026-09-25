/**
 * Keyboard shortcut group data — one list per shell (D14, R-D14-A/H).
 *
 * Kept in a pure `.ts` module (no JSX, no component) so both
 * `KeyboardShortcutsHelp.tsx` and `CommandPalette.tsx` can import it
 * without triggering the `react-refresh/only-export-components` lint rule.
 *
 * `SHORTCUT_GROUPS` is V1's list and is frozen: V1's `Shift+?` help renders it
 * byte-identical to `main`, and `keyboardShortcutGroups.test.ts` pins it to a
 * literal copy (`keyboardShortcutGroups.fixture.ts`, R-D14-I). Editing it is a
 * V1 change that needs a ruling.
 *
 * `V2_SHORTCUT_GROUPS` is v2's complete list: only what v2 binds, every v2
 * binding, described as v2 behaves. A row whose text is identical in both
 * shells is authored once below and placed in both lists (R-D14-H).
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

// ── Rows and groups shared by both shells (R-D14-H: authored once) ──────────
// Everything here is bound by machinery both shells mount: the global hook
// (`useGlobalKeyboardShortcuts`), the shared group-view hook mounted by
// `GroupViewContent` in both shells (`useGroupViewKeyboardShortcuts`), `Modal`,
// and the Shift+Click copy-link sites.

const MY_STATICS: ShortcutItem = { key: 'Shift+S', description: 'My Statics' };
const ADMIN_DASHBOARD: ShortcutItem = { key: 'Ctrl+Shift+S', description: 'Admin Dashboard', adminOnly: true };
const COPY_LINK: ShortcutItem = { key: 'Shift+Click', description: 'Copy link' };

const STATIC_TIER_GROUP: ShortcutGroup = {
  title: 'Static/Tier',
  shortcuts: [
    { key: 'Ctrl+[ ]', description: 'Prev/next static' },
    { key: 'Alt+[ ]', description: 'Prev/next tier' },
  ],
};

const TIER_ROSTER_GROUP: ShortcutGroup = {
  title: 'Tier & Roster',
  shortcuts: [
    { key: 'Alt+Shift+P', description: 'Add Player' },
    { key: 'Alt+Shift+N', description: 'New Tier' },
    { key: 'Alt+Shift+R', description: 'Copy to New Tier' },
  ],
};

const STATIC_SETTINGS_GROUP: ShortcutGroup = {
  title: 'Static Settings',
  shortcuts: [
    { key: 'Alt+G', description: 'General' },
    { key: 'Alt+P', description: 'Priority' },
    { key: 'Alt+M', description: 'Members' },
    { key: 'Alt+I', description: 'Recruitment' },
  ],
};

const GENERAL_GROUP: ShortcutGroup = {
  title: 'General',
  shortcuts: [
    { key: 'Shift+?', description: 'Show shortcuts' },
    { key: 'Esc', description: 'Close modal' },
  ],
};

// ── V1 (frozen) ─────────────────────────────────────────────────────────────

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Tab Navigation',
    shortcuts: [
      { key: '1-4', description: 'Switch main tabs' },
      { key: 'Alt+1-3', description: 'Switch sub tabs' },
      MY_STATICS,
      ADMIN_DASHBOARD,
    ],
  },
  STATIC_TIER_GROUP,
  {
    title: 'View Controls',
    shortcuts: [
      { key: 'V', description: 'Expand/collapse' },
      { key: 'G', description: 'Toggle grid view' },
      { key: 'S', description: 'Toggle subs' },
      { key: 'Alt+← →', description: 'Change week' },
    ],
  },
  TIER_ROSTER_GROUP,
  STATIC_SETTINGS_GROUP,
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
      COPY_LINK,
      { key: 'Alt+Click', description: 'Navigate to item' },
    ],
  },
  GENERAL_GROUP,
];

// ── v2 (complete) ───────────────────────────────────────────────────────────
// Consumed by callers that know they are v2: the v2 branch of `Layout.tsx`'s
// help mount, and `CommandPalette.tsx` (v2-only outright). Rows are described
// per surface where one key does different things (`V` on the Roster vs on
// Loot's weapon list). A16's dead rows (`Alt+1-3`, `G` "grid view", a global
// "Change week") are gone: v2 has no sub tabs, `G` toggles light-party
// grouping, and the week keys step the Log only (R-D14-E).

export const V2_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '`', description: 'Home' },
      { key: '1', description: 'Schedule' },
      { key: '2', description: 'Roster' },
      { key: '3', description: 'Tracking' },
      { key: '4', description: 'Loot' },
      { key: 'Ctrl+K', description: 'Command palette' },
      MY_STATICS,
      ADMIN_DASHBOARD,
    ],
  },
  STATIC_TIER_GROUP,
  {
    title: 'Roster',
    shortcuts: [
      // Fix wave (D14a review, MINOR #7): all three act only on the Cards
      // view (`Roster.tsx:166,296` — `active: rosterView === 'cards'`), never
      // on Board, so the suffix matches the Loot rows' "(Log)"/"(Weapons)"
      // truthfulness convention.
      { key: 'V', description: 'Compact / expanded cards (Cards)' },
      { key: 'G', description: 'Toggle light-party grouping (Cards)' },
      { key: 'S', description: 'Separate substitutes (Cards)' },
    ],
  },
  {
    title: 'Loot',
    shortcuts: [
      { key: 'V', description: 'Expand / collapse weapon sections (Weapons)' },
      { key: 'Alt+L', description: 'Log a drop' },
      { key: 'Alt+U', description: 'Log material' },
      { key: 'Alt+← →', description: 'Previous / next week (Log)' },
      { key: 'Alt+B', description: 'Mark floor cleared (Log)' },
      { key: 'Ctrl+Shift+F', description: 'Search history' },
    ],
  },
  TIER_ROSTER_GROUP,
  STATIC_SETTINGS_GROUP,
  {
    title: 'Mouse',
    shortcuts: [
      COPY_LINK,
      { key: 'Alt+Click', description: 'Jump to the linked player or entry' },
    ],
  },
  GENERAL_GROUP,
];
