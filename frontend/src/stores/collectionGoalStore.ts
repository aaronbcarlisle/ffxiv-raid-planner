import { create } from 'zustand';

/** Reward type — what is being tracked */
export type CollectionGoalType =
  | 'mount' | 'token' | 'minion' | 'orchestrion' | 'glam' | 'custom_reward'
  | 'weapon' | 'weapon_coffer' | 'title' | 'clear_count';

export type CollectionPriorityMode =
  | 'everyone_gets_one' | 'priority_order' | 'free_roll' | 'desired_only' | 'custom';

export type ParticipantState = 'need' | 'want' | 'have' | 'pass';
export type ParticipantSource = 'manual' | 'player_hub' | 'plugin';

export type CollectionGoalStatus = 'wanted' | 'farming' | 'scheduled' | 'complete';

/** Content type — where the reward comes from */
export type CollectionContentType =
  | 'extreme' | 'savage' | 'ultimate' | 'criterion'
  | 'chaotic_alliance' | 'field_operation' | 'custom';

export interface ParticipantSummary {
  need: number;
  want: number;
  have: number;
  passing: number;
  total: number;
}

export interface ParticipantStateEntry {
  id: string;
  goalId: string;
  userId: string;
  staticGroupId: string;
  state: ParticipantState;
  tokenCount: number | null;
  priorityRank: number | null;
  source: ParticipantSource;
  lastSyncedAt: string | null;
  notes: string | null;
  updatedAt: string;
  displayName: string | null;
}

export interface RewardDrop {
  id: string;
  goalId: string;
  staticGroupId: string;
  recipientUserId: string | null;
  createdById: string | null;
  quantity: number;
  droppedAt: string;
  notes: string | null;
  createdAt: string;
  recipientDisplayName: string | null;
}

export interface CollectionGoal {
  id: string;
  staticGroupId: string;
  createdById: string | null;
  goalType: CollectionGoalType;
  contentType: CollectionContentType | null;
  contentKey: string | null;
  title: string;
  status: CollectionGoalStatus;
  priorityMode: CollectionPriorityMode | null;
  summary: string | null;
  linkedDutyId: string | null;
  linkedRewardId: string | null;
  targetCount: number | null;
  currentCount: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  participantSummary: ParticipantSummary | null;
}

export interface CollectionGoalCreate {
  goalType: CollectionGoalType;
  contentType?: CollectionContentType | null;
  contentKey?: string | null;
  title: string;
  status: CollectionGoalStatus;
  priorityMode?: CollectionPriorityMode | null;
  summary?: string | null;
  linkedDutyId?: string | null;
  linkedRewardId?: string | null;
  targetCount?: number | null;
  currentCount?: number | null;
  note?: string | null;
}

export interface ParticipantStateUpsert {
  state: ParticipantState;
  tokenCount?: number | null;
  priorityRank?: number | null;
  notes?: string | null;
}

export interface RewardDropCreate {
  recipientUserId?: string | null;
  quantity?: number;
  droppedAt?: string | null;
  notes?: string | null;
}

export interface CollectionGoalUpdate {
  goalType?: CollectionGoalType;
  contentType?: CollectionContentType | null;
  contentKey?: string | null;
  title?: string;
  status?: CollectionGoalStatus;
  priorityMode?: CollectionPriorityMode | null;
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
  content_type: string | null;
  content_key: string | null;
  title: string;
  status: string;
  priority_mode: string | null;
  summary: string | null;
  linked_duty_id: string | null;
  linked_reward_id: string | null;
  target_count: number | null;
  current_count: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  participant_summary: { need: number; want: number; have: number; passing: number; total: number } | null;
}

interface ApiParticipant {
  id: string;
  goal_id: string;
  user_id: string;
  static_group_id: string;
  state: string;
  token_count: number | null;
  priority_rank: number | null;
  source: string;
  last_synced_at: string | null;
  notes: string | null;
  updated_at: string;
  display_name: string | null;
}

interface ApiDrop {
  id: string;
  goal_id: string;
  static_group_id: string;
  recipient_user_id: string | null;
  created_by_id: string | null;
  quantity: number;
  dropped_at: string;
  notes: string | null;
  created_at: string;
  recipient_display_name: string | null;
}

function fromApi(g: ApiGoal): CollectionGoal {
  return {
    id: g.id,
    staticGroupId: g.static_group_id,
    createdById: g.created_by_id,
    goalType: g.goal_type as CollectionGoalType,
    contentType: (g.content_type as CollectionContentType | null) ?? null,
    contentKey: g.content_key ?? null,
    title: g.title,
    status: g.status as CollectionGoalStatus,
    priorityMode: (g.priority_mode as CollectionPriorityMode | null) ?? null,
    summary: g.summary,
    linkedDutyId: g.linked_duty_id,
    linkedRewardId: g.linked_reward_id,
    targetCount: g.target_count,
    currentCount: g.current_count,
    note: g.note,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    completedAt: g.completed_at,
    participantSummary: g.participant_summary ?? null,
  };
}

function fromApiParticipant(p: ApiParticipant): ParticipantStateEntry {
  return {
    id: p.id,
    goalId: p.goal_id,
    userId: p.user_id,
    staticGroupId: p.static_group_id,
    state: p.state as ParticipantState,
    tokenCount: p.token_count,
    priorityRank: p.priority_rank,
    source: p.source as ParticipantSource,
    lastSyncedAt: p.last_synced_at,
    notes: p.notes,
    updatedAt: p.updated_at,
    displayName: p.display_name,
  };
}

function fromApiDrop(d: ApiDrop): RewardDrop {
  return {
    id: d.id,
    goalId: d.goal_id,
    staticGroupId: d.static_group_id,
    recipientUserId: d.recipient_user_id,
    createdById: d.created_by_id,
    quantity: d.quantity,
    droppedAt: d.dropped_at,
    notes: d.notes,
    createdAt: d.created_at,
    recipientDisplayName: d.recipient_display_name,
  };
}

