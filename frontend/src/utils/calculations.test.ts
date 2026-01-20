/**
 * Unit tests for iLv calculation and gear source inference functions
 */

import { describe, it, expect } from 'vitest';
import {
  inferCurrentSource,
  getEffectiveCurrentSource,
  calculateAverageItemLevel,
  calculateTeamAverageItemLevel,
  requiresAugmentation,
  isSlotComplete,
  toGearState,
  fromGearState,
} from './calculations';
import type { GearSlotStatus, SnapshotPlayer } from '../types';

// Helper to create a minimal gear slot status
function createGearSlot(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return {
    slot: 'body',
    bisSource: 'raid',
    hasItem: false,
    isAugmented: false,
    ...overrides,
  };
}

// Helper to create a minimal snapshot player
function createPlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'test-player',
    tierSnapshotId: 'test-tier',
    name: 'Test Player',
    job: 'DRG',
    role: 'melee',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('inferCurrentSource', () => {
  it('returns "savage" when hasItem is true and bisSource is "raid"', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'raid' });
    expect(inferCurrentSource(slot)).toBe('savage');
  });

  it('returns "tome_up" when hasItem is true, bisSource is "tome", and isAugmented is true', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'tome', isAugmented: true });
    expect(inferCurrentSource(slot)).toBe('tome_up');
  });

  it('returns "tome" when hasItem is true, bisSource is "tome", and isAugmented is false', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'tome', isAugmented: false });
    expect(inferCurrentSource(slot)).toBe('tome');
  });

  it('returns "tome" when hasItem is true and bisSource is "base_tome"', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'base_tome' });
    expect(inferCurrentSource(slot)).toBe('tome');
  });

  it('returns "crafted" when hasItem is true and bisSource is "crafted"', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'crafted' });
    expect(inferCurrentSource(slot)).toBe('crafted');
  });

  it('returns "crafted" when hasItem is false (tier start default)', () => {
    const slot = createGearSlot({ hasItem: false });
    expect(inferCurrentSource(slot)).toBe('crafted');
  });
});

describe('getEffectiveCurrentSource', () => {
  it('returns currentSource when it is set', () => {
    const slot = createGearSlot({ currentSource: 'relic', hasItem: true, bisSource: 'raid' });
    expect(getEffectiveCurrentSource(slot)).toBe('relic');
  });

  it('infers source when currentSource is undefined', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'raid' });
    // currentSource is undefined, should infer to 'savage'
    expect(getEffectiveCurrentSource(slot)).toBe('savage');
  });

  it('infers "crafted" when hasItem is false and currentSource is undefined', () => {
    const slot = createGearSlot({ hasItem: false });
    expect(getEffectiveCurrentSource(slot)).toBe('crafted');
  });
});

