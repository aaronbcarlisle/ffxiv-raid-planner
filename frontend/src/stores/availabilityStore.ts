import { create } from 'zustand';
import { api } from '../services/api';
import type {
  AvailabilityDateSummary,
  AvailabilitySubmit,
  AvailabilityTemplateDaySummary,
} from '../types';

interface AvailabilityState {
  data: AvailabilityDateSummary[];
  templateData: AvailabilityTemplateDaySummary[];
  isLoading: boolean;
  isLoadingTemplate: boolean;
  error: string | null;

  fetchAvailability: (groupId: string, startDate: string, endDate: string) => Promise<void>;
  submitAvailability: (groupId: string, date: string, slots: string[]) => Promise<void>;
  fetchTemplates: (groupId: string) => Promise<void>;
  submitTemplate: (groupId: string, dayOfWeek: string, slots: string[]) => Promise<void>;
  clearAvailability: () => void;
}

export const useAvailabilityStore = create<AvailabilityState>((set) => ({
  data: [],
  templateData: [],
  isLoading: false,
  isLoadingTemplate: false,
  error: null,

  fetchAvailability: async (groupId: string, startDate: string, endDate: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<AvailabilityDateSummary[]>(
        `/api/static-groups/${groupId}/availability?start_date=${startDate}&end_date=${endDate}`
      );
      set({ data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  submitAvailability: async (groupId: string, date: string, slots: string[]) => {
    set({ error: null });
    try {
      const body: AvailabilitySubmit = { date, slots };
      const response = await api.put<{ id: string; userId: string; username: string | null; date: string; slots: string[] }>(
        `/api/static-groups/${groupId}/availability`,
        body
      );
      set((state) => {
        const updated = { ...response };
        const dateExists = state.data.some((d) => d.date === date);

        if (!dateExists) {
          const newEntry: AvailabilityDateSummary = { date, responses: [updated] };
          return {
            data: [...state.data, newEntry].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }

        return {
          data: state.data.map((d) => {
            if (d.date !== date) return d;
            const existingIdx = d.responses.findIndex((r) => r.userId === response.userId);
            if (existingIdx >= 0) {
              return {
                ...d,
                responses: d.responses.map((r, i) => (i === existingIdx ? updated : r)),
              };
            }
            return { ...d, responses: [...d.responses, updated] };
          }),
        };
      });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  fetchTemplates: async (groupId: string) => {
    set({ isLoadingTemplate: true, error: null });
    try {
      const templateData = await api.get<AvailabilityTemplateDaySummary[]>(
        `/api/static-groups/${groupId}/availability/template`
      );
      set({ templateData, isLoadingTemplate: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoadingTemplate: false });
    }
  },

  submitTemplate: async (groupId: string, dayOfWeek: string, slots: string[]) => {
    set({ error: null });
    try {
      const response = await api.put<AvailabilityTemplateDaySummary['responses'][0]>(
        `/api/static-groups/${groupId}/availability/template`,
        { dayOfWeek, slots }
      );
      set((state) => {
        const existingDay = state.templateData.find((d) => d.dayOfWeek === dayOfWeek);
        if (!existingDay) {
          return {
            templateData: [
              ...state.templateData,
              { dayOfWeek, responses: [response] },
            ],
          };
        }
        return {
          templateData: state.templateData.map((d) => {
            if (d.dayOfWeek !== dayOfWeek) return d;
            const idx = d.responses.findIndex((r) => r.userId === response.userId);
            const responses = idx >= 0
              ? d.responses.map((r, i) => (i === idx ? response : r))
              : [...d.responses, response];
            return { ...d, responses };
          }),
        };
      });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearAvailability: () => set({ data: [], templateData: [], error: null }),
}));
