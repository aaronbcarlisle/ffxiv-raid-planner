/**
 * Application Constants
 *
 * Re-exports game data constants and defines app-specific constants.
 * Most game data is now in src/gamedata/
 */

// Re-export game data for backwards compatibility
export {
  RAID_JOBS,
  ROLE_CONFIG,
  JOB_DISPLAY_NAMES,
  getRoleForJob,
  getJobDisplayName,
  getCurrentTier,
  RAID_TIERS,
} from '../gamedata';

export { GEAR_SLOTS, GEAR_SLOT_NAMES } from '../types';
import type { TemplateRole } from '../types';

// Default display order (party list style: tanks first, then healers, then DPS)
export const DEFAULT_DISPLAY_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'];

// Default loot priority (DPS first, as they benefit most from gear)
export const DEFAULT_LOOT_PRIORITY = ['melee', 'ranged', 'caster', 'tank', 'healer'];

// Sort presets for player ordering
export const SORT_PRESETS = {
  standard: {
    name: 'Standard',
    description: 'Tank > Healer > DPS',
    order: ['tank', 'healer', 'melee', 'ranged', 'caster'],
  },
  'dps-first': {
    name: 'DPS First',
    description: 'Melee > Ranged > Caster > Tank > Healer',
    order: ['melee', 'ranged', 'caster', 'tank', 'healer'],
  },
  'healer-first': {
    name: 'Healer First',
    description: 'Healer > Tank > DPS',
    order: ['healer', 'tank', 'melee', 'ranged', 'caster'],
  },
  custom: {
    name: 'Custom',
    description: 'Drag to reorder',
    order: null as string[] | null, // Uses player.sortOrder only
  },
} as const;

// Raid floors shorthand (current tier)
export const RAID_FLOORS = ['M5S', 'M6S', 'M7S', 'M8S'];

// Template role display configuration
// Used for empty player slots to show expected role
export const TEMPLATE_ROLE_INFO: Record<TemplateRole, { label: string; shortLabel: string; color: string; iconId: number }> = {
  'tank': { label: 'Tank', shortLabel: 'Tank', color: 'role-tank', iconId: 62581 },
  'pure-healer': { label: 'Pure Healer', shortLabel: 'Healer', color: 'role-healer', iconId: 62588 },
  'barrier-healer': { label: 'Barrier Healer', shortLabel: 'Healer', color: 'role-healer', iconId: 62589 },
  'melee': { label: 'Melee DPS', shortLabel: 'Melee', color: 'role-melee', iconId: 62584 },
  'physical-ranged': { label: 'Physical Ranged', shortLabel: 'Ranged', color: 'role-ranged', iconId: 62586 },
  'magical-ranged': { label: 'Magical Ranged', shortLabel: 'Caster', color: 'role-caster', iconId: 62587 },
};

// Helper to get XIVAPI icon URL for role icons
export function getRoleIconUrl(iconId: number): string {
  const folder = Math.floor(iconId / 1000) * 1000;
  const paddedFolder = folder.toString().padStart(6, '0');
  const paddedIcon = iconId.toString().padStart(6, '0');
  return `https://xivapi.com/i/${paddedFolder}/${paddedIcon}.png`;
}
