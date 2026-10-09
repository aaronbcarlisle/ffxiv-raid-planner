/**
 * Store-shaped fixtures shared by the Progress component tests: a goal and a
 * participant row, with every field set and the usual ones overridable.
 */
import type { CollectionGoal, ParticipantStateEntry } from '../../../stores/collectionGoalStore';

export function goal(id: string, overrides: Partial<CollectionGoal> = {}): CollectionGoal {
  return {
    id, staticGroupId: 'g1', createdById: null, goalType: 'mount', contentType: null, contentKey: null,
    title: id, status: 'farming', priorityMode: null, summary: null, linkedDutyId: null, linkedRewardId: null,
    targetCount: null, currentCount: null, note: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    completedAt: null, catalogItemId: null, tokenName: 'Tokens', tokenCost: 99, participantSummary: null, ...overrides,
  };
}

export function row(goalId: string, userId: string, overrides: Partial<ParticipantStateEntry> = {}): ParticipantStateEntry {
  return {
    id: `${goalId}:${userId}`, goalId, userId, staticGroupId: 'g1', state: 'need', tokenCount: null, priorityRank: null,
    source: 'manual', lastSyncedAt: null, notes: null, updatedAt: '2026-10-01T00:00:00Z', displayName: userId,
    memberRole: 'member', countHidden: false, record: null, ...overrides,
  };
}
