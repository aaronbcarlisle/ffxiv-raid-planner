/**
 * Loot Tracking Store
 *
 * Manages loot log entries, page ledger entries, and page balances.
 * Supports week-based filtering and current week calculation.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import type {
  LootLogEntry,
  LootLogEntryCreate,
  PageLedgerEntry,
  PageLedgerEntryCreate,
  PageBalance,
  MarkFloorClearedRequest,
} from '../types';

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
  createLootEntry: (groupId: string, tierId: string, data: LootLogEntryCreate) => Promise<void>;
  deleteLootEntry: (groupId: string, tierId: string, entryId: number) => Promise<void>;
  createPageEntry: (groupId: string, tierId: string, data: PageLedgerEntryCreate) => Promise<void>;
  markFloorCleared: (groupId: string, tierId: string, data: MarkFloorClearedRequest) => Promise<void>;
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
      const response = await api.get<LootLogEntry[]>(
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
      const response = await api.get<PageLedgerEntry[]>(
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
      const response = await api.get<PageBalance[]>(
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
      const response = await api.get<{ currentWeek: number }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/current-week`
      );
      set({ currentWeek: response.currentWeek });
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
