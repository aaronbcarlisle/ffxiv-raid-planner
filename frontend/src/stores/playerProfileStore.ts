/**
 * Player Profile Store
 *
 * Manages solo player profile state: profile data, linked characters,
 * gear snapshots, and job profiles. Independent of static group stores.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('playerProfile');

// --- Types ---

export interface PlayerCharacter {
  id: string;
  lodestoneId: string;
  name: string;
  server: string;
  dataCenter: string | null;
  avatarUrl: string | null;
  isMain: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GearSnapshot {
  id: string;
  characterId: string;
  job: string;
  gear: GearSlotData[];
  avgItemLevel: number;
  source: string;
  syncedAt: string | null;
  lastPluginSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GearSlotData {
  slot: string;
  currentSource?: string;
  hasItem?: boolean;
  isAugmented?: boolean;
  equippedItemId?: number;
  equippedItemName?: string;
  equippedItemLevel?: number;
  equippedItemIcon?: string;
  itemLevel?: number;
}

export type BisTargetPurpose = 'savage' | 'ultimate' | 'prog' | 'farm' | 'speed' | 'comfort' | 'custom';
export type BisSourceType = 'etro' | 'xivgear' | 'ariyala' | 'manual' | 'custom_link';
export type BisImportStatus = 'linked_only' | 'imported' | 'import_failed' | 'unsupported';

export interface PlayerBisTargetSet {
  id: string;
  profileId: string;
  jobProfileId: string;
  job: string;
  name: string;
  purpose: BisTargetPurpose;
  sourceType: BisSourceType;
  externalUrl: string | null;
  importStatus: BisImportStatus;
  isActive: boolean;
  itemLevel: number | null;
  notes: string | null;
  itemsJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerJobProfile {
  id: string;
  job: string;
  role: string;
  priority: string;
  readiness: string;
  notes: string | null;
  gearSnapshotId: string | null;
  gearSnapshot: GearSnapshot | null;
  bisTargets: PlayerBisTargetSet[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  visibility: string;
  shareCode: string | null;
  shareEnabled: boolean;
  bio: string | null;
  characters: PlayerCharacter[];
  jobProfiles: PlayerJobProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicPlayerProfile {
  id: string;
  bio: string | null;
  characters: PlayerCharacter[];
  jobProfiles: PlayerJobProfile[];
}

export interface GearSyncResult {
  snapshotId: string;
  job: string;
  avgItemLevel: number;
  source: string;
  syncedAt: string;
  slotCount: number;
  gear: GearSlotData[];
}

export type JobPriority = 'main' | 'preferred_alt' | 'flex' | 'emergency' | 'casual';
export type GearReadiness = 'ready' | 'needs_gear' | 'in_progress' | 'not_ready' | 'unknown';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalType = 'collection' | 'mount_farm' | 'totem_farm' | 'weekly_clear' | 'personal' | 'gear' | 'raid' | 'custom';

export const COLLECTION_GOAL_TYPES: GoalType[] = ['collection', 'mount_farm', 'totem_farm'];
export const PERSONAL_GOAL_TYPES: GoalType[] = ['weekly_clear', 'personal', 'gear', 'raid', 'custom'];

export interface CollectionSuggestion {
  trialId: string;
  mountName: string;
  dutyName: string;
  totemName: string | null;
  totemTarget: number;
  currentCount: number;
  hasMount: boolean;
  source: string;
}

export interface StaticSuggestion {
  name: string;
  shareCode: string;
  recruitmentStatus: string;
  neededJobs: string[];
  neededRoles: string[];
  matchingJobs: string[];
  matchingRoles: string[];
  dataCenter: string | null;
  intensity: string | null;
}

export interface PlayerGoal {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  category: string | null;
  status: string;
  currentCount: number;
  targetCount: number | null;
  sourceContent: string | null;
  sourceItem: string | null;
  linkedCharacterId: string | null;
  linkedJob: string | null;
  dueDate: string | null;
  intentLevel: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Store ---

interface PlayerProfileState {
  profile: PlayerProfile | null;
  gearSnapshots: Record<string, GearSnapshot[]>; // characterId -> snapshots
  goals: PlayerGoal[];
  collectionSuggestions: CollectionSuggestion[];
  staticSuggestions: StaticSuggestion[];
  loading: boolean;
  syncing: boolean;
  error: string | null;

  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { visibility?: string; bio?: string; shareEnabled?: boolean }) => Promise<void>;

  // Characters
  linkCharacter: (data: {
    lodestoneId: string;
    name: string;
    server: string;
    dataCenter?: string;
    avatarUrl?: string;
    isMain?: boolean;
  }) => Promise<PlayerCharacter>;
  updateCharacter: (id: string, data: { isMain?: boolean; name?: string; server?: string; dataCenter?: string }) => Promise<void>;
  unlinkCharacter: (id: string) => Promise<void>;

  // Gear
  fetchGearSnapshots: (characterId: string) => Promise<void>;
  syncGear: (characterId: string, forceRefresh?: boolean, job?: string) => Promise<GearSyncResult>;

  // Jobs
  fetchJobProfiles: () => Promise<void>;
  createJobProfile: (data: {
    job: string;
    role: string;
    priority?: string;
    readiness?: string;
    notes?: string;
  }) => Promise<void>;
  updateJobProfile: (id: string, data: {
    priority?: string;
    readiness?: string;
    notes?: string;
  }) => Promise<void>;
  deleteJobProfile: (id: string) => Promise<void>;

  // Goals
  fetchGoals: () => Promise<void>;
  createGoal: (data: {
    title: string;
    goalType: string;
    description?: string;
    category?: string;
    status?: string;
    currentCount?: number;
    targetCount?: number;
    sourceContent?: string;
    sourceItem?: string;
    linkedCharacterId?: string;
    linkedJob?: string;
    dueDate?: string;
    intentLevel?: string | null;
    isPublic?: boolean;
  }) => Promise<void>;
  updateGoal: (id: string, data: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    currentCount?: number;
    targetCount?: number;
    sourceContent?: string;
    sourceItem?: string;
    linkedCharacterId?: string;
    linkedJob?: string;
    dueDate?: string;
    intentLevel?: string | null;
    isPublic?: boolean;
  }) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Suggestions
  fetchCollectionSuggestions: () => Promise<void>;
  fetchStaticSuggestions: () => Promise<void>;

  // Share
  rotateShareCode: () => Promise<void>;
  fetchPublicProfile: (shareCode: string) => Promise<PublicPlayerProfile>;

  // BiS targets
  bisTargets: Record<string, PlayerBisTargetSet[]>;
  fetchBisTargets: (jobProfileId: string) => Promise<void>;
  createBisTarget: (jobProfileId: string, data: {
    name: string;
    purpose: string;
    sourceType: string;
    externalUrl?: string;
    importStatus?: string;
    notes?: string;
  }) => Promise<PlayerBisTargetSet>;
  updateBisTarget: (jobProfileId: string, targetId: string, data: {
    name?: string;
    purpose?: string;
    sourceType?: string;
    externalUrl?: string;
    importStatus?: string;
    notes?: string;
  }) => Promise<void>;
  deleteBisTarget: (jobProfileId: string, targetId: string) => Promise<void>;
  setBisTargetActive: (jobProfileId: string, targetId: string) => Promise<void>;
}

export const usePlayerProfileStore = create<PlayerProfileState>((set, get) => ({
  profile: null,
  gearSnapshots: {},
  goals: [],
  collectionSuggestions: [],
  staticSuggestions: [],
  bisTargets: {},
  loading: false,
  syncing: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await api.get<PlayerProfile>('/api/player/profile');
      set({ profile, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      logger.error('fetchProfile failed', { error: message });
      set({ error: message, loading: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const profile = await api.put<PlayerProfile>('/api/player/profile', data);
      set({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      logger.error('updateProfile failed', { error: message });
      throw err;
    }
  },

  linkCharacter: async (data) => {
    try {
      const character = await api.post<PlayerCharacter>('/api/player/characters', data);
      // Refresh profile to get updated character list
      await get().fetchProfile();
      return character;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link character';
      logger.error('linkCharacter failed', { error: message });
      throw err;
    }
  },

  updateCharacter: async (id, data) => {
    try {
      await api.put<PlayerCharacter>(`/api/player/characters/${id}`, data);
      await get().fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update character';
      logger.error('updateCharacter failed', { error: message });
      throw err;
    }
  },

  unlinkCharacter: async (id) => {
    try {
      await api.delete(`/api/player/characters/${id}`);
      // Remove snapshots for this character
      const snapshots = { ...get().gearSnapshots };
      delete snapshots[id];
      set({ gearSnapshots: snapshots });
      await get().fetchProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlink character';
      logger.error('unlinkCharacter failed', { error: message });
      throw err;
    }
  },

  fetchGearSnapshots: async (characterId) => {
    try {
      const snapshots = await api.get<GearSnapshot[]>(
        `/api/player/characters/${characterId}/gear`
      );
      set((state) => ({
        gearSnapshots: { ...state.gearSnapshots, [characterId]: snapshots },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load gear';
      logger.error('fetchGearSnapshots failed', { error: message });
    }
  },

  syncGear: async (characterId, forceRefresh = false, job?: string) => {
    set({ syncing: true });
    try {
      const result = await api.post<GearSyncResult>(
        `/api/player/characters/${characterId}/sync-gear`,
        { forceRefresh, ...(job ? { job } : {}) }
      );
      // Refresh gear snapshots
      await get().fetchGearSnapshots(characterId);
      // Refresh job profiles (auto-link may have occurred)
      await get().fetchJobProfiles();
      set({ syncing: false });
      return result;
    } catch (err) {
      set({ syncing: false });
      const message = err instanceof Error ? err.message : 'Gear sync failed';
      logger.error('syncGear failed', { error: message });
      throw err;
    }
  },

  fetchJobProfiles: async () => {
    try {
      const jobs = await api.get<PlayerJobProfile[]>('/api/player/jobs');
      set((state) => {
        if (!state.profile) return state;
        return {
          profile: { ...state.profile, jobProfiles: jobs },
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load jobs';
      logger.error('fetchJobProfiles failed', { error: message });
    }
  },

  createJobProfile: async (data) => {
    try {
      await api.post('/api/player/jobs', data);
      await get().fetchJobProfiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create job profile';
      logger.error('createJobProfile failed', { error: message });
      throw err;
    }
  },

  updateJobProfile: async (id, data) => {
    try {
      await api.put(`/api/player/jobs/${id}`, data);
      await get().fetchJobProfiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update job profile';
      logger.error('updateJobProfile failed', { error: message });
      throw err;
    }
  },

  deleteJobProfile: async (id) => {
    try {
      await api.delete(`/api/player/jobs/${id}`);
      await get().fetchJobProfiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete job profile';
      logger.error('deleteJobProfile failed', { error: message });
      throw err;
    }
  },

  fetchGoals: async () => {
    try {
      const goals = await api.get<PlayerGoal[]>('/api/player/goals');
      set({ goals });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load goals';
      logger.error('fetchGoals failed', { error: message });
    }
  },

  createGoal: async (data) => {
    try {
      await api.post('/api/player/goals', data);
      await get().fetchGoals();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create goal';
      logger.error('createGoal failed', { error: message });
      throw err;
    }
  },

  updateGoal: async (id, data) => {
    try {
      await api.put(`/api/player/goals/${id}`, data);
      await get().fetchGoals();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update goal';
      logger.error('updateGoal failed', { error: message });
      throw err;
    }
  },

  deleteGoal: async (id) => {
    try {
      await api.delete(`/api/player/goals/${id}`);
      await get().fetchGoals();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete goal';
      logger.error('deleteGoal failed', { error: message });
      throw err;
    }
  },

  fetchCollectionSuggestions: async () => {
    try {
      const data = await api.get<{ suggestions: CollectionSuggestion[] }>('/api/player/collection-suggestions');
      set({ collectionSuggestions: data.suggestions });
    } catch {
      // Suggestions are non-critical — fail silently
    }
  },

  fetchStaticSuggestions: async () => {
    try {
      const data = await api.get<{ suggestions: StaticSuggestion[] }>('/api/player/suggested-statics');
      set({ staticSuggestions: data.suggestions });
    } catch {
      // Suggestions are non-critical — fail silently
    }
  },

  rotateShareCode: async () => {
    try {
      const profile = await api.post<PlayerProfile>('/api/player/profile/rotate-share-code');
      set({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rotate share code';
      logger.error('rotateShareCode failed', { error: message });
      throw err;
    }
  },

  fetchPublicProfile: async (shareCode: string) => {
    const profile = await api.get<PublicPlayerProfile>(`/api/player/profile/share/${shareCode}`);
    return profile;
  },

  fetchBisTargets: async (jobProfileId) => {
    try {
      const targets = await api.get<PlayerBisTargetSet[]>(
        `/api/player/jobs/${jobProfileId}/bis-targets`,
      );
      set((state) => ({ bisTargets: { ...state.bisTargets, [jobProfileId]: targets } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load BiS targets';
      logger.error('fetchBisTargets failed', { error: message });
    }
  },

  createBisTarget: async (jobProfileId, data) => {
    try {
      const target = await api.post<PlayerBisTargetSet>(
        `/api/player/jobs/${jobProfileId}/bis-targets`,
        data,
      );
      await get().fetchBisTargets(jobProfileId);
      return target;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create BiS target';
      logger.error('createBisTarget failed', { error: message });
      throw err;
    }
  },

  updateBisTarget: async (jobProfileId, targetId, data) => {
    try {
      await api.put(`/api/player/jobs/${jobProfileId}/bis-targets/${targetId}`, data);
      await get().fetchBisTargets(jobProfileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update BiS target';
      logger.error('updateBisTarget failed', { error: message });
      throw err;
    }
  },

  deleteBisTarget: async (jobProfileId, targetId) => {
    try {
      await api.delete(`/api/player/jobs/${jobProfileId}/bis-targets/${targetId}`);
      set((state) => ({
        bisTargets: {
          ...state.bisTargets,
          [jobProfileId]: (state.bisTargets[jobProfileId] ?? []).filter((t) => t.id !== targetId),
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete BiS target';
      logger.error('deleteBisTarget failed', { error: message });
      throw err;
    }
  },

  setBisTargetActive: async (jobProfileId, targetId) => {
    try {
      await api.post(`/api/player/jobs/${jobProfileId}/bis-targets/${targetId}/set-active`);
      await get().fetchBisTargets(jobProfileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set BiS target active';
      logger.error('setBisTargetActive failed', { error: message });
      throw err;
    }
  },
}));
