/**
 * ThemeToggle - Floating day/night toggle
 *
 * Pill-shaped toggle fixed to the bottom-left corner.
 * Dark state: dark track with moon+stars, light circle on left.
 * Light state: light track with sun, dark circle on right.
 */

import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-full"
      style={{
        width: 64,
        height: 32,
        borderRadius: 16,
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        position: 'fixed',
        background: isLight
          ? 'linear-gradient(135deg, #87CEEB 0%, #60A5FA 100%)' // design-system-ignore
          : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', // design-system-ignore
        boxShadow: isLight
          ? '0 2px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
          : '0 2px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Stars (visible in dark mode) */}
      <span
        style={{
          position: 'absolute',
          top: 6,
          right: 10,
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
        style={{
          position: 'absolute',
          top: 14,
          right: 18,
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
        style={{
          position: 'absolute',
          top: 8,
          right: 26,
          width: 2,
          height: 2,
          borderRadius: '50%',
          // design-system-ignore
          background: '#fff',
          opacity: isLight ? 0 : 0.6,
          transition: 'opacity 0.4s ease',
        }}
      />

      {/* Sliding circle with sun/moon icon */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: isLight ? 35 : 3,
          width: 26,
          height: 26,
          borderRadius: '50%',
          // design-system-ignore
          background: isLight
            ? '#fbbf24'
            : '#e2e8f0',
          boxShadow: isLight
            ? '0 0 8px rgba(251, 191, 36, 0.5)' // design-system-ignore
            : '0 1px 4px rgba(0, 0, 0, 0.3)', // design-system-ignore
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLight ? (
          // Sun icon
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          // Moon icon
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#475569" stroke="#475569" strokeWidth="1">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}
