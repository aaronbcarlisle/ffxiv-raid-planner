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
import { Tooltip } from '../primitives/Tooltip';
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

/**
 * Tooltip body that teaches the control's keyboard shortcut (legacy R-012 /
 * `GroupViewToggle` parity — C6 makes `G` and `S` live in v2 for the first
 * time, and shipping them with no on-surface hint would lose the affordance
 * legacy had; director F2).
 */
function ShortcutHint({ keyLabel, text }: { keyLabel: string; text: string }) {
  return (
    <div className="max-w-60">
      <div className="flex items-center gap-2 font-medium">
        Shortcut
        <kbd className="rounded border border-border-default bg-surface-base px-1.5 py-0.5 text-xs">
          {keyLabel}
        </kbd>
      </div>
      <div className="mt-0.5 text-xs text-text-secondary">{text}</div>
    </div>
  );
}

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
  // Separating is only moot while the section it would create is hidden.
  const separateSubsDisabled = subsHidden && subsView;
  const groupingHint = groupView
    ? 'On — the roster splits into G1 / G2. Click to show one flat grid.'
    : 'Off — one flat grid. Click to split the roster into G1 / G2.';
  // Task 1 (feedback-polish): the transient enter→drag→exit reorder flow
  // shipped with zero on-surface teaching. A plain Tooltip, not ShortcutHint
  // — there's no reorder keyboard shortcut (`r` is Copy to New Tier). Wording
  // tuned from SORT_PRESETS.custom.description ('Drag to reorder') for the
  // fuller two-step flow, but read-only — that shared constants file is
  // frozen (still-live V1 consumer).
  const reorderHint = 'Drag cards to reorder or swap players. Click again to finish.';
  const separateHint = separateSubsDisabled
    ? // Subs ARE separated here — the section is just hidden, so the only thing
      // this control could do is merge them back (PR #199 review).
      'Substitutes are hidden. Turn "Show subs" on to change how they are grouped.'
    : subsView
      ? 'On — substitutes sit in their own section. Click to merge them into the roster.'
      : 'Off — substitutes are merged into the roster. Click to separate them.';

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
              are groups at all. One control per axis. The variant carries the
              pressed state visually — `aria-pressed` alone leaves sighted
              users with two identical-looking states (director F5). */}
          <Tooltip content={<ShortcutHint keyLabel="G" text={groupingHint} />}>
            <Button
              variant={groupView ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Users className="h-3.5 w-3.5" aria-hidden />}
              aria-pressed={groupView}
              onClick={() => onGroupViewChange(!groupView)}
            >
              Light Party
            </Button>
          </Tooltip>

          {hasSubstitutes && (
            <>
              <Toggle
                checked={!subsHidden}
                onChange={(shown) => onSubsHiddenChange(!shown)}
                label="Show subs"
                size="sm"
              />
              {/* Show Subs gates this one (C1-checkpoint correction (c)) — but
                  ONLY while a separate section is what's being hidden. In the
                  GROUPED view merged subs render inside G1/G2 whatever
                  `subsHidden` says, so disabling the control there would
                  strand the user with substitutes they had just switched off
                  (director F6). The flat view filters them out instead — an
                  inherited legacy inconsistency (`PlayerGrid.tsx:640` gates
                  its main grid on `subsView || subsHidden` while the grouped
                  branch does not), recorded on matrix D-07. */}
              <Tooltip content={<ShortcutHint keyLabel="S" text={separateHint} />}>
                <span className="inline-flex">
                  <Toggle
                    checked={subsView}
                    onChange={onSubsViewChange}
                    label="Separate subs"
                    size="sm"
                    disabled={separateSubsDisabled}
                  />
                </span>
              </Tooltip>
            </>
          )}
        </>
      )}

      <div className="flex-1" />

      {rosterView === 'cards' && (
        <Tooltip content={<div className="max-w-60">{reorderHint}</div>}>
          {/* Disabled buttons don't receive hover/focus events, so the
              trigger sits on this always-enabled span (precedent above,
              :189-199) — the tooltip must still teach the flow to a
              non-manager, even though they can't use it. */}
          <span className="inline-flex">
            {/* Pressed treatment swaps the VARIANT, not just className — a
                className addition can't reliably beat `ghost`'s own
                `bg-transparent` in the cascade (both are plain utility
                classes at equal specificity; Tailwind's generated order, not
                DOM/JSX order, decides the winner, and `bg-transparent` was
                winning), so `aria-pressed` was lying with zero visible
                change. `accent-subtle` (Button.tsx) is the existing
                semantic "on" look (MyStaticsPanel.tsx:356 precedent: same
                variant-swap approach, not a className race). */}
            <Button
              variant={reorderMode ? 'accent-subtle' : 'ghost'}
              size="sm"
              leftIcon={<List className="w-3.5 h-3.5" aria-hidden />}
              aria-pressed={reorderMode}
              disabled={!canManage}
              onClick={() => onReorderModeChange(!reorderMode)}
            >
              Reorder
            </Button>
          </span>
        </Tooltip>
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
