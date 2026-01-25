/**
 * Log Layout Toggle
 *
 * Floating layout toggle (Grid/List) for mobile.
 * Positioned at bottom left, opposite to the Log Loot/Material FABs.
 * Uses same icons as the Roster tab's compact/expanded toggle.
 */

interface LogLayoutToggleProps {
  layoutMode: 'grid' | 'split';
  onLayoutChange: (mode: 'grid' | 'split') => void;
  visible: boolean;
}

export function LogLayoutToggle({ layoutMode, onLayoutChange, visible }: LogLayoutToggleProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 flex flex-row gap-1 z-30 md:hidden bg-surface-elevated rounded-full ring-2 ring-accent/50 shadow-[0_0_20px_rgba(20,184,166,0.3)] p-1">
      {/* design-system-ignore: Toggle buttons in compact FAB group require specific styling */}
      <button
        onClick={() => onLayoutChange('grid')}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          layoutMode === 'grid'
            ? 'bg-accent text-accent-contrast'
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
            ? 'bg-accent text-accent-contrast'
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
    </div>
  );
}
