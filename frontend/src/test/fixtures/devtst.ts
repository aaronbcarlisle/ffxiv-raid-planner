/**
 * DEVTST fixture — the Dev Test Static as the V2 audit dumped it (R-P0-11).
 *
 * Source: the main checkout's git-ignored audit dumps
 * `.superpowers/v2-audit/canvas/_data/{tier,lootlog,matlog,group}.json`,
 * captured 2026-09-27 (loot-log entry 73 is the newest, `createdAt`
 * 2026-09-27T10:00Z). Extracted 2026-09-30.
 *
 * The dump is NOT purely synthetic (`group.json` holds a real chat-platform
 * account, and `tier.json` links "Caster One" to it), so this file is built
 * from an explicit field allowlist and never copies a record wholesale:
 *
 * Players — `id` (renamed `p-<role>-<n>`), `name`, `job`, `role`, `position`,
 * `isSubstitute`, plus every field the priority engine reads:
 *   - `configured`, `isSubstitute` — the roster pools
 *     (`recipientRanking.ts:66-67`, `LogWeekWizard/index.tsx` mainRosterPlayers);
 *   - `role`, `job`, `priorityModifier`, `lootAdjustment` — the base score
 *     (`priority.ts:199-237`);
 *   - `sortOrder` — position-based mode (`priority.ts:75-108`);
 *   - `gear[].{slot,bisSource,hasItem,isAugmented}` — need + weighted need
 *     (`priority.ts:209-213,357-359,383-386,443-449`), and `gear[].itemName`
 *     where the dump has one — `requiresAugmentation` (`calculations.ts:94-98`)
 *     reads it to tell an augmented tome target from a base one;
 *   - `tomeWeapon.{pursuing,hasItem,isAugmented}` — solvent need
 *     (`priority.ts:457,481`, `materialCoordination.ts:106-111`);
 *   - `name` — the tie-break sort (`priority.ts:369`, `priorityEntries.ts:70`).
 *   Type-required scaffolding (`tierSnapshotId`, `weaponPriorities`,
 *   `weaponPrioritiesLocked`, `createdAt`, `updatedAt`) is filled with fixed
 *   constants. Never held: the account-link fields, the chat-platform and
 *   character-service fields, `createdBy*`, `recipientCharacter*`, `bisLink`,
 *   `fflogsId`, `lastSync*` (R-P0-11 names them; the report's grep proves it).
 *
 * Settings — `group.json`'s `settings` over `DEFAULT_SETTINGS`, minus the
 * `discovery` block (not a `StaticSettings` field). The dump stores
 * `jobPriorityModifiers` and `prioritySettings` as `null`; every engine read
 * goes through `?.`, so `undefined` is behaviour-identical and type-correct.
 *
 * Loot log — all 13 entries (recipient ids remapped; `notes` dropped).
 * Material log — all 5 entries. Both are built through a typed seed that
 * omits `createdBy*` (no consumer of this fixture reads it), asserted to the
 * full entry type at the one place the seed is widened.
 */
import type {
  GearSlot, GearSlotStatus, GearSource, LootLogEntry, MaterialLogEntry,
  RaidPosition, SnapshotPlayer, StaticSettings, TomeWeaponStatus,
} from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/constants';

export const DEVTST_TIER_ID = 'devtst-tier';
export const DEVTST_FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

const DUMP_DATE = '2026-09-27T10:00:00Z';

const P = {
  tank1: 'p-tank-1',
  tank2: 'p-tank-2',
  healer1: 'p-healer-1',
  healer2: 'p-healer-2',
  melee1: 'p-melee-1',
  melee2: 'p-melee-2',
  ranged1: 'p-ranged-1',
  caster1: 'p-caster-1',
} as const;

function g(slot: GearSlot, bisSource: GearSource | null, hasItem: boolean, isAugmented: boolean, itemName?: string): GearSlotStatus {
  return itemName === undefined
    ? { slot, bisSource, hasItem, isAugmented }
    : { slot, bisSource, hasItem, isAugmented, itemName };
}

