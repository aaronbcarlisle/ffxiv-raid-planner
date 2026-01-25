/**
 * Log Layout Toggle
 *
 * Floating layout toggle (Grid/List) for mobile.
 * Positioned at bottom left, opposite to the Log Loot/Material FABs.
 */

import { LayoutGrid, List } from 'lucide-react';

interface LogLayoutToggleProps {
  layoutMode: 'grid' | 'split';
  onLayoutChange: (mode: 'grid' | 'split') => void;
  visible: boolean;
}

export function LogLayoutToggle({ layoutMode, onLayoutChange, visible }: LogLayoutToggleProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 flex flex-row gap-1 z-30 md:hidden bg-surface-elevated border border-border-default rounded-full shadow-lg p-1">
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
        <LayoutGrid className="w-5 h-5" />
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
        <List className="w-5 h-5" />
      </button>
    </div>
  );
}
