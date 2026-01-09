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
  /** Specific weapon job to mark as received (defaults to player's main job) */
  weaponJob?: string;
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
 * 2. If updateGear=true and method='drop' or 'book': marks gear slot as acquired
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

  // 2. Update gear if requested and method is 'drop' or 'book'
  if (options.updateGear && (data.method === 'drop' || data.method === 'book')) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (player) {
      let slot = data.itemSlot as GearSlot;

      // Special handling for ring drops: find which ring slot needs raid BiS
      // Floor 1 drops a generic "ring" (stored as ring1), but we need to mark
      // the correct ring slot based on the player's BiS configuration
      if (slot === 'ring1' || slot === 'ring2') {
        const ring1 = player.gear.find((g) => g.slot === 'ring1');
        const ring2 = player.gear.find((g) => g.slot === 'ring2');
        const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
        const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;

        // Prefer ring1 if both need it, otherwise use the one that needs raid
        if (needsRing1) {
          slot = 'ring1';
        } else if (needsRing2) {
          slot = 'ring2';
        }
        // If neither needs raid, fall back to ring1 (original behavior)
      }

      const updatedGear = player.gear.map((g) =>
        g.slot === slot ? { ...g, hasItem: true } : g
      );
      await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
        gear: updatedGear,
      });
    }
  }

  // 3. Update weapon priority if it's a weapon drop or book
  if (options.updateWeaponPriority && data.itemSlot === 'weapon' && (data.method === 'drop' || data.method === 'book')) {
    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (player?.weaponPriorities) {
      // Use the passed weaponJob, fall back to data.weaponJob, then player's main job
      const targetJob = options.weaponJob || data.weaponJob || player.job;

      // Mark the target job's weapon as received
      const updatedPriorities = player.weaponPriorities.map((wp) =>
        wp.job === targetJob
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

export interface UpdateLootOptions {
  /** Sync gear changes when recipient or slot changes */
  syncGear?: boolean;
}

/**
 * Update loot entry with optional gear sync
 *
 * Coordinates multiple store actions:
 * 1. Updates the loot log entry
 * 2. If syncGear=true and recipient changed: revert old, mark new
 * 3. If syncGear=true and slot changed: revert old slot, mark new slot
 */
export async function updateLootAndSyncGear(
  groupId: string,
  tierId: string,
  entryId: number,
  originalEntry: LootLogEntry,
  updates: import('../types').LootLogEntryUpdate,
  options: UpdateLootOptions = {}
): Promise<void> {
  const lootStore = useLootTrackingStore.getState();
  const tierStore = useTierStore.getState();

  // 1. Update the loot entry
  await lootStore.updateLootEntry(groupId, tierId, entryId, updates);

  // 2. Sync gear if requested and the original was a drop or book
  if (options.syncGear && (originalEntry.method === 'drop' || originalEntry.method === 'book')) {
    // Ensure tier is loaded
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }
    const currentState = useTierStore.getState();

    const recipientChanged = updates.recipientPlayerId && updates.recipientPlayerId !== originalEntry.recipientPlayerId;
    const slotChanged = updates.itemSlot && updates.itemSlot !== originalEntry.itemSlot;

    // Revert old recipient's gear if recipient changed
    if (recipientChanged) {
      const oldPlayer = currentState.currentTier?.players?.find(
        (p) => p.id === originalEntry.recipientPlayerId
      );
      if (oldPlayer) {
        const oldSlot = originalEntry.itemSlot as GearSlot;
        const updatedGear = oldPlayer.gear.map((g) =>
          g.slot === oldSlot ? { ...g, hasItem: false } : g
        );
        await tierStore.updatePlayer(groupId, tierId, originalEntry.recipientPlayerId, {
          gear: updatedGear,
        });
      }
    }

    // Mark new recipient's gear if recipient changed, or update slot if slot changed
    const newRecipientId = updates.recipientPlayerId || originalEntry.recipientPlayerId;
    const newSlot = (updates.itemSlot || originalEntry.itemSlot) as GearSlot;

    if (recipientChanged || slotChanged) {
      // Refetch state after previous update
      const freshState = useTierStore.getState();
      const newPlayer = freshState.currentTier?.players?.find(
        (p) => p.id === newRecipientId
      );
      if (newPlayer) {
        let targetSlot = newSlot;

        // Special handling for rings
        if (targetSlot === 'ring1' || targetSlot === 'ring2') {
          const ring1 = newPlayer.gear.find((g) => g.slot === 'ring1');
          const ring2 = newPlayer.gear.find((g) => g.slot === 'ring2');
          const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
          const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;
          if (needsRing1) targetSlot = 'ring1';
          else if (needsRing2) targetSlot = 'ring2';
        }

        const updatedGear = newPlayer.gear.map((g) =>
          g.slot === targetSlot ? { ...g, hasItem: true } : g
        );
        await tierStore.updatePlayer(groupId, tierId, newRecipientId, {
          gear: updatedGear,
        });
      }

      // If slot changed but not recipient, also revert the old slot
      if (slotChanged && !recipientChanged) {
        const player = useTierStore.getState().currentTier?.players?.find(
          (p) => p.id === newRecipientId
        );
        if (player) {
          const oldSlot = originalEntry.itemSlot as GearSlot;
          const updatedGear = player.gear.map((g) =>
            g.slot === oldSlot ? { ...g, hasItem: false } : g
          );
          await tierStore.updatePlayer(groupId, tierId, newRecipientId, {
            gear: updatedGear,
          });
        }
      }
    }
  }
}

/**
 * Delete loot entry with optional gear reversion
 *
 * Coordinates multiple store actions:
 * 1. Deletes the loot log entry
 * 2. If revertGear=true and was a drop or book: unchecks gear slot
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

  // 2. Revert gear if requested and was a drop or book
  if (options.revertGear && (entry.method === 'drop' || entry.method === 'book')) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === entry.recipientPlayerId
    );

    if (player) {
      let slot = entry.itemSlot as GearSlot;

      // Special handling for ring drops (same as logLootAndUpdateGear)
      if (slot === 'ring1' || slot === 'ring2') {
        const ring1 = player.gear.find((g) => g.slot === 'ring1');
        const ring2 = player.gear.find((g) => g.slot === 'ring2');
        // Find which ring slot has the item (to revert)
        const hasRing1 = ring1?.bisSource === 'raid' && ring1?.hasItem;
        const hasRing2 = ring2?.bisSource === 'raid' && ring2?.hasItem;
        if (hasRing1) {
          slot = 'ring1';
        } else if (hasRing2) {
          slot = 'ring2';
        }
      }

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
 *
 * @param playerId - Player ID to calculate stats for
 * @param lootLog - Full loot log
 * @param currentWeek - Current raid week number
 * @param lootAdjustment - Optional adjustment for mid-tier roster changes
 *                         Positive = player brought in loot from outside,
 *                         Negative = player should be credited for missed weeks
 */
export function calculatePlayerLootStats(
  playerId: string,
  lootLog: LootLogEntry[],
  currentWeek: number,
  lootAdjustment: number = 0
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

  // Include loot adjustment in total drops count
  // This affects priority calculations for mid-tier roster changes
  return {
    totalDrops: playerDrops.length + lootAdjustment,
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
