/**
 * Unit tests for iLv calculation and gear source inference functions
 */

import { describe, it, expect } from 'vitest';
import {
  inferCurrentSource,
  getEffectiveCurrentSource,
  calculateAverageItemLevel,
  calculateTeamAverageItemLevel,
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

  it('skips slots with "unknown" currentSource', () => {
    const gear = [
      createGearSlot({ slot: 'body', currentSource: 'savage', itemLevel: 790, hasItem: true }),
      createGearSlot({ slot: 'legs', currentSource: 'unknown' }),
    ];
    // Only body slot counts, so average = 790
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(790);
  });

  it('handles weapon slot with higher iLv correctly', () => {
    const gear = [
      createGearSlot({ slot: 'weapon', currentSource: 'savage' }), // 795 (weapon)
      createGearSlot({ slot: 'body', currentSource: 'savage' }),   // 790 (armor)
    ];
    // Average of 795, 790 = 792.5 -> rounds to 793
    expect(calculateAverageItemLevel(gear, 'aac-heavyweight')).toBe(793);
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
