import { create } from 'zustand';
import type { Static, Player, StaticSettings, GearSlotStatus } from '../types';
import { GEAR_SLOTS } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { DEFAULT_DISPLAY_ORDER, DEFAULT_LOOT_PRIORITY } from '../utils/constants';

// Number of default empty slots for new statics
const DEFAULT_SLOT_COUNT = 8;

// Create default gear with all slots empty
function createDefaultGear(): GearSlotStatus[] {
  return GEAR_SLOTS.map((slot) => ({
    slot,
    bisSource: 'raid' as const,
    hasItem: false,
    isAugmented: false,
  }));
}

// Create template players for a new static
export function createTemplatePlayers(staticId: string): Player[] {
  const now = new Date().toISOString();
  return Array.from({ length: DEFAULT_SLOT_COUNT }, (_, index) => ({
    id: crypto.randomUUID(),
    staticId,
    name: '',
    job: '',
    role: '', // Empty role - will be set when job is selected
    configured: false,
    sortOrder: index,
    isSubstitute: false,
    gear: createDefaultGear(),
    createdAt: now,
    updatedAt: now,
  }));
}

export type ViewMode = 'compact' | 'expanded';

interface StaticState {
  currentStatic: Static | null;
  isLoading: boolean;
  error: string | null;
  selectedFloor: FloorNumber;
  viewMode: ViewMode;
  editingPlayerId: string | null;

  // Actions
  setStatic: (staticData: Static) => void;
  clearStatic: () => void;
  updateSettings: (settings: Partial<StaticSettings>) => void;
  addPlayer: (player: Player) => void;
  addPlayerSlot: () => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  configurePlayer: (playerId: string, name: string, job: string, role: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedFloor: (floor: FloorNumber) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditingPlayerId: (playerId: string | null) => void;
}

export const useStaticStore = create<StaticState>((set) => ({
  currentStatic: null,
  isLoading: false,
  error: null,
  selectedFloor: 1,
  viewMode: 'compact',
  editingPlayerId: null,

  setStatic: (staticData) => set({ currentStatic: staticData, error: null }),

  clearStatic: () => set({ currentStatic: null, editingPlayerId: null }),

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

  addPlayerSlot: () =>
    set((state) => {
      if (!state.currentStatic) return state;
      const now = new Date().toISOString();
      const newPlayer: Player = {
        id: crypto.randomUUID(),
        staticId: state.currentStatic.id,
        name: '',
        job: '',
        role: '', // Generic slot - role determined when job is selected
        configured: false,
        sortOrder: state.currentStatic.players.length,
        isSubstitute: false,
        gear: createDefaultGear(),
        createdAt: now,
        updatedAt: now,
      };
      return {
        currentStatic: {
          ...state.currentStatic,
          players: [...state.currentStatic.players, newPlayer],
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

  configurePlayer: (playerId, name, job, role) =>
    set((state) => {
      if (!state.currentStatic) return state;
      return {
        currentStatic: {
          ...state.currentStatic,
          players: state.currentStatic.players.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  name,
                  job,
                  role,
                  configured: true,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        },
        editingPlayerId: null,
      };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setSelectedFloor: (floor) => set({ selectedFloor: floor }),

  setViewMode: (viewMode) => set({ viewMode }),

  setEditingPlayerId: (editingPlayerId) => set({ editingPlayerId }),
}));

// Default settings for new statics
export const getDefaultSettings = (): StaticSettings => ({
  displayOrder: DEFAULT_DISPLAY_ORDER,
  lootPriority: DEFAULT_LOOT_PRIORITY,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSync: false,
  syncFrequency: 'weekly',
});
