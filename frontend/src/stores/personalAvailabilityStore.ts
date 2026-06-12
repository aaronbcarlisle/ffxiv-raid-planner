/**
 * Personal Availability Store
 *
 * Manages user-level typical weekly availability, independent of any static.
 * Used in Player Hub and can be applied into static Event Planner schedules.
 */

import { create } from 'zustand';
import { api } from '../services/api';

export interface PersonalAvailabilityDay {
  dayOfWeek: string; // MO TU WE TH FR SA SU
  slots: string[];   // e.g. ["18:00", "18:30", "19:00"]
  timezone: string;
}

interface PersonalAvailabilityState {
  days: PersonalAvailabilityDay[];
  isLoading: boolean;
  error: string | null;

  fetchPersonalAvailability: () => Promise<void>;
  submitPersonalAvailability: (dayOfWeek: string, slots: string[], timezone: string) => Promise<void>;
  clearPersonalAvailability: () => void;
}

export const usePersonalAvailabilityStore = create<PersonalAvailabilityState>((set) => ({
  days: [],
  isLoading: false,
  error: null,

  fetchPersonalAvailability: async () => {
    set({ isLoading: true, error: null });
    try {
      const days = await api.get<PersonalAvailabilityDay[]>(
        '/api/player/availability/template'
      );
      set({ days, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  submitPersonalAvailability: async (dayOfWeek: string, slots: string[], timezone: string) => {
    set({ error: null });
    try {
      const response = await api.put<PersonalAvailabilityDay>(
        '/api/player/availability/template',
        { dayOfWeek, slots, timezone }
      );
      set((state) => {
        const idx = state.days.findIndex((d) => d.dayOfWeek === dayOfWeek);
        if (idx >= 0) {
          return {
            days: state.days.map((d, i) => (i === idx ? response : d)),
          };
        }
        // Add and sort
        const DAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const updated = [...state.days, response].sort(
          (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
        );
        return { days: updated };
      });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  clearPersonalAvailability: () => set({ days: [], error: null }),
}));
