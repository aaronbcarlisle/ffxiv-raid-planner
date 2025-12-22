import { create } from 'zustand';
import type { Static, Player, StaticSettings } from '../types';
import { DEFAULT_DISPLAY_ORDER, DEFAULT_LOOT_PRIORITY } from '../utils/constants';

interface StaticState {
  currentStatic: Static | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setStatic: (staticData: Static) => void;
  clearStatic: () => void;
  updateSettings: (settings: Partial<StaticSettings>) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStaticStore = create<StaticState>((set) => ({
  currentStatic: null,
  isLoading: false,
  error: null,

  setStatic: (staticData) => set({ currentStatic: staticData, error: null }),

  clearStatic: () => set({ currentStatic: null }),

  updateSettings: (settings) =>
    set((state) => {
      if (!state.currentStatic) return state;
      return {
        currentStatic: {
          ...state.currentStatic,
          settings: { ...state.currentStatic.settings, ...settings },
        },
      };
    }),

  addPlayer: (player) =>
    set((state) => {
      if (!state.currentStatic) return state;
      return {
        currentStatic: {
          ...state.currentStatic,
          players: [...state.currentStatic.players, player],
        },
      };
    }),

  updatePlayer: (playerId, updates) =>
    set((state) => {
      if (!state.currentStatic) return state;
      return {
        currentStatic: {
          ...state.currentStatic,
          players: state.currentStatic.players.map((p) =>
            p.id === playerId ? { ...p, ...updates } : p
          ),
        },
      };
    }),

  removePlayer: (playerId) =>
    set((state) => {
      if (!state.currentStatic) return state;
      return {
        currentStatic: {
          ...state.currentStatic,
          players: state.currentStatic.players.filter((p) => p.id !== playerId),
        },
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));

// Default settings for new statics
export const getDefaultSettings = (): StaticSettings => ({
  displayOrder: DEFAULT_DISPLAY_ORDER,
  lootPriority: DEFAULT_LOOT_PRIORITY,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSync: false,
  syncFrequency: 'weekly',
});
