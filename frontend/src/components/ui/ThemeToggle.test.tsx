/**
 * Tests for the header ThemeToggle (relocated out of the UserMenu dropdown).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from '../../hooks/useTheme';

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // jsdom has no matchMedia; default to "prefers dark" (prefers-light = false)
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
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a toggle button with a stable aria-label', () => {
    renderToggle();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('toggles data-theme between dark and light on click', () => {
    renderToggle();
    const btn = screen.getByRole('button', { name: 'Toggle theme' });
    // No saved theme + prefers-light=false → starts dark
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists the chosen theme to localStorage', () => {
    renderToggle();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
