/**
 * Log Layout Toggle
 *
 * Floating layout toggle (Grid/List/All Weeks) for mobile.
 * Positioned at bottom left, opposite to the Log Loot/Material FABs.
 * Uses same icons as the Roster tab's compact/expanded toggle.
 */

import type { LogLayoutMode } from './LootLogFilters';

interface LogLayoutToggleProps {
  layoutMode: LogLayoutMode;
  onLayoutChange: (mode: LogLayoutMode) => void;
  visible: boolean;
}

export function LogLayoutToggle({ layoutMode, onLayoutChange, visible }: LogLayoutToggleProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-[4.5rem] left-4 flex flex-row gap-1 z-30 md:hidden backdrop-blur-md bg-black/40 rounded-full ring-1 ring-white/10 p-1">
      {/* design-system-ignore: Toggle buttons in compact FAB group require specific styling */}
      <button
        onClick={() => onLayoutChange('grid')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          layoutMode === 'grid'
            ? 'bg-accent/20 text-accent'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="Grid view"
        aria-pressed={layoutMode === 'grid'}
      >
        {/* Grid icon - 4 squares */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <button
        onClick={() => onLayoutChange('split')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          layoutMode === 'split'
            ? 'bg-accent/20 text-accent'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="List view"
        aria-pressed={layoutMode === 'split'}
      >
        {/* List icon - horizontal bars */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="4" rx="1" />
          <rect x="1" y="7" width="14" height="4" rx="1" />
          <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
        </svg>
      </button>
      <button
        onClick={() => onLayoutChange('allWeeks')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          layoutMode === 'allWeeks'
            ? 'bg-accent/20 text-accent'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        aria-label="All weeks view"
        aria-pressed={layoutMode === 'allWeeks'}
      >
        {/* Calendar icon for all weeks */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="3" width="14" height="12" rx="1.5" fillOpacity="0.15" stroke="currentColor" strokeWidth="1" fill="none" />
          <rect x="1" y="3" width="14" height="3.5" rx="1.5" />
          <rect x="3.5" y="8" width="2" height="1.5" rx="0.3" opacity="0.7" />
          <rect x="7" y="8" width="2" height="1.5" rx="0.3" opacity="0.7" />
          <rect x="10.5" y="8" width="2" height="1.5" rx="0.3" opacity="0.7" />
          <rect x="3.5" y="11" width="2" height="1.5" rx="0.3" opacity="0.7" />
          <rect x="7" y="11" width="2" height="1.5" rx="0.3" opacity="0.7" />
        </svg>
      </button>
    </div>
  );
}
