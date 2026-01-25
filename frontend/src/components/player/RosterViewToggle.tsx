/**
 * Roster View Toggle
 *
 * Floating view mode toggle (Expanded/Compact) for mobile.
 * Positioned at bottom left to match the Log tab's layout toggle.
 * Uses the same icons as the desktop ViewModeToggle.
 */

import type { ViewMode } from '../../types';

interface RosterViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  visible: boolean;
}

export function RosterViewToggle({ viewMode, onViewModeChange, visible }: RosterViewToggleProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 flex flex-row gap-1 z-30 md:hidden bg-surface-elevated border border-border-default rounded-full shadow-lg p-1">
      {/* design-system-ignore: Toggle buttons in compact FAB group require specific styling */}
      <button
        onClick={() => onViewModeChange('compact')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          viewMode === 'compact'
            ? 'bg-accent text-accent-contrast'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="Compact view"
        aria-pressed={viewMode === 'compact'}
      >
        {/* Grid icon - same as desktop compact view */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <button
        onClick={() => onViewModeChange('expanded')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          viewMode === 'expanded'
            ? 'bg-accent text-accent-contrast'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="Expanded view"
        aria-pressed={viewMode === 'expanded'}
      >
        {/* List icon - same as desktop expanded view */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="4" rx="1" />
          <rect x="1" y="7" width="14" height="4" rx="1" />
          <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
        </svg>
      </button>
    </div>
  );
}
