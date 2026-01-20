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
export type GearSource = 'raid' | 'tome' | 'crafted';

// Display names for BiS sources (short labels for UI)
export const BIS_SOURCE_NAMES: Record<GearSource, string> = {
  raid: 'Raid',
  tome: 'Tome',
  crafted: 'Craft',
};

// Color classes for BiS sources
export const BIS_SOURCE_COLORS: Record<GearSource, string> = {
  raid: 'text-gear-raid',
  tome: 'text-gear-tome',
  crafted: 'text-orange-400',
};

// Background color classes for BiS source badges
export const BIS_SOURCE_BG_COLORS: Record<GearSource, string> = {
  raid: 'bg-gear-raid/20',
  tome: 'bg-gear-tome/20',
  crafted: 'bg-orange-400/20',
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
  crafted: 'text-orange-400',   // Orange for crafted
  prep: 'text-purple-300',      // Purple for previous tier
  normal: 'text-gray-400',      // Gray for normal raid
  unknown: 'text-gray-500',     // Muted for unknown
};

// Page navigation modes
export type PageMode = 'players' | 'loot' | 'stats' | 'history';

// View mode for player cards
export type ViewMode = 'compact' | 'expanded';

// Sort preset for player ordering
export type SortPreset = 'standard' | 'dps-first' | 'healer-first' | 'custom';

// Reset mode for Reset Gear action
export type ResetMode = 'progress' | 'unlink' | 'all';

// Raid position for mechanics (light parties, partners, spread positions)
export type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';

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

// Gear slot status for a player
export interface GearSlotStatus {
  slot: GearSlot;
  bisSource: GearSource;         // BiS target (raid or tome)
  currentSource?: GearSourceCategory; // What's actually equipped (9 categories)
  hasItem: boolean;
  isAugmented: boolean;
  itemName?: string;
  itemLevel?: number;
  itemIcon?: string;
  itemStats?: ItemStats;
}

// Static (raid group) settings
export interface StaticSettings {
  displayOrder: string[]; // Role order for display (used by non-custom presets)
  lootPriority: string[]; // Role order for loot priority
  sortPreset: SortPreset; // Current sort preset
  groupView: boolean; // Show G1/G2 light party grouping
  timezone: string;
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly';
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
  email?: string;
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

// Static group settings (loot priority, etc.)
export interface StaticGroupSettings {
  lootPriority: string[];
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
  configured: boolean;
  sortOrder: number;
  isSubstitute: boolean;
  notes?: string;
  lodestoneId?: string;
  bisLink?: string;
  fflogsId?: number;
  lastSync?: string;
  gear: GearSlotStatus[];
  tomeWeapon: TomeWeaponStatus;
  weaponPriorities: WeaponPriority[];
  weaponPrioritiesLocked: boolean;
  weaponPrioritiesLockedBy?: string;
  weaponPrioritiesLockedAt?: string;
  // Adjustment fields for mid-tier roster changes
  lootAdjustment?: number;
  pageAdjustments?: { I: number; II: number; III: number; IV: number };
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

// ==================== Loot Tracking Types ====================

// Loot acquisition method
export type LootMethod = 'drop' | 'book' | 'tome';

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
  notes?: string;
}

// Material log entry update request (all fields optional)
export interface MaterialLogEntryUpdate {
  weekNumber?: number;
  floor?: string;
  materialType?: MaterialType;
  recipientPlayerId?: string;
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
