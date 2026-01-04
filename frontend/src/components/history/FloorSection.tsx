/**
 * FloorSection Component
 *
 * A collapsible wrapper that groups loot entries by floor with colored header bar.
 * Uses floor color coding from loot-tables.ts.
 */

import { useState, type ReactNode } from 'react';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';

interface FloorSectionProps {
  floor: FloorNumber;
  floorName: string; // e.g., "M9S"
  entryCount: number;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function FloorSection({ floor, floorName, entryCount, children, defaultExpanded = true }: FloorSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const colors = FLOOR_COLORS[floor];

  return (
    <div className="mb-4">
      {/* Floor Header - clickable to toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} border ${colors.bg} ${colors.border} transition-all hover:opacity-90`}
      >
        <div className="flex items-center gap-2">
          {/* Chevron indicator */}
          <svg
            className={`w-4 h-4 ${colors.text} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-sm font-bold ${colors.text}`}>
            {floorName}
          </span>
        </div>
        <span className={`text-xs ${colors.text} opacity-80`}>
          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </button>
      {/* Content - collapsible */}
      {isExpanded && (
        <div className="bg-surface-elevated/30 border border-t-0 border-border-default rounded-b-lg p-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

export default FloorSection;
