/**
 * useLootActions Hook
 *
 * Provides coordinated loot actions for React components.
 * Handles the cross-store coordination automatically.
 */

import { useCallback } from 'react';
import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useTierStore } from '../stores/tierStore';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import {
  logLootAndUpdateGear,
  deleteLootAndRevertGear,
  getPrioritySuggestionsForSlot,
  calculatePlayerLootStats,
  calculateEnhancedPriorityScore,
  type LogLootOptions,
  type PlayerLootStats,
} from '../utils/lootCoordination';
import { DEFAULT_SETTINGS } from '../utils/constants';
import type { LootLogEntryCreate, LootLogEntry, SnapshotPlayer } from '../types';

interface UseLootActionsReturn {
  /** Log loot with automatic gear/priority updates */
  logLoot: (data: LootLogEntryCreate, options?: LogLootOptions) => Promise<void>;

  /** Delete loot entry with optional gear reversion */
  deleteLoot: (entryId: number, entry: LootLogEntry, revertGear?: boolean) => Promise<void>;

  /** Get priority suggestions for a slot */
  getPrioritySuggestions: (slot: string) => Array<{
    player: SnapshotPlayer;
    score: number;
    reason: string;
  }>;

  /** Get loot stats for a player */
  getPlayerStats: (playerId: string) => PlayerLootStats;

  /** Calculate enhanced priority with loot history */
  getEnhancedPriority: (baseScore: number, playerId: string) => number;

  /** Loading state */
  isLoading: boolean;
}

export function useLootActions(): UseLootActionsReturn {
  const { currentGroup } = useStaticGroupStore();
  const { currentTier } = useTierStore();
  const { lootLog, currentWeek, isLoading } = useLootTrackingStore();

  const groupId = currentGroup?.id;
  const tierId = currentTier?.tierId;  // Fixed: use tierId (tier identifier) not id (database UUID)
  const players = currentTier?.players ?? [];
  // Use centralized default settings
  const settings = DEFAULT_SETTINGS;

  const logLoot = useCallback(
    async (data: LootLogEntryCreate, options?: LogLootOptions) => {
      if (!groupId || !tierId) {
        throw new Error('No group or tier selected');
      }
      await logLootAndUpdateGear(groupId, tierId, data, options);
    },
    [groupId, tierId]
  );

  const deleteLoot = useCallback(
    async (entryId: number, entry: LootLogEntry, revertGear?: boolean) => {
      if (!groupId || !tierId) {
        throw new Error('No group or tier selected');
      }
      await deleteLootAndRevertGear(groupId, tierId, entryId, entry, {
        revertGear,
      });
    },
    [groupId, tierId]
  );

  const getPrioritySuggestions = useCallback(
    (slot: string) => {
      return getPrioritySuggestionsForSlot(players, slot, settings);
    },
    [players, settings]
  );

  const getPlayerStats = useCallback(
    (playerId: string): PlayerLootStats => {
      return calculatePlayerLootStats(playerId, lootLog, currentWeek);
    },
    [lootLog, currentWeek]
  );

  const getEnhancedPriority = useCallback(
    (baseScore: number, playerId: string): number => {
      const stats = calculatePlayerLootStats(playerId, lootLog, currentWeek);

      // Calculate average drops across all players
      const playerDropCounts = players.map(
        (p) => lootLog.filter((e) => e.recipientPlayerId === p.id && e.method === 'drop').length
      );
      const averageDrops =
        playerDropCounts.length > 0
          ? playerDropCounts.reduce((sum, count) => sum + count, 0) / playerDropCounts.length
          : 0;

      return calculateEnhancedPriorityScore(baseScore, stats, averageDrops);
    },
    [players, lootLog, currentWeek]
  );

  return {
    logLoot,
    deleteLoot,
    getPrioritySuggestions,
    getPlayerStats,
    getEnhancedPriority,
    isLoading,
  };
}
