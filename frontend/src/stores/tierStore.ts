/**
 * Tier Store - Manages tier snapshot state
 *
 * Handles CRUD operations for tier snapshots and snapshot players.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { TierSnapshot, SnapshotPlayer, RolloverResponse } from '../types';
import { authRequest } from '../services/api';
import { logger } from '../lib/logger';

// Stable empty array reference to avoid re-renders when players is undefined
const EMPTY_PLAYERS: SnapshotPlayer[] = [];

interface TierState {
  // List of tier snapshots for current group
  tiers: TierSnapshot[];

  // Currently selected tier (with players)
  currentTier: TierSnapshot | null;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Error state
  error: string | null;

  // Tier actions
  fetchTiers: (groupId: string) => Promise<void>;
  fetchTier: (groupId: string, tierId: string) => Promise<void>;
  createTier: (groupId: string, tierId: string, contentType?: 'savage' | 'ultimate') => Promise<TierSnapshot>;
  setActiveTier: (groupId: string, tierId: string) => Promise<void>;
  deleteTier: (groupId: string, tierId: string) => Promise<void>;
  rollover: (groupId: string, sourceTierId: string, targetTierId: string, resetGear?: boolean) => Promise<RolloverResponse>;
  setCurrentTier: (tier: TierSnapshot | null) => void;
  clearTiers: () => void;
  clearError: () => void;

  // Player actions
  updatePlayer: (groupId: string, tierId: string, playerId: string, data: Partial<SnapshotPlayer>) => Promise<void>;
  addPlayer: (groupId: string, tierId: string) => Promise<SnapshotPlayer>;
  removePlayer: (groupId: string, tierId: string, playerId: string) => Promise<void>;
  reorderPlayers: (groupId: string, tierId: string, updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }>) => Promise<void>;

  // Ownership actions
  claimPlayer: (groupId: string, tierId: string, playerId: string) => Promise<SnapshotPlayer>;
  releasePlayer: (groupId: string, tierId: string, playerId: string) => Promise<SnapshotPlayer>;

  // Weapon priority actions
  updateWeaponPriorities: (groupId: string, tierId: string, playerId: string, weaponPriorities: import('../types').WeaponPriority[]) => Promise<SnapshotPlayer>;
  lockPlayerWeaponPriorities: (groupId: string, tierId: string, playerId: string) => Promise<SnapshotPlayer>;
  unlockPlayerWeaponPriorities: (groupId: string, tierId: string, playerId: string) => Promise<SnapshotPlayer>;
  updateWeaponPrioritySettings: (groupId: string, tierId: string, settings: { weaponPrioritiesAutoLockDate?: string; weaponPrioritiesGlobalLock?: boolean }) => Promise<void>;
}

export const useTierStore = create<TierState>((set, get) => ({
  // Initial state
  tiers: [],
  currentTier: null,
  isLoading: false,
  isSaving: false,
  error: null,

  /**
   * Fetch all tier snapshots for a group
   */
  fetchTiers: async (groupId: string) => {
    const log = logger.scope('TierStore');
    set({ isLoading: true, error: null });

    try {
      const tiers = await authRequest<TierSnapshot[]>(`/api/static-groups/${groupId}/tiers`);
      log.debug('Fetched tiers:', tiers.map(t => `${t.tierId}(active:${t.isActive})`).join(', '));
      set({ tiers, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch tiers',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch a specific tier with players
   */
  fetchTier: async (groupId: string, tierId: string) => {
    set({ isLoading: true, error: null });

    try {
      const tier = await authRequest<TierSnapshot>(`/api/static-groups/${groupId}/tiers/${tierId}`);
      set({ currentTier: tier, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch tier',
        isLoading: false,
      });
    }
  },

  /**
   * Create a new tier snapshot
   */
  createTier: async (groupId: string, tierId: string, contentType: 'savage' | 'ultimate' = 'savage') => {
    set({ isSaving: true, error: null });

    try {
      const tier = await authRequest<TierSnapshot>(`/api/static-groups/${groupId}/tiers`, {
        method: 'POST',
        body: JSON.stringify({ tierId, contentType, isActive: true }),
      });

      // Update tiers list, mark others as inactive
      set((state) => ({
        tiers: [tier, ...state.tiers.map(t => ({ ...t, isActive: false }))],
        currentTier: tier,
        isSaving: false,
      }));

      return tier;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create tier',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Set a tier as active
   */
  setActiveTier: async (groupId: string, tierId: string) => {
    set({ isSaving: true, error: null });

    try {
      await authRequest<TierSnapshot>(`/api/static-groups/${groupId}/tiers/${tierId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: true }),
      });

      // Update tiers list
      set((state) => ({
        tiers: state.tiers.map(t => ({
          ...t,
          isActive: t.tierId === tierId,
        })),
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set active tier',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Delete a tier snapshot
   */
  deleteTier: async (groupId: string, tierId: string) => {
    set({ isSaving: true, error: null });

    try {
      await authRequest<void>(`/api/static-groups/${groupId}/tiers/${tierId}`, {
        method: 'DELETE',
      });

      set((state) => ({
        // Filter by both id (UUID) and tierId (slug) since either can be passed
        tiers: state.tiers.filter(t => t.id !== tierId && t.tierId !== tierId),
        currentTier: (state.currentTier?.id === tierId || state.currentTier?.tierId === tierId) ? null : state.currentTier,
        isSaving: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete tier',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Rollover roster to a new tier
   */
  rollover: async (groupId: string, sourceTierId: string, targetTierId: string, resetGear: boolean = false) => {
    set({ isSaving: true, error: null });

    try {
      const result = await authRequest<RolloverResponse>(
        `/api/static-groups/${groupId}/tiers/${sourceTierId}/rollover`,
        {
          method: 'POST',
          body: JSON.stringify({ targetTierId, resetGear }),
        }
      );

      // Update tiers list with new tier and updated source
      set((state) => ({
        tiers: [
          result.targetSnapshot,
          ...state.tiers.map(t =>
            t.tierId === sourceTierId ? result.sourceSnapshot : t
          ),
        ],
        currentTier: result.targetSnapshot,
        isSaving: false,
      }));

      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to rollover',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Set the current tier
   */
  setCurrentTier: (tier: TierSnapshot | null) => {
    set({ currentTier: tier });
  },

  /**
   * Clear all tier state (when switching groups)
   */
  clearTiers: () => {
    set({ tiers: [], currentTier: null, error: null });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },

  // ==================== Player Actions ====================

  /**
   * Update a player in the current tier
   */
  updatePlayer: async (groupId: string, tierId: string, playerId: string, data: Partial<SnapshotPlayer>) => {
    set({ isSaving: true, error: null });

    try {
      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update player',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Add a player to the current tier
   */
  addPlayer: async (groupId: string, tierId: string) => {
    set({ isSaving: true, error: null });

    try {
      const currentTier = get().currentTier;
      const sortOrder = currentTier?.players?.length ?? 0;

      const newPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players`,
        {
          method: 'POST',
          body: JSON.stringify({ sortOrder }),
        }
      );

      // Add player to current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: [...state.currentTier.players, newPlayer],
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return newPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add player',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Remove a player from the current tier
   */
  removePlayer: async (groupId: string, tierId: string, playerId: string) => {
    set({ isSaving: true, error: null });

    try {
      await authRequest<void>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}`,
        { method: 'DELETE' }
      );

      // Remove player from current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.filter(p => p.id !== playerId),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove player',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Reorder players with optimistic update (prevents visual "pop" during drag)
   * Updates local state immediately, then persists to backend
   */
  reorderPlayers: async (groupId: string, tierId: string, updates: Array<{ playerId: string; data: Partial<SnapshotPlayer> }>) => {
    const previousTier = get().currentTier;
    if (!previousTier?.players) return;

    // Apply optimistic update immediately
    set((state) => {
      if (!state.currentTier?.players) return state;

      const updatedPlayers = state.currentTier.players.map(player => {
        const update = updates.find(u => u.playerId === player.id);
        return update ? { ...player, ...update.data } : player;
      });

      return {
        currentTier: {
          ...state.currentTier,
          players: updatedPlayers,
        },
      };
    });

    // Persist to backend (fire and forget, but track for error handling)
    try {
      await Promise.all(
        updates.map(({ playerId, data }) =>
          authRequest<SnapshotPlayer>(
            `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}`,
            {
              method: 'PUT',
              body: JSON.stringify(data),
            }
          )
        )
      );
    } catch (error) {
      // Revert optimistic update on error
      set({
        currentTier: previousTier,
        error: error instanceof Error ? error.message : 'Failed to reorder players',
      });
    }
  },

  // ==================== Ownership Actions ====================

  /**
   * Claim a player (link current user to player card)
   */
  claimPlayer: async (groupId: string, tierId: string, playerId: string) => {
    set({ isSaving: true, error: null });

    try {
      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/claim`,
        { method: 'POST' }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return updatedPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to claim player',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Release a player (unlink user from player card)
   */
  releasePlayer: async (groupId: string, tierId: string, playerId: string) => {
    set({ isSaving: true, error: null });

    try {
      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/claim`,
        { method: 'DELETE' }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return updatedPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to release player',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Update a player's weapon priorities
   */
  updateWeaponPriorities: async (groupId: string, tierId: string, playerId: string, weaponPriorities) => {
    set({ isSaving: true, error: null });

    try {
      // Normalize weapon priorities to ensure all fields are present
      const normalized = weaponPriorities.map((wp) => ({
        job: wp.job,
        weaponName: wp.weaponName ?? null,
        received: wp.received,
        receivedDate: wp.receivedDate ?? null,
      }));

      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/weapon-priorities`,
        {
          method: 'PUT',
          body: JSON.stringify({ weaponPriorities: normalized }),
        }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return updatedPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update weapon priorities',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Lock a player's weapon priorities (Owner/Lead only)
   */
  lockPlayerWeaponPriorities: async (groupId: string, tierId: string, playerId: string) => {
    set({ isSaving: true, error: null });

    try {
      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/weapon-priorities/lock`,
        { method: 'POST' }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return updatedPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to lock weapon priorities',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Unlock a player's weapon priorities (Owner/Lead only)
   */
  unlockPlayerWeaponPriorities: async (groupId: string, tierId: string, playerId: string) => {
    set({ isSaving: true, error: null });

    try {
      const updatedPlayer = await authRequest<SnapshotPlayer>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/weapon-priorities/lock`,
        { method: 'DELETE' }
      );

      // Update player in current tier
      set((state) => {
        if (state.currentTier?.players) {
          return {
            currentTier: {
              ...state.currentTier,
              players: state.currentTier.players.map(p =>
                p.id === playerId ? updatedPlayer : p
              ),
            },
            isSaving: false,
          };
        }
        return { isSaving: false };
      });

      return updatedPlayer;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to unlock weapon priorities',
        isSaving: false,
      });
      throw error;
    }
  },

  /**
   * Update tier-level weapon priority settings (Owner/Lead only)
   */
  updateWeaponPrioritySettings: async (groupId: string, tierId: string, settings) => {
    set({ isSaving: true, error: null });

    try {
      await authRequest<TierSnapshot>(
        `/api/static-groups/${groupId}/tiers/${tierId}/weapon-priority-settings`,
        {
          method: 'PUT',
          body: JSON.stringify(settings),
        }
      );

      // Refresh the current tier to get updated settings
      await get().fetchTier(groupId, tierId);

      set({ isSaving: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update weapon priority settings',
        isSaving: false,
      });
      throw error;
    }
  },
}));

// ==================== Selectors ====================
// Use these to subscribe to specific slices of state and prevent unnecessary re-renders

/**
 * Select the current tier (or null)
 */
export const useCurrentTier = () => useTierStore((state) => state.currentTier);

/**
 * Select the current tier ID
 */
export const useCurrentTierId = () => useTierStore((state) => state.currentTier?.id);

/**
 * Select all tiers
 */
export const useTiers = () => useTierStore((state) => state.tiers);

/**
 * Select players from current tier
 *
 * Returns the players array directly from state, which provides stable
 * references when the array hasn't changed. Uses EMPTY_PLAYERS constant
 * for the null case to avoid creating new empty arrays on each call.
 *
 * Note: This selector returns the players array reference directly,
 * not a new array, so Zustand's default strict equality check is sufficient.
 * Only re-renders when the players array reference actually changes.
 */
export const useTierPlayers = () =>
  useTierStore((state) => state.currentTier?.players ?? EMPTY_PLAYERS);

/**
 * Select loading state
 */
export const useTierIsLoading = () => useTierStore((state) => state.isLoading);

/**
 * Select saving state
 */
export const useTierIsSaving = () => useTierStore((state) => state.isSaving);

/**
 * Select error state
 */
export const useTierError = () => useTierStore((state) => state.error);

/**
 * Select a specific player by ID
 */
export const usePlayer = (playerId: string) =>
  useTierStore((state) => state.currentTier?.players?.find((p) => p.id === playerId));

/**
 * Select a player by position
 */
export const usePlayerByPosition = (position: string) =>
  useTierStore((state) => state.currentTier?.players?.find((p) => p.position === position));

/**
 * Select configured players only
 * Uses stable empty array reference to avoid re-renders
 */
export const useConfiguredPlayers = () =>
  useTierStore((state) => state.currentTier?.players?.filter((p) => p.configured) ?? EMPTY_PLAYERS);

/**
 * Select players grouped by party (G1/G2)
 * Uses useShallow for stable object reference when values haven't changed
 */
export const usePlayersByGroup = () =>
  useTierStore(
    useShallow((state) => {
      const players = state.currentTier?.players ?? EMPTY_PLAYERS;
      return {
        group1: players.filter((p) => ['T1', 'H1', 'M1', 'R1'].includes(p.position || '')),
        group2: players.filter((p) => ['T2', 'H2', 'M2', 'R2'].includes(p.position || '')),
      };
    })
  );

/**
 * Select tier-level weapon priority settings
 * Uses useShallow for stable object reference when values haven't changed
 */
export const useWeaponPrioritySettings = () =>
  useTierStore(
    useShallow((state) => ({
      autoLockDate: state.currentTier?.weaponPrioritiesAutoLockDate,
      globalLock: state.currentTier?.weaponPrioritiesGlobalLock ?? false,
      globalLockedBy: state.currentTier?.weaponPrioritiesGlobalLockedBy,
      globalLockedAt: state.currentTier?.weaponPrioritiesGlobalLockedAt,
    }))
  );
