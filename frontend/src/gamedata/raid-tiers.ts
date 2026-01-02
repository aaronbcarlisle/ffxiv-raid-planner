/**
 * Raid Tier Configuration
 *
 * UPDATE THIS FILE each major patch (every ~4 months) when a new savage tier releases.
 * The current tier should always be first in the RAID_TIERS array.
 */

export interface RaidTier {
  /** Internal identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short name for dropdowns (e.g., "M5S-M8S") */
  shortName: string;
  /** Patch version this tier was released */
  patch: string;
  /** Floor identifiers (e.g., M1S, M2S, M3S, M4S) */
  floors: string[];
  /** Full duty names from game (for tooltips) */
  dutyNames?: string[];
  /** Item levels for this tier */
  itemLevels: {
    /** Savage armor iLvl */
    savage: number;
    /** Savage weapon iLvl (usually +5 from armor) */
    savageWeapon: number;
    /** Base tomestone gear iLvl (unaugmented) */
    tome: number;
    /** Augmented tomestone gear iLvl (matches savage) */
    tomeAugmented: number;
    /** Crafted gear iLvl */
    crafted: number;
    /** Minimum iLvl to enter savage */
    minimum: number;
  };
  /** Gear set name prefixes for identification */
  gearPrefixes: {
    savage: string;
    tome: string;
    crafted: string;
  };
  /** Upgrade material names for this tier */
  upgradeMaterials: {
    twine: string;
    glaze: string;
    solvent: string;
  };
  /** Whether this is the current active tier */
  isCurrent: boolean;
}

/**
 * All raid tiers, with current tier first.
 * Add new tiers to the beginning of this array.
 */
export const RAID_TIERS: RaidTier[] = [
  // ==========================================
  // DAWNTRAIL (7.x)
  // ==========================================
  {
    id: 'aac-heavyweight',
    name: 'AAC Heavyweight (Savage)',
    shortName: 'M9S-M12S',
    patch: '7.4',
    floors: ['M9S', 'M10S', 'M11S', 'M12S'],
    dutyNames: [
      'AAC Heavyweight M1 (Savage)',
      'AAC Heavyweight M2 (Savage)',
      'AAC Heavyweight M3 (Savage)',
      'AAC Heavyweight M4 (Savage)',
    ],
    itemLevels: {
      savage: 790,
      savageWeapon: 795,
      tome: 780,
      tomeAugmented: 790,
      crafted: 770,
      minimum: 765,
    },
    gearPrefixes: {
      savage: 'Grand Champion',
      tome: 'TBD', // Update when 7.4 tomestone gear name is known
      crafted: 'TBD', // Update when 7.4 crafted gear name is known
    },
    upgradeMaterials: {
      twine: 'Thundersteeped Twine',
      glaze: 'Thundersteeped Glaze',
      solvent: 'Thundersteeped Solvent',
    },
    isCurrent: true,
  },
  {
    id: 'aac-cruiserweight',
    name: 'AAC Cruiserweight (Savage)',
    shortName: 'M5S-M8S',
    patch: '7.2',
    floors: ['M5S', 'M6S', 'M7S', 'M8S'],
    dutyNames: [
      'AAC Cruiserweight M1 (Savage)',
      'AAC Cruiserweight M2 (Savage)',
      'AAC Cruiserweight M3 (Savage)',
      'AAC Cruiserweight M4 (Savage)',
    ],
    itemLevels: {
      savage: 760,
      savageWeapon: 765,
      tome: 750,
      tomeAugmented: 760,
      crafted: 740,
      minimum: 735,
    },
    gearPrefixes: {
      savage: 'Cruiserweight Champion',
      tome: 'Quetzalli',
      crafted: 'Agonist',
    },
    upgradeMaterials: {
      twine: 'Cruiserweight Twine',
      glaze: 'Cruiserweight Glaze',
      solvent: 'Cruiserweight Solvent',
    },
    isCurrent: false,
  },
  {
    id: 'aac-light-heavyweight',
    name: 'AAC Light-heavyweight (Savage)',
    shortName: 'M1S-M4S',
    patch: '7.0',
    floors: ['M1S', 'M2S', 'M3S', 'M4S'],
    dutyNames: [
      'AAC Light-heavyweight M1 (Savage)',
      'AAC Light-heavyweight M2 (Savage)',
      'AAC Light-heavyweight M3 (Savage)',
      'AAC Light-heavyweight M4 (Savage)',
    ],
    itemLevels: {
      savage: 730,
      savageWeapon: 735,
      tome: 720,
      tomeAugmented: 730,
      crafted: 710,
      minimum: 705,
    },
    gearPrefixes: {
      savage: 'Light-heavyweight Champion',
      tome: 'Neo Kingdom',
      crafted: 'Archeo Kingdom',
    },
    upgradeMaterials: {
      twine: 'Light-heavyweight Twine',
      glaze: 'Light-heavyweight Glaze',
      solvent: 'Light-heavyweight Solvent',
    },
    isCurrent: false,
  },

  // ==========================================
  // ENDWALKER (6.x) - For reference/history
  // ==========================================
  {
    id: 'anabaseios',
    name: 'Anabaseios (Savage)',
    shortName: 'P9S-P12S',
    patch: '6.4',
    floors: ['P9S', 'P10S', 'P11S', 'P12S'],
    itemLevels: {
      savage: 660,
      savageWeapon: 665,
      tome: 650,
      tomeAugmented: 660,
      crafted: 640,
      minimum: 635,
    },
    gearPrefixes: {
      savage: 'Ascension',
      tome: 'Credendum',
      crafted: 'Diadochos',
    },
    upgradeMaterials: {
      twine: 'Ultimas Braid of Fending', // etc
      glaze: 'Ultimas Braid of Casting',
      solvent: 'Ultimite',
    },
    isCurrent: false,
  },
];

