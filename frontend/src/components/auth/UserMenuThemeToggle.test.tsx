/**
 * Tests for the theme toggle row rendered in UserMenu.
 *
 * Tests the toggle logic in isolation (as recommended) rather than fighting
 * Radix DropdownMenu's portal behavior in jsdom. Renders the same Toggle
 * with the same props/handler used in UserMenu.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { Toggle } from '../ui';
import type { Theme } from '../../hooks/useTheme';

// ── Helpers ────────────────────────────────────────────────────────

/** Renders the same Toggle + label markup used in UserMenu's theme row */
function renderThemeToggle(theme: Theme, setTheme: (t: Theme) => void) {
  return render(
    createElement(
      'div',
      { role: 'none', className: 'flex items-center gap-2' },
      createElement('span', null, theme === 'light' ? 'Light Mode' : 'Dark Mode'),
      createElement(Toggle, {
        checked: theme === 'light',
        onChange: (checked: boolean) => setTheme(checked ? 'light' : 'dark'),
        size: 'sm',
        'aria-label': theme === 'light' ? 'Light mode on' : 'Light mode off',
      })
    )
  );
}

// ── Tests ──────────────────────────────────────────────────────────

describe('UserMenu theme toggle', () => {
  let mockSetTheme: Mock<(t: Theme) => void>;

  beforeEach(() => {
    mockSetTheme = vi.fn();
  });

  it('shows "Dark Mode" and unchecked toggle when theme is dark', () => {
    renderThemeToggle('dark', mockSetTheme);

    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('shows "Light Mode" and checked toggle when theme is light', () => {
    renderThemeToggle('light', mockSetTheme);

    expect(screen.getByText('Light Mode')).toBeInTheDocument();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('calls setTheme("light") when clicking from dark mode', () => {
    renderThemeToggle('dark', mockSetTheme);

    fireEvent.click(screen.getByRole('switch'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme("dark") when clicking from light mode', () => {
    renderThemeToggle('light', mockSetTheme);

    fireEvent.click(screen.getByRole('switch'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('has correct aria-label reflecting current state', () => {
    const { unmount } = renderThemeToggle('dark', mockSetTheme);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Light mode off');
    unmount();

    renderThemeToggle('light', mockSetTheme);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Light mode on');
  });
});
