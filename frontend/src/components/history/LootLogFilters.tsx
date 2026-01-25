/**
 * Loot Log Filters
 *
 * Controls for the loot log view:
 * - Layout mode toggle (Grid vs List)
 * - Reset dropdown (for resetting loot/books/all data)
 * - Action buttons (Log Loot, Log Material)
 */

import { Package, Gem } from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { Button } from '../primitives';
import { Tooltip } from '../primitives/Tooltip';

export interface LootLogFiltersProps {
  // Layout mode
  layoutMode: 'split' | 'grid';
  onLayoutModeChange: (mode: 'split' | 'grid') => void;

  // Reset functionality
  canEdit: boolean;
  onResetLoot: () => void;
  onResetBooks: () => void;
  onResetAll: () => void;

  // Action buttons
  onOpenLootModal: () => void;
  onOpenMaterialModal: () => void;
}

export function LootLogFilters({
  layoutMode,
  onLayoutModeChange,
  canEdit,
  onResetLoot,
  onResetBooks,
  onResetAll,
  onOpenLootModal,
  onOpenMaterialModal,
}: LootLogFiltersProps) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-border-default pb-3">
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Layout Mode Toggle - hidden on mobile (floating toggle used instead) */}
        <div className="hidden sm:flex bg-surface-base rounded-lg p-0.5">
          <Tooltip
            content={
              <div>
                <div className="flex items-center gap-2 font-medium">
                  Grid View
                  <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">G</kbd>
                </div>
                <div className="text-text-secondary text-xs mt-0.5">Spreadsheet-style weekly loot grid</div>
              </div>
            }
          >
            {/* design-system-ignore: Layout toggle button requires specific toggle styling */}
            <button
              onClick={() => onLayoutModeChange('grid')}
              className={`px-2 sm:px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
                layoutMode === 'grid'
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {/* Grid icon - 4 squares (matches Roster tab compact icon) */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
              <span className="hidden sm:inline">Grid</span>
            </button>
          </Tooltip>
          <Tooltip
            content={
              <div>
                <div className="flex items-center gap-2 font-medium">
                  List View
                  <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">G</kbd>
                </div>
                <div className="text-text-secondary text-xs mt-0.5">Traditional chronological loot log</div>
              </div>
            }
          >
            {/* design-system-ignore: Layout toggle button requires specific toggle styling */}
            <button
              onClick={() => onLayoutModeChange('split')}
              className={`px-2 sm:px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
                layoutMode === 'split'
                  ? 'bg-accent text-accent-contrast'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {/* List icon - horizontal bars (matches Roster tab expanded icon) */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="1" width="14" height="4" rx="1" />
                <rect x="1" y="7" width="14" height="4" rx="1" />
                <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
              </svg>
              <span className="hidden sm:inline">List</span>
            </button>
          </Tooltip>
        </div>

        {/* Reset dropdown - hidden on mobile (in controls panel instead) */}
        <div className="hidden sm:block">
        {canEdit && (
          <Dropdown>
            <Tooltip
              content={
                <div>
                  <div className="font-medium">Reset Data</div>
                  <div className="text-text-secondary text-xs mt-0.5">Clear loot log, book balances, or all data</div>
                </div>
              }
            >
              <span className="inline-flex">
                <DropdownTrigger asChild>
                  {/* design-system-ignore: Reset trigger button requires specific danger styling */}
                  <button
                    className="px-2 sm:px-3 py-1.5 text-sm font-semibold text-status-error bg-status-error/10 border border-status-error/40 rounded-lg cursor-pointer
                                        hover:bg-status-error/20 hover:border-status-error/60 active:bg-status-error/30 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span className="hidden sm:inline">Reset</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </DropdownTrigger>
              </span>
            </Tooltip>
            <DropdownContent align="start">
              <DropdownItem
                onSelect={onResetLoot}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                }
                className="hover:text-status-error focus:text-status-error"
              >
                Reset Loot Log
              </DropdownItem>
              <DropdownItem
                onSelect={onResetBooks}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                }
                className="hover:text-status-error focus:text-status-error"
              >
                Reset Book Balances
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                onSelect={onResetAll}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                }
                className="font-semibold hover:text-status-error focus:text-status-error"
              >
                Reset All Data
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
        </div>
      </div>

      {/* Action buttons - hidden on mobile (FAB used instead) */}
      {canEdit && (
        <div className="hidden sm:flex items-center gap-2">
          <Tooltip
            content={
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Log Loot</div>
                  <div className="text-text-secondary text-xs mt-0.5">
                    Record a gear drop. Press <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">Alt+L</kbd>
                  </div>
                </div>
              </div>
            }
          >
            <Button size="sm" onClick={onOpenLootModal}>
              + Log Loot
            </Button>
          </Tooltip>
          <Tooltip
            content={
              <div className="flex items-start gap-2">
                <Gem className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Log Material</div>
                  <div className="text-text-secondary text-xs mt-0.5">
                    Record twine, glaze, or solvent. Press <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px]">Alt+M</kbd>
                  </div>
                </div>
              </div>
            }
          >
            <Button size="sm" onClick={onOpenMaterialModal}>
              + Log Material
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
