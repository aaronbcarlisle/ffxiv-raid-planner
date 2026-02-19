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
    it('does not apply adjustment when useLootAdjustments is disabled', () => {
      const settingsWithDisabledAdjustments: StaticSettings = {
        ...defaultSettings,
        prioritySettings: {
          mode: 'role-based',
          roleBasedConfig: { roleOrder: ['melee', 'ranged', 'caster', 'tank', 'healer'] },
          advancedOptions: {
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
            useLootAdjustments: false, // Disabled
          },
        },
      };

      const player = createPlayer({ lootAdjustment: 5 });
      const score = calculatePriorityScore(player, settingsWithDisabledAdjustments);
      const scoreWithoutAdjustment = calculatePriorityScore(
        createPlayer({ lootAdjustment: 0 }),
        settingsWithDisabledAdjustments
      );

      // Same gear and role, so scores should be equal when adjustment disabled
      expect(score).toBe(scoreWithoutAdjustment);
    });

    it('increases priority when lootAdjustment is positive (player needs to catch up)', () => {
      const player = createPlayer({ lootAdjustment: 3 });
      const basePlayer = createPlayer({ lootAdjustment: 0 });

      const adjustedScore = calculatePriorityScore(player, defaultSettings);
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);

      // Positive adjustment should increase score by 15 * adjustment
      expect(adjustedScore).toBe(baseScore + 45); // 3 * 15 = 45 boost
    });

    it('decreases priority when lootAdjustment is negative (player received enough)', () => {
      const player = createPlayer({ lootAdjustment: -2 });
      const basePlayer = createPlayer({ lootAdjustment: 0 });

      const adjustedScore = calculatePriorityScore(player, defaultSettings);
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);

      // Negative adjustment should decrease score
      expect(adjustedScore).toBe(baseScore - 30); // -2 * 15 = -30
    });

    it('handles zero lootAdjustment correctly', () => {
      const player = createPlayer({ lootAdjustment: 0 });
      const basePlayer = createPlayer();

      const adjustedScore = calculatePriorityScore(player, defaultSettings);
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);

      // Zero adjustment should have no effect
      expect(adjustedScore).toBe(baseScore);
    });

    it('handles undefined lootAdjustment gracefully', () => {
      const player = createPlayer();
      delete (player as Partial<SnapshotPlayer>).lootAdjustment;

      // Should not throw
      const score = calculatePriorityScore(player, defaultSettings);

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

  describe('priority modes', () => {
    it('returns 0 for all players when priorityMode is disabled', () => {
      const meleePlayer = createPlayer({ role: 'melee' });
      const tankPlayer = createPlayer({ role: 'tank' });
      const healerPlayer = createPlayer({ role: 'healer' });

      const disabledSettings: StaticSettings = {
        ...defaultSettings,
        priorityMode: 'disabled',
      };

      expect(calculatePriorityScore(meleePlayer, disabledSettings)).toBe(0);
      expect(calculatePriorityScore(tankPlayer, disabledSettings)).toBe(0);
      expect(calculatePriorityScore(healerPlayer, disabledSettings)).toBe(0);
    });

    it('calculates normal priority in automatic mode', () => {
      const player = createPlayer({ role: 'melee' });
      const automaticSettings: StaticSettings = {
        ...defaultSettings,
        priorityMode: 'automatic',
      };

      const score = calculatePriorityScore(player, automaticSettings);
      expect(score).toBeGreaterThan(0);
    });

    it('calculates normal priority in manual mode', () => {
      const player = createPlayer({ role: 'melee' });
      const manualSettings: StaticSettings = {
        ...defaultSettings,
        priorityMode: 'manual',
      };

      const score = calculatePriorityScore(player, manualSettings);
      expect(score).toBeGreaterThan(0);
    });

    it('ignores loot adjustment in disabled mode', () => {
      const player = createPlayer({ role: 'melee', lootAdjustment: 5 });
      const disabledSettings: StaticSettings = {
        ...defaultSettings,
        priorityMode: 'disabled',
      };

      // In disabled mode, all players return 0 regardless of adjustments
      const score = calculatePriorityScore(player, disabledSettings);
      expect(score).toBe(0);
    });
  });

  describe('job modifiers', () => {
    it('applies positive job modifier correctly', () => {
      const player = createPlayer({ job: 'PCT', role: 'caster' });
      const baseSettings = defaultSettings;
      const modifiedSettings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { PCT: 20 },
      };

      const baseScore = calculatePriorityScore(player, baseSettings);
      const modifiedScore = calculatePriorityScore(player, modifiedSettings);

      expect(modifiedScore).toBe(baseScore + 20);
    });

    it('applies negative job modifier correctly', () => {
      const player = createPlayer({ job: 'WAR', role: 'tank' });
      const baseSettings = defaultSettings;
      const modifiedSettings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { WAR: -15 },
      };

      const baseScore = calculatePriorityScore(player, baseSettings);
      const modifiedScore = calculatePriorityScore(player, modifiedSettings);

      expect(modifiedScore).toBe(baseScore - 15);
    });

    it('does not apply modifier to unrelated jobs', () => {
      const drgPlayer = createPlayer({ job: 'DRG', role: 'melee' });
      const modifiedSettings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { PCT: 20, WAR: -10 },
      };

      const baseScore = calculatePriorityScore(drgPlayer, defaultSettings);
      const modifiedScore = calculatePriorityScore(drgPlayer, modifiedSettings);

      expect(modifiedScore).toBe(baseScore);
    });

    it('handles undefined jobPriorityModifiers gracefully', () => {
      const player = createPlayer({ job: 'DRG' });
      const settingsWithoutModifiers: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: undefined,
      };

      // Should not throw and should return valid score
      const score = calculatePriorityScore(player, settingsWithoutModifiers);
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('handles explicit zero modifier correctly', () => {
      const player = createPlayer({ job: 'PCT', role: 'caster' });
      const zeroModifierSettings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { PCT: 0 },
      };

      const baseScore = calculatePriorityScore(player, defaultSettings);
      const zeroModifiedScore = calculatePriorityScore(player, zeroModifierSettings);

      expect(zeroModifiedScore).toBe(baseScore);
    });

    it('applies job modifier case-insensitively (lowercase player.job)', () => {
      // Backend normalizes job modifiers to uppercase (e.g., "DRG")
      // But player.job from database may be lowercase (e.g., "drg")
      const player = createPlayer({ job: 'drg', role: 'melee' }); // lowercase
      const modifiedSettings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { DRG: 25 }, // uppercase (as stored by backend)
      };

      const baseScore = calculatePriorityScore(
        createPlayer({ job: 'drg', role: 'melee' }),
        defaultSettings
      );
      const modifiedScore = calculatePriorityScore(player, modifiedSettings);

      // Modifier should be applied despite case mismatch
      expect(modifiedScore).toBe(baseScore + 25);
    });
  });

  describe('player modifiers', () => {
    it('applies positive player modifier correctly', () => {
      const basePlayer = createPlayer({ priorityModifier: 0 });
      const modifiedPlayer = createPlayer({ priorityModifier: 30 });

      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);
      const modifiedScore = calculatePriorityScore(modifiedPlayer, defaultSettings);

      expect(modifiedScore).toBe(baseScore + 30);
    });

    it('applies negative player modifier correctly', () => {
      const basePlayer = createPlayer({ priorityModifier: 0 });
      const modifiedPlayer = createPlayer({ priorityModifier: -25 });

      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);
      const modifiedScore = calculatePriorityScore(modifiedPlayer, defaultSettings);

      expect(modifiedScore).toBe(baseScore - 25);
    });

    it('handles undefined priorityModifier gracefully', () => {
      const player = createPlayer();
      delete (player as Partial<SnapshotPlayer>).priorityModifier;

      // Should not throw and should return valid score
      const score = calculatePriorityScore(player, defaultSettings);
      expect(typeof score).toBe('number');
    });

    it('handles explicit zero priorityModifier correctly', () => {
      const zeroModifierPlayer = createPlayer({ priorityModifier: 0 });
      const undefinedModifierPlayer = createPlayer();
      delete (undefinedModifierPlayer as Partial<SnapshotPlayer>).priorityModifier;

      const zeroScore = calculatePriorityScore(zeroModifierPlayer, defaultSettings);
      const undefinedScore = calculatePriorityScore(undefinedModifierPlayer, defaultSettings);

      // Both should produce same result
      expect(zeroScore).toBe(undefinedScore);
    });
  });

  describe('combined modifiers', () => {
    it('combines job and player modifiers correctly', () => {
      const player = createPlayer({
        job: 'PCT',
        role: 'caster',
        priorityModifier: 15
      });
      const settings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { PCT: 20 },
      };

      const basePlayer = createPlayer({ job: 'PCT', role: 'caster', priorityModifier: 0 });
      const baseScore = calculatePriorityScore(basePlayer, defaultSettings);
      const combinedScore = calculatePriorityScore(player, settings);

      // Combined score should be base + job modifier + player modifier
      expect(combinedScore).toBe(baseScore + 20 + 15);
    });

    it('combines all factors correctly', () => {
      const player = createPlayer({
        job: 'PCT',
        role: 'caster',
        priorityModifier: 10,
        lootAdjustment: 2, // 2 * 15 = +30 boost (player needs to catch up)
      });
      const settings: StaticSettings = {
        ...defaultSettings,
        jobPriorityModifiers: { PCT: 15 },
      };

      // Calculate expected: role + gear need + job mod + player mod + loot adj boost
      const basePlayer = createPlayer({ job: 'PCT', role: 'caster' });
      const baseScoreWithoutModifiers = calculatePriorityScore(basePlayer, defaultSettings);

      const scoreWithModifiers = calculatePriorityScore(player, settings);

      expect(scoreWithModifiers).toBe(baseScoreWithoutModifiers + 15 + 10 + 30);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for job-based mode when player job is not in config', () => {
      const player = createPlayer({ job: 'DRG', role: 'melee' });
      const settings: StaticSettings = {
        ...defaultSettings,
        prioritySettings: {
          mode: 'job-based',
          jobBasedConfig: {
            groups: [{ id: 'tanks', name: 'Tanks', sortOrder: 0, basePriority: 100 }],
            jobs: [{ job: 'WAR', groupId: 'tanks', sortOrder: 0, priorityOffset: 0 }],
            showAdvancedControls: false,
          },
          advancedOptions: {
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
          },
        },
      };

      const score = calculatePriorityScore(player, settings);
      expect(score).toBe(0);
    });

    it('returns 0 for player-based mode when player is not in config', () => {
      const player = createPlayer({ id: 'unknown-player', role: 'melee' });
      const settings: StaticSettings = {
        ...defaultSettings,
        prioritySettings: {
          mode: 'player-based',
          playerBasedConfig: {
            groups: [{ id: 'default', name: 'All', sortOrder: 0, basePriority: 100 }],
            players: [{ playerId: 'other-player', groupId: 'default', sortOrder: 0, priorityOffset: 0 }],
            showAdvancedControls: false,
          },
          advancedOptions: {
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
          },
        },
      };

      const score = calculatePriorityScore(player, settings);
      expect(score).toBe(0);
    });

    it('returns 0 for manual-planning mode', () => {
      const player = createPlayer({ role: 'melee' });
      const settings: StaticSettings = {
        ...defaultSettings,
        prioritySettings: {
          mode: 'manual-planning',
          advancedOptions: {
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
          },
        },
      };

      const score = calculatePriorityScore(player, settings);
      expect(score).toBe(0);
    });

    it('handles unknown role gracefully in role-based mode', () => {
      const player = createPlayer({ role: 'unknown' as any });
      const score = calculatePriorityScore(player, defaultSettings);
      // Unknown role gets roleIndex -1, which is handled as 0 priority for role component
      expect(typeof score).toBe('number');
    });

    it('returns 0 for job-based mode when config is missing', () => {
      const player = createPlayer({ role: 'melee' });
      const settings: StaticSettings = {
        ...defaultSettings,
        prioritySettings: {
          mode: 'job-based',
          // jobBasedConfig intentionally missing
          advancedOptions: {
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
          },
        },
      };

      const score = calculatePriorityScore(player, settings);
      expect(score).toBe(0);
    });

    it('handles empty gear array without crashing', () => {
      const player = createPlayer({ gear: [] });
      const score = calculatePriorityScore(player, defaultSettings);
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