/**
 * Get the current active raid tier
 */
export function getCurrentTier(): RaidTier {
  const current = RAID_TIERS.find((t) => t.isCurrent);
  if (!current) {
    throw new Error('No current raid tier configured!');
  }
  return current;
}

/**
 * Get a raid tier by ID
 */
export function getTierById(id: string): RaidTier | undefined {
  return RAID_TIERS.find((t) => t.id === id);
}

/**
 * Get all available tier options for selection
 */
export function getTierOptions(): Array<{ id: string; name: string }> {
  return RAID_TIERS.map((t) => ({ id: t.id, name: t.name }));
}

/**
 * Get item level for a gear source category
 *
 * Maps the 9 gear source categories to their iLv for a specific tier.
 * Used for calculating average iLv when itemLevel is not available from BiS import.
 */
export function getItemLevelForCategory(
  tierId: string,
  category: import('../types').GearSourceCategory,
  isWeapon: boolean = false
): number {
  const tier = getTierById(tierId);
  if (!tier) return 0;

  // Base iLv by category (using tier's item level definitions)
  const { savage, savageWeapon, tome, tomeAugmented, crafted, minimum } = tier.itemLevels;

  // Weapon bonus is typically +5 iLv for non-savage gear
  const weaponBonus = isWeapon ? 5 : 0;

  const iLvMap: Record<import('../types').GearSourceCategory, number> = {
    savage: isWeapon ? savageWeapon : savage,        // Raid drops
    tome_up: tomeAugmented,                           // Augmented tomestone (same iLv as savage armor)
    catchup: tome,                                    // Alliance/catch-up (same iLv as unaugmented tome)
    tome: tome + weaponBonus,                         // Unaugmented tomestone
    relic: crafted + 5 + weaponBonus,                 // Relic is usually +5 above crafted
    crafted: crafted + weaponBonus,                   // Crafted pentamelded
    prep: crafted + weaponBonus,                      // Previous BiS (treated as crafted tier)
    normal: minimum + 5 + weaponBonus,               // Normal raid is ~5 above minimum
    unknown: 0,                                       // Unknown - can't calculate
  };

  return iLvMap[category];
}
