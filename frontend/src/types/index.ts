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

// Loot log slots — includes 'ring' which gets normalized to ring1/ring2 for gear updates
export type LootSlot = GearSlot | 'ring';

// Where the BiS gear comes from
export type GearSource = 'raid' | 'tome' | 'base_tome' | 'crafted';

// Display names for BiS sources (abbreviated for compact UI)
export const BIS_SOURCE_NAMES: Record<GearSource, string> = {
  raid: 'R',
  tome: 'T',
  base_tome: 'BT',
  crafted: 'C',
};

// Full display names for BiS sources (for tooltips)
export const BIS_SOURCE_FULL_NAMES: Record<GearSource, string> = {
  raid: 'Raid',
  tome: 'Tome (Aug.)',
  base_tome: 'Base Tome',
  crafted: 'Crafted',
};

// Color classes for BiS sources
export const BIS_SOURCE_COLORS: Record<GearSource, string> = {
  raid: 'text-gear-raid',
  tome: 'text-gear-tome',
  base_tome: 'text-gear-base-tome',
  crafted: 'text-gear-crafted',
};

// Background color classes for BiS source badges
export const BIS_SOURCE_BG_COLORS: Record<GearSource, string> = {
  raid: 'bg-gear-raid/20',
  tome: 'bg-gear-tome/20',
  base_tome: 'bg-gear-base-tome/20',
  crafted: 'bg-gear-crafted/20',
};

// Current gear source category (9 options for tracking actual equipped gear)
export type GearSourceCategory =
  | 'savage'   // iLv 790/795 - Raid drop gear
  | 'tome_up'  // iLv 790 (armor & weapon) - Augmented tomestone
  | 'catchup'  // iLv 780 - Catch-up gear (alliance raid)
  | 'tome'     // iLv 780 - Unaugmented tomestone
  | 'relic'    // iLv 770/775 - Relic weapon
  | 'crafted'  // iLv 770 - Crafted pentamelded
  | 'prep'     // iLv 770/775 - Previous tier BiS
  | 'normal'   // iLv 760/765 - Normal raid
  | 'unknown'; // Unset state

// Display names for gear source categories (shorthand for compact display)
export const GEAR_SOURCE_NAMES: Record<GearSourceCategory, string> = {
  savage: 'Savage',
  tome_up: 'Aug',
  catchup: 'Catch',
  tome: 'Tome',
  relic: 'Relic',
  crafted: 'Craft',
  prep: 'Prev',
  normal: 'Norm',
  unknown: '?',
};

// Color classes for gear source categories
export const GEAR_SOURCE_COLORS: Record<GearSourceCategory, string> = {
  savage: 'text-gear-raid',     // Same as raid drops (green)
  tome_up: 'text-teal-400',     // Teal for augmented tome
  catchup: 'text-blue-400',     // Blue for catch-up
  tome: 'text-teal-400/70',     // Dimmer teal for unaugmented tome
  relic: 'text-yellow-300',     // Yellow for relic
  crafted: 'text-gear-crafted',   // Orange for crafted
  prep: 'text-purple-300',      // Purple for previous tier
  normal: 'text-gray-400',      // Gray for normal raid
  unknown: 'text-gray-500',     // Muted for unknown
};

// Page navigation modes
export type PageMode = 'home' | 'players' | 'loot' | 'stats' | 'history' | 'priority' | 'schedule' | 'mount-farms';

// View mode for player cards
export type ViewMode = 'compact' | 'expanded';

// Sort preset for player ordering
export type SortPreset = 'standard' | 'dps-first' | 'healer-first' | 'custom';

// Reset mode for Reset Gear action
export type ResetMode = 'progress' | 'unlink' | 'all';

// Raid position for mechanics (light parties, partners, spread positions)
export type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';

export type FlexRole = 'MT' | 'ST' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';

// Tank role designation (separate from T1/T2 position)
export type TankRole = 'MT' | 'OT';

// Template role for pre-populated player slots (optimal party comp)
export type TemplateRole =
  | 'tank'
  | 'pure-healer'
  | 'barrier-healer'
  | 'melee'
  | 'physical-ranged'
  | 'magical-ranged';

// All raid positions for iteration
export const RAID_POSITIONS: RaidPosition[] = ['T1', 'T2', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];

// Tome weapon tracking (interim upgrade during prog)
export interface TomeWeaponStatus {
  pursuing: boolean; // "Raid + Tome" selected
  hasItem: boolean; // Got the tome weapon
  isAugmented: boolean; // Augmented it
}

// Weapon priority entry (for multi-job weapon tracking)
export interface WeaponPriority {
  job: string;
  weaponName?: string;
  received: boolean;
  receivedDate?: string;
}

// Player needs calculation result
export interface PlayerNeeds {
  raidNeed: number; // Raid gear pieces still missing
  tomeNeed: number; // Tome gear pieces still missing
  upgrades: number; // Augments needed (has item but not augmented)
  tomeWeeks: number; // Weeks to acquire all tome gear at 450/week cap
}

