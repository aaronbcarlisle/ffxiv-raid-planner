import { create } from 'zustand';
import { api } from '../services/api';
import type {
  ScheduleSession,
  ScheduleSessionCreate,
  ScheduleSessionUpdate,
  RsvpStatus,
  ScheduleRsvp,
} from '../types';

interface ScheduleState {
  sessions: ScheduleSession[];
  isLoading: boolean;
  error: string | null;

  fetchSessions: (groupId: string) => Promise<void>;
  createSession: (groupId: string, data: ScheduleSessionCreate) => Promise<void>;
  updateSession: (groupId: string, sessionId: string, data: ScheduleSessionUpdate) => Promise<void>;
  deleteSession: (groupId: string, sessionId: string) => Promise<void>;
  submitRsvp: (groupId: string, sessionId: string, status: RsvpStatus, note?: string) => Promise<void>;
  clearSessions: () => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await api.get<ScheduleSession[]>(
        `/api/static-groups/${groupId}/schedule`
      );
      set({ sessions, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createSession: async (groupId: string, data: ScheduleSessionCreate) => {
    set({ error: null });
    try {
      const session = await api.post<ScheduleSession>(
        `/api/static-groups/${groupId}/schedule`,
        data
      );
      set((state) => ({
        sessions: [...state.sessions, session].sort((left, right) => left.startTime.localeCompare(right.startTime)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  updateSession: async (groupId: string, sessionId: string, data: ScheduleSessionUpdate) => {
    set({ error: null });
    try {
      const updated = await api.put<ScheduleSession>(
        `/api/static-groups/${groupId}/schedule/${sessionId}`,
        data
      );
      set((state) => ({
        sessions: state.sessions
          .map((s) => (s.id === sessionId ? updated : s))
          .sort((left, right) => left.startTime.localeCompare(right.startTime)),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  deleteSession: async (groupId: string, sessionId: string) => {
    set({ error: null });
    try {
      await api.delete(`/api/static-groups/${groupId}/schedule/${sessionId}`);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  submitRsvp: async (groupId: string, sessionId: string, status: RsvpStatus, note?: string) => {
    set({ error: null });
    try {
      const rsvp = await api.post<ScheduleRsvp>(
        `/api/static-groups/${groupId}/schedule/${sessionId}/rsvp`,
        { status, note }
      );
      set((state) => ({
        sessions: state.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          const existingIdx = s.rsvps.findIndex((r) => r.userId === rsvp.userId);
          const rsvps = existingIdx >= 0
            ? s.rsvps.map((r, i) => (i === existingIdx ? rsvp : r))
            : [...s.rsvps, rsvp];
          return { ...s, rsvps };
        }),
      }));
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearSessions: () => set({
    sessions: [],
    error: null,
  }),
}));
