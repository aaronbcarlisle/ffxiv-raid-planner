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
  /** The participant's role in the static (R-P0-4); null once they are no longer a member. */
  memberRole: string | null;
  // The row's provenance and the merge (S2a-1, R-S1-9; S2a-2, R-S2-13). Optional so a
  // V1-shaped row (and every existing fixture) stays valid; the mapper always fills them.
  updatedByUserId?: string | null;
  updatedVia?: string | null;
  stateChangedAt?: string | null;
  tokenCountUpdatedAt?: string | null;
  /** True when `state` came from the member's character record, not their own row. */
  stateFromRecord?: boolean;
  /** True when `tokenCount` came from the member's character record. */
  countFromRecord?: boolean;
  /** True when the count gate withheld this member's counts from the caller. */
  countHidden?: boolean;
  record?: ParticipantRecordView | null;
}

/** The member's character record behind a farm cell (S2a-1, R-S1-9), as merged. */
export interface ParticipantRecordView {
  characterId: string | null;
  ownershipState: string;
  tokenCount: number | null;
  source: string;
  updatedByUserId: string | null;
  updatedVia: string | null;
  stateChangedAt: string | null;
  tokenCountUpdatedAt: string | null;
  lastSyncedAt: string | null;
}

/** A claimant's record for a goal's item when they have no row for the goal (Q1, R-S2-13). */
export interface RecordOnlyCell {
  userId: string;
  displayName: string | null;
  memberRole: string;
  /** `'have'` when the record says so, else null. */
  state: 'have' | null;
  tokenCount: number | null;
  countHidden: boolean;
  record: ParticipantRecordView;
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
  /** The state this drop flipped the recipient out of (need/want); null when it caused no flip. */
  recipientPriorState: string | null;
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

/** One Progress cell write (S2a-2, R-S2-10): a state, and a count only when it changes. */
export interface CellWrite {
  /** The member written through the lead route; absent for the caller's own cell (the self route). */
  targetUserId?: string;
  state: ParticipantState;
  /** The count to set; absent leaves the count as it is (the body sends null, which the API reads as unchanged). */
  tokenCount?: number;
}

/** One cell the bulk Need names (S2a-2·F6, R-S2-12). */
export interface MarkNeedCell {
  goalId: string;
  userId: string;
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
  member_role?: string | null;
  updated_by_user_id?: string | null;
  updated_via?: string | null;
  state_changed_at?: string | null;
  token_count_updated_at?: string | null;
  state_from_record?: boolean;
  count_from_record?: boolean;
  count_hidden?: boolean;
  record?: ApiParticipantRecord | null;
}

/** A farm-status PATCH's response (R-S2-11): the row as written, plus its undo token (null when minting failed). */
interface ApiParticipantWrite extends ApiParticipant {
  undo_token?: string | null;
}

interface ApiUndoResult {
  restored: number;
  skipped: number;
}

/** The bulk Need's response (R-S2-12): the rows created, how many cells were skipped, and one token for the lot. */
interface ApiMarkNeedResult {
  created: ApiParticipant[];
  skipped: number;
  undo_token: string | null;
}

/** The mark-need route takes at most this many cells per request. */
const MARK_NEED_MAX_CELLS = 200;

interface ApiParticipantRecord {
  character_id: string | null;
  ownership_state: string;
  token_count: number | null;
  source: string;
  updated_by_user_id?: string | null;
  updated_via?: string | null;
  state_changed_at?: string | null;
  token_count_updated_at?: string | null;
  last_synced_at?: string | null;
}

interface ApiRecordOnlyCell {
  user_id: string;
  display_name: string | null;
  member_role: string;
  state: 'have' | null;
  token_count: number | null;
  count_hidden: boolean;
  record: ApiParticipantRecord;
}

interface ApiGoalParticipants {
  goal_id: string;
  participants: ApiParticipant[];
  record_only: ApiRecordOnlyCell[];
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
  recipient_prior_state?: string | null;
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
    memberRole: p.member_role ?? null,
    updatedByUserId: p.updated_by_user_id ?? null,
    updatedVia: p.updated_via ?? null,
    stateChangedAt: p.state_changed_at ?? null,
    tokenCountUpdatedAt: p.token_count_updated_at ?? null,
    stateFromRecord: p.state_from_record ?? false,
    countFromRecord: p.count_from_record ?? false,
    countHidden: p.count_hidden ?? false,
    record: p.record ? fromApiRecord(p.record) : null,
  };
}

