/**
 * Theme Toggle
 *
 * Compact icon button that switches between dark and light themes.
 * Shows the current theme's icon (Moon in dark, Sun in light); the tooltip
 * describes the action. Must be rendered inside <ThemeProvider>.
 */

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { IconButton, Tooltip } from '../primitives';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Tooltip content={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        icon={isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        onClick={toggleTheme}
        variant="ghost"
        aria-label="Toggle theme"
      />
    </Tooltip>
  );
}
