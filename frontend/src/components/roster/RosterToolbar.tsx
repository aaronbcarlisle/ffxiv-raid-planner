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
 * The Cards⇄Board `SegmentedToggle` (mockup's leading control) is **not**
 * part of this component — it's added in `f6c-board` per the spec's split
 * between the two slices.
 */

import { List, Plus } from 'lucide-react';
import { Button } from '../primitives/Button';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../primitives/Dropdown';
import { Toggle } from '../ui/Toggle';

export interface RosterToolbarProps {
  /** Light-Party (G1/G2/Unassigned) grouping vs a single flat "Standard comp" grid. */
  groupView: boolean;
  onGroupViewChange: (v: boolean) => void;
  /** Hides the substitutes section entirely. */
  subsHidden: boolean;
  onSubsHiddenChange: (hidden: boolean) => void;
  /** Whether the roster currently has any substitute players — gates the "Show subs" chip. */
  hasSubstitutes: boolean;
  /** Drag-to-reorder mode. */
  reorderMode: boolean;
  onReorderModeChange: (v: boolean) => void;
  /** Whether the current user can manage the roster (gates "Add player"). */
  canManage: boolean;
  onAddPlayer: () => void;
}

export function RosterToolbar({
  groupView,
  onGroupViewChange,
  subsHidden,
  onSubsHiddenChange,
  hasSubstitutes,
  reorderMode,
  onReorderModeChange,
  canManage,
  onAddPlayer,
}: RosterToolbarProps) {
  const groupingLabel = groupView ? 'Light Party' : 'Standard comp';

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="sm" trailing="chevron">
            {groupingLabel}
          </Button>
        </DropdownTrigger>
        <DropdownContent align="start" className="w-40">
          <DropdownItem onSelect={() => onGroupViewChange(false)}>Standard comp</DropdownItem>
          <DropdownItem onSelect={() => onGroupViewChange(true)}>Light Party</DropdownItem>
        </DropdownContent>
      </Dropdown>

      {hasSubstitutes && (
        <Toggle
          checked={!subsHidden}
          onChange={(shown) => onSubsHiddenChange(!shown)}
          label="Show subs"
          size="sm"
        />
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        leftIcon={<List className="w-3.5 h-3.5" aria-hidden />}
        aria-pressed={reorderMode}
        onClick={() => onReorderModeChange(!reorderMode)}
      >
        Reorder
      </Button>

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
