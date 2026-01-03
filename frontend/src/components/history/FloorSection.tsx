/**
 * FloorSection Component
 *
 * A wrapper that groups loot entries by floor with colored header bar.
 * Uses floor color coding from loot-tables.ts.
 */

import type { ReactNode } from 'react';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';

interface FloorSectionProps {
  floor: FloorNumber;
  floorName: string; // e.g., "M9S"
  entryCount: number;
  children: ReactNode;
}

export function FloorSection({ floor, floorName, entryCount, children }: FloorSectionProps) {
  const colors = FLOOR_COLORS[floor];

  return (
    <div className="mb-4">
      {/* Floor Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${colors.bg} ${colors.border}`}
      >
        <span className={`text-sm font-bold ${colors.text}`}>
          {floorName}
        </span>
        <span className={`text-xs ${colors.text} opacity-80`}>
          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      {/* Content */}
      <div className="bg-surface-elevated/30 border border-t-0 border-border-default rounded-b-lg p-2 space-y-2">
        {children}
      </div>
    </div>
  );
}

export default FloorSection;