describe('calculateAverageItemLevel', () => {
  it('returns 0 for empty gear array', () => {
    expect(calculateAverageItemLevel([], 'aac-heavyweight')).toBe(0);
  });

  it('uses itemLevel directly when hasItem is true', () => {
    const gear = [
      createGearSlot({ slot: 'weapon', itemLevel: 795, hasItem: true }),
      createGearSlot({ slot: 'body', itemLevel: 790, hasItem: true }),
      createGearSlot({ slot: 'legs', itemLevel: 790, hasItem: true }),
    ];
    // Average of 795, 790, 790 = 791.67 -> rounds to 792
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(792);
  });

  it('ignores itemLevel when hasItem is false (BiS target, not current gear)', () => {
    const gear = [
      createGearSlot({ slot: 'body', itemLevel: 790, hasItem: false, currentSource: 'crafted' }),
      createGearSlot({ slot: 'legs', itemLevel: 790, hasItem: false, currentSource: 'crafted' }),
    ];
    // Should use currentSource 'crafted' (770) instead of itemLevel (790)
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(770);
  });

  it('calculates iLv from currentSource when itemLevel is not available', () => {
    const gear = [
      createGearSlot({ slot: 'body', currentSource: 'savage' }), // 790
      createGearSlot({ slot: 'legs', currentSource: 'tome' }),   // 780
    ];
    // For aac-heavyweight: savage=790, tome=780 -> average = 785
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(785);
  });

  it('infers currentSource when missing and calculates iLv', () => {
    const gear = [
      createGearSlot({ slot: 'body', hasItem: true, bisSource: 'raid' }), // infers 'savage' -> 790
      createGearSlot({ slot: 'legs', hasItem: false }),                    // infers 'crafted' -> 770
    ];
    // Average of 790, 770 = 780
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(780);
  });

  it('treats "unknown" currentSource as crafted gear (baseline)', () => {
    const gear = [
      createGearSlot({ slot: 'body', currentSource: 'savage', itemLevel: 790, hasItem: true }),
      createGearSlot({ slot: 'legs', currentSource: 'unknown' }),
    ];
    // body=790, legs=770 (unknown → crafted) → average = 780
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(780);
  });

  it('prevents inflated averages when only few items are checked', () => {
    // Alexander's case: 1 tome piece checked, rest unconfigured
    const gear = [
      createGearSlot({ slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false }), // 780
      createGearSlot({ slot: 'legs', currentSource: 'unknown' }),    // 770 (crafted baseline)
      createGearSlot({ slot: 'head', currentSource: 'unknown' }),    // 770
      createGearSlot({ slot: 'hands', currentSource: 'unknown' }),   // 770
      createGearSlot({ slot: 'feet', currentSource: 'unknown' }),    // 770
    ];
    // Average of 780 + 4×770 = 3860 / 5 = 772
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(772);
  });

  it('handles weapon slot with higher iLv correctly', () => {
    const gear = [
      createGearSlot({ slot: 'weapon', currentSource: 'savage' }), // 795 (weapon)
      createGearSlot({ slot: 'body', currentSource: 'savage' }),   // 790 (armor)
    ];
    // Average of 795, 790 = 792.5 -> rounds to 793
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(793);
  });

  it('uses base tome iLv (not stored augmented itemLevel) when hasItem but not augmented', () => {
    // This tests the fix for the bug where tome gear showed augmented iLv even when not augmented
    // BiS import sets itemLevel to augmented value (790), but player only has base tome (780)
    const gear = [
      createGearSlot({
        slot: 'body',
        bisSource: 'tome',
        hasItem: true,
        isAugmented: false,
        itemLevel: 790, // This is the augmented iLv from BiS import - should be ignored
      }),
      createGearSlot({
        slot: 'legs',
        bisSource: 'tome',
        hasItem: true,
        isAugmented: false,
        itemLevel: 790, // This is the augmented iLv from BiS import - should be ignored
      }),
    ];
    // Should use base tome iLv (780) not stored itemLevel (790)
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(780);
  });

  it('uses stored itemLevel when tome gear IS augmented', () => {
    const gear = [
      createGearSlot({
        slot: 'body',
        bisSource: 'tome',
        hasItem: true,
        isAugmented: true,
        itemLevel: 790, // Augmented tome iLv - should be used
      }),
    ];
    // Should use stored itemLevel (790) since gear is augmented
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(790);
  });
});

describe('calculateTeamAverageItemLevel', () => {
  it('returns 0 for empty players array', () => {
    expect(calculateTeamAverageItemLevel([], 'aac-heavyweight')).toBe(0);
  });

  it('calculates team average across multiple players', () => {
    const players = [
      createPlayer({
        id: 'player1',
        gear: [
          createGearSlot({ slot: 'body', itemLevel: 790, hasItem: true }),
          createGearSlot({ slot: 'legs', itemLevel: 790, hasItem: true }),
        ],
      }),
      createPlayer({
        id: 'player2',
        gear: [
          createGearSlot({ slot: 'body', itemLevel: 770, hasItem: true }),
          createGearSlot({ slot: 'legs', itemLevel: 770, hasItem: true }),
        ],
      }),
    ];
    // Player 1: 790, Player 2: 770 -> Team average = 780
    expect(calculateTeamAverageItemLevel(players, 'aac-heavyweight')).toBe(780);
  });

  it('skips players with 0 average iLv', () => {
    const players = [
      createPlayer({
        id: 'player1',
        gear: [createGearSlot({ slot: 'body', itemLevel: 790, hasItem: true })],
      }),
      createPlayer({
        id: 'player2',
        gear: [], // Empty gear = 0 iLv, should be skipped
      }),
    ];
    // Only player1 counts
    expect(calculateTeamAverageItemLevel(players, 'aac-heavyweight')).toBe(790);
  });
});

