/**
 * Unit tests for loot coordination utilities
 *
 * Tests the pure utility functions for loot statistics and priority calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePlayerLootStats,
  calculateEnhancedPriorityScore,
  calculateAverageDrops,
  type PlayerLootStats,
} from './lootCoordination';
import type { LootLogEntry } from '../types';

// Helper to create a minimal loot log entry
function createLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 'tier-1',
    weekNumber: 1,
    floor: 'M5S',
    itemSlot: 'body',
    recipientPlayerId: 'player-1',
    recipientPlayerName: 'Test Player',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-09T00:00:00Z',
    createdByUserId: 'user-1',
    createdByUsername: 'TestUser',
    ...overrides,
  };
}

describe('calculatePlayerLootStats', () => {
  describe('totalDrops', () => {
    it('counts drops for the specified player', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 1 }),
        createLootEntry({ id: 2, recipientPlayerId: 'player-1', weekNumber: 2 }),
        createLootEntry({ id: 3, recipientPlayerId: 'player-2', weekNumber: 1 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 3);
      expect(stats.totalDrops).toBe(2);
    });

    it('excludes non-drop methods (book, tome)', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', method: 'drop' }),
        createLootEntry({ id: 2, recipientPlayerId: 'player-1', method: 'book' }),
        createLootEntry({ id: 3, recipientPlayerId: 'player-1', method: 'tome' }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 1);
      expect(stats.totalDrops).toBe(1);
    });

    it('returns 0 for player with no drops', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-2' }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 1);
      expect(stats.totalDrops).toBe(0);
    });

    it('applies positive loot adjustment', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1' }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 1, 2);
      expect(stats.totalDrops).toBe(3); // 1 drop + 2 adjustment
    });

    it('applies negative loot adjustment', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 1 }),
        createLootEntry({ id: 2, recipientPlayerId: 'player-1', weekNumber: 2 }),
        createLootEntry({ id: 3, recipientPlayerId: 'player-1', weekNumber: 3 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 3, -2);
      expect(stats.totalDrops).toBe(1); // 3 drops - 2 adjustment
    });
  });

  describe('dropsThisWeek', () => {
    it('counts only drops from current week', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 1 }),
        createLootEntry({ id: 2, recipientPlayerId: 'player-1', weekNumber: 2 }),
        createLootEntry({ id: 3, recipientPlayerId: 'player-1', weekNumber: 3 }),
        createLootEntry({ id: 4, recipientPlayerId: 'player-1', weekNumber: 3 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 3);
      expect(stats.dropsThisWeek).toBe(2);
    });

    it('returns 0 if no drops this week', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 1 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 3);
      expect(stats.dropsThisWeek).toBe(0);
    });
  });

  describe('weeksSinceLastDrop', () => {
    it('calculates weeks since last drop', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 1 }),
        createLootEntry({ id: 2, recipientPlayerId: 'player-1', weekNumber: 3 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 5);
      expect(stats.weeksSinceLastDrop).toBe(2); // Week 5 - Week 3 = 2
    });

    it('returns 0 if dropped this week', () => {
      const lootLog: LootLogEntry[] = [
        createLootEntry({ id: 1, recipientPlayerId: 'player-1', weekNumber: 5 }),
      ];

      const stats = calculatePlayerLootStats('player-1', lootLog, 5);
      expect(stats.weeksSinceLastDrop).toBe(0);
    });

    it('returns currentWeek if no drops ever', () => {
      const stats = calculatePlayerLootStats('player-1', [], 5);
      expect(stats.weeksSinceLastDrop).toBe(5);
    });
  });
});

describe('calculateEnhancedPriorityScore', () => {
  describe('drought bonus', () => {
    it('adds 10 points per week without drops', () => {
      const stats: PlayerLootStats = {
        totalDrops: 0,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 3,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 0);
      expect(enhanced).toBe(130); // 100 + (3 * 10)
    });

    it('caps drought bonus at 50', () => {
      const stats: PlayerLootStats = {
        totalDrops: 0,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 10,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 0);
      expect(enhanced).toBe(150); // 100 + 50 (capped)
    });

    it('applies no bonus if dropped this week', () => {
      const stats: PlayerLootStats = {
        totalDrops: 1,
        dropsThisWeek: 1,
        weeksSinceLastDrop: 0,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 1);
      expect(enhanced).toBe(100); // No drought bonus, no balance penalty
    });
  });

  describe('balance penalty', () => {
    it('subtracts 15 points per drop above average', () => {
      const stats: PlayerLootStats = {
        totalDrops: 5,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 1,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 3);
      expect(enhanced).toBe(100 + 10 - 30); // +10 drought, -30 for 2 drops above avg
    });

    it('caps balance penalty at 45', () => {
      const stats: PlayerLootStats = {
        totalDrops: 10,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 0,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 1);
      expect(enhanced).toBe(55); // 100 - 45 (capped)
    });

    it('applies no penalty if below or at average', () => {
      const stats: PlayerLootStats = {
        totalDrops: 2,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 0,
      };

      const enhanced = calculateEnhancedPriorityScore(100, stats, 3);
      expect(enhanced).toBe(100); // No penalty
    });
  });

  describe('combined effects', () => {
    it('applies both drought bonus and balance penalty', () => {
      const stats: PlayerLootStats = {
        totalDrops: 5,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 4,
      };

      // Player has 5 drops vs 2 average = 3 above
      // Drought: 4 weeks = +40
      // Penalty: 3 above = -45
      const enhanced = calculateEnhancedPriorityScore(100, stats, 2);
      expect(enhanced).toBe(95); // 100 + 40 - 45
    });

    it('rounds the final score', () => {
      const stats: PlayerLootStats = {
        totalDrops: 0,
        dropsThisWeek: 0,
        weeksSinceLastDrop: 1,
      };

      const enhanced = calculateEnhancedPriorityScore(99.7, stats, 0);
      expect(enhanced).toBe(110); // 99.7 + 10 = 109.7, rounds to 110
    });
  });
});

describe('calculateAverageDrops', () => {
  it('calculates average drops across players', () => {
    const lootLog: LootLogEntry[] = [
      createLootEntry({ id: 1, recipientPlayerId: 'player-1' }),
      createLootEntry({ id: 2, recipientPlayerId: 'player-1' }),
      createLootEntry({ id: 3, recipientPlayerId: 'player-2' }),
      createLootEntry({ id: 4, recipientPlayerId: 'player-2' }),
      createLootEntry({ id: 5, recipientPlayerId: 'player-2' }),
      createLootEntry({ id: 6, recipientPlayerId: 'player-2' }),
    ];

    const average = calculateAverageDrops(['player-1', 'player-2'], lootLog);
    expect(average).toBe(3); // (2 + 4) / 2
  });

  it('returns 0 for empty player list', () => {
    const lootLog: LootLogEntry[] = [
      createLootEntry({ id: 1, recipientPlayerId: 'player-1' }),
    ];

    const average = calculateAverageDrops([], lootLog);
    expect(average).toBe(0);
  });

  it('excludes non-drop methods', () => {
    const lootLog: LootLogEntry[] = [
      createLootEntry({ id: 1, recipientPlayerId: 'player-1', method: 'drop' }),
      createLootEntry({ id: 2, recipientPlayerId: 'player-1', method: 'book' }),
      createLootEntry({ id: 3, recipientPlayerId: 'player-2', method: 'drop' }),
      createLootEntry({ id: 4, recipientPlayerId: 'player-2', method: 'tome' }),
    ];

    const average = calculateAverageDrops(['player-1', 'player-2'], lootLog);
    expect(average).toBe(1); // (1 + 1) / 2
  });

  it('handles players with no drops', () => {
    const lootLog: LootLogEntry[] = [
      createLootEntry({ id: 1, recipientPlayerId: 'player-1' }),
      createLootEntry({ id: 2, recipientPlayerId: 'player-1' }),
    ];

    const average = calculateAverageDrops(['player-1', 'player-2'], lootLog);
    expect(average).toBe(1); // (2 + 0) / 2
  });

  it('ignores drops from players not in the list', () => {
    const lootLog: LootLogEntry[] = [
      createLootEntry({ id: 1, recipientPlayerId: 'player-1' }),
      createLootEntry({ id: 2, recipientPlayerId: 'player-2' }),
      createLootEntry({ id: 3, recipientPlayerId: 'player-3' }),
    ];

    const average = calculateAverageDrops(['player-1', 'player-2'], lootLog);
    expect(average).toBe(1); // (1 + 1) / 2, ignores player-3
  });
});
