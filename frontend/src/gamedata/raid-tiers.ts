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
  /** Patch version this tier was released */
  patch: string;
  /** Floor identifiers (e.g., M1S, M2S, M3S, M4S) */
  floors: string[];
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
    id: 'aac-cruiserweight',
    name: 'AAC Cruiserweight (Savage)',
    patch: '7.2',
    floors: ['M5S', 'M6S', 'M7S', 'M8S'],
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
    isCurrent: true,
  },
  {
    id: 'aac-light-heavyweight',
    name: 'AAC Light-heavyweight (Savage)',
    patch: '7.0',
    floors: ['M1S', 'M2S', 'M3S', 'M4S'],
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
