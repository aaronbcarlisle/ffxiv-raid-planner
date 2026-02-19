/**
 * Priority Preset Configurations
 *
 * Defines the default values for each priority preset.
 */

import type { AdvancedPriorityOptions, PriorityPreset } from '../../types';

export const PRESET_CONFIGS: Record<
  Exclude<PriorityPreset, 'custom'>,
  Omit<AdvancedPriorityOptions, 'showPriorityScores' | 'preset'>
> = {
  balanced: {
    enableEnhancedFairness: true,
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
  'strict-fairness': {
    enableEnhancedFairness: true,
    droughtBonusMultiplier: 15,
    droughtBonusCapWeeks: 99, // Effectively no cap
    balancePenaltyMultiplier: 20,
    balancePenaltyCapDrops: 99, // Effectively no cap
    useMultipliers: true,
    rolePriorityMultiplier: 10, // Reduced - fairness matters more than role
    gearNeededMultiplier: 5,
    lootReceivedPenalty: 25,
    useWeightedNeed: true,
    useLootAdjustments: true,
  },
  'gear-need-focus': {
    enableEnhancedFairness: false,
    droughtBonusMultiplier: 10,
    droughtBonusCapWeeks: 5,
    balancePenaltyMultiplier: 15,
    balancePenaltyCapDrops: 3,
    useMultipliers: true,
    rolePriorityMultiplier: 10, // Reduced
    gearNeededMultiplier: 20, // Increased - missing gear = higher priority
    lootReceivedPenalty: 10,
    useWeightedNeed: true,
    useLootAdjustments: true,
  },
};
