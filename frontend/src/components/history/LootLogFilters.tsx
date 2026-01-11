/**
 * Loot Log Filters
 *
 * Controls for the loot log view:
 * - Layout mode toggle (Grid vs List)
 * - Reset dropdown (for resetting loot/books/all data)
 * - Action buttons (Log Loot, Log Material)
 */

import { type ResetType } from '../ui/ResetConfirmModal';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import { Button } from '../primitives';

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
    <div className="flex items-center justify-between border-b border-border-default pb-3">
      <div className="flex items-center gap-3">
        {/* Layout Mode Toggle */}
        <div className="flex bg-surface-base rounded-lg p-0.5">
          <button
            onClick={() => onLayoutModeChange('grid')}
            className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
              layoutMode === 'grid'
                ? 'bg-accent text-accent-contrast'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            Grid
          </button>
          <button
            onClick={() => onLayoutModeChange('split')}
            className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-1.5 font-bold ${
              layoutMode === 'split'
                ? 'bg-accent text-accent-contrast'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
              />
            </svg>
            List
          </button>
        </div>

        {/* Reset dropdown */}
        {canEdit && (
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                className="px-3 py-1.5 text-sm font-semibold text-status-error bg-status-error/10 border border-status-error/40 rounded-lg cursor-pointer
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
                Reset
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </DropdownTrigger>
            <DropdownContent align="start">
              <DropdownItem onSelect={onResetLoot} className="text-status-error focus:text-status-error">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Reset Loot Log
                </span>
              </DropdownItem>
              <DropdownItem onSelect={onResetBooks} className="text-status-error focus:text-status-error">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Reset Book Balances
                </span>
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                onSelect={onResetAll}
                className="text-status-error focus:text-status-error font-semibold"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Reset All Data
                </span>
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      </div>

      {/* Action buttons */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onOpenLootModal} title="Log loot drop (Alt+L)">
            + Log Loot
          </Button>
          <Button size="sm" onClick={onOpenMaterialModal} title="Log material drop (Alt+M)">
            + Log Material
          </Button>
        </div>
      )}
    </div>
  );
}
