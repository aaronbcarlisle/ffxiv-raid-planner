/**
 * Objective Command Store — per-objective card data for the Command Center.
 * Fetches aggregate card data from GET /api/static-groups/{id}/objective-command.
 * Private player goals and private BiS targets are never included (enforced server-side).
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('objectiveCommandStore');

export interface RosterReadiness {
  ready: number;
  total: number;
}

export interface GoalAlignmentSummary {
  aligned: number;
  partial: number;
  conflicts: number;
}

export interface BiSReadiness {
  ready: number;
  missing: number;
}

export interface LinkedCollectionGoal {
  id: string;
  title: string;
  progress: number | null;
  target: number | null;
}

export interface NextSession {
  id: string;
  date: string;
  title: string;
}

export interface ObjectiveCommandCard {
  id: string;
  title: string;
  category: string;
  priority: string;
  rosterReadiness: RosterReadiness;
  goalAlignment: GoalAlignmentSummary;
  bisReadiness: BiSReadiness | null;
  linkedCollectionGoal: LinkedCollectionGoal | null;
  nextSession: NextSession | null;
  nextAction: string;
  nextActionTarget: 'schedule' | 'roster' | 'applicants' | 'bis' | 'collection' | 'suggestions' | null;
}

interface ObjectiveCommandState {
  cards: ObjectiveCommandCard[];
  loading: boolean;
  error: string | null;

  fetchCards: (groupId: string) => Promise<void>;
}

export const useObjectiveCommandStore = create<ObjectiveCommandState>((set) => ({
  cards: [],
  loading: false,
  error: null,

  fetchCards: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/static-groups/${groupId}/objective-command`,
      );
      // Map snake_case API response to camelCase
      const cards: ObjectiveCommandCard[] = raw.map((c) => ({
        id: c.id as string,
        title: c.title as string,
        category: c.category as string,
        priority: c.priority as string,
        rosterReadiness: c.roster_readiness as RosterReadiness,
        goalAlignment: c.goal_alignment as GoalAlignmentSummary,
        bisReadiness: c.bis_readiness as BiSReadiness | null,
        linkedCollectionGoal: c.linked_collection_goal as LinkedCollectionGoal | null,
        nextSession: c.next_session as NextSession | null,
        nextAction: c.next_action as string,
        nextActionTarget: c.next_action_target as ObjectiveCommandCard['nextActionTarget'],
      }));
      set({ cards, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load objective command data';
      logger.error('fetchCards failed', { error: message, groupId });
      set({ error: message, loading: false });
    }
  },
}));
