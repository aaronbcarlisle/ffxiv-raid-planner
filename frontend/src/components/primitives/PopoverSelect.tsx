/**
 * PopoverSelect - Reusable popover-based selection component
 *
 * A standardized dropdown selector used for badge-style selections like
 * Position (T1-R2), Tank Role (MT/OT), and BiS Source (Raid/Tome/Crafted).
 *
 * ## Design Standards
 *
 * **Trigger Button:**
 * - Size: `px-1.5 py-0.5` (compact badge) or `w-14 py-0.5` (fixed width)
 * - Typography: `text-xs font-bold`
 * - Border radius: `rounded`
 * - Unselected: `bg-surface-interactive text-text-muted`
 * - Selected: `bg-{color}/20 text-{color}` with `hover:bg-{color}/30`
 * - Disabled: `opacity-50 cursor-not-allowed`
 *
 * **Dropdown Items:**
 * - Padding: `px-2 py-1.5`
 * - Typography: `text-xs font-bold`
 * - Border radius: `rounded`
 * - Unselected: `bg-{color}/20 text-{color} hover:bg-{color}/30`
 * - Selected: `bg-{color} text-surface-base` (solid background, dark text)
 *
 * **Clear Button (optional):**
 * - Full width, centered text
 * - `mt-2 px-2 py-1 rounded text-xs`
 * - `text-text-muted hover:text-text-primary hover:bg-surface-interactive`
 */

import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Tooltip } from './Tooltip';

// ============================================================================
// Types
// ============================================================================

export interface PopoverSelectOption<T extends string> {
  /** The value for this option */
  value: T;
  /** Display label */
  label: string;
  /** Optional icon (rendered before label) */
  icon?: ReactNode;
  /** Optional description shown in tooltip */
  description?: string;
  /** Custom color classes for this option - overrides getOptionClasses */
  colorClasses?: {
    selected: string;
    unselected: string;
  };
}

export interface PopoverSelectProps<T extends string> {
  /** Currently selected value (null/undefined for unselected) */
  value: T | null | undefined;
  /** Available options */
  options: PopoverSelectOption<T>[];
  /** Called when selection changes */
  onSelect: (value: T | undefined) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Reason shown in tooltip when disabled */
  disabledReason?: string;
  /** Tooltip content when enabled (defaults to "Click to change") */
  tooltipContent?: ReactNode;
  /** Whether to show a clear button when value is set */
  clearable?: boolean;
  /** Text for clear button */
  clearText?: string;
  /** Layout for options: 'vertical' (stacked), 'horizontal' (row), or 'grid' */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /** Number of columns for grid layout */
  gridCols?: number;
  /** Alignment of popover relative to trigger */
  align?: 'start' | 'center' | 'end';
  /** Function to get color classes for an option */
  getOptionClasses?: (option: PopoverSelectOption<T>, isSelected: boolean) => string;
  /** Function to get trigger button classes based on current value */
  getTriggerClasses?: (value: T | null | undefined) => string;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Fixed width for trigger (e.g., 'w-14') */
  triggerWidth?: string;
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Whether to show option icons in dropdown */
  showIcons?: boolean;
  /** Width class for the dropdown content (e.g., 'w-20', 'min-w-fit') */
  contentWidth?: string;
}

// ============================================================================
// Default Styling
// ============================================================================

/** Default trigger classes when no value selected */
const DEFAULT_TRIGGER_UNSELECTED = 'bg-surface-interactive text-text-muted hover:text-text-secondary';

/** Default trigger classes - can be overridden via getTriggerClasses */
function defaultGetTriggerClasses(value: string | null | undefined): string {
  if (!value) return DEFAULT_TRIGGER_UNSELECTED;
  return 'bg-accent/20 text-accent hover:bg-accent/30';
}

/** Default option classes - can be overridden via getOptionClasses */
function defaultGetOptionClasses<T extends string>(
  _option: PopoverSelectOption<T>,
  isSelected: boolean
): string {
  if (isSelected) {
    return 'bg-accent text-surface-base';
  }
  return 'bg-surface-base text-text-muted hover:bg-surface-interactive hover:text-text-secondary';
}

// ============================================================================
// Component
// ============================================================================

