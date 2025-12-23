import type { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex bg-bg-secondary rounded-md border border-border-default">
      <button
        onClick={() => onViewModeChange('compact')}
        className={`px-3 py-2 rounded-l-md text-sm font-medium transition-colors ${
          viewMode === 'compact'
            ? 'bg-accent/20 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="Compact view"
      >
        {/* Grid icon - represents compact/thumbnail view */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </button>
      <button
        onClick={() => onViewModeChange('expanded')}
        className={`px-3 py-2 rounded-r-md text-sm font-medium transition-colors border-l border-border-default ${
          viewMode === 'expanded'
            ? 'bg-accent/20 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
        }`}
        title="Expanded view"
      >
        {/* List icon - represents expanded/detailed view */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <rect x="1" y="1" width="14" height="4" rx="1" />
          <rect x="1" y="7" width="14" height="4" rx="1" />
          <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
        </svg>
      </button>
    </div>
  );
}
