import { create } from 'zustand';
import type {
  Static,
  Player,
  StaticSettings,
  GearSlotStatus,
  PageMode,
  ViewMode,
  TomeWeaponStatus,
  TemplateRole,
  RaidPosition,
  TankRole,
} from '../types';
import { GEAR_SLOTS } from '../types';
import type { FloorNumber } from '../gamedata/loot-tables';
import { DEFAULT_DISPLAY_ORDER, DEFAULT_LOOT_PRIORITY } from '../utils/constants';
import { getDefaultPositionForRole } from '../utils/priority';
import * as api from '../services/api';

// Debounce delay for auto-save (ms)
const SAVE_DEBOUNCE_DELAY = 1000;

// Create default gear with all slots empty
// Ring2 defaults to tome since you can't equip two identical raid rings
function createDefaultGear(): GearSlotStatus[] {
  return GEAR_SLOTS.map((slot) => ({
    slot,
    bisSource: slot === 'ring2' ? 'tome' as const : 'raid' as const,
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

// Get light party group (1 or 2) from raid position
function getGroupFromPosition(position: RaidPosition): 1 | 2 {
  return position.endsWith('1') ? 1 : 2;
}

// Swap position between light party groups (M1↔M2, T1↔T2, etc.)
function swapPositionGroup(position: RaidPosition): RaidPosition {
  const role = position.charAt(0); // T, H, M, or R
  const currentNum = position.charAt(1); // 1 or 2
  const newNum = currentNum === '1' ? '2' : '1';
  return `${role}${newNum}` as RaidPosition;
}

// Optimal party composition for savage raiding
// Each entry: [templateRole, position, tankRole (if applicable)]
const OPTIMAL_PARTY_COMP: Array<{
  templateRole: TemplateRole;
  position: RaidPosition;
  tankRole?: TankRole;
}> = [
  { templateRole: 'tank', position: 'T1', tankRole: 'MT' },
  { templateRole: 'tank', position: 'T2', tankRole: 'OT' },
  { templateRole: 'pure-healer', position: 'H1' },
  { templateRole: 'barrier-healer', position: 'H2' },
  { templateRole: 'melee', position: 'M1' },
  { templateRole: 'melee', position: 'M2' },
  { templateRole: 'physical-ranged', position: 'R1' },
  { templateRole: 'magical-ranged', position: 'R2' },
];

// Create template players for a new static with optimal party composition
export function createTemplatePlayers(staticId: string): Player[] {
  const now = new Date().toISOString();
  return OPTIMAL_PARTY_COMP.map((slot, index) => ({
    id: crypto.randomUUID(),
    staticId,
    name: '',
    job: '',
    role: '', // Empty role - will be set when job is selected
    position: slot.position,
    tankRole: slot.tankRole,
    templateRole: slot.templateRole,
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
  isSaving: boolean;
  error: string | null;
  selectedFloor: FloorNumber;
  pageMode: PageMode;
  viewMode: ViewMode;
  editingPlayerId: string | null;
  clipboardPlayer: Player | null;
  // Track pending saves
  pendingPlayerSaves: Set<string>;

  // Actions
  setStatic: (staticData: Static) => void;
  clearStatic: () => void;
  updateSettings: (settings: Partial<StaticSettings>) => void;
  addPlayer: (player: Player) => void;
  addPlayerSlot: () => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  configurePlayer: (playerId: string, name: string, job: string, role: string) => void;
  duplicatePlayer: (playerId: string) => void;
  reorderPlayers: (activeId: string, overId: string) => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedFloor: (floor: FloorNumber) => void;
  setPageMode: (mode: PageMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setEditingPlayerId: (playerId: string | null) => void;
  setClipboardPlayer: (player: Player | null) => void;

  // API Actions
  fetchStatic: (shareCode: string) => Promise<void>;
  createNewStatic: (name: string, tier: string) => Promise<Static>;
  savePlayer: (playerId: string) => Promise<void>;
  savePlayerDebounced: (playerId: string) => void;
}

// Debounced save function (created once per store instance)
let debouncedSavePlayer: api.DebouncedFn<(state: StaticState, playerId: string) => void> | null = null;

export const useStaticStore = create<StaticState>((set, get) => {
  // Initialize debounced save function
  const performSave = async (state: StaticState, playerId: string) => {
    const { currentStatic, pendingPlayerSaves } = state;
    if (!currentStatic) return;

    const player = currentStatic.players.find((p) => p.id === playerId);
    if (!player) return;

    try {
      set({ isSaving: true });
      await api.updatePlayer(currentStatic.id, playerId, {
        name: player.name,
        job: player.job,
        role: player.role,
        position: player.position,
        tankRole: player.tankRole,
        configured: player.configured,
        sortOrder: player.sortOrder,
        isSubstitute: player.isSubstitute,
        notes: player.notes,
        lodestoneId: player.lodestoneId,
        bisLink: player.bisLink,
        fflogsId: player.fflogsId,
        gear: player.gear,
        tomeWeapon: player.tomeWeapon,
      });
      // Remove from pending saves
      pendingPlayerSaves.delete(playerId);
      set({ pendingPlayerSaves: new Set(pendingPlayerSaves), isSaving: false });
    } catch (error) {
      console.error('Failed to save player:', error);
      set({ isSaving: false });
    }
  };

  debouncedSavePlayer = api.debounce(performSave, SAVE_DEBOUNCE_DELAY);

  return {
    currentStatic: null,
    isLoading: false,
    isSaving: false,
    error: null,
    selectedFloor: 1,
    pageMode: 'players',
    viewMode: 'expanded',
    editingPlayerId: null,
    clipboardPlayer: null,
    pendingPlayerSaves: new Set(),

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

    addPlayerSlot: () => {
      const state = get();
      if (!state.currentStatic) return;

      const now = new Date().toISOString();
      const newPlayer: Player = {
        id: crypto.randomUUID(),
        staticId: state.currentStatic.id,
        name: '',
        job: '',
        role: '',
        configured: false,
        sortOrder: state.currentStatic.players.length,
        isSubstitute: false,
        gear: createDefaultGear(),
        tomeWeapon: createDefaultTomeWeapon(),
        createdAt: now,
        updatedAt: now,
      };

      // Add player locally
      set((s) => ({
        currentStatic: s.currentStatic
          ? {
              ...s.currentStatic,
              players: [...s.currentStatic.players, newPlayer],
            }
          : null,
      }));

      // Create on server
      api
        .createPlayer(state.currentStatic.id, {
          name: newPlayer.name,
          job: newPlayer.job,
          role: newPlayer.role,
          configured: newPlayer.configured,
          sortOrder: newPlayer.sortOrder,
          isSubstitute: newPlayer.isSubstitute,
          gear: newPlayer.gear,
          tomeWeapon: newPlayer.tomeWeapon,
        })
        .then((serverPlayer) => {
          // Update with server-generated ID
          set((s) => ({
            currentStatic: s.currentStatic
              ? {
                  ...s.currentStatic,
                  players: s.currentStatic.players.map((p) =>
                    p.id === newPlayer.id ? { ...p, id: serverPlayer.id } : p
                  ),
                }
              : null,
          }));
        })
        .catch((err) => {
          console.error('Failed to create player on server:', err);
        });
    },

    updatePlayer: (playerId, updates) => {
      set((state) => {
        if (!state.currentStatic) return state;

        // Check if role is changing - if so, recalculate default position
        const currentPlayer = state.currentStatic.players.find((p) => p.id === playerId);
        let finalUpdates = { ...updates };
        let settingsUpdates: Partial<StaticSettings> | null = null;

        if (updates.role && currentPlayer && updates.role !== currentPlayer.role) {
          // Role is changing - get new default position
          if (!('position' in updates)) {
            const { position, tankRole } = getDefaultPositionForRole(
              state.currentStatic.players,
              updates.role,
              playerId
            );
            finalUpdates = { ...finalUpdates, position, tankRole };
          }
        }

        // If job is changing, auto-switch to custom sort to preserve card position
        if (updates.job && currentPlayer && updates.job !== currentPlayer.job) {
          if (state.currentStatic.settings.sortPreset !== 'custom') {
            settingsUpdates = { sortPreset: 'custom' };
          }
        }

        // Add to pending saves
        const newPendingSaves = new Set(state.pendingPlayerSaves);
        newPendingSaves.add(playerId);

        return {
          currentStatic: {
            ...state.currentStatic,
            players: state.currentStatic.players.map((p) =>
              p.id === playerId ? { ...p, ...finalUpdates } : p
            ),
            // Apply settings updates if job changed
            ...(settingsUpdates && {
              settings: { ...state.currentStatic.settings, ...settingsUpdates },
            }),
          },
          pendingPlayerSaves: newPendingSaves,
        };
      });

      // Trigger debounced save
      get().savePlayerDebounced(playerId);
    },

    removePlayer: (playerId) => {
      const state = get();
      if (!state.currentStatic) return;

      // Remove locally
      set((s) => ({
        currentStatic: s.currentStatic
          ? {
              ...s.currentStatic,
              players: s.currentStatic.players.filter((p) => p.id !== playerId),
            }
          : null,
      }));

      // Delete on server
      api.deletePlayer(state.currentStatic.id, playerId).catch((err) => {
        console.error('Failed to delete player on server:', err);
      });
    },

    configurePlayer: (playerId, name, job, role) => {
      const state = get();
      if (!state.currentStatic) return;

      // Get default position for this role
      const { position, tankRole } = getDefaultPositionForRole(
        state.currentStatic.players,
        role,
        playerId
      );

      set((s) => ({
        currentStatic: s.currentStatic
          ? {
              ...s.currentStatic,
              players: s.currentStatic.players.map((p) =>
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
            }
          : null,
        editingPlayerId: null,
      }));

      // Save to server
      get().savePlayer(playerId);
    },

    duplicatePlayer: (playerId) => {
      const state = get();
      if (!state.currentStatic) return;

      const sourcePlayer = state.currentStatic.players.find((p) => p.id === playerId);
      if (!sourcePlayer) return;

      const now = new Date().toISOString();
      const tempId = crypto.randomUUID();

      // Get default position for the duplicated player
      const { position, tankRole } = getDefaultPositionForRole(
        state.currentStatic.players,
        sourcePlayer.role,
        tempId
      );

      const newPlayer: Player = {
        ...sourcePlayer,
        id: tempId,
        name: sourcePlayer.name,
        position,
        tankRole,
        sortOrder: state.currentStatic.players.length,
        createdAt: now,
        updatedAt: now,
      };

      // Add locally
      set((s) => ({
        currentStatic: s.currentStatic
          ? {
              ...s.currentStatic,
              players: [...s.currentStatic.players, newPlayer],
            }
          : null,
        editingPlayerId: tempId,
      }));

      // Create on server
      api
        .createPlayer(state.currentStatic.id, {
          name: newPlayer.name,
          job: newPlayer.job,
          role: newPlayer.role,
          position: newPlayer.position,
          tankRole: newPlayer.tankRole,
          configured: newPlayer.configured,
          sortOrder: newPlayer.sortOrder,
          isSubstitute: newPlayer.isSubstitute,
          notes: newPlayer.notes,
          lodestoneId: newPlayer.lodestoneId,
          bisLink: newPlayer.bisLink,
          fflogsId: newPlayer.fflogsId,
          gear: newPlayer.gear,
          tomeWeapon: newPlayer.tomeWeapon,
        })
        .then((serverPlayer) => {
          // Update with server-generated ID
          set((s) => ({
            currentStatic: s.currentStatic
              ? {
                  ...s.currentStatic,
                  players: s.currentStatic.players.map((p) =>
                    p.id === tempId ? { ...p, id: serverPlayer.id } : p
                  ),
                }
              : null,
            editingPlayerId: s.editingPlayerId === tempId ? serverPlayer.id : s.editingPlayerId,
          }));
        })
        .catch((err) => {
          console.error('Failed to create duplicated player on server:', err);
        });
    },

    reorderPlayers: (activeId: string, overId: string) => {
      const state = get();
      if (!state.currentStatic || activeId === overId) return;

      const players = state.currentStatic.players;
      const activeIndex = players.findIndex((p) => p.id === activeId);
      const overIndex = players.findIndex((p) => p.id === overId);

      if (activeIndex === -1 || overIndex === -1) return;

      const activePlayer = players[activeIndex];
      const overPlayer = players[overIndex];

      // Check if this is a cross-group move (both players have positions)
      let newPosition = activePlayer.position;
      if (activePlayer.position && overPlayer.position) {
        const activeGroup = getGroupFromPosition(activePlayer.position);
        const overGroup = getGroupFromPosition(overPlayer.position);

        // If dragging to a different group, swap the position number
        if (activeGroup !== overGroup) {
          newPosition = swapPositionGroup(activePlayer.position);
        }
      }

      // Create new array with reordered players
      const newPlayers = [...players];
      const [movedPlayer] = newPlayers.splice(activeIndex, 1);
      // Apply new position if it changed
      const updatedMovedPlayer = newPosition !== activePlayer.position
        ? { ...movedPlayer, position: newPosition }
        : movedPlayer;
      newPlayers.splice(overIndex, 0, updatedMovedPlayer);

      // Update sortOrder for all players based on new positions
      const updatedPlayers = newPlayers.map((player, index) => ({
        ...player,
        sortOrder: index,
        updatedAt: new Date().toISOString(),
      }));

      // Auto-switch to custom sort mode when user manually reorders
      const shouldSwitchToCustom = state.currentStatic.settings.sortPreset !== 'custom';

      // Update state
      set({
        currentStatic: {
          ...state.currentStatic,
          players: updatedPlayers,
          // Switch to custom mode to preserve the manual ordering
          ...(shouldSwitchToCustom && {
            settings: { ...state.currentStatic.settings, sortPreset: 'custom' },
          }),
        },
      });

      // Save all affected players (those whose sortOrder changed)
      const affectedIds = updatedPlayers
        .filter((p, i) => players.find((orig) => orig.id === p.id)?.sortOrder !== i)
        .map((p) => p.id);

      affectedIds.forEach((playerId) => {
        get().savePlayerDebounced(playerId);
      });
    },

    setLoading: (isLoading) => set({ isLoading }),

    setSaving: (isSaving) => set({ isSaving }),

    setError: (error) => set({ error }),

    setSelectedFloor: (floor) => set({ selectedFloor: floor }),

    setPageMode: (pageMode) => set({ pageMode }),

    setViewMode: (viewMode) => set({ viewMode }),

    setEditingPlayerId: (editingPlayerId) => set({ editingPlayerId }),

    setClipboardPlayer: (clipboardPlayer) => set({ clipboardPlayer }),

    // API Actions
    fetchStatic: async (shareCode: string) => {
      set({ isLoading: true, error: null });
      try {
        const staticData = await api.getStaticByShareCode(shareCode);
        set({ currentStatic: staticData, isLoading: false });
      } catch (error) {
        const message = error instanceof api.ApiError ? error.message : 'Failed to load static';
        set({ error: message, isLoading: false });
      }
    },

    createNewStatic: async (name: string, tier: string) => {
      set({ isLoading: true, error: null });
      try {
        const staticData = await api.createStatic({
          name,
          tier,
          settings: getDefaultSettings(),
        });
        set({ currentStatic: staticData, isLoading: false });
        return staticData;
      } catch (error) {
        const message = error instanceof api.ApiError ? error.message : 'Failed to create static';
        set({ error: message, isLoading: false });
        throw error;
      }
    },

    savePlayer: async (playerId: string) => {
      const state = get();
      if (!state.currentStatic) return;

      const player = state.currentStatic.players.find((p) => p.id === playerId);
      if (!player) return;

      try {
        set({ isSaving: true });
        await api.updatePlayer(state.currentStatic.id, playerId, {
          name: player.name,
          job: player.job,
          role: player.role,
          position: player.position,
          tankRole: player.tankRole,
          configured: player.configured,
          sortOrder: player.sortOrder,
          isSubstitute: player.isSubstitute,
          notes: player.notes,
          lodestoneId: player.lodestoneId,
          bisLink: player.bisLink,
          fflogsId: player.fflogsId,
          gear: player.gear,
          tomeWeapon: player.tomeWeapon,
        });
        // Remove from pending saves
        const newPendingSaves = new Set(state.pendingPlayerSaves);
        newPendingSaves.delete(playerId);
        set({ pendingPlayerSaves: newPendingSaves, isSaving: false });
      } catch (error) {
        console.error('Failed to save player:', error);
        set({ isSaving: false });
      }
    },

    savePlayerDebounced: (playerId: string) => {
      if (debouncedSavePlayer) {
        debouncedSavePlayer(get(), playerId);
      }
    },
  };
});

// Default settings for new statics
export const getDefaultSettings = (): StaticSettings => ({
  displayOrder: DEFAULT_DISPLAY_ORDER,
  lootPriority: DEFAULT_LOOT_PRIORITY,
  sortPreset: 'custom',
  groupView: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  autoSync: false,
  syncFrequency: 'weekly',
});
