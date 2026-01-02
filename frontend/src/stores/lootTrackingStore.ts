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
  LootLogEntryUpdate,
  MaterialLogEntry,
  MaterialLogEntryCreate,
  MaterialBalance,
  PageLedgerEntry,
  PageLedgerEntryCreate,
  PageBalance,
  MarkFloorClearedRequest,
} from '../types';

/** Types of entries that can exist in a week */
export type WeekEntryType = 'loot' | 'books' | 'mats';

/** Week data with entry types */
export interface WeekDataInfo {
  week: number;
  types: WeekEntryType[];
}

interface LootTrackingState {
  lootLog: LootLogEntry[];
  weeksWithEntries: Set<number>; // Tracks which weeks have loot OR ledger entries (for week selector)
  weekDataTypes: Map<number, WeekEntryType[]>; // Week -> entry types for enhanced display
  pageLedger: PageLedgerEntry[];
  pageBalances: PageBalance[];
  playerLedger: PageLedgerEntry[]; // Ledger entries for a specific player (for modal)
  materialLog: MaterialLogEntry[];
  materialBalances: MaterialBalance[];
  currentWeek: number;
  maxWeek: number; // max(currentWeek, maxLoggedWeek) for week selector
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLootLog: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchWeeksWithEntries: (groupId: string, tierId: string) => Promise<void>;
  fetchWeekDataTypes: (groupId: string, tierId: string) => Promise<void>;
  fetchPageLedger: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchPageBalances: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchPlayerLedger: (groupId: string, tierId: string, playerId: string) => Promise<void>;
  fetchMaterialLog: (groupId: string, tierId: string, week?: number) => Promise<void>;
  fetchMaterialBalances: (groupId: string, tierId: string) => Promise<void>;
  fetchCurrentWeek: (groupId: string, tierId: string) => Promise<void>;
  createLootEntry: (groupId: string, tierId: string, data: LootLogEntryCreate) => Promise<void>;
  updateLootEntry: (groupId: string, tierId: string, entryId: number, data: LootLogEntryUpdate) => Promise<void>;
  deleteLootEntry: (groupId: string, tierId: string, entryId: number) => Promise<void>;
  createMaterialEntry: (groupId: string, tierId: string, data: MaterialLogEntryCreate) => Promise<void>;
  deleteMaterialEntry: (groupId: string, tierId: string, entryId: number) => Promise<void>;
  createPageEntry: (groupId: string, tierId: string, data: PageLedgerEntryCreate) => Promise<void>;
  markFloorCleared: (groupId: string, tierId: string, data: MarkFloorClearedRequest) => Promise<void>;
  adjustBookBalance: (groupId: string, tierId: string, playerId: string, bookType: string, adjustment: number, currentWeek: number, notes?: string) => Promise<void>;
  clearLootTracking: () => void;
  clearPlayerLedger: () => void;
}