function player(p: {
  id: string; name: string; job: string; role: string; position: RaidPosition;
  isSubstitute: boolean; sortOrder: number; lootAdjustment: number; priorityModifier: number;
  tomeWeapon: TomeWeaponStatus; gear: GearSlotStatus[];
}): SnapshotPlayer {
  return {
    tierSnapshotId: DEVTST_TIER_ID,
    configured: true,
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: DUMP_DATE,
    updatedAt: DUMP_DATE,
    ...p,
  };
}

export const DEVTST_PLAYERS: SnapshotPlayer[] = [
  player({
    id: P.tank2, name: 'Tank Two', job: 'WAR', role: 'tank', position: 'T2', isSubstitute: false,
    sortOrder: 1, lootAdjustment: 1, priorityModifier: 0,
    tomeWeapon: { pursuing: true, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', true, false, 'Weapon of Heavyweight Combat'),
      g('offhand', null, false, false),
      g('head', 'raid', true, false, 'Head of Heavyweight Combat'),
      g('body', 'raid', true, false, 'Body of Heavyweight Combat'),
      g('hands', 'raid', true, false, 'Hands of Heavyweight Combat'),
      g('legs', 'raid', true, false, 'Legs of Heavyweight Combat'),
      g('feet', 'raid', false, false),
      g('earring', 'raid', true, false, 'Earring of Heavyweight Combat'),
      g('necklace', 'raid', false, false),
      g('bracelet', 'raid', false, false),
      g('ring1', 'raid', false, false),
      g('ring2', 'tome', false, false),
    ],
  }),
  player({
    id: P.healer2, name: 'Healer Two', job: 'SCH', role: 'healer', position: 'H2', isSubstitute: false,
    sortOrder: 2, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', false, false, "Grand Champion's Codex"),
      g('offhand', null, false, false),
      g('head', 'raid', false, false, "Grand Champion's Headgear of Healing"),
      g('body', 'tome', false, false, 'Augmented Bygone Brass Shirt of Healing'),
      g('hands', 'raid', false, false, "Grand Champion's Gloves of Healing"),
      g('legs', 'raid', false, false, "Grand Champion's Breeches of Healing"),
      g('feet', 'raid', false, false, "Grand Champion's Sabatons of Healing"),
      g('earring', 'raid', false, false, "Grand Champion's Ear Cuff of Healing"),
      g('necklace', 'raid', false, false, "Grand Champion's Neckband of Healing"),
      g('bracelet', 'tome', false, false, 'Augmented Bygone Brass Bracelet of Healing'),
      g('ring1', 'base_tome', false, false, 'Bygone Brass Ring of Healing'),
      g('ring2', 'tome', false, false, 'Augmented Bygone Brass Ring of Healing'),
    ],
  }),
  player({
    id: P.healer1, name: 'Healer One', job: 'WHM', role: 'healer', position: 'H1', isSubstitute: false,
    sortOrder: 3, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', true, false, 'Weapon of Heavyweight Combat'),
      g('offhand', null, false, false),
      g('head', 'raid', true, false, 'Head of Heavyweight Combat'),
      g('body', 'raid', true, false, 'Body of Heavyweight Combat'),
      g('hands', 'raid', true, false, 'Hands of Heavyweight Combat'),
      g('legs', 'raid', false, false, 'Legs of Heavyweight Combat'),
      g('feet', 'raid', true, false, 'Feet of Heavyweight Combat'),
      g('earring', 'raid', true, false, 'Earring of Heavyweight Combat'),
      g('necklace', 'raid', true, false, 'Necklace of Heavyweight Combat'),
      g('bracelet', 'raid', true, false, 'Bracelet of Heavyweight Combat'),
      g('ring1', 'raid', true, false),
      g('ring2', 'tome', true, true),
    ],
  }),
  player({
    id: P.melee1, name: 'Melee One', job: 'DRG', role: 'melee', position: 'M1', isSubstitute: false,
    sortOrder: 4, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
    gear: [
      g('weapon', 'raid', true, false, "Grand Champion's Spear"),
      g('offhand', null, false, false),
      g('head', 'tome', false, false, 'Augmented Bygone Brass Cap of Maiming'),
      g('body', 'raid', false, false, "Grand Champion's Jacket of Maiming"),
      g('hands', 'tome', false, false, 'Augmented Bygone Brass Gloves of Maiming'),
      g('legs', 'tome', false, false, 'Augmented Bygone Brass Brais of Maiming'),
      g('feet', 'raid', false, false, "Grand Champion's Boots of Maiming"),
      g('earring', 'tome', false, false, 'Augmented Bygone Brass Earrings of Slaying'),
      g('necklace', 'tome', false, false, 'Augmented Bygone Brass Choker of Slaying'),
      g('bracelet', 'raid', false, false, "Grand Champion's Bracelets of Slaying"),
      g('ring1', 'raid', false, false, "Grand Champion's Ring of Slaying"),
      g('ring2', 'tome', false, false, 'Augmented Bygone Brass Ring of Slaying'),
    ],
  }),
  // The substitute — kept on purpose: the engine's pools filter on it.
  player({
    id: P.melee2, name: 'Melee Two', job: 'MNK', role: 'melee', position: 'M2', isSubstitute: true,
    sortOrder: 5, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', true, false),
      g('offhand', null, false, false),
      g('head', 'raid', false, false),
      g('body', 'raid', false, false),
      g('hands', 'raid', false, false),
      g('legs', 'raid', false, false),
      g('feet', 'raid', false, false),
      g('earring', 'raid', false, false),
      g('necklace', 'raid', false, false),
      g('bracelet', 'raid', false, false),
      g('ring1', 'raid', false, false),
      g('ring2', 'tome', false, false),
    ],
  }),
  player({
    id: P.ranged1, name: 'Ranged One', job: 'BRD', role: 'ranged', position: 'R1', isSubstitute: false,
    sortOrder: 6, lootAdjustment: -1, priorityModifier: 0,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', true, false, "Grand Champion's Longbow"),
      g('offhand', null, false, false),
      g('head', 'tome', false, false, 'Augmented Bygone Brass Top Hat of Aiming'),
      g('body', 'raid', false, false, "Grand Champion's Coat of Aiming"),
      g('hands', 'raid', false, false, "Grand Champion's Gloves of Aiming"),
      g('legs', 'tome', false, false, 'Augmented Bygone Brass Gaskins of Aiming'),
      g('feet', 'tome', false, false, 'Augmented Bygone Brass Boots of Aiming'),
      g('earring', 'tome', false, false, 'Augmented Bygone Brass Earrings of Aiming'),
      g('necklace', 'raid', false, false, "Grand Champion's Neckband of Aiming"),
      g('bracelet', 'tome', false, false, 'Augmented Bygone Brass Bracelet of Aiming'),
      g('ring1', 'tome', false, false, 'Augmented Bygone Brass Ring of Aiming'),
      g('ring2', 'raid', false, false, "Grand Champion's Ring of Aiming"),
    ],
  }),
  player({
    id: P.caster1, name: 'Caster One', job: 'BLM', role: 'caster', position: 'R2', isSubstitute: false,
    sortOrder: 7, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    gear: [
      g('weapon', 'raid', false, false, "Grand Champion's Rod"),
      g('offhand', null, false, false),
      g('head', 'tome', false, false, 'Augmented Bygone Brass Calot of Casting'),
      g('body', 'tome', false, false, 'Augmented Bygone Brass Shirt of Casting'),
      g('hands', 'tome', false, false, 'Augmented Bygone Brass Gloves of Casting'),
      g('legs', 'raid', false, false, "Grand Champion's Breeches of Casting"),
      g('feet', 'raid', false, false, "Grand Champion's Sabatons of Casting"),
      g('earring', 'tome', false, false, 'Augmented Bygone Brass Earrings of Casting'),
      g('necklace', 'raid', false, false, "Grand Champion's Neckband of Casting"),
      g('bracelet', 'raid', false, false, "Grand Champion's Bracelets of Casting"),
      g('ring1', 'raid', false, false, "Grand Champion's Ring of Casting"),
      g('ring2', 'tome', false, false, 'Augmented Bygone Brass Ring of Casting'),
    ],
  }),
  player({
    id: P.tank1, name: 'Tank One', job: 'WAR', role: 'tank', position: 'T1', isSubstitute: false,
    sortOrder: 7, lootAdjustment: 0, priorityModifier: 0,
    tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true },
    gear: [
      g('weapon', 'raid', false, false, "Grand Champion's War Axe"),
      g('offhand', null, false, false),
      g('head', 'raid', true, false, "Grand Champion's Headgear of Fending"),
      g('body', 'tome', true, false, 'Augmented Bygone Brass Coat of Fending'),
      g('hands', 'raid', true, false, "Grand Champion's Gloves of Fending"),
      g('legs', 'raid', true, false, "Grand Champion's Breeches of Fending"),
      g('feet', 'tome', true, false, 'Augmented Bygone Brass Greaves of Fending'),
      g('earring', 'raid', false, false, "Grand Champion's Ear Cuff of Fending"),
      g('necklace', 'tome', false, false, 'Augmented Bygone Brass Choker of Fending'),
      g('bracelet', 'tome', false, false, 'Augmented Bygone Brass Bracelet of Fending'),
      g('ring1', 'raid', false, false, "Grand Champion's Ring of Fending"),
      g('ring2', 'tome', false, false, 'Augmented Bygone Brass Ring of Fending'),
    ],
  }),
];