// Item stats from BiS import (base stats on the item)
export interface ItemStats {
  Strength?: number;
  Dexterity?: number;
  Vitality?: number;
  Intelligence?: number;
  Mind?: number;
  'Critical Hit'?: number;
  Determination?: number;
  'Direct Hit Rate'?: number;
  'Skill Speed'?: number;
  'Spell Speed'?: number;
  Tenacity?: number;
  Piety?: number;
}

// Materia slot from BiS import
export interface MateriaSlot {
  itemId: number;
  itemName: string;
  stat?: string;  // e.g., "Critical Hit"
  tier?: number;  // e.g., 12
  icon?: string;
}

// Gear slot status for a player
export interface GearSlotStatus {
  slot: GearSlot;
  bisSource: GearSource | null;  // BiS target (null = unset, displays as "--")
  currentSource?: GearSourceCategory; // What's actually equipped (9 categories)
  hasItem: boolean;
  isAugmented: boolean;
  itemId?: number;  // In-game item ID from BiS import (for plugin matching)
  itemName?: string;
  itemLevel?: number;
  itemIcon?: string;
  itemStats?: ItemStats;
  materia?: MateriaSlot[];  // Melded materia from BiS import
  // Currently equipped item from Tomestone sync — separate from BiS target fields
  equippedItemId?: number;
  equippedItemLevel?: number;
  equippedItemName?: string;
  equippedItemIcon?: string;
}

// Legacy priority calculation mode (for backward compatibility)
export type PriorityMode = 'automatic' | 'manual' | 'disabled';

// New priority system mode
export type PrioritySystemMode = 'role-based' | 'job-based' | 'player-based' | 'manual-planning' | 'disabled';

// Priority preset types
export type PriorityPreset = 'balanced' | 'strict-fairness' | 'gear-need-focus' | 'custom';

// Role type for priority ordering
export type RoleType = 'tank' | 'healer' | 'melee' | 'ranged' | 'caster';

// Priority group configuration (used in job-based and player-based modes)
export interface PriorityGroupConfig {
  id: string;
  name: string;
  sortOrder: number;
  basePriority: number;
}

// Job configuration within a group (for job-based mode)
export interface JobPriorityConfig {
  job: string;
  groupId: string;
  sortOrder: number;
  priorityOffset: number;
}

// Player configuration within a group (for player-based mode)
export interface PlayerPriorityConfig {
  playerId: string;
  groupId: string;
  sortOrder: number;
  priorityOffset: number;
}

// Role-based mode configuration
export interface RoleBasedConfig {
  roleOrder: RoleType[];
}

// Job-based mode configuration
export interface JobBasedConfig {
  groups: PriorityGroupConfig[];
  jobs: JobPriorityConfig[];
  showAdvancedControls: boolean;
}

// Player-based mode configuration
export interface PlayerBasedConfig {
  groups: PriorityGroupConfig[];
  players: PlayerPriorityConfig[];
  showAdvancedControls: boolean;
}

// Advanced priority calculation options
export interface AdvancedPriorityOptions {
  showPriorityScores: boolean;
  preset: PriorityPreset;

  // Enhanced fairness options
  enableEnhancedFairness: boolean;
  droughtBonusMultiplier: number;
  droughtBonusCapWeeks: number;
  balancePenaltyMultiplier: number;
  balancePenaltyCapDrops: number;

  // Core multipliers
  useMultipliers: boolean;
  rolePriorityMultiplier: number;
  gearNeededMultiplier: number;
  lootReceivedPenalty: number;
  useWeightedNeed: boolean;
  useLootAdjustments: boolean;
}

// Complete priority settings for a static group
export interface StaticPrioritySettings {
  mode: PrioritySystemMode;

  // Mode-specific configs
  roleBasedConfig?: RoleBasedConfig;
  jobBasedConfig?: JobBasedConfig;
  playerBasedConfig?: PlayerBasedConfig;

  // Advanced options (shared across modes)
  advancedOptions: AdvancedPriorityOptions;
}

// Default advanced options
export const DEFAULT_ADVANCED_OPTIONS: AdvancedPriorityOptions = {
  showPriorityScores: true,
  preset: 'balanced',
  enableEnhancedFairness: false,
  droughtBonusMultiplier: 10,
  droughtBonusCapWeeks: 5,
  balancePenaltyMultiplier: 15,
  balancePenaltyCapDrops: 3,
  useMultipliers: true,
  rolePriorityMultiplier: 25,
  gearNeededMultiplier: 10,
  lootReceivedPenalty: 15,
  useWeightedNeed: true,
  useLootAdjustments: true,
};

// Default priority settings
export const DEFAULT_PRIORITY_SETTINGS: StaticPrioritySettings = {
  mode: 'role-based',
  roleBasedConfig: {
    roleOrder: ['melee', 'caster', 'ranged', 'tank', 'healer'],
  },
  advancedOptions: DEFAULT_ADVANCED_OPTIONS,
};

