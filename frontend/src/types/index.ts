/**
 * Core Type Definitions
 *
 * These types are used throughout the application.
 * Job and Role types are re-exported from gamedata for convenience.
 */

// Re-export job/role types from gamedata
export type { Job, Role, JobInfo } from '../gamedata';

// Gear slot identifiers
export type GearSlot =
  | 'weapon'
  | 'head'
  | 'body'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'earring'
  | 'necklace'
  | 'bracelet'
  | 'ring1'
  | 'ring2';

// Where the BiS gear comes from
export type GearSource = 'raid' | 'tome';

// Page navigation modes
export type PageMode = 'players' | 'loot' | 'stats';

// View mode for player cards
export type ViewMode = 'compact' | 'expanded';

// Raid position for mechanics (light parties, partners, spread positions)
export type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';

// Tank role designation (separate from T1/T2 position)
export type TankRole = 'MT' | 'OT';

// All raid positions for iteration
export const RAID_POSITIONS: RaidPosition[] = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

// Tome weapon tracking (interim upgrade during prog)
export interface TomeWeaponStatus {
  pursuing: boolean; // "Raid + Tome" selected
  hasItem: boolean; // Got the tome weapon
  isAugmented: boolean; // Augmented it
}

// Player needs calculation result
export interface PlayerNeeds {
  raidNeed: number; // Raid gear pieces still missing
  tomeNeed: number; // Tome gear pieces still missing
  upgrades: number; // Augments needed (has item but not augmented)
  tomeWeeks: number; // Weeks to acquire all tome gear at 450/week cap
}

// Gear slot status for a player
export interface GearSlotStatus {
  slot: GearSlot;
  bisSource: GearSource;
  hasItem: boolean;
  isAugmented: boolean;
  itemName?: string;
  itemLevel?: number;
}

// Player in a static
export interface Player {
  id: string;
  staticId: string;
  name: string;
  job: string; // Job abbreviation (PLD, WAR, etc.)
  role: string; // Role (tank, healer, melee, ranged, caster)
  position?: RaidPosition; // Raid position for mechanics (T1, H2, M1, etc.)
  tankRole?: TankRole; // MT/OT designation (tanks only)
  configured: boolean; // false for template slots, true once name/job are set
  lodestoneId?: string;
  bisLink?: string;
  fflogsId?: number;
  lastSync?: string;
  sortOrder: number;
  isSubstitute: boolean;
  notes?: string;
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus; // Interim tome weapon tracking
  createdAt: string;
  updatedAt: string;
}

// Static (raid group) settings
export interface StaticSettings {
  displayOrder: string[]; // Role order for display
  lootPriority: string[]; // Role order for loot priority
  timezone: string;
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly';
}

// Static (raid group)
export interface Static {
  id: string;
  name: string;
  tier: string; // Raid tier ID
  shareCode: string;
  settings: StaticSettings;
  players: Player[];
  createdAt: string;
  updatedAt: string;
}

// Team summary calculations
export interface TeamSummary {
  totalPlayers: number;
  completionPercentage: number;
  materialsNeeded: {
    twine: number;
    glaze: number;
    solvent: number;
  };
  booksNeeded: {
    floor1: number;
    floor2: number;
    floor3: number;
    floor4: number;
  };
  weeksToComplete: number;
}

// Gear slots in display order
export const GEAR_SLOTS: GearSlot[] = [
  'weapon',
  'head',
  'body',
  'hands',
  'legs',
  'feet',
  'earring',
  'necklace',
  'bracelet',
  'ring1',
  'ring2',
];

// Gear slot display names
export const GEAR_SLOT_NAMES: Record<GearSlot, string> = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};
