/**
 * @vitest-environment jsdom
 *
 * CommandPalette — navigate-only palette (F6a, Task 11).
 *
 * Asserts:
 *   - Open → navigation rows present
 *   - Click "Go to Loot" → setPageMode('gear') + onClose
 *   - Type "rost" → filters to Roster only
 *   - navigator.platform=MacIntel → ⌘K label; Win32 → Ctrl K label
 *   - 2 mocked groups → 2 "Switch to …" rows; click → navigate('/group/<code>?shell=v2')
 *   - Absorbed shortcut description is rendered
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
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import type { StaticGroupListItem } from '../../types';

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

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetPageMode.mockClear();
  mockSetShowSettingsModal.mockClear();
  useStaticGroupStore.setState({ groups: [groupA, groupB] });

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
});

function renderPalette(isOpen = true, onClose = vi.fn()) {
  return render(
    // MemoryRouter provides router context needed by useSearchParams etc.
    // (used by Modal internally, not by CommandPalette itself since we mock useGroupViewState).
    <MemoryRouter initialEntries={['/group/ABC?shell=v2']}>
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
    const input = screen.getByRole('textbox', { name: 'Search commands' });
    fireEvent.change(input, { target: { value: 'rost' } });
    expect(screen.getByText('Go to Roster')).toBeInTheDocument();
    expect(screen.queryByText('Go to Home')).toBeNull();
    expect(screen.queryByText('Go to Loot')).toBeNull();
    expect(screen.queryByText('Go to Schedule')).toBeNull();
  });

  it('shows "No commands found." when query matches nothing', () => {
    renderPalette();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search commands' }), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('No commands found.')).toBeInTheDocument();
  });

  it('shows ⌘K label when navigator.platform is MacIntel', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });
    renderPalette();
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('shows Ctrl K label when navigator.platform is Win32', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });
    renderPalette();
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();
  });

  it('shows two "Switch to …" rows for two groups', () => {
    renderPalette();
    expect(screen.getByText('Switch to Alpha Static')).toBeInTheDocument();
    expect(screen.getByText('Switch to Beta Static')).toBeInTheDocument();
  });

  it('calls navigate("/group/ABC?shell=v2") when Alpha Static row is clicked', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Switch to Alpha Static'));
    expect(mockNavigate).toHaveBeenCalledWith('/group/ABC?shell=v2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders at least one keyboard shortcut description from SHORTCUT_GROUPS', () => {
    renderPalette();
    // "Switch main tabs" is from the Tab Navigation group in SHORTCUT_GROUPS.
    expect(screen.getByText('Switch main tabs')).toBeInTheDocument();
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

  it('activates a command row via keyboard Enter', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    const row = screen.getByText('Go to Schedule').closest('[role="option"]')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockSetPageMode).toHaveBeenCalledWith('schedule');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
