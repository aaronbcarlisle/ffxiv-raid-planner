/**
 * Loot Log Filters
 *
 * Consolidated toolbar for the Log tab view:
 * - Left: Layout mode toggle (Grid vs List), Reset dropdown
 * - Center: Week selector (passed as children or via weekSelector prop)
 * - Right: Action buttons (Log Loot, Log Material)
 */

import { Package, Gem, ClipboardList } from 'lucide-react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownLabel,
} from '../primitives/Dropdown';
import { Button } from '../primitives';
import { Tooltip } from '../primitives/Tooltip';

export interface LootLogFiltersProps {
  // Layout mode
  layoutMode: 'split' | 'grid';
  onLayoutModeChange: (mode: 'split' | 'grid') => void;

  // Current week for display in menu
  currentWeek: number;

  // Reset functionality - week-specific
  canEdit: boolean;
  onResetWeekLoot: () => void;
  onResetWeekBooks: () => void;
  onResetWeekData: () => void;

  // Reset functionality - tier-wide
  onResetAllLoot: () => void;
  onResetAllBooks: () => void;
  onResetAllData: () => void;

  // Action buttons
  onOpenLootModal: () => void;
  onOpenMaterialModal: () => void;
  onLogWeek?: () => void;

  // Week selector (centered)
  weekSelector?: React.ReactNode;
}

export function LootLogFilters({
  layoutMode,
  onLayoutModeChange,
  currentWeek,
  canEdit,
  onResetWeekLoot,
  onResetWeekBooks,
  onResetWeekData,
  onResetAllLoot,
  onResetAllBooks,
  onResetAllData,
  onOpenLootModal,
  onOpenMaterialModal,
  onLogWeek,
  weekSelector,
}: LootLogFiltersProps) {
  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 border-b border-border-default pb-3">
      {/* Left group: Layout toggle + Reset */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Layout Mode Toggle - hidden on mobile (floating toggle used instead) */}
        <div className="hidden sm:flex bg-surface-raised rounded-lg border border-border-default">
          <Tooltip
            content={
              <div>
                <div className="flex items-center gap-2 font-medium">
                  Week View
                  <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">G</kbd>
                </div>
                <div className="text-text-secondary text-xs mt-0.5">Spreadsheet-style weekly loot grid</div>
              </div>
            }
          >
            {/* design-system-ignore: Layout toggle button requires specific toggle styling */}
            <button
              onClick={() => onLayoutModeChange('grid')}
              className={`px-3 py-2 rounded-l-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                layoutMode === 'grid'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {/* Grid icon - 4 squares (matches Roster tab compact icon) */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
              <span className="hidden sm:inline">Week</span>
            </button>
          </Tooltip>
          <Tooltip
            content={
              <div>
                <div className="flex items-center gap-2 font-medium">
                  History View
                  <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">G</kbd>
                </div>
                <div className="text-text-secondary text-xs mt-0.5">Chronological loot history</div>
              </div>
            }
          >
            {/* design-system-ignore: Layout toggle button requires specific toggle styling */}
            <button
              onClick={() => onLayoutModeChange('split')}
              className={`px-3 py-2 rounded-r-lg text-sm font-medium transition-colors flex items-center gap-1.5 border-l border-border-default ${
                layoutMode === 'split'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {/* List icon - horizontal bars (matches Roster tab expanded icon) */}
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <rect x="1" y="1" width="14" height="4" rx="1" />
                <rect x="1" y="7" width="14" height="4" rx="1" />
                <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
              </svg>
              <span className="hidden sm:inline">History</span>
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
                  <div className="text-text-secondary text-xs mt-0.5">Clear loot, books, or all data</div>
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
            <DropdownContent align="start" className="w-48">
              {/* Week-specific resets */}
              <DropdownLabel>Week {currentWeek}</DropdownLabel>
              <DropdownItem
                onSelect={onResetWeekLoot}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                className="hover:text-status-warning focus:text-status-warning"
              >
                Reset W{currentWeek} Loot
              </DropdownItem>
              <DropdownItem
                onSelect={onResetWeekBooks}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
                className="hover:text-status-warning focus:text-status-warning"
              >
                Reset W{currentWeek} Books
              </DropdownItem>
              <DropdownItem
                onSelect={onResetWeekData}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
                className="hover:text-status-warning focus:text-status-warning"
              >
                Reset W{currentWeek} Data
              </DropdownItem>

              <DropdownSeparator />

              {/* Tier-wide resets */}
              <DropdownLabel>All Weeks</DropdownLabel>
              <DropdownItem
                onSelect={onResetAllLoot}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                className="hover:text-status-error focus:text-status-error"
              >
                Reset All Loot
              </DropdownItem>
              <DropdownItem
                onSelect={onResetAllBooks}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
                className="hover:text-status-error focus:text-status-error"
              >
                Reset All Books
              </DropdownItem>

              <DropdownSeparator />

              <DropdownItem
                onSelect={onResetAllData}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Center group: Week selector */}
      {weekSelector && (
        <div className="hidden sm:flex flex-shrink-0">
          {weekSelector}
        </div>
      )}

      {/* Right group: Action buttons - hidden on mobile (FAB used instead) */}
      {canEdit && (
        <div className="hidden sm:flex items-center gap-2">
          {onLogWeek && (
            <>
              <Tooltip content="Log all drops for this week using a step-by-step wizard">
                <Button size="sm" variant="primary" onClick={onLogWeek}>
                  <ClipboardList className="w-4 h-4 mr-1.5" />
                  Log Week
                </Button>
              </Tooltip>

              {/* Divider */}
              <div className="w-px h-6 bg-border-default" />
            </>
          )}

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
            <Button size="sm" variant="accent-subtle" onClick={onOpenLootModal}>
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
            <Button size="sm" variant="accent-subtle" onClick={onOpenMaterialModal}>
              + Log Material
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
