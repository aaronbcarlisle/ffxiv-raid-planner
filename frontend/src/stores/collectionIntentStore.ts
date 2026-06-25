import { create } from 'zustand';
import { api } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentValue = 'hunting' | 'interested' | 'pass' | 'hidden';
export type IntentPriority = 'high' | 'medium' | 'low';
export type IntentVisibility = 'private' | 'static_only' | 'dossier_public';

export interface CollectionIntent {
  id: string;
  profileId: string;
  catalogItemId: string;
  intent: IntentValue;
  priority: IntentPriority;
  visibility: IntentVisibility;
  notes: string | null;
  updatedAt: string;
}

export interface MemberSuggestionEntry {
  userId: string;
  displayName: string | null;
  ownershipState: 'have' | 'missing' | 'unknown';
  intent: IntentValue | null;
  tokenCount: number | null;
  canBuy: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

export interface StaticCollectionSuggestion {
  catalogItemId: string;
  catalogItemName: string;
  catalogItemCategory: string | null;
  expansion: string | null;
  sourceDutyName: string | null;
  sourceType: string | null;
  staticGoalId: string | null;
  suggestedFarmScore: number;
  reasonSummary: string;
  members: MemberSuggestionEntry[];
}

export interface DossierHuntingEntry {
  catalogItemId: string;
  catalogItemName: string;
  catalogItemCategory: string;
  sourceDutyName: string | null;
  sourceType: string | null;
  intent: IntentValue;
  priority: IntentPriority;
}

export interface CatalogPlayerEntry {
  catalogItemId: string;
  catalogItemName: string;
  catalogItemCategory: string | null;
  expansion: string | null;
  sourceDutyName: string | null;
  sourceType: string | null;
  // Merged player state (null = no record yet)
  ownershipState: 'have' | 'missing' | 'unknown' | null;
  intent: IntentValue | null;
  priority: IntentPriority | null;
  visibility: IntentVisibility | null;
  tokenCount: number | null;
  snapshotSource: 'plugin' | 'player_hub' | 'manual' | null;
  lastSyncedAt: string | null;
}

export interface CollectionSnapshotUpsert {
  ownershipState: 'have' | 'missing' | 'unknown';
  tokenCount?: number | null;
}

export interface CollectionIntentUpsert {
  intent: IntentValue;
  priority?: IntentPriority;
  visibility?: IntentVisibility;
  notes?: string | null;
}

// ── API response shapes ───────────────────────────────────────────────────────

interface ApiIntent {
  id: string;
  profile_id: string;
  catalog_item_id: string;
  intent: string;
  priority: string;
  visibility: string;
  notes: string | null;
  updated_at: string;
}

interface ApiSuggestionMember {
  user_id: string;
  display_name: string | null;
  ownership_state: string;
  intent: string | null;
  token_count: number | null;
  can_buy: boolean;
  confidence: string;
  reasons: string[];
}

interface ApiSuggestion {
  catalog_item_id: string;
  catalog_item_name: string;
  catalog_item_category: string | null;
  expansion: string | null;
  source_duty_name: string | null;
  source_type: string | null;
  static_goal_id: string | null;
  suggested_farm_score: number;
  reason_summary: string;
  members: ApiSuggestionMember[];
}


interface ApiCatalogEntry {
  catalog_item_id: string;
  catalog_item_name: string;
  catalog_item_category: string | null;
  expansion: string | null;
  source_duty_name: string | null;
  source_type: string | null;
  ownership_state: string | null;
  intent: string | null;
  priority: string | null;
  visibility: string | null;
  token_count: number | null;
  snapshot_source: string | null;
  last_synced_at: string | null;
}

// ── Converters ────────────────────────────────────────────────────────────────

function fromApiIntent(r: ApiIntent): CollectionIntent {
  return {
    id: r.id,
    profileId: r.profile_id,
    catalogItemId: r.catalog_item_id,
    intent: r.intent as IntentValue,
    priority: r.priority as IntentPriority,
    visibility: r.visibility as IntentVisibility,
    notes: r.notes,
    updatedAt: r.updated_at,
  };
}

function fromApiSuggestion(s: ApiSuggestion): StaticCollectionSuggestion {
  return {
    catalogItemId: s.catalog_item_id,
    catalogItemName: s.catalog_item_name,
    catalogItemCategory: s.catalog_item_category,
    expansion: s.expansion ?? null,
    sourceDutyName: s.source_duty_name,
    sourceType: s.source_type,
    staticGoalId: s.static_goal_id,
    suggestedFarmScore: s.suggested_farm_score,
    reasonSummary: s.reason_summary,
    members: s.members.map(m => ({
      userId: m.user_id,
      displayName: m.display_name,
      ownershipState: m.ownership_state as MemberSuggestionEntry['ownershipState'],
      intent: m.intent as IntentValue | null,
      tokenCount: m.token_count,
      canBuy: m.can_buy,
      confidence: m.confidence as MemberSuggestionEntry['confidence'],
      reasons: m.reasons,
    })),
  };
}


function fromApiCatalogEntry(e: ApiCatalogEntry): CatalogPlayerEntry {
  return {
    catalogItemId: e.catalog_item_id,
    catalogItemName: e.catalog_item_name,
    catalogItemCategory: e.catalog_item_category,
    expansion: e.expansion,
    sourceDutyName: e.source_duty_name,
    sourceType: e.source_type,
    ownershipState: e.ownership_state as CatalogPlayerEntry['ownershipState'],
    intent: e.intent as IntentValue | null,
    priority: e.priority as IntentPriority | null,
    visibility: e.visibility as IntentVisibility | null,
    tokenCount: e.token_count,
    snapshotSource: e.snapshot_source as CatalogPlayerEntry['snapshotSource'],
    lastSyncedAt: e.last_synced_at,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface CollectionIntentState {
  // Personal intents (keyed by catalogItemId)
  myIntents: Record<string, CollectionIntent>;
  myIntentsLoaded: boolean;

  // Static suggestion cache (keyed by groupId)
  suggestions: Record<string, StaticCollectionSuggestion[]>;
  suggestionsLoading: Record<string, boolean>;

  // Personal catalog (all active catalog items + merged player state)
  myCatalog: CatalogPlayerEntry[];
  myCatalogLoaded: boolean;

  // Actions
  fetchMyIntents: () => Promise<void>;
  upsertIntent: (catalogItemId: string, data: CollectionIntentUpsert) => Promise<void>;
  deleteIntent: (catalogItemId: string) => Promise<void>;
  fetchSuggestions: (groupId: string) => Promise<void>;
  fetchMyCatalog: (filters?: { category?: string; expansion?: string; sourceType?: string }) => Promise<void>;
  upsertSnapshot: (catalogItemId: string, data: CollectionSnapshotUpsert) => Promise<CatalogPlayerEntry>;
  patchCatalogEntry: (catalogItemId: string, patch: Partial<CatalogPlayerEntry>) => void;
}

export const useCollectionIntentStore = create<CollectionIntentState>((set, get) => ({
  myIntents: {},
  myIntentsLoaded: false,
  suggestions: {},
  suggestionsLoading: {},
  myCatalog: [],
  myCatalogLoaded: false,

  fetchMyIntents: async () => {
    const raw = await api.get<ApiIntent[]>('/api/me/collection-intent');
    const map: Record<string, CollectionIntent> = {};
    for (const r of raw) {
      map[r.catalog_item_id] = fromApiIntent(r);
    }
    set({ myIntents: map, myIntentsLoaded: true });
  },

  upsertIntent: async (catalogItemId, data) => {
    const raw = await api.put<ApiIntent>(
      `/api/me/collection-intent/${catalogItemId}`,
      data,
    );
    set(s => ({ myIntents: { ...s.myIntents, [catalogItemId]: fromApiIntent(raw) } }));
    get().patchCatalogEntry(catalogItemId, {
      intent: raw.intent as IntentValue,
      priority: raw.priority as IntentPriority,
      visibility: raw.visibility as IntentVisibility,
    });
  },

  deleteIntent: async (catalogItemId) => {
    await api.delete(`/api/me/collection-intent/${catalogItemId}`);
    set(s => {
      const next = { ...s.myIntents };
      delete next[catalogItemId];
      return { myIntents: next };
    });
    get().patchCatalogEntry(catalogItemId, { intent: null, priority: null, visibility: null });
  },

  fetchSuggestions: async (groupId) => {
    if (get().suggestionsLoading[groupId]) return;
    set(s => ({ suggestionsLoading: { ...s.suggestionsLoading, [groupId]: true } }));
    try {
      const raw = await api.get<ApiSuggestion[]>(
        `/api/static-groups/${groupId}/collection-suggestions`,
      );
      set(s => ({
        suggestions: { ...s.suggestions, [groupId]: raw.map(fromApiSuggestion) },
        suggestionsLoading: { ...s.suggestionsLoading, [groupId]: false },
      }));
    } catch {
      set(s => ({ suggestionsLoading: { ...s.suggestionsLoading, [groupId]: false } }));
    }
  },

  fetchMyCatalog: async (filters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.expansion) params.set('expansion', filters.expansion);
    if (filters?.sourceType) params.set('source_type', filters.sourceType);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const raw = await api.get<ApiCatalogEntry[]>(`/api/me/collection-catalog${qs}`);
    set({ myCatalog: raw.map(fromApiCatalogEntry), myCatalogLoaded: true });
  },

  upsertSnapshot: async (catalogItemId, data) => {
    await api.put<unknown>(
      `/api/me/collection-snapshot/${catalogItemId}`,
      { ownership_state: data.ownershipState, token_count: data.tokenCount ?? null },
    );
    // The snapshot endpoint returns CollectionSnapshotResponse, not CatalogPlayerEntry.
    // We patch locally instead of relying on the response shape.
    get().patchCatalogEntry(catalogItemId, {
      ownershipState: data.ownershipState,
      tokenCount: data.tokenCount ?? null,
      snapshotSource: 'manual',
    });
    // Return a synthetic CatalogPlayerEntry by merging with current state
    const existing = get().myCatalog.find(e => e.catalogItemId === catalogItemId);
    return existing ?? { catalogItemId, catalogItemName: '', catalogItemCategory: null, expansion: null, sourceDutyName: null, sourceType: null, ownershipState: data.ownershipState, intent: null, priority: null, visibility: null, tokenCount: data.tokenCount ?? null, snapshotSource: 'manual', lastSyncedAt: null };
  },

  patchCatalogEntry: (catalogItemId, patch) => {
    set(s => ({
      myCatalog: s.myCatalog.map(e =>
        e.catalogItemId === catalogItemId ? { ...e, ...patch } : e
      ),
      // Also patch myIntents if intent/visibility/priority changed
      myIntents: patch.intent !== undefined || patch.visibility !== undefined || patch.priority !== undefined
        ? (() => {
            const existing = s.myIntents[catalogItemId];
            if (!existing) return s.myIntents;
            return {
              ...s.myIntents,
              [catalogItemId]: {
                ...existing,
                ...(patch.intent !== undefined ? { intent: patch.intent as IntentValue } : {}),
                ...(patch.visibility !== undefined ? { visibility: patch.visibility as IntentVisibility } : {}),
                ...(patch.priority !== undefined ? { priority: patch.priority as IntentPriority } : {}),
              },
            };
          })()
        : s.myIntents,
    }));
  },
}));
