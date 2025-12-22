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

// Default display order (party list style: tanks first, then healers, then DPS)
export const DEFAULT_DISPLAY_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'];

// Default loot priority (DPS first, as they benefit most from gear)
export const DEFAULT_LOOT_PRIORITY = ['melee', 'ranged', 'caster', 'tank', 'healer'];

// Raid floors shorthand (current tier)
export const RAID_FLOORS = ['M5S', 'M6S', 'M7S', 'M8S'];
