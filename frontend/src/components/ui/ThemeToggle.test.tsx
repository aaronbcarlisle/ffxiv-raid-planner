/**
 * Unit tests for the ThemeToggle component
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

// Mock useTheme hook
const mockToggleTheme = vi.fn();
let mockTheme = 'dark';

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({
    theme: mockTheme,
    toggleTheme: mockToggleTheme,
    setTheme: vi.fn(),
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockTheme = 'dark';
    mockToggleTheme.mockClear();
  });

  it('renders with switch role', () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDefined();
  });

  it('shows "Switch to light mode" label in dark mode', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to light mode');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('shows "Switch to dark mode" label in light mode', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-label')).toBe('Switch to dark mode');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('calls toggleTheme on click', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('switch'));
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it('renders moon icon in dark mode', () => {
    mockTheme = 'dark';
    const { container } = render(<ThemeToggle />);
    // Moon SVG has a path element with the crescent shape
    const moonPath = container.querySelector('path[d*="M21 12.79"]');
    expect(moonPath).not.toBeNull();
  });

  it('renders sun icon in light mode', () => {
    mockTheme = 'light';
    const { container } = render(<ThemeToggle />);
    // Sun SVG has a circle element for the sun body
    const sunCircle = container.querySelector('circle[cx="12"][cy="12"]');
    expect(sunCircle).not.toBeNull();
  });
});
