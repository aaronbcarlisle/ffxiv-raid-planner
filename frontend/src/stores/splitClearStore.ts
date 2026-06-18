import { create } from 'zustand';
import { ApiError, api } from '../services/api';
import type { SplitClearAssignment, SplitClearData, SplitLootTarget, SplitRunSlot } from '../types';

export interface SplitClearAssignmentUpdate {
  /** Player Hub character link IDs (preferred over text fields when available). */
  runACharacterLinkId?: string | null;
  runBCharacterLinkId?: string | null;
  /** Legacy manual text fields — used as fallback for unlinked players. */
  mainCharacterName?: string | null;
  mainCharacterWorld?: string | null;
  altCharacterName?: string | null;
  altCharacterWorld?: string | null;
  runACharacter?: SplitRunSlot;
  runBCharacter?: SplitRunSlot;
  lootTarget?: SplitLootTarget;
  lootTargetJob?: string | null;
  runACleared?: boolean;
  runBCleared?: boolean;
  notes?: string | null;
}

interface SplitClearState {
  data: SplitClearData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchData: (groupId: string) => Promise<void>;
  toggleMode: (groupId: string, enabled: boolean) => Promise<void>;
  updateAssignment: (groupId: string, playerId: string, update: SplitClearAssignmentUpdate) => Promise<void>;
  resetWeek: (groupId: string) => Promise<void>;
  clearData: () => void;
}

function loadError(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return 'You do not have permission to view split-clear data.';
  const msg = err instanceof Error ? err.message : 'Unknown error';
  return `Could not load split-clear data. ${msg}`;
}

function saveError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  return `Could not save split-clear assignment. ${msg}`;
}

export const useSplitClearStore = create<SplitClearState>((set, get) => ({
  data: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchData: async (groupId) => {
    set({ data: null, isLoading: true, error: null });
    try {
      const raw = await api.get<SplitClearData>(`/api/static-groups/${groupId}/split-clear`);
      // Ensure playerCharacters is always a defined object even on older API responses
      const data: SplitClearData = { playerCharacters: {}, ...raw };
      set({ data, isLoading: false });
    } catch (err) {
      set({ error: loadError(err), isLoading: false });
    }
  },

  toggleMode: async (groupId, enabled) => {
    set({ isSaving: true, error: null });
    try {
      const raw = await api.put<SplitClearData>(
        `/api/static-groups/${groupId}/split-clear/settings`,
        { enabled },
      );
      const data: SplitClearData = { playerCharacters: {}, ...raw };
      set({ data, isSaving: false });
    } catch (err) {
      set({ error: saveError(err), isSaving: false });
      throw err;
    }
  },

  updateAssignment: async (groupId, playerId, update) => {
    set({ isSaving: true, error: null });
    try {
      const assignment = await api.patch<SplitClearAssignment>(
        `/api/static-groups/${groupId}/split-clear/${playerId}`,
        update,
      );
      const current = get().data;
      if (current) {
        const existing = current.assignments.findIndex(a => a.snapshotPlayerId === playerId);
        const next = existing >= 0
          ? current.assignments.map(a => a.snapshotPlayerId === playerId ? assignment : a)
          : [...current.assignments, assignment];
        set({ data: { ...current, assignments: next }, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      set({ error: saveError(err), isSaving: false });
      throw err;
    }
  },

  resetWeek: async (groupId) => {
    set({ isSaving: true, error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/split-clear/reset-week`, {});
      const current = get().data;
      if (current) {
        set({
          data: {
            ...current,
            assignments: current.assignments.map(a => ({
              ...a,
              runACleared: false,
              runBCleared: false,
            })),
          },
          isSaving: false,
        });
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      set({ error: saveError(err), isSaving: false });
      throw err;
    }
  },

  clearData: () => set({ data: null, error: null }),
}));