export const useLootTrackingStore = create<LootTrackingState>((set, get) => ({
  lootLog: [],
  weeksWithEntries: new Set<number>(),
  weekDataTypes: new Map<number, WeekEntryType[]>(),
  pageLedger: [],
  pageBalances: [],
  playerLedger: [],
  materialLog: [],
  materialBalances: [],
  currentWeek: 1,
  maxWeek: 1,
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

  fetchWeeksWithEntries: async (groupId, tierId) => {
    // Fetch weeks that have either loot log OR page ledger entries
    try {
      const response = await api.get<{ weeks: number[] }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/weeks-with-entries`
      );
      set({ weeksWithEntries: new Set(response.weeks) });
    } catch {
      // Silently fail - week selector will just not show empty indicators
    }
  },

  fetchWeekDataTypes: async (groupId, tierId) => {
    // Fetch weeks with their entry types (loot/books/mats) for enhanced week selector
    try {
      const response = await api.get<{ weeks: WeekDataInfo[] }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/weeks-data-types`
      );
      const dataTypesMap = new Map<number, WeekEntryType[]>();
      for (const weekInfo of response.weeks) {
        dataTypesMap.set(weekInfo.week, weekInfo.types as WeekEntryType[]);
      }
      // Also update weeksWithEntries from this data
      set({
        weekDataTypes: dataTypesMap,
        weeksWithEntries: new Set(response.weeks.map((w) => w.week)),
      });
    } catch {
      // Silently fail - week selector will fall back to basic display
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

  fetchPageBalances: async (groupId, tierId, week) => {
    set({ isLoading: true, error: null });
    try {
      const params = week !== undefined ? `?week=${week}` : '';
      const response = await api.get<PageBalance[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/page-balances${params}`
      );
      set({ pageBalances: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchPlayerLedger: async (groupId, tierId, playerId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<PageLedgerEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/page-ledger`
      );
      set({ playerLedger: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchMaterialLog: async (groupId, tierId, week) => {
    set({ isLoading: true, error: null });
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get<MaterialLogEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/material-log${params}`
      );
      set({ materialLog: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchMaterialBalances: async (groupId, tierId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<MaterialBalance[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/material-balances`
      );
      set({ materialBalances: response, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchCurrentWeek: async (groupId, tierId) => {
    try {
      const response = await api.get<{ currentWeek: number; maxWeek: number }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/current-week`
      );
      set({ currentWeek: response.currentWeek, maxWeek: response.maxWeek });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  createLootEntry: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log`, data);
      // Update maxWeek if the new entry's week is higher
      const { maxWeek, weeksWithEntries } = get();
      if (data.weekNumber > maxWeek) {
        set({ maxWeek: data.weekNumber });
      }
      // Add week to weeksWithEntries
      const newWeeks = new Set(weeksWithEntries);
      newWeeks.add(data.weekNumber);
      set({ weeksWithEntries: newWeeks });
      // Refresh loot log
      await get().fetchLootLog(groupId, tierId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateLootEntry: async (groupId, tierId, entryId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.put(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log/${entryId}`, data);
      // Refresh loot log and weeks with entries (week may have changed)
      await Promise.all([
        get().fetchLootLog(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteLootEntry: async (groupId, tierId, entryId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log/${entryId}`);
      // Refresh loot log and weeks with entries (week may now be empty)
      await Promise.all([
        get().fetchLootLog(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createMaterialEntry: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/material-log`, data);
      // Update maxWeek if the new entry's week is higher
      const { maxWeek, weeksWithEntries } = get();
      if (data.weekNumber > maxWeek) {
        set({ maxWeek: data.weekNumber });
      }
      // Add week to weeksWithEntries
      const newWeeks = new Set(weeksWithEntries);
      newWeeks.add(data.weekNumber);
      set({ weeksWithEntries: newWeeks });
      // Refresh material log and balances
      await Promise.all([
        get().fetchMaterialLog(groupId, tierId),
        get().fetchMaterialBalances(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteMaterialEntry: async (groupId, tierId, entryId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/material-log/${entryId}`);
      // Refresh material log, balances, and weeks with entries (week may now be empty)
      await Promise.all([
        get().fetchMaterialLog(groupId, tierId),
        get().fetchMaterialBalances(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createPageEntry: async (groupId, tierId, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/page-ledger`, data);
      // Update weeksWithEntries if needed
      const { weeksWithEntries, maxWeek } = get();
      const newWeeks = new Set(weeksWithEntries);
      newWeeks.add(data.weekNumber);
      if (data.weekNumber > maxWeek) {
        set({ weeksWithEntries: newWeeks, maxWeek: data.weekNumber });
      } else {
        set({ weeksWithEntries: newWeeks });
      }
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
      // Update weeksWithEntries and maxWeek
      const { weeksWithEntries, maxWeek } = get();
      const newWeeks = new Set(weeksWithEntries);
      newWeeks.add(data.weekNumber);
      if (data.weekNumber > maxWeek) {
        set({ weeksWithEntries: newWeeks, maxWeek: data.weekNumber });
      } else {
        set({ weeksWithEntries: newWeeks });
      }
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

  adjustBookBalance: async (groupId, tierId, playerId, bookType, adjustment, currentWeek, notes) => {
    if (adjustment === 0) return; // No-op for zero adjustment

    set({ isLoading: true, error: null });
    try {
      // Create an adjustment ledger entry
      await api.post(`/api/static-groups/${groupId}/tiers/${tierId}/page-ledger`, {
        playerId,
        weekNumber: currentWeek,
        floor: 'Adjustment', // Generic floor for manual adjustments
        bookType,
        transactionType: 'adjustment',
        quantity: adjustment,
        notes: notes || 'Manual adjustment',
      });
      // Update weeksWithEntries and maxWeek
      const { weeksWithEntries, maxWeek } = get();
      const newWeeks = new Set(weeksWithEntries);
      newWeeks.add(currentWeek);
      if (currentWeek > maxWeek) {
        set({ weeksWithEntries: newWeeks, maxWeek: currentWeek });
      } else {
        set({ weeksWithEntries: newWeeks });
      }
      // Refresh balances
      await get().fetchPageBalances(groupId, tierId);
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearLootTracking: () => {
    set({
      lootLog: [],
      weeksWithEntries: new Set<number>(),
      weekDataTypes: new Map<number, WeekEntryType[]>(),
      pageLedger: [],
      pageBalances: [],
      playerLedger: [],
      materialLog: [],
      materialBalances: [],
      currentWeek: 1,
      maxWeek: 1,
      isLoading: false,
      error: null,
    });
  },

  clearPlayerLedger: () => {
    set({ playerLedger: [] });
  },
}));
