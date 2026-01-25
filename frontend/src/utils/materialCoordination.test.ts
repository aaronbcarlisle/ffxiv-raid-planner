/**
 * Unit tests for material coordination utilities
 *
 * Tests the pure utility functions for material eligibility calculations
 */

import { describe, it, expect } from 'vitest';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  hasTomeWeaponItem,
  getAugmentedSlotsForMaterial,
  isTomeWeaponAugmented,
} from './materialCoordination';
import type { SnapshotPlayer, GearSlotStatus } from '../types';

// Helper to create a minimal gear slot
function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

// Helper to create a minimal player
function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'player-1',
    tierSnapshotId: 'tier-1',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [
      createGearSlot({ slot: 'weapon', bisSource: 'raid' }),
      createGearSlot({ slot: 'head', bisSource: 'raid' }),
      createGearSlot({ slot: 'body', bisSource: 'raid' }),
      createGearSlot({ slot: 'hands', bisSource: 'raid' }),
      createGearSlot({ slot: 'legs', bisSource: 'raid' }),
      createGearSlot({ slot: 'feet', bisSource: 'raid' }),
      createGearSlot({ slot: 'earring', bisSource: 'raid' }),
      createGearSlot({ slot: 'necklace', bisSource: 'raid' }),
      createGearSlot({ slot: 'bracelet', bisSource: 'raid' }),
      createGearSlot({ slot: 'ring1', bisSource: 'raid' }),
      createGearSlot({ slot: 'ring2', bisSource: 'raid' }),
    ],
    tomeWeapon: {
      pursuing: false,
      hasItem: false,
      isAugmented: false,
    },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
    ...overrides,
  };
}

describe('getEligibleSlotsForAugmentation', () => {
  describe('twine (armor)', () => {
    it('returns armor slots with bisSource=tome, hasItem=true, isAugmented=false', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: true }), // already augmented
          createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: false, isAugmented: false }), // doesn't have item
          createGearSlot({ slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false }), // raid BiS
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }), // wrong material type
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual(['head', 'body']);
    });

    it('returns empty array when no armor slots need augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'raid' }),
          createGearSlot({ slot: 'body', bisSource: 'raid' }),
          createGearSlot({ slot: 'hands', bisSource: 'raid' }),
          createGearSlot({ slot: 'legs', bisSource: 'raid' }),
          createGearSlot({ slot: 'feet', bisSource: 'raid' }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual([]);
    });

    it('excludes slots already augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'twine');
      expect(eligible).toEqual([]);
    });
  });

  describe('glaze (accessories)', () => {
    it('returns accessory slots with bisSource=tome, hasItem=true, isAugmented=false', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'bracelet', bisSource: 'raid', hasItem: true, isAugmented: false }), // raid BiS
          createGearSlot({ slot: 'ring1', bisSource: 'tome', hasItem: false, isAugmented: false }), // doesn't have item
          createGearSlot({ slot: 'ring2', bisSource: 'tome', hasItem: true, isAugmented: true }), // already augmented
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }), // wrong material type
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'glaze');
      expect(eligible).toEqual(['earring', 'necklace']);
    });

    it('returns both ring slots if both need augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'ring1', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'ring2', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'glaze');
      expect(eligible).toContain('ring1');
      expect(eligible).toContain('ring2');
    });
  });

  describe('solvent (weapon)', () => {
    it('returns weapon slot when it needs augmentation', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual(['weapon']);
    });

    it('returns empty array when weapon is raid BiS', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: true, isAugmented: false }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual([]);
    });

    it('returns empty array when weapon already augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'solvent');
      expect(eligible).toEqual([]);
    });
  });

  describe('universal_tomestone', () => {
    it('returns empty array (universal_tomestone uses needsTomeWeaponAugmentation instead)', () => {
      const player = createPlayer({
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: false },
      });

      const eligible = getEligibleSlotsForAugmentation(player, 'universal_tomestone');
      expect(eligible).toEqual([]);
    });
  });
});

describe('needsTomeWeaponItem', () => {
  it('returns true when pursuing and does not have item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(false);
  });

  it('returns false when already has tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponItem(player)).toBe(false);
  });
});

describe('hasTomeWeaponItem', () => {
  it('returns true when pursuing and has item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(true);
  });

  it('returns false when not pursuing', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(false);
  });

  it('returns false when does not have item', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(hasTomeWeaponItem(player)).toBe(false);
  });
});

describe('needsTomeWeaponAugmentation', () => {
  it('returns true when pursuing, has item, and not augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when does not have tome weapon yet', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when tome weapon already augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });

  it('returns false when all conditions are false', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: false,
        isAugmented: false,
      },
    });

    expect(needsTomeWeaponAugmentation(player)).toBe(false);
  });
});

describe('getAugmentedSlotsForMaterial', () => {
  describe('twine (armor)', () => {
    it('returns armor slots with bisSource=tome, hasItem=true, isAugmented=true', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'hands', bisSource: 'tome', hasItem: true, isAugmented: false }), // not augmented
          createGearSlot({ slot: 'legs', bisSource: 'tome', hasItem: false, isAugmented: true }), // doesn't have item
          createGearSlot({ slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: true }), // raid BiS
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'twine');
      expect(augmented).toEqual(['head', 'body']);
    });

    it('returns empty array when no armor slots are augmented', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'head', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }),
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'twine');
      expect(augmented).toEqual([]);
    });
  });

  describe('glaze (accessories)', () => {
    it('returns accessory slots with bisSource=tome, hasItem=true, isAugmented=true', () => {
      const player = createPlayer({
        gear: [
          createGearSlot({ slot: 'earring', bisSource: 'tome', hasItem: true, isAugmented: true }),
          createGearSlot({ slot: 'necklace', bisSource: 'tome', hasItem: true, isAugmented: false }),
          createGearSlot({ slot: 'bracelet', bisSource: 'tome', hasItem: true, isAugmented: true }),
        ],
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'glaze');
      expect(augmented).toEqual(['earring', 'bracelet']);
    });
  });

  describe('universal_tomestone', () => {
    it('returns empty array (universal_tomestone uses isTomeWeaponAugmented instead)', () => {
      const player = createPlayer({
        tomeWeapon: { pursuing: true, hasItem: true, isAugmented: true },
      });

      const augmented = getAugmentedSlotsForMaterial(player, 'universal_tomestone');
      expect(augmented).toEqual([]);
    });
  });
});

describe('isTomeWeaponAugmented', () => {
  it('returns true when pursuing, has item, and is augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(true);
  });

  it('returns false when not pursuing tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: false,
        hasItem: true,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });

  it('returns false when does not have tome weapon', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: false,
        isAugmented: true,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });

  it('returns false when not augmented', () => {
    const player = createPlayer({
      tomeWeapon: {
        pursuing: true,
        hasItem: true,
        isAugmented: false,
      },
    });

    expect(isTomeWeaponAugmented(player)).toBe(false);
  });
});
