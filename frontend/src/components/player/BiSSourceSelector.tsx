/**
 * BiSSourceSelector - 2x2 grid BiS source selection
 *
 * Popover layout:
 *   [  Raid ] [  Tome ]
 *   [Crafted] [B. Tome]
 *        Clear Slot
 *
 * Based on TankRoleSelector pattern with Popover.
 */

import { useState } from 'react';
import type { GearSource, TomeWeaponStatus } from '../../types';
import { BIS_SOURCE_FULL_NAMES } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Tooltip } from '../primitives/Tooltip'; // Only used for WeaponBiSSelector

// BiS source display info
const BIS_SOURCE_INFO: Record<GearSource, { short: string; label: string; description: string }> = {
  raid: {
    short: 'R',
    label: 'Raid',
    description: 'BiS gear from Savage raids',
  },
  tome: {
    short: 'T',
    label: 'Tome',
    description: 'Tomestone gear that needs augmentation',
  },
  base_tome: {
    short: 'BT',
    label: 'B. Tome',
    description: 'Tomestone gear where base version is BiS',
  },
  crafted: {
    short: 'C',
    label: 'Crafted',
    description: 'Crafted pentamelded gear',
  },
};

// Grid layout: 2 rows x 2 columns
const GRID_LAYOUT: GearSource[][] = [
  ['raid', 'tome'],
  ['crafted', 'base_tome'],
];

/**
 * Get color classes for a BiS source button
 */
function getSourceButtonClasses(source: GearSource, isSelected: boolean): string {
  const baseClasses = 'px-2 py-1 rounded text-xs font-bold transition-colors';

  if (source === 'raid') {
    return isSelected
      ? `${baseClasses} bg-gear-raid text-surface-base`
      : `${baseClasses} bg-gear-raid/20 text-gear-raid hover:bg-gear-raid/30`;
  }
  if (source === 'tome') {
    return isSelected
      ? `${baseClasses} bg-gear-tome text-surface-base`
      : `${baseClasses} bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30`;
  }
  if (source === 'base_tome') {
    return isSelected
      ? `${baseClasses} bg-gear-base-tome text-surface-base`
      : `${baseClasses} bg-gear-base-tome/20 text-gear-base-tome hover:bg-gear-base-tome/30`;
  }
  // crafted
  return isSelected
    ? `${baseClasses} bg-orange-400 text-surface-base`
    : `${baseClasses} bg-orange-400/20 text-orange-400 hover:bg-orange-400/30`;
}

/**
 * Get trigger button classes based on current source
 * Fixed width (w-7) to accommodate 2-character labels like "BT"
 */
function getTriggerClasses(source: GearSource | null, disabled: boolean): string {
  const baseClasses = 'w-7 py-0.5 rounded text-xs font-bold transition-colors text-center';

  if (disabled) {
    if (!source) return `${baseClasses} bg-surface-interactive text-text-muted opacity-50 cursor-not-allowed`;
    if (source === 'raid') return `${baseClasses} bg-gear-raid/20 text-gear-raid opacity-50 cursor-not-allowed`;
    if (source === 'tome') return `${baseClasses} bg-gear-tome/20 text-gear-tome opacity-50 cursor-not-allowed`;
    if (source === 'base_tome') return `${baseClasses} bg-gear-base-tome/20 text-gear-base-tome opacity-50 cursor-not-allowed`;
    return `${baseClasses} bg-orange-400/20 text-orange-400 opacity-50 cursor-not-allowed`;
  }

  if (!source) return `${baseClasses} bg-surface-interactive text-text-muted hover:text-text-secondary`;
  if (source === 'raid') return `${baseClasses} bg-gear-raid/20 text-gear-raid hover:bg-gear-raid/30`;
  if (source === 'tome') return `${baseClasses} bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30`;
  if (source === 'base_tome') return `${baseClasses} bg-gear-base-tome/20 text-gear-base-tome hover:bg-gear-base-tome/30`;
  return `${baseClasses} bg-orange-400/20 text-orange-400 hover:bg-orange-400/30`;
}

interface BiSSourceSelectorProps {
  /** Current BiS source (null for unset) */
  bisSource: GearSource | null;
  /** Called when BiS source changes */
  onSelect: (source: GearSource | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Reason shown in tooltip when disabled */
  disabledReason?: string;
}

export function BiSSourceSelector({
  bisSource,
  onSelect,
  disabled = false,
  disabledReason,
}: BiSSourceSelectorProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (source: GearSource) => {
    onSelect(source);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
  };

  // Get display label and ARIA label
  const displayLabel = bisSource ? BIS_SOURCE_INFO[bisSource].short : '--';
  const ariaLabel = disabled && disabledReason
    ? disabledReason
    : bisSource
      ? `BiS source: ${BIS_SOURCE_FULL_NAMES[bisSource]}`
      : 'BiS source not set';

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* design-system-ignore: Badge-style button with specific toggle styling */}
        <button
          className={getTriggerClasses(bisSource, disabled)}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          {displayLabel}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={4} className="p-2 w-auto">
        {/* 2x2 grid layout */}
        <div className="grid grid-cols-2 gap-1">
          {GRID_LAYOUT.flat().map((source) => {
            const isSelected = bisSource === source;
            return (
              <button
                key={source}
                onClick={() => handleSelect(source)}
                className={`${getSourceButtonClasses(source, isSelected)} min-w-[4rem] text-center`}
                aria-label={`${BIS_SOURCE_INFO[source].label}: ${BIS_SOURCE_INFO[source].description}`}
                aria-pressed={isSelected}
              >
                {BIS_SOURCE_INFO[source].label}
              </button>
            );
          })}
        </div>

        {/* Clear button */}
        <button
          onClick={handleClear}
          className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
        >
          Clear Slot
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * WeaponBiSSelector - Special selector for weapon slot
 *
 * Shows "Raid" as fixed label with a + toggle for tome weapon tracking.
 * Weapon BiS is always raid - the + toggle is for interim tome weapon.
 */
interface WeaponBiSSelectorProps {
  /** Tome weapon tracking status */
  tomeWeapon: TomeWeaponStatus;
  /** Called when tome weapon status changes */
  onTomeWeaponChange: (updates: Partial<TomeWeaponStatus>) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Reason shown in tooltip when disabled */
  disabledReason?: string;
}

export function WeaponBiSSelector({
  tomeWeapon,
  onTomeWeaponChange,
  disabled = false,
  disabledReason,
}: WeaponBiSSelectorProps) {
  return (
    <div className="flex justify-center gap-1">
      {/* Raid is always on for weapon - fixed width to match other BiS badges */}
      <span className={`inline-flex items-center justify-center w-7 py-0.5 rounded text-xs bg-gear-raid/20 text-gear-raid font-bold ${disabled ? 'opacity-50' : ''}`}>
        R
      </span>
      {/* + is a toggle for interim tome weapon */}
      <Tooltip
        content={
          disabled
            ? disabledReason
            : tomeWeapon.pursuing
              ? 'Stop tracking tome weapon'
              : 'Track interim tome weapon'
        }
      >
        <button
          onClick={() => onTomeWeaponChange({ pursuing: !tomeWeapon.pursuing })}
          className={`inline-flex items-center justify-center w-6 py-0.5 rounded text-xs font-bold transition-colors ${
            tomeWeapon.pursuing
              ? 'bg-gear-tome/20 text-gear-tome'
              : `bg-surface-interactive text-text-muted ${!disabled ? 'hover:text-text-secondary' : ''}`
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          +
        </button>
      </Tooltip>
    </div>
  );
}