// Static (raid group) settings
export interface StaticSettings {
  displayOrder: string[]; // Role order for display (used by non-custom presets)
  lootPriority: string[]; // Role order for loot priority (legacy, use prioritySettings.roleBasedConfig)
  sortPreset: SortPreset; // Current sort preset
  groupView: boolean; // Show G1/G2 light party grouping
  timezone: string;
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly';
  hideSetupBanners?: boolean; // Hide "Unclaimed" banners on player cards
  hideBisBanners?: boolean; // Hide "No BiS configured" banners on player cards
  autoSyncEnabled?: boolean; // Periodically re-sync Lodestone gear
  autoSyncIntervalHours?: number; // Hours between auto-syncs (4-48)
  // Legacy priority settings (for backward compatibility)
  priorityMode?: PriorityMode; // Default: 'automatic'
  jobPriorityModifiers?: Record<string, number>; // e.g., { "PCT": +20, "WAR": -10 }
  showPriorityScores?: boolean; // Default: true
  enableEnhancedScoring?: boolean; // Default: false (opt-in for drought/balance adjustments)
  // New priority system (overrides legacy fields when set)
  prioritySettings?: StaticPrioritySettings;
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
  earring: 'Ears',
  necklace: 'Neck',
  bracelet: 'Wrists',
  ring1: 'R. Ring',
  ring2: 'L. Ring',
};

// Gear slot icons (white variant for clean visibility)
// Source: XIVAPI gear icons, colorized locally via scripts/colorize-gear-icons.py
// Other variants available: gold, gold-vibrant, gold-bright, amber, yellow, teal, gray, black
export const GEAR_SLOT_ICONS: Record<GearSlot, string> = {
  weapon: '/images/gear-slots/white/weapon.png',
  head: '/images/gear-slots/white/head.png',
  body: '/images/gear-slots/white/body.png',
  hands: '/images/gear-slots/white/hands.png',
  legs: '/images/gear-slots/white/legs.png',
  feet: '/images/gear-slots/white/feet.png',
  earring: '/images/gear-slots/white/earring.png',
  necklace: '/images/gear-slots/white/necklace.png',
  bracelet: '/images/gear-slots/white/bracelet.png',
  ring1: '/images/gear-slots/white/ring.png',
  ring2: '/images/gear-slots/white/ring.png',
};

// Gear slot filled icons from XIVAPI (colorful/filled style)
// Future use: Show actual BiS item icon when "Have" is checked (requires Etro/XIVGear integration)
export const GEAR_SLOT_FILLED_ICONS: Record<GearSlot, string> = {
  weapon: 'https://xivapi.com/i/060000/060102.png', // Gladiator's Arm (generic sword)
  head: 'https://xivapi.com/i/060000/060124.png',
  body: 'https://xivapi.com/i/060000/060126.png',
  hands: 'https://xivapi.com/i/060000/060129.png',
  legs: 'https://xivapi.com/i/060000/060128.png',
  feet: 'https://xivapi.com/i/060000/060130.png',
  earring: 'https://xivapi.com/i/060000/060133.png',
  necklace: 'https://xivapi.com/i/060000/060132.png',
  bracelet: 'https://xivapi.com/i/060000/060134.png',
  ring1: 'https://xivapi.com/i/060000/060135.png',
  ring2: 'https://xivapi.com/i/060000/060135.png',
};

// Context menu icons (transparent background versions)
export const CONTEXT_MENU_ICONS = {
  copy: '/icons/copy-transparent-bg.png',
  paste: '/icons/paste-transparent-bg.png',
  duplicate: '/icons/duplicate-transparent-bg.png',
  remove: '/icons/remove-transparent-bg.png',
  substitute: '/icons/substitute-transparent-bg.png',
  weaponPriority: '/icons/weapon-priority-transparent-bg.png',
  resetGear: '/icons/reset-gear-transparent-bg.png',
  takeOwnership: '/icons/take-ownership-transparent-bg.png',
  releaseOwnership: '/icons/release-ownership-transparent-bg.png',
  playerOptions: '/icons/player-options-transparent-bg.png',
  importBis: '/icons/import-bis-transparent-bg.png',
};

// Tab navigation icons (transparent background versions)
export const TAB_ICONS = {
  party: '/icons/party-transparent-bg.png',
  loot: '/icons/loot-transparent-bg.png',
  stats: '/icons/stats-transparent-bg.png',
  history: '/icons/history-transparent-bg.png',
  schedule: '/icons/schedule-transparent-bg.png',
  mountFarms: '/icons/mount-farms-transparent-bg.png',
  playerOverview: '/icons/player-hub-overview.svg',
  playerSync: '/icons/player-hub-overview.svg',
  playerCharacter: '/icons/player-hub-character.svg',
  playerGear: '/icons/player-hub-gear.svg',
  playerAvailability: '/icons/schedule-transparent-bg.png',
  playerJobs: '/icons/player-hub-jobs.svg',
  playerHunts: '/icons/player-hub-hunts.svg',
  playerGoals: '/icons/player-hub-goals.svg',
  playerShare: '/icons/player-hub-share.svg',
};

// ==================== User/Auth Types ====================

