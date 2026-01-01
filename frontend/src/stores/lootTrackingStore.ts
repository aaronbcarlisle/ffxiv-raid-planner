/**
 * Loot Tracking Store
 *
 * Manages loot log entries, page ledger entries, and page balances.
 * Supports week-based filtering and current week calculation.
 */

import { create } from 'zustand';
import { api } from '../services/api';

export interface LootLogEntry {
  id: number;
  tierSnapshotId: string;
  weekNumber: number;
  floor: string;
  itemSlot: string;
  recipientPlayerId: string;
  recipientPlayerName: string;
  method: 'drop' | 'book' | 'tome';
  notes?: string;
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

export interface PageLedgerEntry {
  id: number;
  tierSnapshotId: string;
  playerId: string;
  playerName: string;
  weekNumber: number;
  floor: string;
  bookType: string; // "I", "II", "III", "IV"
  transactionType: 'earned' | 'spent' | 'missed' | 'adjustment';
  quantity: number;
  notes?: string;
  createdAt: string;
  createdByUserId: string;
  createdByUsername: string;
}

export interface PageBalance {
  playerId: string;
  playerName: string;
  book_I: number;
  book_II: number;
  book_III: number;
  book_IV: number;
}

interface LootTrackingState {
  lootLog: LootLogEntry[];
  pageLedger: PageLedgerEntry[];
  pageBalances: PageBalance[];
  currentWeek: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLootLog: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchPageLedger: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchPageBalances: (groupId: string, tierId: string) => Promise<void>;
  fetchCurrentWeek: (groupId: string, tierId: string) => Promise<void>;
  createLootEntry: (
    groupId: string,
    tierId: string,
    data: {
      weekNumber: number;
      floor: string;
      itemSlot: string;
      recipientPlayerId: string;
      method: 'drop' | 'book' | 'tome';
      notes?: string;
    }
  ) => Promise<void>;
  deleteLootEntry: (groupId: string, tierId: string, entryId: number) => Promise<void>;
  createPageEntry: (
    groupId: string,
    tierId: string,
    data: {
      playerId: string;
      weekNumber: number;
      floor: string;
      bookType: string;
      transactionType: 'earned' | 'spent' | 'missed' | 'adjustment';
      quantity: number;
      notes?: string;
    }
  ) => Promise<void>;
  markFloorCleared: (
    groupId: string,
    tierId: string,
    data: {
      weekNumber: number;
      floor: string;
      playerIds: string[];
      notes?: string;
    }
  ) => Promise<void>;
  clearLootTracking: () => void;
}

export const useLootTrackingStore = create<LootTrackingState>((set, get) => ({
  lootLog: [],
  pageLedger: [],
  pageBalances: [],
  currentWeek: 1,
  isLoading: false,
  error: null,

  fetchLootLog: async (groupId, tierId, week) => {
    set({ isLoading: true, error: null });
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get(
        `/api/static-groups/${groupId}/tiers/${tierId}/loot-log${params}`
      );
      set({ lootLog: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchPageLedger: async (groupId, tierId, week) => {
    set({ isLoading: true, error: null });
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get(
        `/api/static-groups/${groupId}/tiers/${tierId}/page-ledger${params}`
      );
      set({ pageLedger: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchPageBalances: async (groupId, tierId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/api/static-groups/${groupId}/tiers/${tierId}/page-balances`
      );
      set({ pageBalances: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchCurrentWeek: async (groupId, tierId) => {
    try {
      const response = await api.get(
        `/api/static-groups/${groupId}/tiers/${tierId}/current-week`
      );
      set({ currentWeek: response.current_week });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createLootEntry: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log`, data);
      // Refresh loot log
      await get().fetchLootLog(groupId, tierId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteLootEntry: async (groupId, tierId, entryId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log/${entryId}`);
      // Refresh loot log
      await get().fetchLootLog(groupId, tierId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createPageEntry: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/page-ledger`, data);
      // Refresh ledger and balances
      await Promise.all([
        get().fetchPageLedger(groupId, tierId),
        get().fetchPageBalances(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  markFloorCleared: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/mark-floor-cleared`, data);
      // Refresh ledger and balances
      await Promise.all([
        get().fetchPageLedger(groupId, tierId),
        get().fetchPageBalances(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearLootTracking: () => {
    set({
      lootLog: [],
      pageLedger: [],
      pageBalances: [],
      currentWeek: 1,
      isLoading: false,
      error: null,
    });
  },
}));