export function PopoverSelect<T extends string>({
  value,
  options,
  onSelect,
  disabled = false,
  disabledReason,
  tooltipContent,
  clearable = false,
  clearText = 'Clear',
  layout = 'vertical',
  gridCols = 4,
  align = 'start',
  getOptionClasses = defaultGetOptionClasses,
  getTriggerClasses = defaultGetTriggerClasses,
  placeholder = '--',
  triggerWidth,
  triggerClassName,
  showIcons = true,
  contentWidth,
}: PopoverSelectProps<T>) {
  const [open, setOpen] = useState(false);

  const handleSelect = (newValue: T | undefined) => {
    onSelect(newValue);
    setOpen(false);
  };

  // Find current option for display
  const currentOption = options.find((opt) => opt.value === value);
  const displayLabel = currentOption?.label ?? placeholder;

  // Build trigger classes
  const triggerClasses = [
    // Base styles
    'rounded text-xs font-bold transition-colors',
    // Size
    triggerWidth ?? 'px-1.5',
    'py-0.5',
    // Color based on value
    getTriggerClasses(value),
    // Disabled state
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    // Custom classes
    triggerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  // Build layout classes for options container
  const layoutClasses =
    layout === 'grid'
      ? `grid grid-cols-${gridCols} gap-1`
      : layout === 'horizontal'
        ? 'flex gap-1'
        : 'space-y-1';

  // Default tooltip when enabled
  const defaultTooltip = tooltipContent ?? (
    <span className="text-text-muted text-xs">Click to change</span>
  );

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <Tooltip content={disabled ? disabledReason : defaultTooltip}>
        <span className="inline-flex">
          <PopoverTrigger asChild>
            {/* design-system-ignore: PopoverSelect trigger with standardized styling */}
            <button className={triggerClasses} disabled={disabled}>
              {displayLabel}
            </button>
          </PopoverTrigger>
        </span>
      </Tooltip>

      <PopoverContent align={align} sideOffset={4} className={`p-2 ${contentWidth ?? ''}`}>
        <div className={layoutClasses}>
          {options.map((option) => {
            const isSelected = value === option.value;
            const optionClasses = option.colorClasses
              ? isSelected
                ? option.colorClasses.selected
                : option.colorClasses.unselected
              : getOptionClasses(option, isSelected);

            const button = (
              /* design-system-ignore: PopoverSelect option with standardized styling */
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  px-2 py-1.5 rounded text-xs font-bold transition-colors
                  ${showIcons && option.icon ? 'flex items-center gap-2' : ''}
                  ${layout === 'vertical' ? 'w-full' : ''}
                  ${optionClasses}
                `}
              >
                {showIcons && option.icon && (
                  <span className="w-4 h-4 flex items-center justify-center">
                    {option.icon}
                  </span>
                )}
                <span>{option.label}</span>
              </button>
            );

            // Wrap with tooltip if option has description
            return option.description ? (
              <Tooltip key={option.value} content={option.description} side="right">
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>

        {/* Clear button */}
        {clearable && value && (
          <button
            onClick={() => handleSelect(undefined)}
            className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-interactive transition-colors"
          >
            {clearText}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Preset Color Helpers
// ============================================================================

/**
 * Creates option classes for role-based colors (tank, healer, dps)
 */
export function createRoleColorClasses(
  rolePrefix: string
): { selected: string; unselected: string } {
  if (rolePrefix === 'T') {
    return {
      selected: 'bg-role-tank text-surface-base',
      unselected: 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30',
    };
  }
  if (rolePrefix === 'H') {
    return {
      selected: 'bg-role-healer text-surface-base',
      unselected: 'bg-role-healer/20 text-role-healer hover:bg-role-healer/30',
    };
  }
  // Melee/Ranged/Caster all use melee color
  return {
    selected: 'bg-role-melee text-surface-base',
    unselected: 'bg-role-melee/20 text-role-melee hover:bg-role-melee/30',
  };
}

/**
 * Creates option classes for gear source colors (raid, tome, base_tome, crafted)
 */
export function createGearSourceColorClasses(
  source: 'raid' | 'tome' | 'base_tome' | 'crafted'
): { selected: string; unselected: string } {
  if (source === 'raid') {
    return {
      selected: 'bg-gear-raid text-surface-base',
      unselected: 'bg-gear-raid/20 text-gear-raid hover:bg-gear-raid/30',
    };
  }
  if (source === 'tome') {
    return {
      selected: 'bg-gear-tome text-surface-base',
      unselected: 'bg-gear-tome/20 text-gear-tome hover:bg-gear-tome/30',
    };
  }
  if (source === 'base_tome') {
    return {
      selected: 'bg-gear-base-tome text-surface-base',
      unselected: 'bg-gear-base-tome/20 text-gear-base-tome hover:bg-gear-base-tome/30',
    };
  }
  return {
    selected: 'bg-orange-400 text-surface-base',
    unselected: 'bg-orange-400/20 text-orange-400 hover:bg-orange-400/30',
  };
}

/**
 * Creates trigger classes for a value with a specific color
 */
export function createColoredTriggerClasses(
  color: string,
  hasValue: boolean
): string {
  if (!hasValue) return DEFAULT_TRIGGER_UNSELECTED;
  return `bg-${color}/20 text-${color} hover:bg-${color}/30`;
}