// User from Discord OAuth
export interface User {
  id: string;
  discordId: string;
  discordUsername: string;
  discordDiscriminator?: string;
  discordAvatar?: string;
  avatarUrl?: string;
  displayName?: string;
  /**
   * Super-user flag granting owner-level access to ALL static groups.
   * Set via ADMIN_DISCORD_IDS env var on backend.
   * NOT to be confused with isAdminAccess on StaticGroup which indicates
   * the user's role was granted via admin privileges rather than membership.
   *
   * Optional because it may be undefined when:
   * - Loading persisted user data from localStorage (before backend populates it)
   * - Between OAuth callback completion and fetchUser response
   *
   * Callers MUST handle the undefined case explicitly, e.g. by treating it as
   * false for permission checks or by showing a loading state until the value
   * has been populated by the backend.
   */
  isAdmin?: boolean;
  activityDisplayMode?: 'named' | 'anonymous';
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// Auth tokens response
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

// Discord OAuth URL response
export interface DiscordAuthUrl {
  url: string;
  state: string;
}

// ==================== Static Group Types ====================

// Membership role in a static group
export type MemberRole = 'owner' | 'lead' | 'member' | 'viewer';

// How user is associated with a group
export type GroupSource = 'membership' | 'linked';

// Member info for display
export interface MemberInfo {
  id: string;
  discordId: string;
  discordUsername: string;
  discordAvatar?: string;
  avatarUrl?: string;
  displayName?: string;
}

// Membership in a static group
export interface Membership {
  id: string;
  userId: string;
  staticGroupId: string;
  role: MemberRole;
  joinedAt: string;
  user?: MemberInfo;
}

// Owner info for display
export interface OwnerInfo {
  id: string;
  discordUsername: string;
  discordAvatar?: string;
  avatarUrl?: string;
  displayName?: string;
}

// Discovery settings for public static listing
export type ContactMethod = 'discord' | 'discord_server' | 'url' | 'text';

export type VoiceRequirement = 'required' | 'preferred' | 'listening_ok' | 'text_only';

export interface CommunicationStyle {
  voiceRequirement?: VoiceRequirement;
  discordRequired?: boolean;
}

export interface RecruitingRoleEntry {
  role: string;
  priority: 'needed' | 'nice_to_have';
  jobs: string[];
}

export interface DiscoverySettings {
  enabled: boolean;
  /** 'limited' is a legacy value treated as 'selective' */
  recruitmentStatus: 'open' | 'selective' | 'paused' | 'closed' | 'limited';
  description?: string;
  contactMethod?: ContactMethod;
  contactValue?: string;
  intensity?: 'casual' | 'midcore' | 'hardcore';
  languages?: string[];
  dataCenter?: string;
  server?: string;
  timezone?: string;
  /** Legacy — derived from recruitingRoles on save for backward compat */
  neededRoles?: string[];
  /** Legacy — derived from recruitingRoles on save for backward compat */
  neededJobs?: string[];
  scheduleDays?: string[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  showMemberCount?: boolean;
  /** v2 structured recruiting (supersedes neededRoles/neededJobs) */
  recruitingRoles?: RecruitingRoleEntry[];
  communicationStyle?: CommunicationStyle;
}

// Static group settings (loot priority, etc.)
// All fields optional to support partial updates
export interface StaticGroupSettings {
  lootPriority?: string[];
  hideSetupBanners?: boolean;
  hideBisBanners?: boolean;
  autoSyncEnabled?: boolean;
  autoSyncIntervalHours?: number;
  // Legacy priority settings (for backward compatibility)
  priorityMode?: PriorityMode;
  jobPriorityModifiers?: Record<string, number>;
  showPriorityScores?: boolean;
  enableEnhancedScoring?: boolean;
  // New priority system (overrides legacy fields when set)
  prioritySettings?: StaticPrioritySettings;
  discovery?: DiscoverySettings;
}

// Static group (persistent team identity)
export interface StaticGroup {
  id: string;
  name: string;
  shareCode: string;
  isPublic: boolean;
  ownerId: string;
  owner?: OwnerInfo;
  members?: Membership[];
  memberCount: number;
  userRole?: MemberRole;
  /**
   * True if userRole was granted via admin privileges rather than actual membership.
   * Used for UI display purposes (e.g., showing "Admin Access" indicator).
   * NOT to be confused with User.isAdmin which is the super-user flag.
   * Always returned by API (defaults to false), non-optional for type safety.
   */
  isAdminAccess: boolean;
  settings?: StaticGroupSettings;
  createdAt: string;
  updatedAt: string;
}

// Static group list item (for dashboard)
export interface StaticGroupListItem {
  id: string;
  name: string;
  shareCode: string;
  isPublic: boolean;
  ownerId: string;
  memberCount: number;
  userRole?: MemberRole;
  /**
   * True if userRole was granted via admin privileges rather than actual membership.
   * Always false for dashboard items (admin uses AdminDashboard with StaticGroupWithMembers).
   * NOT to be confused with User.isAdmin which is the super-user flag.
   */
  isAdminAccess: boolean;
  source: GroupSource;
  settings?: StaticGroupSettings;
  createdAt: string;
  updatedAt: string;
}

// ==================== Tier Snapshot Types ====================

// Content type for tier snapshots
export type ContentType = 'savage' | 'ultimate';

// Linked user info (for player cards)
export interface LinkedUserInfo {
  id: string;
  discordId: string;
  discordUsername: string;
  discordAvatar?: string;
  avatarUrl?: string;
  displayName?: string;
  membershipRole?: string; // owner/lead/member/viewer
}

// Linked player info (for members panel)
export interface LinkedPlayerInfo {
  playerId: string;
  playerName: string;
  playerJob: string;
  tierId: string;
  user: LinkedUserInfo;
}

// Interacted user info (for assignment modals - combines members and linked players)
export interface InteractedUser {
  user: LinkedUserInfo;
  isMember: boolean;
  memberRole?: MemberRole;
}

// Player assignment request (for admin/owner assign endpoints)
export interface AssignPlayerRequest {
  userId: string | null;
  createMembership?: boolean;
  membershipRole?: 'member' | 'lead';
}

// Tier snapshot (roster for a specific raid tier)
export interface TierSnapshot {
  id: string;
  staticGroupId: string;
  tierId: string;
  contentType: ContentType;
  isActive: boolean;
  playerCount?: number;
  players?: SnapshotPlayer[];
  weaponPrioritiesAutoLockDate?: string;
  weaponPrioritiesGlobalLock: boolean;
  weaponPrioritiesGlobalLockedBy?: string;
  weaponPrioritiesGlobalLockedAt?: string;
  currentWeek: number;
  weekStartDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Snapshot player (player within a tier snapshot)
export interface SnapshotPlayer {
  id: string;
  tierSnapshotId: string;
  userId?: string | null;
  linkedUser?: LinkedUserInfo | null;
  name: string;
  job: string;
  role: string;
  position?: RaidPosition | null;
  tankRole?: TankRole | null;
  templateRole?: TemplateRole | null;
  rosterTitle?: string | null;
  rosterNote?: string | null;
  flexRoles?: FlexRole[];
  configured: boolean;
  sortOrder: number;
  isSubstitute: boolean;
  notes?: string;
  lodestoneId?: string;
  lodestoneName?: string;
  lodestoneServer?: string;
  lodestoneAvatarUrl?: string;
  bisLink?: string;
  fflogsId?: number;
  lastSync?: string;
  lastSyncSource?: string;
  lastSyncedJob?: string;
  jobMismatchWarning?: string | null;
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  weaponPriorities: WeaponPriority[];
  weaponPrioritiesLocked: boolean;
  weaponPrioritiesLockedBy?: string;
  weaponPrioritiesLockedAt?: string;
  // Adjustment fields for mid-tier roster changes
  lootAdjustment?: number;
  pageAdjustments?: { I: number; II: number; III: number; IV: number };
  // Priority modifier for per-player adjustment (-100 to +100)
  priorityModifier?: number;
  createdAt: string;
  updatedAt: string;
}

// Page adjustment type for type-safe floor access
export interface PageAdjustments {
  I: number;
  II: number;
  III: number;
  IV: number;
}

// Rollover request
export interface RolloverRequest {
  targetTierId: string;
  resetGear: boolean;
}

// Rollover response
export interface RolloverResponse {
  sourceSnapshot: TierSnapshot;
  targetSnapshot: TierSnapshot;
  playersCopied: number;
}

// ==================== Invitation Types ====================

// Invitation for joining a static group
export interface Invitation {
  id: string;
  staticGroupId: string;
  inviteCode: string;
  role: MemberRole;
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
  isActive: boolean;
  isValid: boolean;
  createdAt: string;
  createdById: string;
  staticGroupName?: string;
}

// Invitation preview (public info before accepting)
export interface InvitationPreview {
  inviteCode: string;
  staticGroupName: string;
  staticGroupId: string;
  shareCode: string;  // For navigation to group page
  role: MemberRole;
  isValid: boolean;
  expiresAt?: string;
  alreadyMember: boolean;
}

// Invitation create request
export interface InvitationCreate {
  role?: MemberRole;
  expiresInDays?: number;
  maxUses?: number;
}

// Invitation accept response
export interface InvitationAcceptResponse {
  success: boolean;
  message: string;
  staticGroupId?: string;
  shareCode?: string;
  role?: MemberRole;
}

// ==================== Join Request Types ====================

export type JoinRequestStatus = 'pending' | 'under_review' | 'accepted' | 'declined' | 'cancelled';

export interface RequesterInfo {
  id: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AltJobEntry {
  job: string;
  role: string;
  priority: string;
  readiness: string;
}

export interface GearSnapshotSummary {
  job: string;
  avgItemLevel: number;
  source: string;
  syncedAt: string | null;
  completeSlotsCount?: number;
}

export interface AvailabilitySnapshotSummary {
  configuredDays: number;
  timezone: string;
  detailLevel: 'summary_only' | 'exact';
  dayLabels?: string[];
  source?: 'player_hub';
  exactWindows?: { dayOfWeek: string; dayLabel: string; slots: string[] }[];
}

export interface JoinRequest {
  id: string;
  staticGroupId: string;
  staticGroupName?: string;
  requesterUserId: string;
  requester?: RequesterInfo;
  status: JoinRequestStatus;
  message?: string;
  roleInterest?: string[];
  jobInterest?: string[];
  availabilityNote?: string;
  contactDiscord?: string;
  // Profile-connected fields
  playerProfileId?: string;
  playerCharacterId?: string;
  selectedJob?: string;
  selectedRole?: string;
  includedAltJobs?: AltJobEntry[];
  gearSnapshotSummary?: GearSnapshotSummary;
  availabilitySummary?: AvailabilitySnapshotSummary;
  readinessAtApply?: string;
  profileShareCodeAtApply?: string;
  profileVisibilityAtApply?: 'private' | 'shareable' | 'discoverable';
  profileShareEnabledAtApply?: boolean;
  // Character identity snapshot
  characterNameAtApply?: string;
  characterWorldAtApply?: string;
  characterDcAtApply?: string;
  characterAvatarUrlAtApply?: string;
  characterLodestoneIdAtApply?: string;
  // Goal alignment snapshot captured at apply time
  goalAlignmentSnapshot?: {
    aligned: number;
    partial: number;
    conflicts: number;
    missing: number;
    unknown: number;
  } | null;
  // Roster onboarding
  rosterPlayerId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

export interface JoinRequestListResponse {
  items: JoinRequest[];
  pendingCount: number;
}

export interface JoinRequestCreatePayload {
  message?: string;
  roleInterest?: string[];
  jobInterest?: string[];
  availabilityNote?: string;
  contactDiscord?: string;
  // Profile-connected fields
  playerProfileId?: string;
  playerCharacterId?: string;
  selectedJob?: string;
  selectedRole?: string;
  includedAltJobs?: AltJobEntry[];
  gearSnapshotSummary?: GearSnapshotSummary;
  availabilitySummary?: AvailabilitySnapshotSummary;
  includeExactAvailability?: boolean;
  readinessAtApply?: string;
  profileShareCodeAtApply?: string;
  // Character identity (auto-populated by backend from character if omitted)
  characterNameAtApply?: string;
  characterWorldAtApply?: string;
  characterDcAtApply?: string;
  characterAvatarUrlAtApply?: string;
}

// ==================== Admin Types ====================

// Admin static group list item (includes owner info)
export interface AdminStaticGroupListItem {
  id: string;
  name: string;
  shareCode: string;
  isPublic: boolean;
  ownerId: string;
  owner?: OwnerInfo;
  memberCount: number;
  tierCount: number;
  createdAt: string;
  updatedAt: string;
}

// Admin static group list response (paginated)
export interface AdminStaticGroupListResponse {
  items: AdminStaticGroupListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ==================== BiS Import Types ====================

// Gear slot data from BiS import
export interface BiSGearSlotData {
  slot: GearSlot;
  source: GearSource;
  itemId?: number;
  itemName?: string;
  itemLevel?: number;
  itemIcon?: string;
  itemStats?: ItemStats;
  materia?: MateriaSlot[];  // Melded materia
}

// BiS import response from XIVGear
export interface BiSImportData {
  name: string;
  job: string;
  slots: BiSGearSlotData[];
}

// BiS preset option (for dropdown)
export interface BiSPreset {
  name: string;
  index: number;
  uuid?: string; // XIVGear shortlink UUID (for shortlink presets)
  setIndex?: number; // Set index within the XIVGear sheet
  githubIndex?: number; // Set index in GitHub tier file (for GitHub presets)
  githubTier?: string; // GitHub tier name (e.g., "current", "fru", "top")
  description?: string; // Original name from The Balance
  category?: 'savage' | 'ultimate' | 'prog'; // Content type
  gcd?: string; // GCD tier (e.g., "2.50")
}

// BiS category type
export type BiSCategory = 'savage' | 'ultimate' | 'all';

// BiS presets response
export interface BiSPresetsResponse {
  job: string;
  presets: BiSPreset[];
}

// ==================== Multi-BiS V1 Types ====================

export type BisTargetSource = 'manual' | 'etro' | 'xivgear' | 'ariyala' | 'external';
export type BisTargetPurpose =
  | 'savage' | 'ultimate' | 'prog' | 'farm' | 'speed' | 'comfort' | 'custom'
  | 'savage_prog' | 'savage_reclear' | 'week1' | 'alt_job' | 'parse';

// ==================== Shared BiS Target Types (V2 — backend-persisted) ====================

export type BiSOwnerType = 'player_job_profile' | 'roster_member_job' | 'static_tier_job' | 'custom';
export type BiSSourceType = 'preset' | 'etro' | 'xivgear' | 'ariyala' | 'manual' | 'custom_link';
export type BiSImportStatus = 'linked_only' | 'imported' | 'import_failed' | 'unsupported';

export interface SharedBiSTargetSet {
  id: string;
  ownerType: BiSOwnerType;
  ownerId: string;
  jobProfileId?: string | null;
  snapshotPlayerId?: string | null;
  groupId?: string | null;
  profileId?: string | null;
  job: string;
  name: string;
  purpose: BisTargetPurpose;
  sourceType: BiSSourceType;
  externalUrl?: string | null;
  importStatus: BiSImportStatus;
  isActive: boolean;
  isPublic: boolean;
  patch?: string | null;
  itemLevel?: number | null;
  notes?: string | null;
  itemsJson?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedBiSTargetCreate {
  ownerType: BiSOwnerType;
  ownerId: string;
  groupId?: string | null;
  name: string;
  purpose?: BisTargetPurpose;
  sourceType?: BiSSourceType;
  externalUrl?: string | null;
  importStatus?: BiSImportStatus;
  isPublic?: boolean;
  patch?: string | null;
  itemLevel?: number | null;
  notes?: string | null;
}

export interface SharedBiSTargetUpdate {
  name?: string;
  purpose?: BisTargetPurpose;
  sourceType?: BiSSourceType;
  externalUrl?: string | null;
  importStatus?: BiSImportStatus;
  isPublic?: boolean;
  patch?: string | null;
  itemLevel?: number | null;
  notes?: string | null;
}

/**
 * A named target gear set for one job.
 * A job can have many BisTargetSets; exactly one should have isActive = true.
 *
 * Import status: xivgear and etro UUIDs are supported via existing /api/bis/* endpoints.
 * Ariyala is deprecated upstream; store externalUrl only.
 * Full item-level import requires a valid UUID/sheet from a supported source.
 */
export interface BisTargetSet {
  id: string;
  job: string;
  name: string;
  source: BisTargetSource;
  externalUrl?: string;
  purpose: BisTargetPurpose;
  patch?: string;
  tier?: string;
  targetItemLevel?: number;
  isActive: boolean;
  importedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Loot Tracking Types ====================

// Loot acquisition method
export type LootMethod = 'drop' | 'book' | 'tome' | 'purchase';

// Page ledger transaction type
export type TransactionType = 'earned' | 'spent' | 'missed' | 'adjustment';

// Loot log entry
export interface LootLogEntry {
  id: number;
  tierSnapshotId: string;
  weekNumber: number;
  floor: string;
  itemSlot: string;
  recipientPlayerId: string;
  recipientPlayerName: string;
  method: LootMethod;
  notes?: string;
  weaponJob?: string;  // "DRG", "WHM", etc. for weapon slots
  isExtra: boolean;    // True if extra/off-job loot
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

// Page ledger entry
export interface PageLedgerEntry {
  id: number;
  tierSnapshotId: string;
  playerId: string;
  playerName: string;
  weekNumber: number;
  floor: string;
  bookType: string;
  transactionType: TransactionType;
  quantity: number;
  notes?: string;
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

// Page balance for a player
export interface PageBalance {
  playerId: string;
  playerName: string;
  bookI: number;
  bookII: number;
  bookIII: number;
  bookIV: number;
}

// Material types for upgrade materials
export type MaterialType = 'twine' | 'glaze' | 'solvent' | 'universal_tomestone';

// Material log entry
export interface MaterialLogEntry {
  id: number;
  tierSnapshotId: string;
  weekNumber: number;
  floor: string;
  materialType: MaterialType;
  recipientPlayerId: string;
  recipientPlayerName: string;
  method: LootMethod;
  /** Which slot was augmented (null for universal_tomestone which marks tome weapon as "have") */
  slotAugmented?: GearSlot | 'tome_weapon' | null;
  notes?: string;
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

// Material balance for a player
export interface MaterialBalance {
  playerId: string;
  playerName: string;
  twine: number;
  glaze: number;
  solvent: number;
  universalTomestone: number;
}

// Material log entry create request
export interface MaterialLogEntryCreate {
  weekNumber: number;
  floor: string;
  materialType: MaterialType;
  recipientPlayerId: string;
  method?: LootMethod;
  /** Which slot was augmented (null for universal_tomestone which marks tome weapon as "have") */
  slotAugmented?: GearSlot | 'tome_weapon' | null;
  notes?: string;
}

// Material log entry update request (all fields optional)
export interface MaterialLogEntryUpdate {
  weekNumber?: number;
  floor?: string;
  materialType?: MaterialType;
  recipientPlayerId?: string;
  method?: LootMethod;
  slotAugmented?: GearSlot | 'tome_weapon' | null;
  notes?: string;
}

// Loot log entry create request
export interface LootLogEntryCreate {
  weekNumber: number;
  floor: string;
  itemSlot: string;
  recipientPlayerId: string;
  method: LootMethod;
  notes?: string;
  weaponJob?: string;  // "DRG", "WHM", etc. for weapon slots
  isExtra?: boolean;   // True if extra/off-job loot
}

// Loot log entry update request
export interface LootLogEntryUpdate {
  weekNumber?: number;
  floor?: string;
  itemSlot?: string;
  recipientPlayerId?: string;
  method?: LootMethod;
  notes?: string;
  weaponJob?: string;
  isExtra?: boolean;
}

// Page ledger entry create request
export interface PageLedgerEntryCreate {
  playerId: string;
  weekNumber: number;
  floor: string;
  bookType: string;
  transactionType: TransactionType;
  quantity: number;
  notes?: string;
}

// Mark floor cleared request
export interface MarkFloorClearedRequest {
  weekNumber: number;
  floor: string;
  playerIds: string[];
  notes?: string;
}

// ==================== Weekly Assignment Types (Manual Planning Mode) ====================

// Weekly assignment response
export interface WeeklyAssignment {
  id: string;
  staticGroupId: string;
  tierId: string;
  week: number;
  floor: string;
  slot: string;
  playerId: string | null;
  playerName: string | null;
  playerJob: string | null;
  sortOrder: number;
  didNotDrop: boolean;
  createdAt: string;
  updatedAt: string;
}

// Weekly assignment create request
export interface WeeklyAssignmentCreate {
  tierId: string;
  week: number;
  floor: string;
  slot: string;
  playerId: string | null;
  sortOrder?: number;
  didNotDrop?: boolean;
}

// Weekly assignment update request
export interface WeeklyAssignmentUpdate {
  playerId?: string | null;
  sortOrder?: number;
  didNotDrop?: boolean;
}

// Bulk item - individual assignment within a bulk create request
// Excludes tierId and week since those are provided at the wrapper level
export interface WeeklyAssignmentBulkItem {
  floor: string;
  slot: string;
  playerId: string | null;
  sortOrder?: number;
  didNotDrop?: boolean;
}

// Bulk create weekly assignments
export interface WeeklyAssignmentBulkCreate {
  tierId: string;
  week: number;
  assignments: WeeklyAssignmentBulkItem[];
}

// Bulk delete weekly assignments
export interface WeeklyAssignmentBulkDelete {
  tierId: string;
  week: number;
  floor?: string;
  slot?: string;
}

// ==================== Schedule Types ====================

export type RsvpStatus = 'available' | 'unavailable' | 'tentative';
export type InitialRsvpStatus = 'no_response' | RsvpStatus;

export interface ScheduleRsvp {
  id: string;
  sessionId: string;
  userId: string;
  username: string | null;
  status: RsvpStatus;
  note: string | null;
  updatedAt: string;
}

export type EventCategory = 'raid' | 'ultimate' | 'farm' | 'reclear' | 'prog' | 'social' | 'other';

export interface ScheduleSession {
  id: string;
  staticGroupId: string;
  createdById: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  trackAvailability?: boolean;
  category: EventCategory | null;
  contentId: string | null;
  contentName: string | null;
  createdAt: string;
  updatedAt: string;
  rsvps: ScheduleRsvp[];
}

export interface ScheduleSettings {
  id?: string | null;
  staticGroupId: string;
  webhookConfigured: boolean;
  webhookUrlMasked?: string | null;
  reminderChannelLabel?: string | null;
  mentionTarget: 'none' | 'here' | 'role';
  mentionRoleId?: string | null;
  enableAtStartReminder?: boolean;
  enable15mReminder?: boolean;
  enable24hReminder: boolean;
  enable1hReminder: boolean;
  enable6hReminder?: boolean;
  enable12hReminder?: boolean;
  enableMissingRsvpReminder: boolean;
  calendarEnabled: boolean;
  calendarUrl?: string | null;
  calendarTokenCreatedAt?: string | null;
  canManage: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ScheduleSettingsUpdate {
  webhookUrl?: string | null;
  reminderChannelLabel?: string | null;
  mentionTarget?: 'none' | 'here' | 'role';
  mentionRoleId?: string | null;
  enableAtStartReminder?: boolean;
  enable15mReminder?: boolean;
  enable24hReminder?: boolean;
  enable1hReminder?: boolean;
  enable6hReminder?: boolean;
  enable12hReminder?: boolean;
  enableMissingRsvpReminder?: boolean;
}

export interface CalendarTokenResponse {
  calendarEnabled: boolean;
  calendarUrl?: string | null;
  calendarTokenCreatedAt?: string | null;
}

export interface ScheduleSessionCreate {
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  timezone: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  trackAvailability?: boolean;
  initialRsvpStatus?: InitialRsvpStatus;
  category?: EventCategory | null;
  contentId?: string | null;
  contentName?: string | null;
}

export interface ScheduleSessionUpdate {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  trackAvailability?: boolean;
  category?: EventCategory | null;
  contentId?: string | null;
  contentName?: string | null;
}

// ==================== Availability Types ====================

export interface UserAvailabilitySlot {
  id: string;
  userId: string;
  username: string | null;
  date: string;
  slots: string[];
}

export interface AvailabilityDateSummary {
  date: string;
  responses: UserAvailabilitySlot[];
}

export interface AvailabilitySubmit {
  date: string;
  slots: string[];
}

export interface AvailabilityTemplateSlot {
  id: string;
  userId: string;
  username: string | null;
  dayOfWeek: string;
  slots: string[];
}

export interface AvailabilityTemplateDaySummary {
  dayOfWeek: string;
  responses: AvailabilityTemplateSlot[];
}

export interface AvailabilityTemplateSubmit {
  dayOfWeek: string;
  slots: string[];
}
