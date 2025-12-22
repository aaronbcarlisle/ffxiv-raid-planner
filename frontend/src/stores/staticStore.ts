import { create } from 'zustand';
import type {
  Static,
  Player,
  StaticSettings,
  GearSlotStatus,
  PageMode,
  ViewMode,
  TomeWeaponStatus,
} from '../types';
import { GEAR_SLOTS } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { DEFAULT_DISPLAY_ORDER, DEFAULT_LOOT_PRIORITY } from '../utils/constants';
import { getDefaultPositionForRole } from '../utils/priority';

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

// Create default tome weapon status
function createDefaultTomeWeapon(): TomeWeaponStatus {
  return {
    pursuing: false,
    hasItem: false,
    isAugmented: false,
  };
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
    tomeWeapon: createDefaultTomeWeapon(),
    createdAt: now,
    updatedAt: now,
  }));
}

interface StaticState {
  currentStatic: Static | null;
  isLoading: boolean;
  error: string | null;
  selectedFloor: FloorNumber;
  pageMode: PageMode;
  viewMode: ViewMode;
  editingPlayerId: string | null;
  clipboardPlayer: Player | null;
  // Track if a newly duplicated player should start expanded
  duplicatedPlayerId: string | null;
  duplicatedPlayerExpanded: boolean;

  // Actions
  setStatic: (staticData: Static) => void;
  clearStatic: () => void;
  updateSettings: (settings: Partial<StaticSettings>) => void;
  addPlayer: (player: Player) => void;
  addPlayerSlot: () => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  configurePlayer: (playerId: string, name: string, job: string, role: string) => void;
  duplicatePlayer: (playerId: string, expanded?: boolean) => void;
  clearDuplicatedPlayerState: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedFloor: (floor: FloorNumber) => void;
  setPageMode: (mode: PageMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditingPlayerId: (playerId: string | null) => void;
  setClipboardPlayer: (player: Player | null) => void;
}

export const useStaticStore = create<StaticState>((set) => ({
  currentStatic: null,
  isLoading: false,
  error: null,
  selectedFloor: 1,
  pageMode: 'players',
  viewMode: 'expanded',
  editingPlayerId: null,
  clipboardPlayer: null,
  duplicatedPlayerId: null,
  duplicatedPlayerExpanded: false,

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
        tomeWeapon: createDefaultTomeWeapon(),
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

      // Check if role is changing - if so, recalculate default position
      const currentPlayer = state.currentStatic.players.find((p) => p.id === playerId);
      let finalUpdates = { ...updates };

      if (updates.role && currentPlayer && updates.role !== currentPlayer.role) {
        // Role is changing - get new default position
        // Only auto-assign if they don't already have a position explicitly set in this update
        if (!('position' in updates)) {
          const { position, tankRole } = getDefaultPositionForRole(
            state.currentStatic.players,
            updates.role,
            playerId
          );
          finalUpdates = { ...finalUpdates, position, tankRole };
        }
      }

      return {
        currentStatic: {
          ...state.currentStatic,
          players: state.currentStatic.players.map((p) =>
            p.id === playerId ? { ...p, ...finalUpdates } : p
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

      // Get default position for this role
      const { position, tankRole } = getDefaultPositionForRole(
        state.currentStatic.players,
        role,
        playerId
      );

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
                  position,
                  tankRole,
                  configured: true,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        },
        editingPlayerId: null,
      };
    }),

  duplicatePlayer: (playerId, expanded = false) =>
    set((state) => {
      if (!state.currentStatic) return state;
      const sourcePlayer = state.currentStatic.players.find((p) => p.id === playerId);
      if (!sourcePlayer) return state;

      const now = new Date().toISOString();
      const newPlayerId = crypto.randomUUID();

      // Get default position for the duplicated player (don't copy source position)
      const { position, tankRole } = getDefaultPositionForRole(
        state.currentStatic.players,
        sourcePlayer.role,
        newPlayerId
      );

      const newPlayer: Player = {
        ...sourcePlayer,
        id: newPlayerId,
        name: sourcePlayer.name, // Keep name, user will edit inline
        position, // Assign new position
        tankRole, // Assign new tank role
        sortOrder: state.currentStatic.players.length,
        createdAt: now,
        updatedAt: now,
      };

      return {
        currentStatic: {
          ...state.currentStatic,
          players: [...state.currentStatic.players, newPlayer],
        },
        editingPlayerId: newPlayer.id, // Open inline edit for new player
        duplicatedPlayerId: newPlayer.id,
        duplicatedPlayerExpanded: expanded,
      };
    }),

  clearDuplicatedPlayerState: () =>
    set({ duplicatedPlayerId: null, duplicatedPlayerExpanded: false }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setSelectedFloor: (floor) => set({ selectedFloor: floor }),

  setPageMode: (pageMode) => set({ pageMode }),

  setViewMode: (viewMode) => set({ viewMode }),

  setEditingPlayerId: (editingPlayerId) => set({ editingPlayerId }),

  setClipboardPlayer: (clipboardPlayer) => set({ clipboardPlayer }),
}));

// Default settings for new statics
export const getDefaultSettings = (): StaticSettings => ({
  displayOrder: DEFAULT_DISPLAY_ORDER,
  lootPriority: DEFAULT_LOOT_PRIORITY,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSync: false,
  syncFrequency: 'weekly',
});
