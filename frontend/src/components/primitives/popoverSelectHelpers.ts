/**
 * Color helper functions for PopoverSelect component
 *
 * Separated from PopoverSelect.tsx to satisfy react-refresh/only-export-components
 * rule which requires component files to only export components.
 */

/** Default trigger classes when no value selected */
export const DEFAULT_TRIGGER_UNSELECTED =
  'bg-surface-interactive text-text-muted hover:text-text-secondary';

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
    selected: 'bg-gear-crafted text-surface-base',
    unselected: 'bg-gear-crafted/20 text-gear-crafted hover:bg-gear-crafted/30',
  };
}

/**
 * Creates trigger classes for a value with a specific color
 */
export function createColoredTriggerClasses(color: string, hasValue: boolean): string {
  if (!hasValue) return DEFAULT_TRIGGER_UNSELECTED;
  return `bg-${color}/20 text-${color} hover:bg-${color}/30`;
}
