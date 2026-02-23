/**
 * Unit tests for the useTheme hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  let matchMediaListeners: Map<string, (e: MediaQueryListEvent) => void>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    matchMediaListeners = new Map();

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
          matchMediaListeners.set(query, handler);
        }),
        removeEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (matchMediaListeners.get(query) === handler) {
            matchMediaListeners.delete(query);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial theme', () => {
    it('defaults to dark when no saved preference and OS prefers dark', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('defaults to light when OS prefers light', () => {
      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: light)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('uses saved localStorage value over OS preference', () => {
      localStorage.setItem('theme', 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('ignores invalid localStorage values', () => {
      localStorage.setItem('theme', 'sepia');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('toggles from dark to light', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');

      act(() => result.current.toggleTheme());

      expect(result.current.theme).toBe('light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('toggles from light to dark', () => {
      localStorage.setItem('theme', 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');

      act(() => result.current.toggleTheme());

      expect(result.current.theme).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('persists to localStorage', () => {
      const { result } = renderHook(() => useTheme());

      act(() => result.current.setTheme('light'));

      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('applies data-theme attribute to document', () => {
      const { result } = renderHook(() => useTheme());

      act(() => result.current.setTheme('light'));

      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('sets color-scheme CSS property', () => {
      const { result } = renderHook(() => useTheme());

      act(() => result.current.setTheme('light'));

      expect(document.documentElement.style.colorScheme).toBe('light');
    });
  });

  describe('OS preference listener', () => {
    it('registers a media query change listener', () => {
      renderHook(() => useTheme());
      expect(matchMediaListeners.has('(prefers-color-scheme: light)')).toBe(true);
    });

    it('cleans up the listener on unmount', () => {
      const { unmount } = renderHook(() => useTheme());
      expect(matchMediaListeners.has('(prefers-color-scheme: light)')).toBe(true);

      unmount();

      expect(matchMediaListeners.has('(prefers-color-scheme: light)')).toBe(false);
    });

    it('follows OS changes when no saved preference', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');

      const handler = matchMediaListeners.get('(prefers-color-scheme: light)');
      expect(handler).toBeDefined();

      act(() => {
        handler!({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current.theme).toBe('light');
      // Should NOT persist — user didn't explicitly choose
      expect(localStorage.getItem('theme')).toBeNull();
    });

    it('ignores OS changes when user has saved preference', () => {
      localStorage.setItem('theme', 'dark');
      const { result } = renderHook(() => useTheme());

      const handler = matchMediaListeners.get('(prefers-color-scheme: light)');
      act(() => {
        handler!({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current.theme).toBe('dark');
    });
  });
});
