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
  getValidRole,
  sortJobsByRole,
  groupJobsByRole,
  getJobsForTemplateRole,
  getHealerType,
  getEffectiveHealerType,
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

// Worlds, data centers, timezones, languages
export {
  type DataCenter,
  DATA_CENTERS,
  DC_NAMES,
  getWorldsForDC,
  getDCForWorld,
  TIMEZONES,
  LANGUAGES,
  RAID_DAYS,
  ICAL_DAY_MAP,
  TIME_SLOTS,
} from './worlds';

// Mount Farms
export {
  type Expansion,
  type MountFarmTrial,
  EXPANSIONS,
  MOUNT_FARM_TRIALS,
  getTrialsByExpansion,
  getTrialById,
  getAllTrialIds,
  getCurrencyLabel,
  getCurrencyLabelPlural,
  getRewardLabel,
  getRewardNoun,
  hasCurrencyTracking,
  getExchangeSummary,
} from './mount-farms';

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
