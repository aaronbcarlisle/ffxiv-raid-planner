/**
 * Tier Store - Manages tier snapshot state
 *
 * Handles CRUD operations for tier snapshots and snapshot players.
 */

import { create } from 'zustand';
import type { TierSnapshot, SnapshotPlayer, RolloverResponse } from '../types';
import { authRequest } from '../services/api';

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
    set({ isLoading: true, error: null });

    try {
      const tiers = await authRequest<TierSnapshot[]>(`/api/static-groups/${groupId}/tiers`);
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
        tiers: state.tiers.filter(t => t.tierId !== tierId),
        currentTier: state.currentTier?.tierId === tierId ? null : state.currentTier,
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
}));
