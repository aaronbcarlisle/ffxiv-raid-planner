/**
 * Game Data Module
 *
 * Central export for all FFXIV game data.
 * This module provides:
 * - Jobs (fetched from XIVAPI, bundled as JSON)
 * - Raid tiers (manually configured per patch)
 * - Loot tables (what drops from each floor)
 * - Costs (books, tomestones)
 */

// Jobs and roles
export {
  type Job,
  type Role,
  type JobInfo,
  type HealerType,
  RAID_JOBS,
  HEALER_TYPES,
  getRaidJobs,
  getJobsByRole,
  getJobInfo,
  getRoleForJob,
  getJobIconUrl,
  getJobDisplayName,
  getRoleDisplayName,
  getRoleColor,
  sortJobsByRole,
  groupJobsByRole,
  getJobsForTemplateRole,
  getHealerType,
  JOB_DISPLAY_NAMES,
  ROLE_CONFIG,
} from './jobs';

// Raid tiers
export {
  type RaidTier,
  RAID_TIERS,
  getCurrentTier,
  getTierById,
  getTierOptions,
} from './raid-tiers';

// Loot tables
export {
  type FloorNumber,
  type FloorLootTable,
  FLOOR_LOOT_TABLES,
  getFloorForSlot,
  getFloorForUpgradeMaterial,
  getUpgradeMaterialForSlot,
  UPGRADE_MATERIAL_SLOTS,
} from './loot-tables';

// Costs
export {
  BOOK_COSTS,
  BOOK_TYPE_FOR_SLOT,
  UPGRADE_MATERIAL_BOOK_COSTS,
  TOMESTONE_COSTS,
  WEEKLY_TOMESTONE_CAP,
  SLOT_VALUE_WEIGHTS,
  calculateWeeksForTomestones,
  calculateTotalTomestoneCost,
  calculateWeeksForBooks,
} from './costs';