export const DEVTST_SETTINGS: StaticSettings = {
  ...DEFAULT_SETTINGS,
  lootPriority: ['melee', 'ranged', 'caster', 'tank', 'healer'],
  hideSetupBanners: true,
  hideBisBanners: true,
  priorityMode: 'automatic',
  jobPriorityModifiers: undefined,
  showPriorityScores: true,
  enableEnhancedScoring: false,
  autoSyncEnabled: false,
  autoSyncIntervalHours: 8,
  prioritySettings: undefined,
};

type LootSeed = Pick<
  LootLogEntry,
  'id' | 'weekNumber' | 'floor' | 'itemSlot' | 'recipientPlayerId' | 'recipientPlayerName' | 'method' | 'weaponJob' | 'isExtra'
>;

function loot(seed: LootSeed): LootLogEntry {
  // The seed deliberately carries no `createdBy*` (see header); nothing that
  // consumes this fixture reads those fields.
  return { tierSnapshotId: DEVTST_TIER_ID, createdAt: DUMP_DATE, ...seed } as LootLogEntry;
}

export const DEVTST_LOOT_LOG: LootLogEntry[] = [
  loot({ id: 73, weekNumber: 11, floor: 'M9S', itemSlot: 'earring', recipientPlayerId: P.healer2, recipientPlayerName: 'Healer Two', method: 'drop', weaponJob: undefined, isExtra: false }),
  loot({ id: 72, weekNumber: 3, floor: 'M9S', itemSlot: 'necklace', recipientPlayerId: P.ranged1, recipientPlayerName: 'Ranged One', method: 'drop', weaponJob: undefined, isExtra: false }),
  loot({ id: 71, weekNumber: 3, floor: 'M12S', itemSlot: 'weapon', recipientPlayerId: P.healer1, recipientPlayerName: 'Healer One', method: 'drop', weaponJob: 'WHM', isExtra: false }),
  loot({ id: 70, weekNumber: 3, floor: 'M10S', itemSlot: 'feet', recipientPlayerId: P.tank2, recipientPlayerName: 'Tank Two', method: 'purchase', weaponJob: undefined, isExtra: false }),
  loot({ id: 69, weekNumber: 3, floor: 'M10S', itemSlot: 'hands', recipientPlayerId: P.melee1, recipientPlayerName: 'Melee One', method: 'tome', weaponJob: undefined, isExtra: false }),
  loot({ id: 68, weekNumber: 2, floor: 'M12S', itemSlot: 'weapon', recipientPlayerId: P.tank1, recipientPlayerName: 'Tank One', method: 'drop', weaponJob: 'DRG', isExtra: false }),
  loot({ id: 67, weekNumber: 2, floor: 'M11S', itemSlot: 'legs', recipientPlayerId: P.healer1, recipientPlayerName: 'Healer One', method: 'drop', weaponJob: undefined, isExtra: true }),
  loot({ id: 44, weekNumber: 2, floor: 'M12S', itemSlot: 'weapon', recipientPlayerId: P.melee1, recipientPlayerName: 'Melee One', method: 'drop', weaponJob: 'DRG', isExtra: false }),
  loot({ id: 28, weekNumber: 2, floor: 'M9S', itemSlot: 'earring', recipientPlayerId: P.caster1, recipientPlayerName: 'Caster One', method: 'drop', weaponJob: undefined, isExtra: false }),
  loot({ id: 66, weekNumber: 1, floor: 'M11S', itemSlot: 'body', recipientPlayerId: P.caster1, recipientPlayerName: 'Caster One', method: 'drop', weaponJob: undefined, isExtra: false }),
  loot({ id: 65, weekNumber: 1, floor: 'M10S', itemSlot: 'head', recipientPlayerId: P.tank1, recipientPlayerName: 'Tank One', method: 'book', weaponJob: undefined, isExtra: false }),
  loot({ id: 64, weekNumber: 1, floor: 'M9S', itemSlot: 'ring', recipientPlayerId: P.ranged1, recipientPlayerName: 'Ranged One', method: 'drop', weaponJob: undefined, isExtra: true }),
  loot({ id: 63, weekNumber: 1, floor: 'M9S', itemSlot: 'earring', recipientPlayerId: P.healer2, recipientPlayerName: 'Healer Two', method: 'drop', weaponJob: undefined, isExtra: false }),
];

