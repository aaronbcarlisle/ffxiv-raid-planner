import { create } from 'zustand';
import { api } from '../services/api';
import type {
  StaticCharacterRegistration,
  StaticCharacterRegistrationCreate,
  StaticCharacterRegistrationUpdate,
  StaticCharacterRegistrationsResponse,
} from '../types';

interface StaticCharacterState {
  /** Registrations keyed by snapshotPlayerId, per group. */
  registrationsByGroup: Record<string, Record<string, StaticCharacterRegistration[]>>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchRegistrations: (groupId: string) => Promise<void>;
  createRegistration: (groupId: string, payload: StaticCharacterRegistrationCreate) => Promise<StaticCharacterRegistration>;
  updateRegistration: (groupId: string, regId: string, payload: StaticCharacterRegistrationUpdate) => Promise<StaticCharacterRegistration>;
  setPrimaryRegistration: (groupId: string, regId: string, snapshotPlayerId: string) => Promise<StaticCharacterRegistration>;
  deleteRegistration: (groupId: string, regId: string, snapshotPlayerId: string) => Promise<void>;
  clearGroup: (groupId: string) => void;
}

export const useStaticCharacterStore = create<StaticCharacterState>((set, _get) => ({
  registrationsByGroup: {},
  isLoading: false,
  isSaving: false,
  error: null,

  fetchRegistrations: async (groupId) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await api.get<StaticCharacterRegistrationsResponse>(
        `/api/static-groups/${groupId}/character-registrations`,
      );
      set(state => ({
        registrationsByGroup: {
          ...state.registrationsByGroup,
          [groupId]: resp.registrations,
        },
        isLoading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: `Could not load character registrations. ${msg}`, isLoading: false });
    }
  },

  createRegistration: async (groupId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const reg = await api.post<StaticCharacterRegistration>(
        `/api/static-groups/${groupId}/character-registrations`,
        payload,
      );
      set(state => {
        const current = state.registrationsByGroup[groupId] ?? {};
        const existing = current[reg.snapshotPlayerId] ?? [];
        return {
          registrationsByGroup: {
            ...state.registrationsByGroup,
            [groupId]: {
              ...current,
              [reg.snapshotPlayerId]: [...existing, reg],
            },
          },
          isSaving: false,
        };
      });
      return reg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: `Could not create character registration. ${msg}`, isSaving: false });
      throw err;
    }
  },

  updateRegistration: async (groupId, regId, payload) => {
    set({ isSaving: true, error: null });
    try {
      const reg = await api.patch<StaticCharacterRegistration>(
        `/api/static-groups/${groupId}/character-registrations/${regId}`,
        payload,
      );
      set(state => ({
        registrationsByGroup: {
          ...state.registrationsByGroup,
          [groupId]: _replaceReg(state.registrationsByGroup[groupId] ?? {}, reg),
        },
        isSaving: false,
      }));
      return reg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: `Could not update character registration. ${msg}`, isSaving: false });
      throw err;
    }
  },

  setPrimaryRegistration: async (groupId, regId, snapshotPlayerId) => {
    set({ isSaving: true, error: null });
    try {
      const reg = await api.post<StaticCharacterRegistration>(
        `/api/static-groups/${groupId}/character-registrations/${regId}/set-primary`,
        {},
      );
      set(state => {
        const current = state.registrationsByGroup[groupId] ?? {};
        const playerRegs = (current[snapshotPlayerId] ?? []).map(r => ({
          ...r,
          isPrimaryForStatic: r.id === regId,
        }));
        return {
          registrationsByGroup: {
            ...state.registrationsByGroup,
            [groupId]: { ...current, [snapshotPlayerId]: playerRegs },
          },
          isSaving: false,
        };
      });
      return reg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: `Could not set primary registration. ${msg}`, isSaving: false });
      throw err;
    }
  },

  deleteRegistration: async (groupId, regId, snapshotPlayerId) => {
    set({ isSaving: true, error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/character-registrations/${regId}`);
      set(state => {
        const current = state.registrationsByGroup[groupId] ?? {};
        const playerRegs = (current[snapshotPlayerId] ?? []).filter(r => r.id !== regId);
        return {
          registrationsByGroup: {
            ...state.registrationsByGroup,
            [groupId]: { ...current, [snapshotPlayerId]: playerRegs },
          },
          isSaving: false,
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      set({ error: `Could not delete character registration. ${msg}`, isSaving: false });
      throw err;
    }
  },

  clearGroup: (groupId) => {
    set(state => {
      const next = { ...state.registrationsByGroup };
      delete next[groupId];
      return { registrationsByGroup: next };
    });
  },
}));

function _replaceReg(
  current: Record<string, StaticCharacterRegistration[]>,
  updated: StaticCharacterRegistration,
): Record<string, StaticCharacterRegistration[]> {
  const playerRegs = (current[updated.snapshotPlayerId] ?? []).map(r =>
    r.id === updated.id ? updated : r,
  );
  return { ...current, [updated.snapshotPlayerId]: playerRegs };
}
