/**
 * @vitest-environment jsdom
 *
 * CommandPalette — navigate-only palette (F6a, Task 11).
 *
 * Asserts:
 *   - Open → navigation rows present
 *   - Click "Go to Loot" → setPageMode('gear') + onClose
 *   - Type "rost" → filters to Roster only
 *   - navigator.platform=MacIntel → ⌘K on chip + footer row; Win32 → Ctrl+K on both (R-E1-G)
 *   - Combobox: ArrowDown/Up move aria-activedescendant (clamped), a query
 *     change resets the highlight, zero results means no activedescendant
 *     and a no-op Enter, Enter is ignored while IME-composing, hover moves
 *     the highlight (R-E1-F)
 *   - 2 mocked groups → 2 "Switch to …" rows; click → navigate('/group/<code>')
 *   - Footer lists exactly v2's shortcut registry, no V1-only row (R-D14-A)
 *   - Escape closes (Modal handles it)
 *   - isOpen=false → dialog not in DOM
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock useNavigate ─────────────────────────────────────────────────────────
// Must be declared before vi.mock so the factory can close over it.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock useGroupViewState ───────────────────────────────────────────────────
const mockSetPageMode = vi.fn();
const mockSetShowSettingsModal = vi.fn();
vi.mock('../../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({
    setPageMode: mockSetPageMode,
    setShowSettingsModal: mockSetShowSettingsModal,
  }),
}));

// Imports after mocks so they pick up the mocked modules.
import { CommandPalette } from './CommandPalette';
import { V2_SHORTCUT_GROUPS } from '../ui/keyboardShortcutGroups';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useAuthStore } from '../../stores/authStore';
import type { StaticGroupListItem, User } from '../../types';

const groupA = {
  id: 'a',
  shareCode: 'ABC',
  name: 'Alpha Static',
} as unknown as StaticGroupListItem;

const groupB = {
  id: 'b',
  shareCode: 'XYZ',
  name: 'Beta Static',
} as unknown as StaticGroupListItem;

// Captured once, before any test mutates it, so afterEach can restore the
// real jsdom default rather than whatever the previous test's
// Object.defineProperty stub left behind (R-E1-G: an unrestored stub would
// leak the Mac/Win platform into unrelated tests run after it).
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetPageMode.mockClear();
  mockSetShowSettingsModal.mockClear();
  try { localStorage.clear(); } catch { /* ignore */ }
  useStaticGroupStore.setState({ groups: [groupA, groupB] });
  // Default: no user (matches the store's own initial state) — the non-admin
  // case for the footer's `adminOnly` filter (fix wave, IMPORTANT #2).
  useAuthStore.setState({ user: null });

  // Radix / framer-motion stubs required in jsdom.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Fix wave (MINOR #2): jsdom's `platform` is a PROTOTYPE getter, so the
  // own-property descriptor captured above is `undefined` for the ordinary
  // case — the `if` branch never restores anything, and a test's
  // `Object.defineProperty(navigator, 'platform', ...)` (which shadows the
  // getter with an own property) leaks into every test that runs after it
  // in this file. Deleting the own property un-shadows the prototype getter.
  if (originalPlatformDescriptor) {
    Object.defineProperty(window.navigator, 'platform', originalPlatformDescriptor);
  } else {
    delete (navigator as { platform?: string }).platform;
  }
});

