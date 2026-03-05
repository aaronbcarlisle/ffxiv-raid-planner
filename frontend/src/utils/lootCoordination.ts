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
  LootSlot,
  AdvancedPriorityOptions,
} from '../types';
import { DEFAULT_ADVANCED_OPTIONS } from '../types';

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

  // 2. Update gear if requested, method is 'drop' or 'book', and not extra/off-spec loot
  if (options.updateGear && (data.method === 'drop' || data.method === 'book') && !data.isExtra) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === data.recipientPlayerId
    );

    if (player) {
      let slot: LootSlot | null = data.itemSlot as LootSlot;

      // Special handling for ring drops: find which ring slot needs raid BiS
      // Loot log stores rings as "ring" but gear uses ring1/ring2
      if (slot === 'ring' || slot === 'ring1' || slot === 'ring2') {
        const ring1 = player.gear.find((g) => g.slot === 'ring1');
        const ring2 = player.gear.find((g) => g.slot === 'ring2');
        const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
        const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;

        if (needsRing1) {
          slot = 'ring1';
        } else if (needsRing2) {
          slot = 'ring2';
        } else {
          slot = null; // Neither ring needs raid BiS, skip gear update
        }
      }

      // Only update gear if the slot has raid BiS source (matches backend mark_acquired)
      if (slot) {
        const slotData = player.gear.find((g) => g.slot === slot);
        if (slotData?.bisSource === 'raid') {
          const updatedGear = player.gear.map((g) =>
            g.slot === slot ? { ...g, hasItem: true } : g
          );
          await tierStore.updatePlayer(groupId, tierId, data.recipientPlayerId, {
            gear: updatedGear,
          });
        }
      }
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

  // 2. Sync gear if requested, the original was a drop or book, and not extra/off-spec
  const isOriginalExtra = originalEntry.isExtra;
  const isNewExtra = updates.isExtra !== undefined ? updates.isExtra : isOriginalExtra;
  if (options.syncGear && (originalEntry.method === 'drop' || originalEntry.method === 'book') && !isOriginalExtra) {
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
        let oldSlot: LootSlot = originalEntry.itemSlot as LootSlot;
        // Ring: find which ring slot to revert (loot log stores "ring", gear uses ring1/ring2)
        if (oldSlot === 'ring' || oldSlot === 'ring1' || oldSlot === 'ring2') {
          const ring1 = oldPlayer.gear.find((g) => g.slot === 'ring1');
          const ring2 = oldPlayer.gear.find((g) => g.slot === 'ring2');
          if (ring1?.bisSource === 'raid' && ring1?.hasItem) oldSlot = 'ring1';
          else if (ring2?.bisSource === 'raid' && ring2?.hasItem) oldSlot = 'ring2';
        }
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
    const newSlot: LootSlot = (updates.itemSlot || originalEntry.itemSlot) as LootSlot;

    if (recipientChanged || slotChanged) {
      // Only mark new gear if the (possibly updated) entry is not extra/off-spec
      if (!isNewExtra) {
        // Refetch state after previous update
        const freshState = useTierStore.getState();
        const newPlayer = freshState.currentTier?.players?.find(
          (p) => p.id === newRecipientId
        );
        if (newPlayer) {
          let targetSlot: LootSlot | null = newSlot;

          // Special handling for rings (loot log stores "ring", gear uses ring1/ring2)
          if (targetSlot === 'ring' || targetSlot === 'ring1' || targetSlot === 'ring2') {
            const ring1 = newPlayer.gear.find((g) => g.slot === 'ring1');
            const ring2 = newPlayer.gear.find((g) => g.slot === 'ring2');
            const needsRing1 = ring1?.bisSource === 'raid' && !ring1?.hasItem;
            const needsRing2 = ring2?.bisSource === 'raid' && !ring2?.hasItem;
            if (needsRing1) targetSlot = 'ring1';
            else if (needsRing2) targetSlot = 'ring2';
            else targetSlot = null;
          }

          if (targetSlot) {
            const slotData = newPlayer.gear.find((g) => g.slot === targetSlot);
            if (slotData?.bisSource === 'raid') {
              const updatedGear = newPlayer.gear.map((g) =>
                g.slot === targetSlot ? { ...g, hasItem: true } : g
              );
              await tierStore.updatePlayer(groupId, tierId, newRecipientId, {
                gear: updatedGear,
              });
            }
          }
        }
      }

      // If slot changed but not recipient, also revert the old slot
      if (slotChanged && !recipientChanged) {
        const player = useTierStore.getState().currentTier?.players?.find(
          (p) => p.id === newRecipientId
        );
        if (player) {
          let oldSlot: LootSlot = originalEntry.itemSlot as LootSlot;
          // Ring: find which ring slot to revert
          if (oldSlot === 'ring' || oldSlot === 'ring1' || oldSlot === 'ring2') {
            const ring1 = player.gear.find((g) => g.slot === 'ring1');
            const ring2 = player.gear.find((g) => g.slot === 'ring2');
            if (ring1?.bisSource === 'raid' && ring1?.hasItem) oldSlot = 'ring1';
            else if (ring2?.bisSource === 'raid' && ring2?.hasItem) oldSlot = 'ring2';
          }
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

  // 2. Revert gear if requested, was a drop or book, and not extra/off-spec
  if (options.revertGear && (entry.method === 'drop' || entry.method === 'book') && !entry.isExtra) {
    // Ensure tier is loaded before trying to find the player
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === entry.recipientPlayerId
    );

    if (player) {
      let slot: LootSlot | null = entry.itemSlot as LootSlot;

      // Special handling for ring drops (loot log stores "ring", gear uses ring1/ring2)
      if (slot === 'ring' || slot === 'ring1' || slot === 'ring2') {
        const ring1 = player.gear.find((g) => g.slot === 'ring1');
        const ring2 = player.gear.find((g) => g.slot === 'ring2');
        // Find which ring slot has the item (to revert)
        const hasRing1 = ring1?.bisSource === 'raid' && ring1?.hasItem;
        const hasRing2 = ring2?.bisSource === 'raid' && ring2?.hasItem;
        if (hasRing1) {
          slot = 'ring1';
        } else if (hasRing2) {
          slot = 'ring2';
        } else {
          slot = null; // Neither ring has raid item, nothing to revert
        }
      }

      if (slot) {
        const updatedGear = player.gear.map((g) =>
          g.slot === slot ? { ...g, hasItem: false } : g
        );
        await tierStore.updatePlayer(groupId, tierId, entry.recipientPlayerId, {
          gear: updatedGear,
        });
      }
    }
  }

  // 3. Revert weapon priority if this was a weapon drop or book
  if (entry.itemSlot === 'weapon' && (entry.method === 'drop' || entry.method === 'book')) {
    // Ensure tier is loaded
    if (!tierStore.currentTier?.players) {
      await tierStore.fetchTier(groupId, tierId);
    }

    const player = useTierStore.getState().currentTier?.players?.find(
      (p) => p.id === entry.recipientPlayerId
    );

    if (player?.weaponPriorities) {
      // Determine which job's weapon to un-mark
      const weaponJob = entry.weaponJob || player.job;
      const updatedPriorities = player.weaponPriorities.map((wp) =>
        wp.job === weaponJob
          ? { ...wp, received: false, receivedDate: undefined }
          : wp
      );
      await useTierStore.getState().updateWeaponPriorities(
        groupId,
        tierId,
        entry.recipientPlayerId,
        updatedPriorities
      );
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
 * Get advanced options from settings with defaults
 * Used for enhanced priority calculation multipliers
 */
function getAdvancedOptions(settings?: StaticSettings): AdvancedPriorityOptions {
  return settings?.prioritySettings?.advancedOptions || DEFAULT_ADVANCED_OPTIONS;
}

/**
 * Enhanced score breakdown for tooltips
 */
export interface EnhancedScoreBreakdown {
  score: number;
  droughtBonus: number;
  balancePenalty: number;
}

/**
 * Calculate enhanced priority score with detailed breakdown
 *
 * Returns both the final score and the individual components for display.
 * Uses configurable multipliers from settings when provided.
 *
 * Note: This function always calculates the enhanced score when called.
 * The `enableEnhancedFairness` toggle controls whether the UI USES this
 * function, not whether the function does its calculation.
 *
 * @param baseScore - Base priority score from calculatePriorityScore
 * @param stats - Player's loot statistics
 * @param averageDrops - Average drops across all players
 * @param settings - Optional static settings for configurable multipliers
 */
export function calculateEnhancedScoreWithBreakdown(
  baseScore: number,
  stats: PlayerLootStats,
  averageDrops: number,
  settings?: StaticSettings
): EnhancedScoreBreakdown {
  const advancedOptions = getAdvancedOptions(settings);

  // Get enhanced fairness multipliers - always use configured values
  // (useMultipliers only gates base score multipliers like role/gear in priority.ts)
  const droughtMultiplier = advancedOptions.droughtBonusMultiplier;
  const droughtCapWeeks = advancedOptions.droughtBonusCapWeeks;
  const balanceMultiplier = advancedOptions.balancePenaltyMultiplier;
  const balanceCapDrops = advancedOptions.balancePenaltyCapDrops;

  // Drought bonus: reward players who haven't received loot recently
  const droughtBonus = Math.min(
    stats.weeksSinceLastDrop * droughtMultiplier,
    droughtCapWeeks * droughtMultiplier
  );

  // Balance penalty: penalize players who are ahead of the curve
  const excessDrops = Math.max(0, stats.totalDrops - averageDrops);
  const cappedExcess = Math.min(excessDrops, balanceCapDrops);
  const balancePenalty = cappedExcess * balanceMultiplier;

  return {
    score: Math.round(baseScore + droughtBonus - balancePenalty),
    droughtBonus,
    balancePenalty,
  };
}

/**
 * Calculate enhanced priority score with loot history adjustments
 *
 * Modifies base priority score with:
 * - Drought bonus: reward for weeks without drops (configurable)
 * - Balance penalty: penalty for drops above average (configurable)
 *
 * @param baseScore - Base priority score from calculatePriorityScore
 * @param stats - Player's loot statistics
 * @param averageDrops - Average drops across all players
 * @param settings - Optional static settings for configurable multipliers
 */
export function calculateEnhancedPriorityScore(
  baseScore: number,
  stats: PlayerLootStats,
  averageDrops: number,
  settings?: StaticSettings
): number {
  const breakdown = calculateEnhancedScoreWithBreakdown(baseScore, stats, averageDrops, settings);
  return breakdown.score;
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
      averageDrops,
      settings // Pass settings to use configurable multipliers
    );

    return {
      player: entry.player,
      baseScore: entry.score,
      enhancedScore,
      stats,
    };
  });
}
