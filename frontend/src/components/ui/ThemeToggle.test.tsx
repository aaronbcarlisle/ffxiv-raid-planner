/**
 * Unit tests for the ThemeToggle component
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from './ThemeToggle';

// Mock useTheme hook (context-based)
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

  it('is a native button that supports keyboard activation', () => {
    // Native <button> handles Space/Enter → click automatically.
    // jsdom doesn't simulate this, so we verify the element is a <button>
    // which guarantees keyboard accessibility per HTML spec.
    render(<ThemeToggle />);
    const toggle = screen.getByRole('switch');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('type')).toBe('button');
  });

  it('renders moon icon in dark mode', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);
    expect(screen.getByTestId('icon-moon')).toBeDefined();
  });

  it('renders sun icon in light mode', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);
    expect(screen.getByTestId('icon-sun')).toBeDefined();
  });

  it('marks all decorative elements as aria-hidden', () => {
    const { container } = render(<ThemeToggle />);
    const ariaHiddenSpans = container.querySelectorAll('span[aria-hidden="true"]');
    // 3 star spans + 1 orb span = 4
    expect(ariaHiddenSpans.length).toBe(4);
  });
});