function renderPalette(isOpen = true, onClose = vi.fn()) {
  return render(
    // MemoryRouter provides router context needed by useSearchParams etc.
    // (used by Modal internally, not by CommandPalette itself since we mock useGroupViewState).
    <MemoryRouter initialEntries={['/group/ABC']}>
      <CommandPalette isOpen={isOpen} onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('CommandPalette', () => {
  it('renders "Go to Roster" when open', () => {
    renderPalette();
    expect(screen.getByText('Go to Roster')).toBeInTheDocument();
  });

  it('renders all four navigation targets when open', () => {
    renderPalette();
    expect(screen.getByText('Go to Home')).toBeInTheDocument();
    expect(screen.getByText('Go to Roster')).toBeInTheDocument();
    expect(screen.getByText('Go to Loot')).toBeInTheDocument();
    expect(screen.getByText('Go to Schedule')).toBeInTheDocument();
  });

  it('calls setPageMode("gear") and onClose when "Go to Loot" is clicked', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Go to Loot'));
    expect(mockSetPageMode).toHaveBeenCalledWith('gear');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls setPageMode("roster") when "Go to Roster" is clicked', () => {
    renderPalette();
    fireEvent.click(screen.getByText('Go to Roster'));
    expect(mockSetPageMode).toHaveBeenCalledWith('roster');
  });

  it('filters to only Roster when query is "rost"', () => {
    renderPalette();
    const input = screen.getByRole('combobox', { name: 'Search commands' });
    fireEvent.change(input, { target: { value: 'rost' } });
    expect(screen.getByText('Go to Roster')).toBeInTheDocument();
    expect(screen.queryByText('Go to Home')).toBeNull();
    expect(screen.queryByText('Go to Loot')).toBeNull();
    expect(screen.queryByText('Go to Schedule')).toBeNull();
  });

  it('shows "No commands found." when query matches nothing', () => {
    renderPalette();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search commands' }), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('No commands found.')).toBeInTheDocument();
  });

  // T3-b1 (R-E1-G): one label author (lib/platform.ts) feeds both surfaces —
  // the input's chip AND the footer's own "Command palette" shortcut row —
  // so they can never say different things.
  it('shows ⌘K on both the chip and the footer row when navigator.platform is MacIntel', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    renderPalette();
    expect(screen.getAllByText('⌘K')).toHaveLength(2);
    expect(screen.queryByText('Ctrl+K')).toBeNull();
    expect(screen.queryByText('Ctrl K')).toBeNull();
  });

  it('shows Ctrl+K on both the chip and the footer row when navigator.platform is Win32', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });
    renderPalette();
    expect(screen.getAllByText('Ctrl+K')).toHaveLength(2);
    expect(screen.queryByText('⌘K')).toBeNull();
    expect(screen.queryByText('Ctrl K')).toBeNull();
  });

  it('shows two "Switch to …" rows for two groups', () => {
    renderPalette();
    expect(screen.getByText('Switch to Alpha Static')).toBeInTheDocument();
    expect(screen.getByText('Switch to Beta Static')).toBeInTheDocument();
  });

  it('calls navigate("/group/ABC") when Alpha Static row is clicked (no saved tab)', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Switch to Alpha Static'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/ABC');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores the target static\'s saved tab (remember ON, the default)', () => {
    // Task 7 follow-up (FIX 3): the "Switch to …" row must repoint through the
    // same buildStaticNavHref call StaticPicker uses, instead of hardcoding a
    // bare `/group/{code}` that drops the saved tab.
    localStorage.setItem('static-nav-ABC', 'tab=loot&sub=weapon');
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Switch to Alpha Static'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/ABC?tab=loot&sub=weapon');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  function renderedFooterRows() {
    // The grid is the heading's sibling; each row is <span>desc</span><kbd>key</kbd>.
    const grid = screen.getByText('Keyboard Shortcuts').nextElementSibling;
    if (!grid) throw new Error('shortcut grid not found');
    return Array.from(grid.children).map((row) => [
      row.querySelector('kbd')?.textContent ?? '',
      row.querySelector('span')?.textContent ?? '',
    ]);
  }

  it('footer lists exactly v2\'s registry (minus adminOnly, non-admin), in order, and no V1-only row (R-D14-A)', () => {
    renderPalette();
    expect(renderedFooterRows()).toStrictEqual(
      V2_SHORTCUT_GROUPS.flatMap((g) =>
        g.shortcuts.filter((s) => !s.adminOnly).map((s) => [s.key, s.description]),
      ),
    );
    // A16: V1's list must not be appended — these rows are V1-only.
    expect(screen.queryByText('Switch main tabs')).toBeNull();
    expect(screen.queryByText('Alt+1-3')).toBeNull();
    expect(screen.queryByText('Toggle grid view')).toBeNull();
  });

  // Fix wave (D14a review, IMPORTANT #2): the footer had no `adminOnly` filter
  // at all, so a non-admin saw "Ctrl+Shift+S → Admin Dashboard" even though
  // that binding is registered only for admins (`useGlobalKeyboardShortcuts.ts`)
  // — a row that never fires for them. `KeyboardShortcutsHelp` already hides
  // it; this footer must match.
  it('a non-admin sees no Admin Dashboard row in the footer', () => {
    useAuthStore.setState({ user: { id: 'u1', discordId: 'd1', discordUsername: 'nonadmin', isAdmin: false } as User });
    renderPalette();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
    expect(renderedFooterRows().map(([key]) => key)).not.toContain('Ctrl+Shift+S');
  });

  it('an admin sees the Admin Dashboard row in the footer', () => {
    useAuthStore.setState({ user: { id: 'u1', discordId: 'd1', discordUsername: 'admin', isAdmin: true } as User });
    renderPalette();
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(renderedFooterRows()).toStrictEqual(
      V2_SHORTCUT_GROUPS.flatMap((g) => g.shortcuts.map((s) => [s.key, s.description])),
    );
  });

  it('renders the Keyboard Shortcuts section heading', () => {
    renderPalette();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('closes on Escape (handled by Modal keydown listener)', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    // Modal attaches its keydown handler to window.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when isOpen=false', () => {
    renderPalette(false);
    // Modal returns null when isOpen=false — no dialog in the DOM.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  // Rewritten (R-E1-F) to the input-driven combobox flow: rows are no
  // longer tab stops (tabIndex={-1}), so activation is driven from the
  // search input's own keydown handler, not a keydown fired at a row.
  describe('combobox keyboard flow (R-E1-F)', () => {
    function getInput() {
      return screen.getByRole('combobox', { name: 'Search commands' });
    }

    it('T3-a1: ArrowDown moves aria-activedescendant to the second option', () => {
      renderPalette();
      const input = getInput();
      const options = screen.getAllByRole('option');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
    });

    it('T3-a2: ArrowDown then typing a query resets the highlight to the first match', () => {
      renderPalette();
      const input = getInput();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.change(input, { target: { value: 'settings' } });
      // "settings" narrows to a single row ("Open Settings"); the stale
      // second-option highlight must not survive the query change.
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('T3-a3: zero results means no aria-activedescendant, and Enter is a no-op', () => {
      const onClose = vi.fn();
      renderPalette(true, onClose);
      const input = getInput();
      fireEvent.change(input, { target: { value: 'zzznomatch' } });
      expect(input.hasAttribute('aria-activedescendant')).toBe(false);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockSetPageMode).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('T3-a4: Enter runs the highlighted command, but not while IME-composing', () => {
      const onClose = vi.fn();
      renderPalette(true, onClose);
      const input = getInput();
      // Highlighted option defaults to the first row ("Go to Home").
      fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
      expect(mockSetPageMode).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockSetPageMode).toHaveBeenCalledWith('overview');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('T3-a5: ArrowUp at the first option clamps instead of wrapping to the last', () => {
      renderPalette();
      const input = getInput();
      const options = screen.getAllByRole('option');
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('T3-a6: hovering a row moves the highlight, and only one row carries it', () => {
      renderPalette();
      const options = screen.getAllByRole('option');
      fireEvent.mouseEnter(options[2]);
      const classTokens = (el: Element) => el.className.split(/\s+/);
      const highlighted = options.filter((o) => classTokens(o).includes('bg-surface-elevated'));
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0]).toBe(options[2]);
      // MINOR #7: the highlight is state-driven only (R-E1-F) — a re-added
      // `hover:bg-surface-elevated` Tailwind variant would let a SECOND row
      // highlight via CSS `:hover` even though only one carries the state
      // class above; assert its absence so that regression can't survive.
      for (const option of options) {
        expect(classTokens(option)).not.toContain('hover:bg-surface-elevated');
      }
    });
  });

  it('renders the three slotless tab entries: Tracking, Plugin, More', () => {
    renderPalette();
    expect(screen.getByText('Go to Tracking')).toBeInTheDocument();
    expect(screen.getByText('Go to Plugin')).toBeInTheDocument();
    expect(screen.getByText('Go to More')).toBeInTheDocument();
  });

  it('calls setPageMode("goals") and onClose when "Go to Tracking" is clicked', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Go to Tracking'));
    expect(mockSetPageMode).toHaveBeenCalledWith('goals');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls setPageMode("plugin") and onClose when "Go to Plugin" is clicked', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Go to Plugin'));
    expect(mockSetPageMode).toHaveBeenCalledWith('plugin');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls setPageMode("more") and onClose when "Go to More" is clicked', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Go to More'));
    expect(mockSetPageMode).toHaveBeenCalledWith('more');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
