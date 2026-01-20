/**
 * BiSSourceSelector - Horizontal button group for BiS source selection
 *
 * Standard slots: [R] [T] [BT] [C] - Horizontal button group
 * Weapon slot: [R] [+] - R is fixed, + toggles tome weapon tracking
 *
 * Based on TankRoleSelector pattern with Popover.
 */

import { useState } from 'react';
import type { GearSource, TomeWeaponStatus } from '../../types';
import { BIS_SOURCE_FULL_NAMES } from '../../types';
import { Popover, PopoverContent, PopoverTrigger } from '../primitives';
import { Tooltip } from '../primitives/Tooltip';

// BiS source order for display
const BIS_SOURCES: GearSource[] = ['raid', 'tome', 'base_tome', 'crafted'];

// BiS source display info
const BIS_SOURCE_INFO: Record<GearSource, { short: string; description: string }> = {
  raid: {
    short: 'R',
    description: 'BiS gear from Savage raids',
  },
  tome: {
    short: 'T',
    description: 'Tomestone gear that needs augmentation',
  },
  base_tome: {
    short: 'BT',
    description: 'Tomestone gear where base version is BiS',
  },
  crafted: {
    short: 'C',
    description: 'Crafted pentamelded gear',
  },
};

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
  if (source === 'tome' || source === 'base_tome') {
    return isSelected
      ? `${baseClasses} bg-gear-tome text-surface-base`
      : `${baseClasses} bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30`;
  }
  // crafted
  return isSelected
    ? `${baseClasses} bg-orange-400 text-surface-base`
    : `${baseClasses} bg-orange-400/20 text-orange-400 hover:bg-orange-400/30`;
}

/**
 * Get trigger button classes based on current source
 */
function getTriggerClasses(source: GearSource | null, disabled: boolean): string {
  const baseClasses = 'px-2 py-0.5 rounded text-xs font-bold transition-colors';

  if (disabled) {
    if (!source) return `${baseClasses} bg-surface-interactive text-text-muted opacity-50 cursor-not-allowed`;
    if (source === 'raid') return `${baseClasses} bg-gear-raid/20 text-gear-raid opacity-50 cursor-not-allowed`;
    if (source === 'tome' || source === 'base_tome') return `${baseClasses} bg-gear-tome/20 text-gear-tome opacity-50 cursor-not-allowed`;
    return `${baseClasses} bg-orange-400/20 text-orange-400 opacity-50 cursor-not-allowed`;
  }

  if (!source) return `${baseClasses} bg-surface-interactive text-text-muted hover:text-text-secondary`;
  if (source === 'raid') return `${baseClasses} bg-gear-raid/20 text-gear-raid hover:bg-gear-raid/30`;
  if (source === 'tome' || source === 'base_tome') return `${baseClasses} bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30`;
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

  // Get display label
  const displayLabel = bisSource ? BIS_SOURCE_INFO[bisSource].short : '--';

  // Tooltip content
  const tooltipContent = disabled
    ? disabledReason
    : bisSource
      ? (
        <div>
          <div className="font-medium">{BIS_SOURCE_FULL_NAMES[bisSource]}</div>
          <div className="text-text-secondary text-xs mt-0.5">
            {BIS_SOURCE_INFO[bisSource].description}
          </div>
        </div>
      )
      : 'Click to set BiS source';

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <Tooltip content={tooltipContent}>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            {/* design-system-ignore: Badge-style button with specific toggle styling */}
            <button
              className={getTriggerClasses(bisSource, disabled)}
              disabled={disabled}
            >
              {displayLabel}
            </button>
          </PopoverTrigger>
        </span>
      </Tooltip>

      <PopoverContent align="center" sideOffset={4} className="p-2 w-auto">
        {/* Horizontal button group */}
        <div className="flex gap-1">
          {BIS_SOURCES.map((source) => {
            const isSelected = bisSource === source;
            return (
              <Tooltip
                key={source}
                content={BIS_SOURCE_INFO[source].description}
                side="top"
              >
                <button
                  onClick={() => handleSelect(source)}
                  className={getSourceButtonClasses(source, isSelected)}
                >
                  {BIS_SOURCE_INFO[source].short}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Clear button */}
        {bisSource !== null && (
          <button
            onClick={handleClear}
            className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            Clear Slot
          </button>
        )}
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
      {/* Raid is always on for weapon */}
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs bg-gear-raid/20 text-gear-raid font-bold ${disabled ? 'opacity-50' : ''}`}>
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
          className={`inline-flex items-center justify-center w-6 h-5 rounded text-xs font-bold transition-colors ${
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
