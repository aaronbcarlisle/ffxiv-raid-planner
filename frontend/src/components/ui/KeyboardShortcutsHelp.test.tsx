/**
 * @vitest-environment jsdom
 *
 * KeyboardShortcutsHelp — the `extraGroups` seam (D11, R-D11-C).
 *
 * T-28: with no `extraGroups` (the legacy V1 mount's shape), the rendered
 * group titles and shortcut rows are exactly `SHORTCUT_GROUPS` — no more, no
 * less — and the v2-only `Ctrl+Shift+F` binding is absent. This is the
 * V1-unchanged assert at component level; `Layout.chrome.test.tsx`'s T-29
 * carries the mount-level half (which mount passes the prop).
 *
 * T-28b: `adminOnly` filtering applies across BOTH lists, not just the
 * built-in one.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { SHORTCUT_GROUPS } from './keyboardShortcutGroups';

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

/** The group's card is the h3's own parent — scope queries to it so a
 * shortcut description/group title that collides with another group's text
 * (e.g. the "General" group vs. the "General" description on Alt+G) is
 * resolved unambiguously. */
function cardFor(groupTitle: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name: groupTitle });
  const card = heading.parentElement;
  if (!card) throw new Error(`no card for group "${groupTitle}"`);
  return card;
}

describe('KeyboardShortcutsHelp — T-28 no extraGroups = SHORTCUT_GROUPS, byte for byte', () => {
  it('renders exactly SHORTCUT_GROUPS\' titles and rows, and Ctrl+Shift+F is absent', () => {
    render(<KeyboardShortcutsHelp isOpen onClose={() => {}} />);

    for (const group of SHORTCUT_GROUPS) {
      // adminOnly rows are excluded by default (isAdmin defaults to false).
      const visibleShortcuts = group.shortcuts.filter((s) => !s.adminOnly);
      const card = within(cardFor(group.title));
      for (const shortcut of visibleShortcuts) {
        expect(card.getByText(shortcut.description)).toBeInTheDocument();
        expect(card.getByText(shortcut.key)).toBeInTheDocument();
      }
    }

    // The exact set of group titles rendered is SHORTCUT_GROUPS' own set —
    // no group from a v2-only list has joined it.
    const renderedTitles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(renderedTitles).toEqual(SHORTCUT_GROUPS.map((g) => g.title));
    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByText('Ctrl+Shift+F')).toBeNull();
    expect(screen.queryByText('Search history')).toBeNull();
  });
});

describe('KeyboardShortcutsHelp — extraGroups renders alongside SHORTCUT_GROUPS', () => {
  it('an extra group\'s title and rows render too', () => {
    render(
      <KeyboardShortcutsHelp
        isOpen
        onClose={() => {}}
        extraGroups={[{ title: 'History', shortcuts: [{ key: 'Ctrl+Shift+F', description: 'Search history' }] }]}
      />,
    );

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument();
    expect(screen.getByText('Search history')).toBeInTheDocument();
    // The built-in groups are still present alongside it.
    expect(screen.getByText(SHORTCUT_GROUPS[0].title)).toBeInTheDocument();
  });
});

describe('KeyboardShortcutsHelp — T-28b adminOnly filtering applies across both lists', () => {
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

  it('an adminOnly row inside extraGroups is hidden for a non-admin and shown for an admin', () => {
    const extraGroups = [
      {
        title: 'History',
        shortcuts: [
          { key: 'Ctrl+Shift+F', description: 'Search history' },
          { key: 'Ctrl+Shift+Z', description: 'Admin-only history tool', adminOnly: true },
        ],
      },
    ];

    const { rerender } = render(
      <KeyboardShortcutsHelp isOpen onClose={() => {}} extraGroups={extraGroups} />,
    );
    expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument();
    expect(screen.queryByText('Ctrl+Shift+Z')).toBeNull();

    rerender(
      <KeyboardShortcutsHelp isOpen onClose={() => {}} isAdmin extraGroups={extraGroups} />,
    );
    expect(screen.getByText('Ctrl+Shift+Z')).toBeInTheDocument();
  });
});
