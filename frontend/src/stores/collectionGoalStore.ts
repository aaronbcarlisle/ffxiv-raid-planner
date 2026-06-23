import { create } from 'zustand';
import { api } from '../services/api';

// ── Catalog types ────────────────────────────────────────────────────────────

export type CatalogExpansion = 'arr' | 'hw' | 'sb' | 'shb' | 'ew' | 'dt';
export type CatalogCategory = 'mount' | 'orchestrion' | 'minion' | 'glam' | 'title' | 'weapon' | 'emote' | 'hairstyle' | 'card' | 'other';

export interface CatalogItem {
  id: string;
  externalSource: string;
  externalId: string | null;
  name: string;
  category: CatalogCategory;
  expansion: CatalogExpansion | null;
  patch: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sourceText: string | null;
  sourceType: string | null;
  sourceDutyName: string | null;
  sourceDutyKey: string | null;
  tokenName: string | null;
  tokenCost: number | null;
  tokenItemId: number | null;
  gameMountId: number | null;
  tradeable: boolean | null;
  rarityOwnedPercent: number | null;
  isCurated: boolean;
  notes: string | null;
}

interface ApiCatalogItem {
  id: string;
  external_source: string;
  external_id: string | null;
  name: string;
  category: string;
  expansion: string | null;
  patch: string | null;
  icon_url: string | null;
  image_url: string | null;
  source_text: string | null;
  source_type: string | null;
  source_duty_name: string | null;
  source_duty_key: string | null;
  token_name: string | null;
  token_cost: number | null;
  token_item_id: number | null;
  game_mount_id: number | null;
  tradeable: boolean | null;
  rarity_owned_percent: number | null;
  is_curated: boolean;
  notes: string | null;
}

function fromApiCatalogItem(c: ApiCatalogItem): CatalogItem {
  return {
    id: c.id,
    externalSource: c.external_source,
    externalId: c.external_id,
    name: c.name,
    category: c.category as CatalogCategory,
    expansion: (c.expansion as CatalogExpansion | null) ?? null,
    patch: c.patch,
    iconUrl: c.icon_url,
    imageUrl: c.image_url,
    sourceText: c.source_text,
    sourceType: c.source_type,
    sourceDutyName: c.source_duty_name,
    sourceDutyKey: c.source_duty_key,
    tokenName: c.token_name,
    tokenCost: c.token_cost,
    tokenItemId: c.token_item_id,
    gameMountId: c.game_mount_id,
    tradeable: c.tradeable,
    rarityOwnedPercent: c.rarity_owned_percent,
    isCurated: c.is_curated,
    notes: c.notes,
  };
}

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
  catalogItemId: string | null;
  tokenName: string | null;
  tokenCost: number | null;
  participantSummary: ParticipantSummary | null;
}

export interface CollectionGoalFromSuggestion {
  catalogItemId: string;
  status?: CollectionGoalStatus;
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
  catalogItemId?: string | null;
  tokenName?: string | null;
  tokenCost?: number | null;
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
  catalog_item_id: string | null;
  token_name: string | null;
  token_cost: number | null;
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
    catalogItemId: g.catalog_item_id ?? null,
    tokenName: g.token_name ?? null,
    tokenCost: g.token_cost ?? null,
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
    catalog_item_id: c.catalogItemId ?? null,
    token_name: c.tokenName ?? null,
    token_cost: c.tokenCost ?? null,
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
  // Catalog
  catalog: CatalogItem[];
  catalogLoading: boolean;
  catalogLoaded: boolean;
  catalogError: string | null;
  fetchCatalog: (params?: { category?: string; expansion?: string }) => Promise<void>;

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
  createGoalFromSuggestion: (groupId: string, data: CollectionGoalFromSuggestion) => Promise<CollectionGoal>;
  updateGoal: (groupId: string, goalId: string, data: CollectionGoalUpdate) => Promise<void>;
  deleteGoal: (groupId: string, goalId: string) => Promise<void>;

  fetchParticipants: (groupId: string, goalId: string) => Promise<void>;
  upsertMyState: (groupId: string, goalId: string, data: ParticipantStateUpsert) => Promise<void>;
  upsertStateForUser: (groupId: string, goalId: string, targetUserId: string, data: ParticipantStateUpsert) => Promise<void>;

  fetchDrops: (groupId: string, goalId: string) => Promise<void>;
  logDrop: (groupId: string, goalId: string, data: RewardDropCreate) => Promise<RewardDrop>;
}