function toApiCreate(c: CollectionGoalCreate): object {
  return {
    goal_type: c.goalType,
    content_type: c.contentType ?? null,
    content_key: c.contentKey ?? null,
    title: c.title,
    status: c.status,
    priority_mode: c.priorityMode ?? null,
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
  if ('priorityMode' in u) result.priority_mode = u.priorityMode ?? null;
  if ('contentType' in u) result.content_type = u.contentType ?? null;
  if ('contentKey' in u) result.content_key = u.contentKey ?? null;
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

  // participants keyed by goalId
  participants: Record<string, ParticipantStateEntry[]>;
  participantsLoading: Record<string, boolean>;

  // drops keyed by goalId
  drops: Record<string, RewardDrop[]>;
  dropsLoading: Record<string, boolean>;

  fetchGoals: (groupId: string) => Promise<void>;
  createGoal: (groupId: string, data: CollectionGoalCreate) => Promise<CollectionGoal>;
  updateGoal: (groupId: string, goalId: string, data: CollectionGoalUpdate) => Promise<void>;
  deleteGoal: (groupId: string, goalId: string) => Promise<void>;

  fetchParticipants: (groupId: string, goalId: string) => Promise<void>;
  upsertMyState: (groupId: string, goalId: string, data: ParticipantStateUpsert) => Promise<void>;
  upsertStateForUser: (groupId: string, goalId: string, targetUserId: string, data: ParticipantStateUpsert) => Promise<void>;

  fetchDrops: (groupId: string, goalId: string) => Promise<void>;
  logDrop: (groupId: string, goalId: string, data: RewardDropCreate) => Promise<RewardDrop>;
}

export const useCollectionGoalStore = create<CollectionGoalStore>((set, get) => ({
  goals: [],
  isLoading: false,
  error: null,
  loadedGroupId: null,
  participants: {},
  participantsLoading: {},
  drops: {},
  dropsLoading: {},

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

  fetchParticipants: async (groupId, goalId) => {
    set((s) => ({ participantsLoading: { ...s.participantsLoading, [goalId]: true } }));
    try {
      const res = await fetch(
        `/api/static-groups/${groupId}/collection-goals/${goalId}/participants`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to load participants: ${res.status}`);
      const data: ApiParticipant[] = await res.json();
      set((s) => ({
        participants: { ...s.participants, [goalId]: data.map(fromApiParticipant) },
        participantsLoading: { ...s.participantsLoading, [goalId]: false },
      }));
    } catch {
      set((s) => ({ participantsLoading: { ...s.participantsLoading, [goalId]: false } }));
    }
  },

  upsertMyState: async (groupId, goalId, data) => {
    const res = await fetch(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/participants`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          state: data.state,
          token_count: data.tokenCount ?? null,
          priority_rank: data.priorityRank ?? null,
          notes: data.notes ?? null,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update state' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to update state');
    }
    const updated = fromApiParticipant(await res.json() as ApiParticipant);
    set((s) => {
      const existing = s.participants[goalId] ?? [];
      const idx = existing.findIndex((p) => p.userId === updated.userId);
      const next = idx >= 0
        ? existing.map((p, i) => (i === idx ? updated : p))
        : [...existing, updated];
      return { participants: { ...s.participants, [goalId]: next } };
    });
    // Refresh goal list to get updated summary counts
    await get().fetchGoals(groupId);
  },

  upsertStateForUser: async (groupId, goalId, targetUserId, data) => {
    const res = await fetch(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/participants/${targetUserId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          state: data.state,
          token_count: data.tokenCount ?? null,
          priority_rank: data.priorityRank ?? null,
          notes: data.notes ?? null,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update state' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to update state');
    }
    const updated = fromApiParticipant(await res.json() as ApiParticipant);
    set((s) => {
      const existing = s.participants[goalId] ?? [];
      const idx = existing.findIndex((p) => p.userId === updated.userId);
      const next = idx >= 0
        ? existing.map((p, i) => (i === idx ? updated : p))
        : [...existing, updated];
      return { participants: { ...s.participants, [goalId]: next } };
    });
    await get().fetchGoals(groupId);
  },

  fetchDrops: async (groupId, goalId) => {
    set((s) => ({ dropsLoading: { ...s.dropsLoading, [goalId]: true } }));
    try {
      const res = await fetch(
        `/api/static-groups/${groupId}/collection-goals/${goalId}/drops`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to load drops: ${res.status}`);
      const data: ApiDrop[] = await res.json();
      set((s) => ({
        drops: { ...s.drops, [goalId]: data.map(fromApiDrop) },
        dropsLoading: { ...s.dropsLoading, [goalId]: false },
      }));
    } catch {
      set((s) => ({ dropsLoading: { ...s.dropsLoading, [goalId]: false } }));
    }
  },

  logDrop: async (groupId, goalId, data) => {
    const res = await fetch(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/drops`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipient_user_id: data.recipientUserId ?? null,
          quantity: data.quantity ?? 1,
          dropped_at: data.droppedAt ?? null,
          notes: data.notes ?? null,
        }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to log drop' }));
      throw new Error((err as { detail?: string }).detail ?? 'Failed to log drop');
    }
    const drop = fromApiDrop(await res.json() as ApiDrop);
    set((s) => ({
      drops: { ...s.drops, [goalId]: [drop, ...(s.drops[goalId] ?? [])] },
    }));
    // Refresh participant list — drop may have auto-advanced state
    await get().fetchParticipants(groupId, goalId);
    await get().fetchGoals(groupId);
    return drop;
  },
}));
