/**
 * Loot Coordination Utilities
 *
 * Provides cross-store coordination for loot actions.
 * Ensures loot log entries, gear updates, and weapon priorities stay in sync.
 */

import { useLootTrackingStore } from '../stores/lootTrackingStore';
import { useTierStore } from '../stores/tierStore';
import { getPriorityForItem, getPriorityForRing } from './priority';
import type {
  LootLogEntry,
  LootLogEntryCreate,
  SnapshotPlayer,
  StaticSettings,
  GearSlot,
} from '../types';

// ==================== Types ====================

export interface LogLootOptions {
  /** Update player's gear hasItem when logging a drop */
  updateGear?: boolean;
  /** Update weapon priority when logging a weapon drop */
  updateWeaponPriority?: boolean;
}

export interface DeleteLootOptions {
  /** Revert player's gear hasItem when deleting a drop */
  revertGear?: boolean;
}

export interface PlayerLootStats {
  /** Total drops received across all weeks */
  totalDrops: number;
  /** Drops received in the current week */
  dropsThisWeek: number;
  /** Weeks since last drop (0 if dropped this week) */
  weeksSinceLastDrop: number;
}

export interface PrioritySuggestion {
  player: SnapshotPlayer;
  score: number;
  reason: string;
}

// ==================== Coordination Functions ====================

/**
 * Log loot with automatic gear and weapon priority updates
 *
 * Coordinates multiple store actions:
 * 1. Creates the loot log entry
 * 2. If updateGear=true and method='drop': marks gear slot as acquired
 * 3. If updateWeaponPriority=true and slot='weapon': marks weapon as received
 */
export async function logLootAndUpdateGear(
  groupId: string,
  tierId: string,
  data: LootLogEntryCreate,
  options: LogLootOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();
  const tierStore = useTierStore.getState();

  // 1. Create the loot entry
  await lootStore.createLootEntry(groupId, tierId, data);

  // 2. Update gear if requested and method is 'drop'
  if (options.updateGear && data.method === 'drop') {
    const player = tierStore.currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (player) {
      const slot = data.itemSlot as GearSlot;
      const updatedGear = player.gear.map((g) =>
        g.slot === slot ? { ...g, hasItem: true } : g
      );
      await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
        gear: updatedGear,
      });
    }
  }

  // 3. Update weapon priority if it's a weapon drop
  if (options.updateWeaponPriority && data.itemSlot === 'weapon' && data.method === 'drop') {
    const player = tierStore.currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (player?.weaponPriorities) {
      // Mark the player's main job weapon as received
      const updatedPriorities = player.weaponPriorities.map((wp) =>
        wp.job === player.job
          ? { ...wp, received: true, receivedDate: new Date().toISOString() }
          : wp
      );
      await tierStore.updateWeaponPriorities(
        groupId,
        tierId,
        data.recipientPlayerId,
        updatedPriorities
      );
    }
  }
}

/**
 * Delete loot entry with optional gear reversion
 *
 * Coordinates multiple store actions:
 * 1. Deletes the loot log entry
 * 2. If revertGear=true and was a drop: unchecks gear slot
 */
export async function deleteLootAndRevertGear(
  groupId: string,
  tierId: string,
  entryId: number,
  entry: LootLogEntry,
  options: DeleteLootOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();
  const tierStore = useTierStore.getState();

  // 1. Delete the entry
  await lootStore.deleteLootEntry(groupId, tierId, entryId);

  // 2. Revert gear if requested and was a drop
  if (options.revertGear && entry.method === 'drop') {
    const player = tierStore.currentTier?.players?.find(
      (p) => p.id === entry.recipientPlayerId
    );

    if (player) {
      const slot = entry.itemSlot as GearSlot;
      const updatedGear = player.gear.map((g) =>
        g.slot === slot ? { ...g, hasItem: false } : g
      );
      await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
        gear: updatedGear,
      });
    }
  }
}

// ==================== Priority Suggestion Functions ====================

/**
 * Get priority suggestions for a slot
 * Returns top 3 players who need this slot, sorted by priority
 */