export const useCollectionGoalStore = create<CollectionGoalStore>((set, get) => ({
  catalog: [],
  catalogLoading: false,
  catalogLoaded: false,
  catalogError: null,

  fetchCatalog: async (params = {}) => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const qs = new URLSearchParams();
      if (params.category) qs.set('category', params.category);
      if (params.expansion) qs.set('expansion', params.expansion);
      const endpoint = `/api/collection-catalog${qs.toString() ? `?${qs}` : ''}`;
      const data = await api.get<ApiCatalogItem[]>(endpoint);
      set({ catalog: data.map(fromApiCatalogItem), catalogLoaded: true, catalogLoading: false, catalogError: null });
    } catch (err) {
      // On error: mark as loaded so we don't retry automatically, but store the error
      // so CatalogBrowse can show the fallback + retry button
      set({ catalogLoading: false, catalogLoaded: true, catalogError: err instanceof Error ? err.message : 'Failed to load catalog' });
    }
  },

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
      const data = await api.get<ApiGoal[]>(`/api/static-groups/${groupId}/collection-goals`);
      set({ goals: data.map(fromApi), loadedGroupId: groupId, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },

  createGoal: async (groupId, data) => {
    const created = await api.post<ApiGoal>(
      `/api/static-groups/${groupId}/collection-goals`,
      toApiCreate(data),
    );
    const goal = fromApi(created);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  createGoalFromSuggestion: async (groupId, data) => {
    const created = await api.post<ApiGoal>(
      `/api/static-groups/${groupId}/collection-goals/from-suggestion`,
      { catalog_item_id: data.catalogItemId, status: data.status ?? 'wanted' },
    );
    const goal = fromApi(created);
    set((s) => ({ goals: [...s.goals, goal] }));
    return goal;
  },

  updateGoal: async (groupId, goalId, data) => {
    const updated = await api.put<ApiGoal>(
      `/api/static-groups/${groupId}/collection-goals/${goalId}`,
      toApiUpdate(data),
    );
    const goal = fromApi(updated);
    set((s) => ({ goals: s.goals.map((g) => (g.id === goalId ? goal : g)) }));
  },

  deleteGoal: async (groupId, goalId) => {
    await api.delete<void>(`/api/static-groups/${groupId}/collection-goals/${goalId}`);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== goalId) }));
  },

  fetchParticipants: async (groupId, goalId) => {
    set((s) => ({ participantsLoading: { ...s.participantsLoading, [goalId]: true } }));
    try {
      const data = await api.get<ApiParticipant[]>(
        `/api/static-groups/${groupId}/collection-goals/${goalId}/participants`,
      );
      set((s) => ({
        participants: { ...s.participants, [goalId]: data.map(fromApiParticipant) },
        participantsLoading: { ...s.participantsLoading, [goalId]: false },
      }));
    } catch {
      set((s) => ({ participantsLoading: { ...s.participantsLoading, [goalId]: false } }));
    }
  },

  upsertMyState: async (groupId, goalId, data) => {
    const updated = await api.patch<ApiParticipant>(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/participants`,
      {
        state: data.state,
        token_count: data.tokenCount ?? null,
        priority_rank: data.priorityRank ?? null,
        notes: data.notes ?? null,
      },
    );
    const participant = fromApiParticipant(updated);
    set((s) => {
      const existing = s.participants[goalId] ?? [];
      const idx = existing.findIndex((p) => p.userId === participant.userId);
      const next = idx >= 0
        ? existing.map((p, i) => (i === idx ? participant : p))
        : [...existing, participant];
      return { participants: { ...s.participants, [goalId]: next } };
    });
    await get().fetchGoals(groupId);
  },

  upsertStateForUser: async (groupId, goalId, targetUserId, data) => {
    const updated = await api.patch<ApiParticipant>(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/participants/${targetUserId}`,
      {
        state: data.state,
        token_count: data.tokenCount ?? null,
        priority_rank: data.priorityRank ?? null,
        notes: data.notes ?? null,
      },
    );
    const participant = fromApiParticipant(updated);
    set((s) => {
      const existing = s.participants[goalId] ?? [];
      const idx = existing.findIndex((p) => p.userId === participant.userId);
      const next = idx >= 0
        ? existing.map((p, i) => (i === idx ? participant : p))
        : [...existing, participant];
      return { participants: { ...s.participants, [goalId]: next } };
    });
    await get().fetchGoals(groupId);
  },

  fetchDrops: async (groupId, goalId) => {
    set((s) => ({ dropsLoading: { ...s.dropsLoading, [goalId]: true } }));
    try {
      const data = await api.get<ApiDrop[]>(
        `/api/static-groups/${groupId}/collection-goals/${goalId}/drops`,
      );
      set((s) => ({
        drops: { ...s.drops, [goalId]: data.map(fromApiDrop) },
        dropsLoading: { ...s.dropsLoading, [goalId]: false },
      }));
    } catch {
      set((s) => ({ dropsLoading: { ...s.dropsLoading, [goalId]: false } }));
    }
  },

  logDrop: async (groupId, goalId, data) => {
    const created = await api.post<ApiDrop>(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/drops`,
      {
        recipient_user_id: data.recipientUserId ?? null,
        quantity: data.quantity ?? 1,
        dropped_at: data.droppedAt ?? null,
        notes: data.notes ?? null,
      },
    );
    const drop = fromApiDrop(created);
    set((s) => ({
      drops: { ...s.drops, [goalId]: [drop, ...(s.drops[goalId] ?? [])] },
    }));
    await get().fetchParticipants(groupId, goalId);
    await get().fetchGoals(groupId);
    return drop;
  },
}));
