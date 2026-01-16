/**
 * Loot Tracking Store
 *
 * Manages loot log entries, page ledger entries, and page balances.
 * Supports week-based filtering and current week calculation.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { getErrorMessage } from '../lib/errorHandler';
import type {
  LootLogEntry,
  LootLogEntryCreate,
  LootLogEntryUpdate,
  MaterialLogEntry,
  MaterialLogEntryCreate,
  MaterialLogEntryUpdate,
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

/** Granular loading states to prevent UI jitter */
interface LoadingStates {
  lootLog: boolean;
  pageLedger: boolean;
  pageBalances: boolean;
  playerLedger: boolean;
  materialLog: boolean;
  materialBalances: boolean;
  currentWeek: boolean;
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
  /** @deprecated Use loadingStates for granular loading. Kept for backward compatibility. */
  isLoading: boolean;
  /** Granular loading states per data type */
  loadingStates: LoadingStates;
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
  updateMaterialEntry: (groupId: string, tierId: string, entryId: number, data: MaterialLogEntryUpdate) => Promise<void>;
  deleteMaterialEntry: (groupId: string, tierId: string, entryId: number) => Promise<void>;
  createPageEntry: (groupId: string, tierId: string, data: PageLedgerEntryCreate) => Promise<void>;
  markFloorCleared: (groupId: string, tierId: string, data: MarkFloorClearedRequest) => Promise<void>;
  adjustBookBalance: (groupId: string, tierId: string, playerId: string, bookType: string, adjustment: number, currentWeek: number, notes?: string) => Promise<void>;
  deletePlayerLedger: (groupId: string, tierId: string, playerId: string) => Promise<void>;
  clearAllPageLedger: (groupId: string, tierId: string) => Promise<void>;
  startNextWeek: (groupId: string, tierId: string) => Promise<number>;
  revertWeek: (groupId: string, tierId: string) => Promise<number>;
  clearLootTracking: () => void;
  clearPlayerLedger: () => void;
}

