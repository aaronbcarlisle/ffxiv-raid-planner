/**
 * Job Data and Utilities
 *
 * This file provides typed access to job data fetched from XIVAPI.
 * Run `npx tsx scripts/fetch-xivapi-data.ts` to update jobs.json
 */

import jobsData from './jobs.json';

export type Role = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

// Healer sub-type for party composition
export type HealerType = 'pure' | 'barrier';

// Healer job to type mapping
export const HEALER_TYPES: Record<string, HealerType> = {
  WHM: 'pure',
  AST: 'pure',
  SCH: 'barrier',
  SGE: 'barrier',
};

export interface JobInfo {
  id: number;
  abbreviation: string;
  name: string;
  role: Role;
  icon: string;
  isCombat: boolean;
  isLimited: boolean;
}

// XIVAPI base URL for icons
const XIVAPI_BASE = 'https://xivapi.com';

// Newer jobs use numeric icon IDs instead of the /cj/1/ path
const NUMERIC_ICON_IDS: Record<string, number> = {
  SGE: 62040,
  RPR: 62039,
  VPR: 62041,
  PCT: 62042,
};

// All jobs from XIVAPI
const allJobs: JobInfo[] = jobsData as JobInfo[];

// Base classes that evolve into jobs (not usable at endgame)
const BASE_CLASSES = ['GLA', 'PGL', 'MRD', 'LNC', 'ARC', 'CNJ', 'THM', 'ACN', 'ROG'];

/**
 * All combat jobs available for savage raiding (excludes base classes and limited jobs)
 */
export const RAID_JOBS: JobInfo[] = allJobs.filter(
  (job) => job.isCombat && !job.isLimited && !BASE_CLASSES.includes(job.abbreviation)
);

/**
 * Job abbreviations for raid-eligible jobs
 */
export type Job = (typeof RAID_JOBS)[number]['abbreviation'];

/**
 * Get all raid-eligible jobs
 */
export function getRaidJobs(): JobInfo[] {
  return RAID_JOBS;
}

/**
 * Get jobs filtered by role
 */
export function getJobsByRole(role: Role): JobInfo[] {
  return RAID_JOBS.filter((job) => job.role === role);
}

/**
 * Get job info by abbreviation
 */
export function getJobInfo(abbreviation: string): JobInfo | undefined {
  return RAID_JOBS.find((job) => job.abbreviation === abbreviation);
}

/**
 * Get role for a job abbreviation
 */
export function getRoleForJob(abbreviation: string): Role | undefined {
  return getJobInfo(abbreviation)?.role;
}

/**
 * Get full icon URL for a job abbreviation
 * Uses XIVAPI classjob icons for transparent style icons
 */
export function getJobIconUrl(abbreviation: string): string | undefined {
  const job = getJobInfo(abbreviation);
  if (!job) return undefined;

  // Newer jobs (Endwalker + Dawntrail) use numeric icon IDs
  if (abbreviation in NUMERIC_ICON_IDS) {
    const iconId = NUMERIC_ICON_IDS[abbreviation];
    return `${XIVAPI_BASE}/i/062000/0${iconId}.png`;
  }

  // Use XIVAPI classjob icons (transparent style)
  const iconName = job.name.replace(/\s+/g, '');
  return `${XIVAPI_BASE}/cj/1/${iconName}.png`;
}

/**
 * Job display name mapping (capitalized properly)
 */
export const JOB_DISPLAY_NAMES: Record<string, string> = {
  // Tanks
  PLD: 'Paladin',
  WAR: 'Warrior',
  DRK: 'Dark Knight',
  GNB: 'Gunbreaker',
  // Healers
  WHM: 'White Mage',
  SCH: 'Scholar',
  AST: 'Astrologian',
  SGE: 'Sage',
  // Melee DPS
  MNK: 'Monk',
  DRG: 'Dragoon',
  NIN: 'Ninja',
  SAM: 'Samurai',
  RPR: 'Reaper',
  VPR: 'Viper',
  // Physical Ranged DPS
  BRD: 'Bard',
  MCH: 'Machinist',
  DNC: 'Dancer',
  // Magical Ranged DPS (Casters)
  BLM: 'Black Mage',
  SMN: 'Summoner',
  RDM: 'Red Mage',
  PCT: 'Pictomancer',
};