describe('requiresAugmentation', () => {
  it('returns false for raid BiS (no augmentation ever needed)', () => {
    const slot = createGearSlot({ bisSource: 'raid', itemName: 'Savage Body' });
    expect(requiresAugmentation(slot)).toBe(false);
  });

  it('returns false for crafted BiS (no augmentation ever needed)', () => {
    const slot = createGearSlot({ bisSource: 'crafted', itemName: 'Crafted Body' });
    expect(requiresAugmentation(slot)).toBe(false);
  });

  it('returns true for tome BiS with "Aug." prefix item name', () => {
    const slot = createGearSlot({ bisSource: 'tome', itemName: 'Aug. Quetzalli Coat' });
    expect(requiresAugmentation(slot)).toBe(true);
  });

  it('returns true for tome BiS with "Augmented" prefix item name', () => {
    const slot = createGearSlot({ bisSource: 'tome', itemName: 'Augmented Quetzalli Coat' });
    expect(requiresAugmentation(slot)).toBe(true);
  });

  it('returns false for tome BiS with non-augmented item name (base tome is BiS)', () => {
    const slot = createGearSlot({ bisSource: 'tome', itemName: 'Quetzalli Coat' });
    expect(requiresAugmentation(slot)).toBe(false);
  });

  it('returns true for tome BiS with no item name (safe default)', () => {
    const slot = createGearSlot({ bisSource: 'tome' });
    expect(requiresAugmentation(slot)).toBe(true);
  });

  it('is case-insensitive for item name prefix', () => {
    const slot1 = createGearSlot({ bisSource: 'tome', itemName: 'aug. Quetzalli Coat' });
    const slot2 = createGearSlot({ bisSource: 'tome', itemName: 'AUG. Quetzalli Coat' });
    const slot3 = createGearSlot({ bisSource: 'tome', itemName: 'AUGMENTED Quetzalli Coat' });
    expect(requiresAugmentation(slot1)).toBe(true);
    expect(requiresAugmentation(slot2)).toBe(true);
    expect(requiresAugmentation(slot3)).toBe(true);
  });
});

describe('isSlotComplete', () => {
  it('returns false when hasItem is false', () => {
    const slot = createGearSlot({ hasItem: false, bisSource: 'raid' });
    expect(isSlotComplete(slot)).toBe(false);
  });

  it('returns true for raid BiS when hasItem is true', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'raid' });
    expect(isSlotComplete(slot)).toBe(true);
  });

  it('returns true for crafted BiS when hasItem is true', () => {
    const slot = createGearSlot({ hasItem: true, bisSource: 'crafted' });
    expect(isSlotComplete(slot)).toBe(true);
  });

  it('returns true for tome BiS when hasItem is true and base tome is BiS', () => {
    const slot = createGearSlot({
      hasItem: true,
      bisSource: 'tome',
      itemName: 'Quetzalli Coat', // No "Aug." prefix = base tome is BiS
      isAugmented: false,
    });
    expect(isSlotComplete(slot)).toBe(true);
  });

  it('returns false for tome BiS when hasItem is true but needs augmentation and not augmented', () => {
    const slot = createGearSlot({
      hasItem: true,
      bisSource: 'tome',
      itemName: 'Aug. Quetzalli Coat', // "Aug." prefix = needs augmentation
      isAugmented: false,
    });
    expect(isSlotComplete(slot)).toBe(false);
  });

  it('returns true for tome BiS when hasItem is true and needs augmentation and IS augmented', () => {
    const slot = createGearSlot({
      hasItem: true,
      bisSource: 'tome',
      itemName: 'Aug. Quetzalli Coat', // "Aug." prefix = needs augmentation
      isAugmented: true,
    });
    expect(isSlotComplete(slot)).toBe(true);
  });
});

describe('toGearState', () => {
  it('returns "missing" when hasItem is false', () => {
    expect(toGearState(false, false)).toBe('missing');
    expect(toGearState(false, true)).toBe('missing');
  });

  it('returns "have" when hasItem is true and not augmented', () => {
    expect(toGearState(true, false)).toBe('have');
  });

  it('returns "augmented" when hasItem is true and augmented', () => {
    expect(toGearState(true, true)).toBe('augmented');
  });
});

describe('fromGearState', () => {
  it('returns { hasItem: false, isAugmented: false } for "missing"', () => {
    expect(fromGearState('missing')).toEqual({ hasItem: false, isAugmented: false });
  });

  it('returns { hasItem: true, isAugmented: false } for "have"', () => {
    expect(fromGearState('have')).toEqual({ hasItem: true, isAugmented: false });
  });

  it('returns { hasItem: true, isAugmented: true } for "augmented"', () => {
    expect(fromGearState('augmented')).toEqual({ hasItem: true, isAugmented: true });
  });
});
