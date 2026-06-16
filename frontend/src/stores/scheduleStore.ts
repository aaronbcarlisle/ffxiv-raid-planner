import { create } from 'zustand';
import { api } from '../services/api';
import type {
  ScheduleSession,
  ScheduleSessionCreate,
  ScheduleSessionUpdate,
  RsvpStatus,
  ScheduleRsvp,
  ScheduleSettings,
  ScheduleSettingsUpdate,
  CalendarTokenResponse,
  OccurrenceResponse,
  ScheduleException,
  ScheduleExceptionCreate,
  DiscordMirrorStatus,
} from '../types';

interface ScheduleState {
  sessions: ScheduleSession[];
  settings: ScheduleSettings | null;
  isLoading: boolean;
  isLoadingSettings: boolean;
  error: string | null;

  fetchSessions: (groupId: string) => Promise<void>;
  fetchSettings: (groupId: string) => Promise<void>;
  updateSettings: (groupId: string, data: ScheduleSettingsUpdate) => Promise<void>;
  sendTestReminder: (groupId: string) => Promise<void>;
  postSessionPreview: (groupId: string) => Promise<void>;
  regenerateCalendar: (groupId: string) => Promise<void>;
  revokeCalendar: (groupId: string) => Promise<void>;
  createSession: (groupId: string, data: ScheduleSessionCreate) => Promise<void>;
  updateSession: (groupId: string, sessionId: string, data: ScheduleSessionUpdate) => Promise<void>;
  deleteSession: (groupId: string, sessionId: string) => Promise<void>;
  submitRsvp: (groupId: string, sessionId: string, status: RsvpStatus, note?: string) => Promise<void>;
  fetchOccurrences: (groupId: string, sessionId: string, count?: number) => Promise<OccurrenceResponse[]>;
  createException: (groupId: string, sessionId: string, data: ScheduleExceptionCreate) => Promise<ScheduleException>;
  deleteException: (groupId: string, sessionId: string, occurrenceDate: string) => Promise<void>;
  fetchExceptions: (groupId: string, sessionId: string) => Promise<ScheduleException[]>;
  syncDiscordMirror: (groupId: string, sessionId: string) => Promise<string[]>;
  fetchDiscordMirrors: (groupId: string, sessionId: string) => Promise<DiscordMirrorStatus[]>;
  clearSessions: () => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  sessions: [],
  settings: null,
  isLoading: false,
  isLoadingSettings: false,
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

  fetchSettings: async (groupId: string) => {
    set({ isLoadingSettings: true, error: null });
    try {
      const settings = await api.get<ScheduleSettings>(
        `/api/static-groups/${groupId}/scheduler/settings`
      );
      set({ settings, isLoadingSettings: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoadingSettings: false });
    }
  },

  updateSettings: async (groupId: string, data: ScheduleSettingsUpdate) => {
    set({ error: null });
    try {
      const settings = await api.put<ScheduleSettings>(
        `/api/static-groups/${groupId}/scheduler/settings`,
        data
      );
      set({ settings });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  sendTestReminder: async (groupId: string) => {
    set({ error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/scheduler/settings/test-reminder`);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  postSessionPreview: async (groupId: string) => {
    set({ error: null });
    try {
      await api.post(`/api/static-groups/${groupId}/scheduler/settings/post-session-preview`);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  regenerateCalendar: async (groupId: string) => {
    set({ error: null });
    try {
      const response = await api.post<CalendarTokenResponse>(
        `/api/static-groups/${groupId}/scheduler/calendar/regenerate`
      );
      set((state) => state.settings ? {
        settings: {
          ...state.settings,
          calendarEnabled: response.calendarEnabled,
          calendarUrl: response.calendarUrl,
          calendarTokenCreatedAt: response.calendarTokenCreatedAt,
        },
      } : state);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  revokeCalendar: async (groupId: string) => {
    set({ error: null });
    try {
      const response = await api.post<CalendarTokenResponse>(
        `/api/static-groups/${groupId}/scheduler/calendar/revoke`
      );
      set((state) => state.settings ? {
        settings: {
          ...state.settings,
          calendarEnabled: response.calendarEnabled,
          calendarUrl: response.calendarUrl,
          calendarTokenCreatedAt: response.calendarTokenCreatedAt,
        },
      } : state);
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
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

  fetchOccurrences: async (groupId: string, sessionId: string, count = 20) => {
    return api.get<OccurrenceResponse[]>(
      `/api/static-groups/${groupId}/schedule/${sessionId}/occurrences?count=${count}`
    );
  },

  createException: async (groupId: string, sessionId: string, data: ScheduleExceptionCreate) => {
    return api.post<ScheduleException>(
      `/api/static-groups/${groupId}/schedule/${sessionId}/exceptions`,
      data
    );
  },

  deleteException: async (groupId: string, sessionId: string, occurrenceDate: string) => {
    await api.delete(
      `/api/static-groups/${groupId}/schedule/${sessionId}/exceptions/${occurrenceDate}`
    );
  },

  fetchExceptions: async (groupId: string, sessionId: string) => {
    return api.get<ScheduleException[]>(
      `/api/static-groups/${groupId}/schedule/${sessionId}/exceptions`
    );
  },

  syncDiscordMirror: async (groupId: string, sessionId: string) => {
    const result = await api.post<{ actions: string[] }>(
      `/api/static-groups/${groupId}/schedule/${sessionId}/sync-discord`
    );
    return result.actions;
  },

  fetchDiscordMirrors: async (groupId: string, sessionId: string) => {
    return api.get<DiscordMirrorStatus[]>(
      `/api/static-groups/${groupId}/schedule/${sessionId}/discord-mirrors`
    );
  },

  clearSessions: () => set({
    sessions: [],
    settings: null,
    error: null,
  }),
}));