/**
 * Get display name for a job
 */
export function getJobDisplayName(abbreviation: string): string {
  return JOB_DISPLAY_NAMES[abbreviation] ?? abbreviation;
}

/**
 * Role display configuration
 */
export const ROLE_CONFIG: Record<Role, { name: string; color: string; order: number }> = {
  tank: { name: 'Tank', color: 'var(--color-role-tank)', order: 1 },
  healer: { name: 'Healer', color: 'var(--color-role-healer)', order: 2 },
  melee: { name: 'Melee DPS', color: 'var(--color-role-melee)', order: 3 },
  ranged: { name: 'Physical Ranged', color: 'var(--color-role-ranged)', order: 4 },
  caster: { name: 'Magical Ranged', color: 'var(--color-role-caster)', order: 5 },
};

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: Role): string {
  return ROLE_CONFIG[role].name;
}

/**
 * Get color for a role
 */
export function getRoleColor(role: Role): string {
  return ROLE_CONFIG[role].color;
}

const VALID_ROLES: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

/**
 * Safely cast a string to a valid Role, falling back to 'melee'
 */
export function getValidRole(role: string): Role {
  return VALID_ROLES.includes(role as Role) ? role as Role : 'melee';
}

/**
 * Sort jobs by role order, then alphabetically within role
 */
export function sortJobsByRole(jobs: JobInfo[]): JobInfo[] {
  return [...jobs].sort((a, b) => {
    const roleOrderA = ROLE_CONFIG[a.role].order;
    const roleOrderB = ROLE_CONFIG[b.role].order;
    if (roleOrderA !== roleOrderB) {
      return roleOrderA - roleOrderB;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Group jobs by role
 */
export function groupJobsByRole(): Record<Role, JobInfo[]> {
  return {
    tank: getJobsByRole('tank'),
    healer: getJobsByRole('healer'),
    melee: getJobsByRole('melee'),
    ranged: getJobsByRole('ranged'),
    caster: getJobsByRole('caster'),
  };
}

/**
 * Determines the healer type for a given healer job.
 *
 * @param abbreviation - Job abbreviation (e.g., 'WHM', 'SCH')
 * @returns 'pure' for WHM/AST, 'barrier' for SCH/SGE, undefined for non-healers
 *
 * Pure healers (H1 slot): WHM, AST - focus on direct healing
 * Barrier healers (H2 slot): SCH, SGE - focus on shields/mitigation
 */
export function getHealerType(abbreviation: string): HealerType | undefined {
  return HEALER_TYPES[abbreviation];
}

/**
 * Determines the effective healer type for a player based on their job and position.
 *
 * Logic:
 * 1. If the player is a healer with a selected job, use that job's healer type
 * 2. Fall back to position-based type (H1 = pure, H2 = barrier)
 *
 * @param role - Player's role (only 'healer' triggers job-based lookup)
 * @param job - Selected job abbreviation (optional)
 * @param position - Player position (e.g., 'H1', 'H2')
 * @returns 'pure' or 'barrier' healer type
 */
export function getEffectiveHealerType(
  role: string,
  job: string | undefined,
  position: string | undefined
): HealerType {
  if (role === 'healer' && job) {
    // Use the selected healer job's type, falling back to position-based
    return getHealerType(job) || (position === 'H1' ? 'pure' : 'barrier');
  }
  // Default to position-based (H1 = pure, H2 = barrier)
  return position === 'H1' ? 'pure' : 'barrier';
}

/**
 * Get jobs for a template role (used for role-based player slot selection)
 * Template roles are more specific than base roles (e.g., pure-healer vs barrier-healer)
 */
export function getJobsForTemplateRole(templateRole: string): JobInfo[] {
  switch (templateRole) {
    case 'tank':
      return getJobsByRole('tank');
    case 'pure-healer':
      return getJobsByRole('healer').filter((job) => HEALER_TYPES[job.abbreviation] === 'pure');
    case 'barrier-healer':
      return getJobsByRole('healer').filter((job) => HEALER_TYPES[job.abbreviation] === 'barrier');
    case 'melee':
      return getJobsByRole('melee');
    case 'physical-ranged':
      return getJobsByRole('ranged');
    case 'magical-ranged':
      return getJobsByRole('caster');
    default:
      return [];
  }
}
