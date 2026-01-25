/**
 * FloorSection Component
 *
 * A collapsible wrapper that groups loot entries by floor with colored header bar.
 * Uses floor color coding from loot-tables.ts.
 *
 * Features:
 * - Click to expand/collapse individual section
 * - Right-click for Expand All / Collapse All context menu
 */

import { useState, type ReactNode, type MouseEvent } from 'react';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

interface FloorSectionProps {
  floor: FloorNumber;
  floorName: string; // e.g., "M9S"
  entryCount: number;
  children: ReactNode;
  defaultExpanded?: boolean;
  /** Controlled expanded state - if provided, component is controlled */
  expanded?: boolean;
  /** Callback when expand/collapse state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Callback to expand all sections */
  onExpandAll?: () => void;
  /** Callback to collapse all sections */
  onCollapseAll?: () => void;
}

export function FloorSection({
  floor,
  floorName,
  entryCount,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onExpandChange,
  onExpandAll,
  onCollapseAll,
}: FloorSectionProps) {
  // Support both controlled and uncontrolled modes
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded ?? localExpanded;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const colors = FLOOR_COLORS[floor];

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    if (controlledExpanded === undefined) {
      setLocalExpanded(newExpanded);
    }
    onExpandChange?.(newExpanded);
  };

  const handleContextMenu = (e: MouseEvent) => {
    // Only show context menu if expand/collapse all callbacks are provided
    if (onExpandAll || onCollapseAll) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const contextMenuItems: ContextMenuItem[] = [
    ...(onExpandAll ? [{
      label: 'Expand All',
      icon: <ChevronsUpDown className="w-4 h-4" />,
      onClick: onExpandAll,
    }] : []),
    ...(onCollapseAll ? [{
      label: 'Collapse All',
      icon: <ChevronsDownUp className="w-4 h-4" />,
      onClick: onCollapseAll,
    }] : []),
  ];

  return (
    <div className="mb-4">
      {/* Floor Header - clickable to toggle, right-click for context menu */}
      <button
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] sm:min-h-0 ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'} border ${colors.bg} ${colors.border} transition-all hover:opacity-90`}
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
      {/* Content - collapsible, vertical stack */}
      {isExpanded && (
        <div className={`bg-surface-elevated/30 border border-t-0 ${colors.border} rounded-b-lg p-2`}>
          <div className="flex flex-col gap-2">
            {children}
          </div>
        </div>
      )}
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

export default FloorSection;