export function getPrioritySuggestionsForSlot(
  players: SnapshotPlayer[],
  slot: string,
  settings: StaticSettings | { lootPriority: string[] }
): PrioritySuggestion[] {
  // Normalize settings to full StaticSettings
  const normalizedSettings: StaticSettings = {
    displayOrder: ['tank', 'healer', 'melee', 'ranged', 'caster'],
    lootPriority: settings.lootPriority,
    sortPreset: 'standard',
    groupView: false,
    timezone: 'UTC',
    autoSync: false,
    syncFrequency: 'weekly',
  };

  const entries =
    slot === 'ring' || slot === 'ring1' || slot === 'ring2'
      ? getPriorityForRing(players, normalizedSettings)
      : getPriorityForItem(players, slot as GearSlot, normalizedSettings);

  return entries.slice(0, 3).map((entry) => ({
    player: entry.player,
    score: entry.score,
    reason: `${entry.player.role} priority, needs ${slot}`,
  }));
}

// ==================== Loot Statistics Functions ====================

/**
 * Calculate loot stats for a player based on loot history
 */
export function calculatePlayerLootStats(
  playerId: string,
  lootLog: LootLogEntry[],
  currentWeek: number
): PlayerLootStats {
  // Filter to drops only (not book/tome acquisitions)
  const playerDrops = lootLog.filter(
    (e) => e.recipientPlayerId === playerId && e.method === 'drop'
  );

  const dropsThisWeek = playerDrops.filter(
    (e) => e.weekNumber === currentWeek
  ).length;

  // Calculate weeks since last drop
  const lastDropWeek =
    playerDrops.length > 0
      ? Math.max(...playerDrops.map((e) => e.weekNumber))
      : 0;
  const weeksSinceLastDrop =
    lastDropWeek > 0 ? currentWeek - lastDropWeek : currentWeek;

  return {
    totalDrops: playerDrops.length,
    dropsThisWeek,
    weeksSinceLastDrop,
  };
}

/**
 * Calculate enhanced priority score with loot history adjustments
 *
 * Modifies base priority score with:
 * - Drought bonus: +10 per week without drops (max +50)
 * - Balance penalty: -15 per drop above average (max -45)
 */
export function calculateEnhancedPriorityScore(
  baseScore: number,
  stats: PlayerLootStats,
  averageDrops: number
): number {
  // Drought bonus: reward players who haven't received loot recently
  const droughtBonus = Math.min(stats.weeksSinceLastDrop * 10, 50);

  // Balance penalty: penalize players who are ahead of the curve
  const excessDrops = stats.totalDrops - averageDrops;
  const balancePenalty = excessDrops > 0 ? Math.min(excessDrops * 15, 45) : 0;

  return Math.round(baseScore + droughtBonus - balancePenalty);
}

/**
 * Calculate average drops across all players
 * Used for balance penalty calculation
 */
export function calculateAverageDrops(
  playerIds: string[],
  lootLog: LootLogEntry[]
): number {
  if (playerIds.length === 0) return 0;

  const totalDrops = playerIds.reduce((sum, playerId) => {
    const playerDrops = lootLog.filter(
      (e) => e.recipientPlayerId === playerId && e.method === 'drop'
    ).length;
    return sum + playerDrops;
  }, 0);

  return totalDrops / playerIds.length;
}

/**
 * Get enhanced priority entries with loot history adjustments
 * Combines base priority with drought bonus and balance penalty
 */
export function getEnhancedPriorityForSlot(
  players: SnapshotPlayer[],
  slot: string,
  settings: StaticSettings,
  lootLog: LootLogEntry[],
  currentWeek: number
): Array<{
  player: SnapshotPlayer;
  baseScore: number;
  enhancedScore: number;
  stats: PlayerLootStats;
}> {
  const entries =
    slot === 'ring' || slot === 'ring1' || slot === 'ring2'
      ? getPriorityForRing(players, settings)
      : getPriorityForItem(players, slot as GearSlot, settings);

  const playerIds = players.map((p) => p.id);
  const averageDrops = calculateAverageDrops(playerIds, lootLog);

  return entries.map((entry) => {
    const stats = calculatePlayerLootStats(entry.player.id, lootLog, currentWeek);
    const enhancedScore = calculateEnhancedPriorityScore(
      entry.score,
      stats,
      averageDrops
    );

    return {
      player: entry.player,
      baseScore: entry.score,
      enhancedScore,
      stats,
    };
  });
}
