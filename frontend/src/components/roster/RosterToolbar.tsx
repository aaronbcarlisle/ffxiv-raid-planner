/**
 * RosterToolbar — v2 roster toolbar, Cards-view controls (F6c Roster · Cards).
 *
 * The row above the card grid: a "Standard comp ⇄ Light Party" grouping pill,
 * a "Show subs" toggle-chip (only when the roster has substitutes), a spacer,
 * a "Reorder" ghost button (toggles drag-to-reorder mode), and an "Add player"
 * primary button. Visual target: `mockups/02-roster-cards.html` `.rtoolbar`
 * (`:482-493`); behaviour: `design/redesign/specs/2026-07-01-f6c-roster-design.md`
 * §5.7.
 *
 * The Cards⇄Board `SegmentedToggle` is the leading control in both views
 * (`f6c-board`, spec §5.7); the grouping pill, "Show subs" chip, and
 * "Reorder" button are Cards-only (the Board is always-grouped and not
 * reorderable — spec §5.4). "Add player" stays in both views.
 */

import { LayoutGrid, List, Plus, Rows3, Table2, Users } from 'lucide-react';
import { Button } from '../primitives/Button';
import { SegmentedToggle } from '../ui/SegmentedToggle';
import { SortModeSelector } from '../ui/SortModeSelector';
import { Toggle } from '../ui/Toggle';
import type { SortPreset, ViewMode } from '../../types';

const VIEW_OPTIONS = [
  { value: 'cards' as const, label: 'Cards', icon: <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> },
  { value: 'board' as const, label: 'Board', icon: <Table2 className="h-3.5 w-3.5" aria-hidden /> },
];

// Density axis (D-01): Compact = pip strip, Expanded = full gear table. Icons
// mirror legacy's ViewModeToggle pairing (grid = compact, list = expanded).
const DENSITY_OPTIONS = [
  { value: 'compact' as const, label: 'Compact', icon: <Rows3 className="h-3.5 w-3.5" aria-hidden /> },
  { value: 'expanded' as const, label: 'Expanded', icon: <List className="h-3.5 w-3.5" aria-hidden /> },
];

export interface RosterToolbarProps {
  /** Light-Party (G1/G2/Unassigned) grouping vs a single flat grid. */
  groupView: boolean;
  onGroupViewChange: (v: boolean) => void;
  /** Hides the substitutes section entirely. */
  subsHidden: boolean;
  onSubsHiddenChange: (hidden: boolean) => void;
  /** Subs in their own section (on) vs merged into the main grid (off) — D-07. */
  subsView: boolean;
  onSubsViewChange: (v: boolean) => void;
  /** Whether the roster currently has any substitute players — gates both subs toggles. */
  hasSubstitutes: boolean;
  /** Drag-to-reorder mode. */
  reorderMode: boolean;
  onReorderModeChange: (v: boolean) => void;
  /** Whether the current user can manage the roster (gates "Add player"). */
  canManage: boolean;
  onAddPlayer: () => void;
  /** Active roster view — Cards (management) vs Board (gear matrix). */
  rosterView: 'cards' | 'board';
  onRosterViewChange: (v: 'cards' | 'board') => void;
  /** Card density axis (D-01) — Cards view only. */
  density: ViewMode;
  onDensityChange: (mode: ViewMode) => void;
  /** Sort preset applied within groups, or across the flat grid (D-06). */
  sortPreset: SortPreset;
  onSortPresetChange: (preset: SortPreset) => void;
  /**
   * Re-clicking the already-active "Expanded" control (C1-checkpoint ruling,
   * legacy R-023): expands every folded section, or folds them all when
   * everything is open. Cards keep their density while a section is folded.
   */
  onExpandAllToggle: () => void;
}

export function RosterToolbar({
  groupView,
  onGroupViewChange,
  subsHidden,
  onSubsHiddenChange,
  subsView,
  onSubsViewChange,
  hasSubstitutes,
  reorderMode,
  onReorderModeChange,
  canManage,
  onAddPlayer,
  rosterView,
  onRosterViewChange,
  density,
  onDensityChange,
  sortPreset,
  onSortPresetChange,
  onExpandAllToggle,
}: RosterToolbarProps) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <SegmentedToggle
        options={VIEW_OPTIONS}
        value={rosterView}
        onChange={onRosterViewChange}
        ariaLabel="Roster view"
      />

      {rosterView === 'cards' && (
        <>
          <SegmentedToggle
            options={DENSITY_OPTIONS}
            value={density}
            onChange={onDensityChange}
            onReselect={(value) => {
              // Legacy binds section expand/collapse-all to re-clicking
              // EXPANDED specifically (`PlayerGrid.expandAllSignal`), so a
              // re-click on Compact stays inert.
              if (value === 'expanded') onExpandAllToggle();
            }}
            ariaLabel="Card density"
          />

          <SortModeSelector
            sortPreset={sortPreset}
            onPresetChange={onSortPresetChange}
            aria-label="Sort players"
          />

          {/* Grouping is its own axis (C1-checkpoint correction (a)): sort
              reorders cards WITHIN their groups, this decides whether there
              are groups at all. One control per axis. */}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Users className="h-3.5 w-3.5" aria-hidden />}
            aria-pressed={groupView}
            onClick={() => onGroupViewChange(!groupView)}
          >
            Light Party
          </Button>

          {hasSubstitutes && (
            <>
              <Toggle
                checked={!subsHidden}
                onChange={(shown) => onSubsHiddenChange(!shown)}
                label="Show subs"
                size="sm"
              />
              {/* Show Subs gates this one (C1-checkpoint correction (c)): in v1
                  both toggle independently, so "separate" could apply to a
                  section that isn't rendered at all. */}
              <Toggle
                checked={subsView}
                onChange={onSubsViewChange}
                label="Separate subs"
                size="sm"
                disabled={subsHidden}
              />
            </>
          )}
        </>
      )}

      <div className="flex-1" />

      {rosterView === 'cards' && (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<List className="w-3.5 h-3.5" aria-hidden />}
          aria-pressed={reorderMode}
          disabled={!canManage}
          onClick={() => onReorderModeChange(!reorderMode)}
        >
          Reorder
        </Button>
      )}

      <Button
        variant="primary"
        size="sm"
        leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden />}
        disabled={!canManage}
        onClick={onAddPlayer}
      >
        Add player
      </Button>
    </div>
  );
}
