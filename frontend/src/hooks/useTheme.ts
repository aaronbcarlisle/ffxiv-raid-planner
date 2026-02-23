import { useState, useCallback, useEffect } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

function isValidTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light';
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(saved)) return saved;
  } catch {
    // Storage unavailable (e.g. Safari ITP private browsing, sandboxed iframe)
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

// NOTE: Single-consumer hook — each instance carries independent state.
// If multiple components need to read `theme`, wrap in a ThemeProvider context.
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Persistence failure — theme is still applied visually
    }
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Sync DOM on initial mount only — intentionally excludes `theme` from deps.
  // The IIFE in main.tsx already sets the correct attribute before React renders;
  // this guards against external DOM resets (e.g. Radix scroll-lock).
  useEffect(() => {
    applyTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for OS preference changes when no saved preference
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        // Storage unavailable — fall through to apply OS preference
      }
      // Apply OS preference without persisting, so we keep following system changes
      const next: Theme = e.matches ? 'light' : 'dark';
      setThemeState(next);
      applyTheme(next);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return { theme, setTheme, toggleTheme } as const;
}
