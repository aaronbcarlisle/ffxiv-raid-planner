/**
 * @vitest-environment jsdom
 *
 * KeyboardShortcutsHelp — the shell-aware `groups` seam (D14, R-D14-A/H/I).
 *
 * T-28: with no `groups` (the legacy V1 mount's shape), the rendered cards are
 * EXACTLY the V1 literal (`keyboardShortcutGroups.fixture.ts`) — every title
 * and every (key, description) row, in order. Compared against the literal,
 * never the export, so an edit to the registry cannot pass vacuously. This is
 * the V1-unchanged assert at component level; `Layout.chrome.test.tsx`'s T-29
 * carries the mount-level half (which mount passes the prop).
 *
 * T-28-v2: `groups={V2_SHORTCUT_GROUPS}` renders v2's list — Task 2's Loot rows
 * present, A16's dead rows absent.
 *
 * T-28b: `adminOnly` filtering applies to whichever list the caller supplies.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { SHORTCUT_GROUPS, V2_SHORTCUT_GROUPS } from './keyboardShortcutGroups';
import {
  V1_SHORTCUT_GROUPS_LITERAL,
  expectedHelpGroups,
  readRenderedHelpGroups,
} from './keyboardShortcutGroups.fixture';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  // Modal → useDevice reads matchMedia; jsdom doesn't implement it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

/** The help modal's own dialog (the only one this suite renders). */
function helpDialog(): Element {
  const dialog = screen.getByText('Keyboard Shortcuts').closest('[role="dialog"]');
  if (!dialog) throw new Error('help dialog not found');
  return dialog;
}

/**
 * T-28 (R-D14-I): the legacy mount's shape — no group list passed — renders
 * EXACTLY the V1 literal: every card title and every (key, description) row,
 * in order, no more and no less. Compared against the literal fixture, not
 * against the export, so an edit to the registry cannot pass vacuously.
 */
describe('KeyboardShortcutsHelp — T-28 no group list = the V1 literal, byte for byte', () => {
  it('non-admin: the rendered cards equal the literal minus its adminOnly rows', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} />);
    expect(readRenderedHelpGroups(helpDialog())).toStrictEqual(
      expectedHelpGroups(V1_SHORTCUT_GROUPS_LITERAL, false),
    );
    // A v2-only row has not joined the V1 render.
    expect(screen.queryByText('Ctrl+Shift+F')).toBeNull();
    expect(screen.queryByText('Search history')).toBeNull();
  });

  it('admin: the rendered cards equal the literal with its adminOnly rows in place', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} isAdmin />);
    expect(readRenderedHelpGroups(helpDialog())).toStrictEqual(
      expectedHelpGroups(V1_SHORTCUT_GROUPS_LITERAL, true),
    );
  });
});

describe('KeyboardShortcutsHelp — T-28-v2 groups={V2_SHORTCUT_GROUPS} renders v2\'s list', () => {
  it('renders exactly the v2 list as (key, description) rows, in order', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} groups={V2_SHORTCUT_GROUPS} />);
    expect(readRenderedHelpGroups(helpDialog())).toStrictEqual(
      expectedHelpGroups(V2_SHORTCUT_GROUPS, false),
    );
  });

  it('contains Task 2\'s Loot rows and the History search row', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} groups={V2_SHORTCUT_GROUPS} />);
    const rows = readRenderedHelpGroups(helpDialog()).flatMap((g) => g.rows);
    expect(rows).toEqual(expect.arrayContaining([
      ['Alt+L', 'Log a drop'],
      ['Alt+U', 'Log material'],
      ['Alt+← →', 'Previous / next week (Log)'],
      ['Alt+B', 'Mark floor cleared (Log)'],
      ['Ctrl+Shift+F', 'Search history'],
    ]));
  });

  it('contains none of A16\'s wrong rows', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} groups={V2_SHORTCUT_GROUPS} />);
    for (const text of ['Alt+1-3', 'Switch sub tabs', '1-4', 'Switch main tabs', 'Toggle grid view', 'Change week', 'Expand/collapse', 'Toggle subs']) {
      expect(screen.queryByText(text), text).toBeNull();
    }
  });
});

describe('KeyboardShortcutsHelp — T-28b adminOnly filtering applies to the supplied list', () => {
  const adminGroup = SHORTCUT_GROUPS.find((g) =>
    g.shortcuts.some((s) => s.adminOnly),
  );
  const adminShortcut = adminGroup?.shortcuts.find((s) => s.adminOnly);

  it('the existing admin-only row (Ctrl+Shift+S) is hidden for a non-admin', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} />);
    expect(adminShortcut).toBeDefined();
    expect(screen.queryByText(adminShortcut!.key)).toBeNull();
  });

  it('the existing admin-only row is shown for an admin', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} isAdmin />);
    expect(screen.getByText(adminShortcut!.key)).toBeInTheDocument();
  });

  it('an adminOnly row inside a caller-supplied list is hidden for a non-admin and shown for an admin', () => {
    const groups = [
      {
        title: 'History',
        shortcuts: [
          { key: 'Ctrl+Shift+F', description: 'Search history' },
          { key: 'Ctrl+Shift+Z', description: 'Admin-only history tool', adminOnly: true },
        ],
      },
    ];

    const { rerender } = render(
      <KeyboardShortcutsHelp isOpen onClose={() => {}} groups={groups} />,
    );
    expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+Shift+Z')).toBeNull();
    // The supplied list REPLACES the default: no V1 group rides along.
    expect(screen.queryByText('Switch main tabs')).toBeNull();

    rerender(
      <KeyboardShortcutsHelp isOpen onClose={() => {}} isAdmin groups={groups} />,
    );
    expect(screen.getByText('Ctrl+Shift+Z')).toBeInTheDocument();
  });
});

// Fix wave (IMPORTANT #1, R-E1-G): the v2 "Command palette" row's `key` is a
// getter over `getCommandPaletteShortcutLabel()` (keyboardShortcutGroups.ts),
// not a literal — this help overlay and CommandPalette's own chip must never
// disagree on a Mac. Exercised through THIS overlay (not just the palette)
// since the earlier fix wave only proved the palette side.
describe('KeyboardShortcutsHelp — v2 Command palette row reads the one label (R-E1-G)', () => {
  // jsdom's `platform` is a prototype getter with no own property, so the
  // captured descriptor is `undefined` in the ordinary case — restore by
  // deleting the own property the stub below installs (fix wave MINOR #2).
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');

  afterEach(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(window.navigator, 'platform', originalPlatformDescriptor);
    } else {
      delete (navigator as { platform?: string }).platform;
    }
  });

  it('renders ⌘K for the Command palette row on a Mac platform', () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} groups={V2_SHORTCUT_GROUPS} />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+K')).toBeNull();
  });

  it('renders Ctrl+K for the Command palette row off a Mac platform', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} groups={V2_SHORTCUT_GROUPS} />);
    expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    expect(screen.queryByText('⌘K')).toBeNull();
  });
});
