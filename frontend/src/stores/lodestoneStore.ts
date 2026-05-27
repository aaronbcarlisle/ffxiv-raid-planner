import { create } from 'zustand';
import { api } from '../services/api';

export interface LodestoneCharacter {
  lodestoneId: number;
  name: string;
  server: string;
  avatar: string | null;
}

export interface LodestoneSearchResult {
  results: LodestoneCharacter[];
  total: number;
}

export interface EquippedGearSlot {
  slot: string;
  itemId: number | null;
  itemName: string | null;
  itemLevel: number;
  itemIcon: string | null;
  currentSource: string;
}

export interface CharacterGear {
  lodestoneId: number;
  name: string;
  server: string;
  avatar: string | null;
  portrait: string | null;
  activeJob: string | null;
  activeJobLevel: number | null;
  gear: EquippedGearSlot[];
}

export interface SyncResult {
  updatedSlots: number;
  lodestoneId: string;
  lastSync: string;
  gear: unknown[];
}

export interface LodestoneDevStatus {
  mockMode: boolean;
  mockSearchNames: string[];
}

const INITIAL_STATE = {
  searchResults: [] as LodestoneCharacter[],
  searchTotal: 0,
  isSearching: false,
  searchError: null as string | null,
  characterGear: null as CharacterGear | null,
  isLoadingGear: false,
  gearError: null as string | null,
  isSyncing: false,
  syncError: null as string | null,
  devStatus: null as LodestoneDevStatus | null,
  isLoadingDevStatus: false,
};

interface LodestoneState {
  searchResults: LodestoneCharacter[];
  searchTotal: number;
  isSearching: boolean;
  searchError: string | null;
  characterGear: CharacterGear | null;
  isLoadingGear: boolean;
  gearError: string | null;
  isSyncing: boolean;
  syncError: string | null;
  devStatus: LodestoneDevStatus | null;
  isLoadingDevStatus: boolean;
  requestVersion: number;
  fetchDevStatus: () => Promise<void>;
  searchCharacters: (name: string, server?: string) => Promise<void>;
  fetchCharacterGear: (lodestoneId: number) => Promise<void>;
  syncPlayerGear: (groupId: string, playerId: string, lodestoneId?: number) => Promise<SyncResult>;
  clearSearch: () => void;
  clearGear: () => void;
  clearErrors: () => void;
  resetState: () => void;
}

export const useLodestoneStore = create<LodestoneState>((set, get) => ({
  ...INITIAL_STATE,
  requestVersion: 0,

  fetchDevStatus: async () => {
    set({ isLoadingDevStatus: true });

    try {
      const status = await api.get<LodestoneDevStatus>('/api/lodestone/status');
      set({
        devStatus: status.mockMode ? status : null,
        isLoadingDevStatus: false,
      });
    } catch {
      set({
        devStatus: null,
        isLoadingDevStatus: false,
      });
    }
  },

  searchCharacters: async (name: string, server?: string) => {
    const requestVersion = get().requestVersion;
    set({
      isSearching: true,
      searchError: null,
      syncError: null,
      gearError: null,
      characterGear: null,
      isLoadingGear: false,
    });

    try {
      const params = new URLSearchParams({ name });
      if (server) {
        params.append('server', server);
      }

      const data = await api.get<LodestoneSearchResult>(
        `/api/lodestone/search?${params.toString()}`
      );

      if (get().requestVersion !== requestVersion) {
        return;
      }

      set({
        searchResults: data.results,
        searchTotal: data.total,
        isSearching: false,
      });
    } catch (err) {
      if (get().requestVersion !== requestVersion) {
        return;
      }

      set({
        searchResults: [],
        searchTotal: 0,
        searchError: (err as Error).message,
        isSearching: false,
      });
    }
  },

  fetchCharacterGear: async (lodestoneId: number) => {
    const requestVersion = get().requestVersion;
    set({
      characterGear: null,
      isLoadingGear: true,
      gearError: null,
      syncError: null,
    });

    try {
      const data = await api.get<CharacterGear>(`/api/lodestone/character/${lodestoneId}`);

      if (get().requestVersion !== requestVersion) {
        return;
      }

      set({
        characterGear: data,
        isLoadingGear: false,
      });
    } catch (err) {
      if (get().requestVersion !== requestVersion) {
        return;
      }

      set({
        characterGear: null,
        gearError: (err as Error).message,
        isLoadingGear: false,
      });
    }
  },

  syncPlayerGear: async (groupId: string, playerId: string, lodestoneId?: number) => {
    const requestVersion = get().requestVersion;
    set({
      isSyncing: true,
      syncError: null,
    });

    try {
      const params = lodestoneId ? `?lodestone_id=${lodestoneId}` : '';
      const result = await api.post<SyncResult>(`/api/lodestone/sync/${groupId}/${playerId}${params}`);

      if (get().requestVersion === requestVersion) {
        set({ isSyncing: false });
      }

      return result;
    } catch (err) {
      if (get().requestVersion === requestVersion) {
        set({
          syncError: (err as Error).message,
          isSyncing: false,
        });
      }

      throw err;
    }
  },

  clearSearch: () =>
    set({
      searchResults: [],
      searchTotal: 0,
      searchError: null,
      isSearching: false,
    }),

  clearGear: () =>
    set({
      characterGear: null,
      gearError: null,
      isLoadingGear: false,
    }),

  clearErrors: () =>
    set({
      searchError: null,
      gearError: null,
      syncError: null,
    }),

  resetState: () =>
    set((state) => ({
      ...INITIAL_STATE,
      requestVersion: state.requestVersion + 1,
    })),
}));
