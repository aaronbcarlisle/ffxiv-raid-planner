/**
 * ThemeToggle - Floating day/night toggle
 *
 * Pill-shaped toggle fixed to the bottom-left corner.
 * Dark state: dark track with moon+stars, light circle on left.
 * Light state: light track with sun, dark circle on right.
 *
 * Uses a raw <button> (like Toggle.tsx) because this is a custom toggle
 * primitive requiring precise layout control not achievable with Button/IconButton.
 *
 * Track/orb colors are CSS custom properties (--color-theme-*) defined in index.css,
 * so they update automatically when data-theme changes.
 */

import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    // design-system-ignore: Custom toggle primitive — same pattern as Toggle.tsx
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={toggleTheme}
      className="fixed left-4 sm:bottom-6 sm:left-6 z-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-full"
      style={{
        bottom: 'var(--theme-toggle-mobile-bottom)',
        width: 80,
        height: 40,
        borderRadius: 20,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        background: 'linear-gradient(135deg, var(--color-theme-track-start) 0%, var(--color-theme-track-end) 100%)',
        boxShadow: isLight
          ? '0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
          : '0 2px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'background 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Stars (visible in dark mode) — decorative, hidden from screen readers */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 8,
          right: 12,
          width: 3,
          height: 3,
          borderRadius: '50%',
          // design-system-ignore
          background: '#fff',
          opacity: isLight ? 0 : 0.7,
          transition: 'opacity 0.4s ease',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 18,
          right: 22,
          width: 2,
          height: 2,
          borderRadius: '50%',
          // design-system-ignore
          background: '#fff',
          opacity: isLight ? 0 : 0.5,
          transition: 'opacity 0.4s ease',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 12,
          right: 34,
          width: 2,
          height: 2,
          borderRadius: '50%',
          // design-system-ignore
          background: '#fff',
          opacity: isLight ? 0 : 0.6,
          transition: 'opacity 0.4s ease',
        }}
      />

      {/* Sliding circle with sun/moon icon — decorative, hidden from screen readers.
          Uses translateX instead of left for GPU-accelerated compositing. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--color-theme-orb)',
          boxShadow: 'var(--color-theme-orb-shadow)',
          transform: isLight ? 'translateX(40px)' : 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {isLight ? (
          // Sun icon — centered via absolute positioning
          <svg data-testid="icon-sun" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          // Moon icon — centered via absolute positioning
          <svg data-testid="icon-moon" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} width="18" height="18" viewBox="0 0 24 24" fill="#475569" stroke="#475569" strokeWidth="1">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}