const INITIAL_LOADING_STATES: LoadingStates = {
  lootLog: false,
  pageLedger: false,
  pageBalances: false,
  playerLedger: false,
  materialLog: false,
  materialBalances: false,
  currentWeek: false,
};

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
  loadingStates: { ...INITIAL_LOADING_STATES },
  error: null,

  fetchLootLog: async (groupId, tierId, week) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, lootLog: true },
      error: null,
    }));
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get<LootLogEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/loot-log${params}`
      );
      set((state) => ({
        lootLog: response,
        loadingStates: { ...state.loadingStates, lootLog: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, lootLog: false },
      }));
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
    } catch (error) {
      // Silently fail - week selector will fall back to basic display
      // Log error for debugging week selector enhancement issues
      console.error('Failed to fetch week data types:', { groupId, tierId, error });
    }
  },

  fetchPageLedger: async (groupId, tierId, week) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, pageLedger: true },
      error: null,
    }));
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get<PageLedgerEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/page-ledger${params}`
      );
      set((state) => ({
        pageLedger: response,
        loadingStates: { ...state.loadingStates, pageLedger: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, pageLedger: false },
      }));
      throw error;
    }
  },

  fetchPageBalances: async (groupId, tierId, week) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, pageBalances: true },
      error: null,
    }));
    try {
      const params = week !== undefined ? `?week=${week}` : '';
      const response = await api.get<PageBalance[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/page-balances${params}`
      );
      set((state) => ({
        pageBalances: response,
        loadingStates: { ...state.loadingStates, pageBalances: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, pageBalances: false },
      }));
      throw error;
    }
  },

  fetchPlayerLedger: async (groupId, tierId, playerId) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, playerLedger: true },
      error: null,
    }));
    try {
      const response = await api.get<PageLedgerEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/page-ledger`
      );
      set((state) => ({
        playerLedger: response,
        loadingStates: { ...state.loadingStates, playerLedger: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, playerLedger: false },
      }));
      throw error;
    }
  },

  fetchMaterialLog: async (groupId, tierId, week) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, materialLog: true },
      error: null,
    }));
    try {
      const params = week ? `?week=${week}` : '';
      const response = await api.get<MaterialLogEntry[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/material-log${params}`
      );
      set((state) => ({
        materialLog: response,
        loadingStates: { ...state.loadingStates, materialLog: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, materialLog: false },
      }));
      throw error;
    }
  },

  fetchMaterialBalances: async (groupId, tierId) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, materialBalances: true },
      error: null,
    }));
    try {
      const response = await api.get<MaterialBalance[]>(
        `/api/static-groups/${groupId}/tiers/${tierId}/material-balances`
      );
      set((state) => ({
        materialBalances: response,
        loadingStates: { ...state.loadingStates, materialBalances: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, materialBalances: false },
      }));
      throw error;
    }
  },

  fetchCurrentWeek: async (groupId, tierId) => {
    set((state) => ({
      loadingStates: { ...state.loadingStates, currentWeek: true },
    }));
    try {
      const response = await api.get<{ currentWeek: number; maxWeek: number }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/current-week`
      );
      set((state) => ({
        currentWeek: response.currentWeek,
        maxWeek: response.maxWeek,
        loadingStates: { ...state.loadingStates, currentWeek: false },
      }));
    } catch (error) {
      set((state) => ({
        error: getErrorMessage(error),
        loadingStates: { ...state.loadingStates, currentWeek: false },
      }));
      throw error;
    }
  },

  createLootEntry: async (groupId, tierId, data) => {
    set({ error: null });
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
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  updateLootEntry: async (groupId, tierId, entryId, data) => {
    set({ error: null });
    try {
      await api.put(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log/${entryId}`, data);
      // Refresh loot log and weeks with entries (week may have changed)
      await Promise.all([
        get().fetchLootLog(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteLootEntry: async (groupId, tierId, entryId) => {
    set({ error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/loot-log/${entryId}`);
      // Refresh loot log and weeks with entries (week may now be empty)
      await Promise.all([
        get().fetchLootLog(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  createMaterialEntry: async (groupId, tierId, data) => {
    set({ error: null });
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
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  deleteMaterialEntry: async (groupId, tierId, entryId) => {
    set({ error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/material-log/${entryId}`);
      // Refresh material log, balances, and weeks with entries (week may now be empty)
      await Promise.all([
        get().fetchMaterialLog(groupId, tierId),
        get().fetchMaterialBalances(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  updateMaterialEntry: async (groupId, tierId, entryId, data) => {
    set({ error: null });
    try {
      await api.put(`/api/static-groups/${groupId}/tiers/${tierId}/material-log/${entryId}`, data);
      // Refresh material log and balances
      await Promise.all([
        get().fetchMaterialLog(groupId, tierId),
        get().fetchMaterialBalances(groupId, tierId),
      ]);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  createPageEntry: async (groupId, tierId, data) => {
    set({ error: null });
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
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  markFloorCleared: async (groupId, tierId, data) => {
    set({ error: null });
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
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  adjustBookBalance: async (groupId, tierId, playerId, bookType, adjustment, currentWeek, notes) => {
    if (adjustment === 0) return; // No-op for zero adjustment

    set({ error: null });
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
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  deletePlayerLedger: async (groupId, tierId, playerId) => {
    set({ error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/page-ledger`);
      // Clear local state
      set({ playerLedger: [] });
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  clearAllPageLedger: async (groupId, tierId) => {
    set({ error: null });
    try {
      // Get all players with ledger entries from page balances
      const balances = get().pageBalances;
      const playerIds = [...new Set(balances.map((b) => b.playerId))];

      // Delete each player's ledger
      for (const playerId of playerIds) {
        await api.delete(`/api/static-groups/${groupId}/tiers/${tierId}/players/${playerId}/page-ledger`);
      }

      // Refresh balances and weeks
      await Promise.all([
        get().fetchPageBalances(groupId, tierId),
        get().fetchPageLedger(groupId, tierId),
        get().fetchWeeksWithEntries(groupId, tierId),
      ]);
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  startNextWeek: async (groupId, tierId) => {
    set({ error: null });
    try {
      const response = await api.post<{ currentWeek: number; weekStartDate: string }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/start-next-week`
      );
      // Update current week and maxWeek in the store
      const newWeek = response.currentWeek;
      const { maxWeek } = get();
      set({
        currentWeek: newWeek,
        maxWeek: Math.max(maxWeek, newWeek),
      });
      return newWeek;
    } catch (error) {
      set({ error: getErrorMessage(error) });
      throw error;
    }
  },

  revertWeek: async (groupId, tierId) => {
    set({ error: null });
    try {
      const response = await api.post<{ currentWeek: number; weekStartDate: string }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/revert-week`
      );
      // Update current week in the store
      const newWeek = response.currentWeek;
      // Also fetch fresh maxWeek from backend
      const weekInfo = await api.get<{ currentWeek: number; maxWeek: number }>(
        `/api/static-groups/${groupId}/tiers/${tierId}/current-week`
      );
      set({
        currentWeek: newWeek,
        maxWeek: weekInfo.maxWeek,
      });
      return newWeek;
    } catch (error) {
      set({ error: getErrorMessage(error) });
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
      loadingStates: { ...INITIAL_LOADING_STATES },
      error: null,
    });
  },

  clearPlayerLedger: () => {
    set({ playerLedger: [] });
  },
}));