type MaterialSeed = Pick<
  MaterialLogEntry,
  'id' | 'weekNumber' | 'floor' | 'materialType' | 'recipientPlayerId' | 'recipientPlayerName' | 'method' | 'slotAugmented'
>;

function material(seed: MaterialSeed): MaterialLogEntry {
  return { tierSnapshotId: DEVTST_TIER_ID, createdAt: DUMP_DATE, ...seed } as MaterialLogEntry;
}

export const DEVTST_MATERIAL_LOG: MaterialLogEntry[] = [
  material({ id: 27, weekNumber: 3, floor: 'M9S', materialType: 'twine', recipientPlayerId: P.tank2, recipientPlayerName: 'Tank Two', method: 'drop', slotAugmented: 'legs' }),
  material({ id: 25, weekNumber: 3, floor: 'M11S', materialType: 'solvent', recipientPlayerId: P.melee1, recipientPlayerName: 'Melee One', method: 'drop', slotAugmented: 'tome_weapon' }),
  material({ id: 16, weekNumber: 2, floor: 'M10S', materialType: 'universal_tomestone', recipientPlayerId: P.melee1, recipientPlayerName: 'Melee One', method: 'drop', slotAugmented: null }),
  material({ id: 10, weekNumber: 2, floor: 'M10S', materialType: 'universal_tomestone', recipientPlayerId: P.tank2, recipientPlayerName: 'Tank Two', method: 'drop', slotAugmented: null }),
  material({ id: 24, weekNumber: 1, floor: 'M10S', materialType: 'twine', recipientPlayerId: P.caster1, recipientPlayerName: 'Caster One', method: 'drop', slotAugmented: 'body' }),
];
