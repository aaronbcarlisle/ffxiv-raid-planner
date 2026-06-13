/**
 * Content Suggestion Store — member-proposed content and voting for static groups.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('contentSuggestionStore');

export interface VoteSummary {
  mustHave: number;
  want: number;
  willing: number;
  notInterested: number;
  avoid: number;
  total: number;
  conflictCount: number;
}

export interface ContentSuggestion {
  id: string;
  staticGroupId: string;
  category: string;
  title: string;
  description: string | null;
  status: 'open' | 'promoted' | 'closed' | 'rejected';
  suggestedByUserId: string;
  suggestedByDisplayName: string | null;
  promotedGoalId: string | null;
  voteSummary: VoteSummary;
  currentUserVote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContentSuggestionState {
  suggestions: ContentSuggestion[];
  loading: boolean;
  error: string | null;

  fetchSuggestions: (groupId: string) => Promise<void>;
  createSuggestion: (
    groupId: string,
    data: { category: string; title: string; description?: string }
  ) => Promise<void>;
  updateSuggestion: (
    groupId: string,
    id: string,
    data: { title?: string; description?: string; status?: string }
  ) => Promise<void>;
  deleteSuggestion: (groupId: string, id: string) => Promise<void>;
  upsertVote: (groupId: string, id: string, vote: string, note?: string) => Promise<void>;
  deleteVote: (groupId: string, id: string) => Promise<void>;
  promoteToGoal: (
    groupId: string,
    id: string,
    data: { priority: string; title?: string; description?: string }
  ) => Promise<void>;
}

export const useContentSuggestionStore = create<ContentSuggestionState>((set, get) => ({
  suggestions: [],
  loading: false,
  error: null,

  fetchSuggestions: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const suggestions = await api.get<ContentSuggestion[]>(
        `/api/static-groups/${groupId}/content-suggestions`
      );
      set({ suggestions, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load suggestions';
      logger.error('fetchSuggestions failed', { error: message });
      set({ error: message, loading: false });
    }
  },

  createSuggestion: async (groupId, data) => {
    try {
      const suggestion = await api.post<ContentSuggestion>(
        `/api/static-groups/${groupId}/content-suggestions`,
        data
      );
      set((s) => ({ suggestions: [suggestion, ...s.suggestions] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create suggestion';
      logger.error('createSuggestion failed', { error: message });
      throw err;
    }
  },

  updateSuggestion: async (groupId, id, data) => {
    try {
      const updated = await api.patch<ContentSuggestion>(
        `/api/static-groups/${groupId}/content-suggestions/${id}`,
        data
      );
      set((s) => ({
        suggestions: s.suggestions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update suggestion';
      logger.error('updateSuggestion failed', { error: message });
      throw err;
    }
  },

  deleteSuggestion: async (groupId, id) => {
    try {
      await api.delete(`/api/static-groups/${groupId}/content-suggestions/${id}`);
      set((s) => ({ suggestions: s.suggestions.filter((s) => s.id !== id) }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete suggestion';
      logger.error('deleteSuggestion failed', { error: message });
      throw err;
    }
  },

  upsertVote: async (groupId, id, vote, note) => {
    try {
      const updated = await api.put<ContentSuggestion>(
        `/api/static-groups/${groupId}/content-suggestions/${id}/vote`,
        { vote, note }
      );
      set((s) => ({
        suggestions: s.suggestions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save vote';
      logger.error('upsertVote failed', { error: message });
      throw err;
    }
  },

  deleteVote: async (groupId, id) => {
    try {
      const updated = await api.delete<ContentSuggestion>(
        `/api/static-groups/${groupId}/content-suggestions/${id}/vote`
      );
      set((s) => ({
        suggestions: s.suggestions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove vote';
      logger.error('deleteVote failed', { error: message });
      throw err;
    }
  },

  promoteToGoal: async (groupId, id, data) => {
    try {
      const updated = await api.post<ContentSuggestion>(
        `/api/static-groups/${groupId}/content-suggestions/${id}/promote`,
        data
      );
      set((s) => ({
        suggestions: s.suggestions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to promote suggestion';
      logger.error('promoteToGoal failed', { error: message });
      throw err;
    }
  },
}));
