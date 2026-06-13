/**
 * Objective Goal Store — static-group raid/progression objective goals
 * and goal alignment with player personal goals.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('objectiveGoalStore');

export interface StaticObjectiveGoal {
  id: string;
  staticGroupId: string;
  createdById: string | null;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalAlignmentItem {
  category: string;
  staticTitle: string;
  playerIntent: string | null;
  staticPriority: string;
  status: string; // aligned | partial | conflict | missing | unknown
}

export interface GoalAlignmentSummary {
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
  unknown: number;
}

export interface GoalAlignmentResult {
  summary: GoalAlignmentSummary;
  items: GoalAlignmentItem[];
}

export interface RosterMemberAlignment {
  userId: string;
  profileId: string | null;
  displayName: string;
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
  unknown: number;
}

interface ObjectiveGoalState {
  objectives: StaticObjectiveGoal[];
  alignment: GoalAlignmentResult | null;
  rosterAlignment: RosterMemberAlignment[] | null;
  loading: boolean;
  error: string | null;

  fetchObjectives: (groupId: string) => Promise<void>;
  createObjective: (
    groupId: string,
    data: { category: string; title: string; description?: string; priority: string }
  ) => Promise<void>;
  updateObjective: (
    groupId: string,
    id: string,
    data: { title?: string; description?: string; priority?: string }
  ) => Promise<void>;
  deleteObjective: (groupId: string, id: string) => Promise<void>;
  fetchAlignment: (groupId: string, profileId: string) => Promise<void>;
  fetchRosterAlignment: (groupId: string) => Promise<void>;
}

export const useObjectiveGoalStore = create<ObjectiveGoalState>((set, get) => ({
  objectives: [],
  alignment: null,
  rosterAlignment: null,
  loading: false,
  error: null,

  fetchObjectives: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const objectives = await api.get<StaticObjectiveGoal[]>(
        `/api/static-groups/${groupId}/objective-goals`
      );
      set({ objectives, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load objectives';
      logger.error('fetchObjectives failed', { error: message, groupId });
      set({ error: message, loading: false });
    }
  },

  createObjective: async (groupId, data) => {
    try {
      await api.post(`/api/static-groups/${groupId}/objective-goals`, data);
      await get().fetchObjectives(groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create objective';
      logger.error('createObjective failed', { error: message });
      throw err;
    }
  },

  updateObjective: async (groupId, id, data) => {
    try {
      await api.patch(`/api/static-groups/${groupId}/objective-goals/${id}`, data);
      await get().fetchObjectives(groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update objective';
      logger.error('updateObjective failed', { error: message });
      throw err;
    }
  },

  deleteObjective: async (groupId, id) => {
    try {
      await api.delete(`/api/static-groups/${groupId}/objective-goals/${id}`);
      await get().fetchObjectives(groupId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete objective';
      logger.error('deleteObjective failed', { error: message });
      throw err;
    }
  },

  fetchAlignment: async (groupId, profileId) => {
    set({ loading: true, error: null, alignment: null });
    try {
      const result = await api.get<GoalAlignmentResult>(
        `/api/static-groups/${groupId}/goal-alignment?profile_id=${encodeURIComponent(profileId)}`
      );
      set({ alignment: result, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load alignment';
      logger.error('fetchAlignment failed', { error: message });
      set({ error: message, loading: false });
    }
  },

  fetchRosterAlignment: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const result = await api.get<RosterMemberAlignment[]>(
        `/api/static-groups/${groupId}/roster-alignment`
      );
      set({ rosterAlignment: result, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load roster alignment';
      logger.error('fetchRosterAlignment failed', { error: message });
      set({ error: message, loading: false });
    }
  },
}));
