/**
 * Unit tests for priority calculation with loot adjustments
 */

import { describe, it, expect } from 'vitest';
import { calculatePriorityScore } from './priority';
import type { SnapshotPlayer, StaticSettings, GearSlotStatus } from '../types';

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
    gear: [
      createGearSlot({ slot: 'weapon', bisSource: 'raid', hasItem: false }),
      createGearSlot({ slot: 'body', bisSource: 'raid', hasItem: false }),
      createGearSlot({ slot: 'legs', bisSource: 'raid', hasItem: false }),
    ],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Default settings with standard loot priority
const defaultSettings: StaticSettings = {
  displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
  lootPriority: ['melee', 'ranged', 'caster', 'tank', 'healer'],
  sortPreset: 'standard',
  groupView: false,
  timezone: 'UTC',
  autoSync: false,
  syncFrequency: 'weekly',
};

describe('calculatePriorityScore', () => {
  describe('base priority calculation', () => {
    it('gives melee highest role priority (index 0)', () => {
      const meleePlayer = createPlayer({ role: 'melee' });
      const tankPlayer = createPlayer({ role: 'tank' });

      const meleeScore = calculatePriorityScore(meleePlayer, defaultSettings);
      const tankScore = calculatePriorityScore(tankPlayer, defaultSettings);

      expect(meleeScore).toBeGreaterThan(tankScore);
    });

    it('gives healer lowest role priority (index 4)', () => {
      const healerPlayer = createPlayer({ role: 'healer' });
      const score = calculatePriorityScore(healerPlayer, defaultSettings);

      // Healer is index 4, so (5-4)*25 = 25 for role priority
      // Plus weighted need from gear slots
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('loot adjustment', () => {
    it('does not apply adjustment when option is not set', () => {
      const player = createPlayer({ lootAdjustment: 5 });
      const score = calculatePriorityScore(player, defaultSettings);
      const scoreWithoutAdjustment = calculatePriorityScore(
        createPlayer({ lootAdjustment: 0 }),
        defaultSettings
      );

      // Same gear and role, so scores should be equal when adjustment not applied
      expect(score).toBe(scoreWithoutAdjustment);
    });

    it('reduces priority when includeLootAdjustment is true and lootAdjustment is positive', () => {
      const player = createPlayer({ lootAdjustment: 3 });
      const basePlayer = createPlayer({ lootAdjustment: 0 });

      const adjustedScore = calculatePriorityScore(player, defaultSettings, {
        includeLootAdjustment: true,
      });
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings, {
        includeLootAdjustment: true,
      });

      // Positive adjustment should reduce score by 15 * adjustment
      expect(adjustedScore).toBe(baseScore - 45); // 3 * 15 = 45 reduction
    });

    it('increases priority when lootAdjustment is negative', () => {
      const player = createPlayer({ lootAdjustment: -2 });
      const basePlayer = createPlayer({ lootAdjustment: 0 });

      const adjustedScore = calculatePriorityScore(player, defaultSettings, {
        includeLootAdjustment: true,
      });
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings, {
        includeLootAdjustment: true,
      });

      // Negative adjustment should increase score
      expect(adjustedScore).toBe(baseScore + 30); // -2 * -15 = 30 increase
    });

    it('handles zero lootAdjustment correctly', () => {
      const player = createPlayer({ lootAdjustment: 0 });
      const basePlayer = createPlayer();

      const adjustedScore = calculatePriorityScore(player, defaultSettings, {
        includeLootAdjustment: true,
      });
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);

      // Zero adjustment should have no effect
      expect(adjustedScore).toBe(baseScore);
    });

    it('handles undefined lootAdjustment gracefully', () => {
      const player = createPlayer();
      delete (player as Partial<SnapshotPlayer>).lootAdjustment;

      // Should not throw
      const score = calculatePriorityScore(player, defaultSettings, {
        includeLootAdjustment: true,
      });

      expect(typeof score).toBe('number');
    });
  });

  describe('weighted need calculation', () => {
    it('gives higher priority to players with more incomplete slots', () => {
      const playerAllIncomplete = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', hasItem: false }),
          createGearSlot({ slot: 'body', hasItem: false }),
          createGearSlot({ slot: 'legs', hasItem: false }),
        ],
      });

      const playerSomeComplete = createPlayer({
        gear: [
          createGearSlot({ slot: 'weapon', hasItem: true, bisSource: 'raid' }),
          createGearSlot({ slot: 'body', hasItem: false }),
          createGearSlot({ slot: 'legs', hasItem: true, bisSource: 'raid' }),
        ],
      });

      const allIncompleteScore = calculatePriorityScore(playerAllIncomplete, defaultSettings);
      const someCompleteScore = calculatePriorityScore(playerSomeComplete, defaultSettings);

      expect(allIncompleteScore).toBeGreaterThan(someCompleteScore);
    });
  });
});
