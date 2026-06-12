import { create } from 'zustand';

export type CollectionGoalType = 'mount' | 'token' | 'minion' | 'orchestrion' | 'glam' | 'custom_reward';
export type CollectionGoalStatus = 'wanted' | 'farming' | 'scheduled' | 'complete';

export interface CollectionGoal {
  id: string;
  staticGroupId: string;
  createdById: string | null;
  goalType: CollectionGoalType;
  title: string;
  status: CollectionGoalStatus;
  summary: string | null;
  linkedDutyId: string | null;
  linkedRewardId: string | null;
  targetCount: number | null;
  currentCount: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CollectionGoalCreate {
  goalType: CollectionGoalType;
  title: string;
  status: CollectionGoalStatus;
  summary?: string | null;
  linkedDutyId?: string | null;
  linkedRewardId?: string | null;
  targetCount?: number | null;
  currentCount?: number | null;
  note?: string | null;
}

export interface CollectionGoalUpdate {
  goalType?: CollectionGoalType;
  title?: string;
  status?: CollectionGoalStatus;
  summary?: string | null;
  linkedDutyId?: string | null;
  linkedRewardId?: string | null;
  targetCount?: number | null;
  currentCount?: number | null;
  note?: string | null;
  completedAt?: string | null;
}

interface ApiGoal {
  id: string;
  static_group_id: string;
  created_by_id: string | null;
  goal_type: string;
  title: string;
  status: string;
  summary: string | null;
  linked_duty_id: string | null;
  linked_reward_id: string | null;
  target_count: number | null;
  current_count: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function fromApi(g: ApiGoal): CollectionGoal {
  return {
    id: g.id,
    staticGroupId: g.static_group_id,
    createdById: g.created_by_id,
    goalType: g.goal_type as CollectionGoalType,
    title: g.title,
    status: g.status as CollectionGoalStatus,
    summary: g.summary,
    linkedDutyId: g.linked_duty_id,
    linkedRewardId: g.linked_reward_id,
    targetCount: g.target_count,
    currentCount: g.current_count,
    note: g.note,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    completedAt: g.completed_at,
  };
}

function toApiCreate(c: CollectionGoalCreate): object {
  return {
    goal_type: c.goalType,
    title: c.title,
    status: c.status,
    summary: c.summary ?? null,
    linked_duty_id: c.linkedDutyId ?? null,
    linked_reward_id: c.linkedRewardId ?? null,
    target_count: c.targetCount ?? null,
    current_count: c.currentCount ?? null,
    note: c.note ?? null,
  };
}

function toApiUpdate(u: CollectionGoalUpdate): object {
  const result: Record<string, unknown> = {};
  if (u.goalType !== undefined) result.goal_type = u.goalType;
  if (u.title !== undefined) result.title = u.title;
  if (u.status !== undefined) result.status = u.status;
  if ('summary' in u) result.summary = u.summary ?? null;
  if ('linkedDutyId' in u) result.linked_duty_id = u.linkedDutyId ?? null;
  if ('linkedRewardId' in u) result.linked_reward_id = u.linkedRewardId ?? null;
  if ('targetCount' in u) result.target_count = u.targetCount ?? null;
  if ('currentCount' in u) result.current_count = u.currentCount ?? null;
  if ('note' in u) result.note = u.note ?? null;
  if ('completedAt' in u) result.completed_at = u.completedAt ?? null;
  return result;
}

interface CollectionGoalStore {
  goals: CollectionGoal[];
  isLoading: boolean;
  error: string | null;
  loadedGroupId: string | null;

  fetchGoals: (groupId: string) => Promise<void>;
  createGoal: (groupId: string, data: CollectionGoalCreate) => Promise<CollectionGoal>;
  updateGoal: (groupId: string, goalId: string, data: CollectionGoalUpdate) => Promise<void>;
  deleteGoal: (groupId: string, goalId: string) => Promise<void>;
}

export const useCollectionGoalStore = create<CollectionGoalStore>((set) => ({
  goals: [],
  isLoading: false,
  error: null,
  loadedGroupId: null,

  fetchGoals: async (groupId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/static-groups/${groupId}/collection-goals`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load collection goals: ${res.status}`);
      const data: ApiGoal[] = await res.json();
      set({ goals: data.map(fromApi), loadedGroupId: groupId, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  createGoal: async (groupId, data) => {
    const res = await fetch(`/api/static-groups/${groupId}/collection-goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toApiCreate(data)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create goal' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to create goal');
    }
    const created: ApiGoal = await res.json();
    const goal = fromApi(created);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  updateGoal: async (groupId, goalId, data) => {
    const res = await fetch(`/api/static-groups/${groupId}/collection-goals/${goalId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(toApiUpdate(data)),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update goal' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to update goal');
    }
    const updated: ApiGoal = await res.json();
    const goal = fromApi(updated);
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? goal : g)) }));
  },

  deleteGoal: async (groupId, goalId) => {
    const res = await fetch(`/api/static-groups/${groupId}/collection-goals/${goalId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to delete goal' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to delete goal');
    }
    set((s) => ({ goals: s.goals.filter((g) => g.id !== goalId) }));
  },
}));
