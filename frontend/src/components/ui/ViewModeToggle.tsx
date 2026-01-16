import { LayoutGrid, List } from 'lucide-react';
import { Tooltip } from '../primitives/Tooltip';
import type { ViewMode } from '../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex bg-surface-raised rounded-md border border-border-default">
      <Tooltip
        content={
          <div className="flex items-start gap-2">
            <LayoutGrid className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Compact View</div>
              <div className="text-text-secondary text-xs mt-0.5">
                Shows gear icons only. Press <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">V</kbd> to toggle.
              </div>
            </div>
          </div>
        }
      >
        <button
          onClick={() => onViewModeChange('compact')}
          className={`px-3 py-2 rounded-l-md text-sm font-medium transition-colors ${
            viewMode === 'compact'
              ? 'bg-accent/20 text-accent'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
          }`}
        >
          {/* Grid icon - represents compact/thumbnail view */}
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
      </Tooltip>
      <Tooltip
        content={
          <div className="flex items-start gap-2">
            <List className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Expanded View</div>
              <div className="text-text-secondary text-xs mt-0.5">
                Shows full gear table. Press <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">V</kbd> to toggle.
              </div>
            </div>
          </div>
        }
      >
        <button
          onClick={() => onViewModeChange('expanded')}
          className={`px-3 py-2 rounded-r-md text-sm font-medium transition-colors border-l border-border-default ${
            viewMode === 'expanded'
              ? 'bg-accent/20 text-accent'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
          }`}
        >
          {/* List icon - represents expanded/detailed view */}
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <rect x="1" y="1" width="14" height="4" rx="1" />
            <rect x="1" y="7" width="14" height="4" rx="1" />
            <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
