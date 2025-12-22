import type { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('compact')}
        className={`
          px-3 py-2 rounded-md font-medium transition-colors text-lg
          ${
            viewMode === 'compact'
              ? 'bg-accent text-bg-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }
        `}
        title="Compact view"
      >
        ▤
      </button>
      <button
        onClick={() => onViewModeChange('expanded')}
        className={`
          px-3 py-2 rounded-md font-medium transition-colors text-lg
          ${
            viewMode === 'expanded'
              ? 'bg-accent text-bg-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
          }
        `}
        title="Expanded view"
      >
        ☰
      </button>
    </div>
  );
}