function fromApiRecord(r: ApiParticipantRecord): ParticipantRecordView {
  return {
    characterId: r.character_id,
    ownershipState: r.ownership_state,
    tokenCount: r.token_count,
    source: r.source,
    updatedByUserId: r.updated_by_user_id ?? null,
    updatedVia: r.updated_via ?? null,
    stateChangedAt: r.state_changed_at ?? null,
    tokenCountUpdatedAt: r.token_count_updated_at ?? null,
    lastSyncedAt: r.last_synced_at ?? null,
  };
}

function fromApiRecordOnly(c: ApiRecordOnlyCell): RecordOnlyCell {
  return {
    userId: c.user_id,
    displayName: c.display_name ?? null,
    memberRole: c.member_role,
    state: c.state ?? null,
    tokenCount: c.token_count,
    countHidden: c.count_hidden ?? false,
    record: fromApiRecord(c.record),
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
    recipientPriorState: d.recipient_prior_state ?? null,
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
  // Record-only cells keyed by goalId (R-S2-13): a claimant's record, no row for the goal.
  recordOnly: Record<string, RecordOnlyCell[]>;

  // drops keyed by goalId
  drops: Record<string, RewardDrop[]>;
  dropsLoading: Record<string, boolean>;

  fetchGoals: (groupId: string) => Promise<void>;
  createGoal: (groupId: string, data: CollectionGoalCreate) => Promise<CollectionGoal>;
  createGoalFromSuggestion: (groupId: string, data: CollectionGoalFromSuggestion) => Promise<CollectionGoal>;
  updateGoal: (groupId: string, goalId: string, data: CollectionGoalUpdate) => Promise<void>;
  deleteGoal: (groupId: string, goalId: string) => Promise<void>;

  fetchParticipants: (groupId: string, goalId: string) => Promise<void>;
  /**
   * The Progress tab's one read (R-S2-13): every cell of the given goals (default: every
   * goal not complete), in `participants` and `recordOnly`. Goals the response omits keep
   * their cached rows. Resolves with THIS call's outcome (`error` is its failure message, or
   * null), so overlapping callers (the active fetch and a Finished fetch) never read each
   * other's failure from the shared `progressError`.
   */
  fetchProgress: (groupId: string, goalIds?: string[]) => Promise<{ error: string | null }>;
  /** A `fetchProgress` is in flight (overlapping calls count: true until the last settles). */
  progressLoading: boolean;
  /** The last `fetchProgress` failure's message; cleared when the next one starts. */
  progressError: string | null;
  upsertMyState: (groupId: string, goalId: string, data: ParticipantStateUpsert) => Promise<void>;
  upsertStateForUser: (groupId: string, goalId: string, targetUserId: string, data: ParticipantStateUpsert) => Promise<void>;
  /**
   * The Progress tab's one write (S2a-2; R-S2-10, R-S2-11): the caller's own cell through
   * the self route, or `targetUserId`'s through the lead route. The written row replaces the
   * member's row for the goal and drops their record-only cell; the goal list is not
   * refetched (a cell write changes no goal). Errors propagate. `undoToken` puts the write
   * back through `undoCells`, or is null when the server could not mint one.
   */
  setCell: (groupId: string, goalId: string, write: CellWrite) => Promise<{ entry: ParticipantStateEntry; undoToken: string | null }>;
  /** Puts a write back by its token (R-S2-11), then refetches the active cells. Errors propagate. */
  undoCells: (groupId: string, token: string) => Promise<{ restored: number; skipped: number }>;
  /**
   * Marks every given blank cell Need (R-S2-12), in requests of at most 200 cells one after
   * another, then refetches the active cells once. Resolves with how many rows the server
   * created and skipped, and one undo token per request that minted one. A failed request
   * throws at once (the later cells are not sent); the refetch still runs when an earlier
   * request had succeeded.
   */
  markNeed: (groupId: string, cells: readonly MarkNeedCell[]) => Promise<{ created: number; skipped: number; undoTokens: string[] }>;

  fetchDrops: (groupId: string, goalId: string) => Promise<void>;
  logDrop: (groupId: string, goalId: string, data: RewardDropCreate) => Promise<RewardDrop>;
  deleteDrop: (groupId: string, goalId: string, dropId: string) => Promise<void>;
}

/** Overlapping `fetchProgress` calls: `progressLoading` stays true until the last settles. */
let progressInFlight = 0;

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
  recordOnly: {},
  progressLoading: false,
  progressError: null,
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

  fetchProgress: async (groupId, goalIds) => {
    const qs = new URLSearchParams();
    for (const id of goalIds ?? []) qs.append('goal_id', id);
    const query = qs.toString();
    progressInFlight += 1;
    set({ progressLoading: true, progressError: null });
    let cells: { goalId: string; participants: ParticipantStateEntry[]; recordOnly: RecordOnlyCell[] }[] = [];
    let failure: string | null = null;
    try {
      const data = await api.get<ApiGoalParticipants[]>(
        `/api/static-groups/${groupId}/collection-participants${query ? `?${query}` : ''}`,
      );
      cells = data.map((g) => ({
        goalId: g.goal_id,
        participants: g.participants.map(fromApiParticipant),
        recordOnly: g.record_only.map(fromApiRecordOnly),
      }));
    } catch (err) {
      // api.ts has toasted; the cached rows stay (as fetchParticipants does).
      failure = err instanceof Error ? err.message : 'Failed to load progress';
    }
    progressInFlight -= 1;
    const progressLoading = progressInFlight > 0;
    if (failure !== null) {
      set({ progressLoading, progressError: failure });
      return { error: failure };
    }
    set((s) => {
      const participants = { ...s.participants };
      const recordOnly = { ...s.recordOnly };
      for (const c of cells) {
        participants[c.goalId] = c.participants;
        recordOnly[c.goalId] = c.recordOnly;
      }
      return { participants, recordOnly, progressLoading };
    });
    return { error: null };
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

  setCell: async (groupId, goalId, write) => {
    const base = `/api/static-groups/${groupId}/collection-goals/${goalId}/participants`;
    const written = await api.patch<ApiParticipantWrite>(
      write.targetUserId ? `${base}/${write.targetUserId}` : base,
      // Only these two keys: the server leaves priority_rank and notes alone when absent.
      { state: write.state, token_count: write.tokenCount ?? null },
    );
    const entry = fromApiParticipant(written);
    set((s) => {
      const existing = s.participants[goalId] ?? [];
      const idx = existing.findIndex((p) => p.userId === entry.userId);
      const next = idx >= 0 ? existing.map((p, i) => (i === idx ? entry : p)) : [...existing, entry];
      const cells = s.recordOnly[goalId];
      const recordOnly = cells?.some((c) => c.userId === entry.userId)
        ? { ...s.recordOnly, [goalId]: cells.filter((c) => c.userId !== entry.userId) }
        : s.recordOnly;
      return { participants: { ...s.participants, [goalId]: next }, recordOnly };
    });
    return { entry, undoToken: written.undo_token ?? null };
  },

  undoCells: async (groupId, token) => {
    const result = await api.post<ApiUndoResult>(
      `/api/static-groups/${groupId}/collection-participants/undo`,
      { token },
    );
    await get().fetchProgress(groupId);
    return { restored: result.restored, skipped: result.skipped };
  },

  markNeed: async (groupId, cells) => {
    let created = 0;
    let skipped = 0;
    const undoTokens: string[] = [];
    let succeeded = 0;
    try {
      for (let i = 0; i < cells.length; i += MARK_NEED_MAX_CELLS) {
        const chunk = cells.slice(i, i + MARK_NEED_MAX_CELLS);
        const result = await api.post<ApiMarkNeedResult>(
          `/api/static-groups/${groupId}/collection-participants/mark-need`,
          { cells: chunk.map((c) => ({ goal_id: c.goalId, user_id: c.userId })) },
        );
        succeeded += 1;
        created += result.created.length;
        skipped += result.skipped;
        if (result.undo_token) undoTokens.push(result.undo_token);
      }
    } finally {
      // The rows a successful request created are on the server whether or not a later one failed.
      if (succeeded > 0) await get().fetchProgress(groupId);
    }
    return { created, skipped, undoTokens };
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

  deleteDrop: async (groupId, goalId, dropId) => {
    await api.delete<void>(
      `/api/static-groups/${groupId}/collection-goals/${goalId}/drops/${dropId}`,
    );
    set((s) => ({
      drops: { ...s.drops, [goalId]: (s.drops[goalId] ?? []).filter((d) => d.id !== dropId) },
    }));
    // The server restores the recipient's prior state, so participants and goal counts changed.
    // It also hands the prior state to the earliest remaining drop, so the cached rows are stale.
    await get().fetchDrops(groupId, goalId);
    await get().fetchParticipants(groupId, goalId);
    await get().fetchGoals(groupId);
  },
}));
