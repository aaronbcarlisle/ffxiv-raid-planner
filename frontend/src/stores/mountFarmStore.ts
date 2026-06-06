import { create } from 'zustand';
import { ApiError, api } from '../services/api';

export type DataSource = 'manual' | 'plugin' | 'tomestone' | 'unknown';

export interface MemberProgress {
  userId: string;
  displayName: string;
  discordUsername: string | null;
  discordAvatar: string | null;
  trialId: string;
  hasMount: boolean;
  wantsMount: boolean;
  totemCount: number;
  notes: string | null;
  updatedAt: string | null;
  ownershipSource: DataSource;
  totemSource: DataSource;
  lastImportedAt: string | null;
  lastPluginSyncAt: string | null;
  lastManualOverrideAt: string | null;
}

export interface TrialSummary {
  trialId: string;
  totalMembers: number;
  membersComplete: number;
  membersMissing: number;
  membersWanting: number;
  membersCanBuy: number;
  memberProgress: MemberProgress[];
}

export interface MountFarmData {
  trials: TrialSummary[];
  currentUserId: string | null;
}

export interface FarmScore {
  trialId: string;
  score: number;
  membersMissing: number;
  membersWanting: number;
  membersCloseToTarget: number;
  membersCanBuy: number;
}

interface MountFarmState {
  data: MountFarmData | null;
  recommendations: FarmScore[];
  isLoading: boolean;
  isLoadingRecs: boolean;
  isSaving: boolean;
  error: string | null;

  fetchProgress: (groupId: string, trialIds?: string[]) => Promise<void>;
  fetchRecommendations: (groupId: string, expansion?: string) => Promise<void>;
  updateProgress: (groupId: string, update: {
    trialId: string;
    userId?: string;
    hasMount?: boolean;
    wantsMount?: boolean;
    totemCount?: number;
    notes?: string;
  }) => Promise<void>;
  clearData: () => void;
}

function logMountFarmApiFailure(endpoint: string, error: unknown): void {
  if (!import.meta.env.DEV) return;

  const status = error instanceof ApiError ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error('Mount Farms API request failed', { endpoint, status, message });
}

function getMountFarmLoadError(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return 'Could not load mount farm progress. Static not found or you do not have access. The Mount Farm API route may also be unavailable in this deployment.';
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return `Could not load mount farm progress. ${message}`;
}

function getMountFarmSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return `Could not save mount farm progress. ${message}`;
}

export const useMountFarmStore = create<MountFarmState>((set, get) => ({
  data: null,
  recommendations: [],
  isLoading: false,
  isLoadingRecs: false,
  isSaving: false,
  error: null,

  fetchProgress: async (groupId: string, trialIds?: string[]) => {
    set({ isLoading: true, error: null });
    const params = trialIds?.length
      ? `?trial_ids=${trialIds.map(encodeURIComponent).join(',')}`
      : '';
    const endpoint = `/api/static-groups/${groupId}/mount-farms${params}`;

    try {
      const data = await api.get<MountFarmData>(endpoint);
      set({ data, isLoading: false });
    } catch (err) {
      logMountFarmApiFailure(endpoint, err);
      set({ error: getMountFarmLoadError(err), isLoading: false });
    }
  },

  fetchRecommendations: async (groupId: string, expansion?: string) => {
    set({ isLoadingRecs: true });
    try {
      const params = expansion ? `?expansion=${expansion}&limit=10` : '?limit=10';
      const recommendations = await api.get<FarmScore[]>(
        `/api/static-groups/${groupId}/mount-farms/recommendations${params}`
      );
      set({ recommendations, isLoadingRecs: false });
    } catch {
      set({ isLoadingRecs: false });
    }
  },

  updateProgress: async (groupId: string, update) => {
    set({ isSaving: true, error: null });
    const endpoint = `/api/static-groups/${groupId}/mount-farms/progress`;

    try {
      const response = await api.patch<MemberProgress>(
        endpoint,
        update
      );

      const current = get().data;
      if (current) {
        const updatedTrials = current.trials.map(trial => {
          if (trial.trialId !== update.trialId) return trial;

          const updatedProgress = trial.memberProgress.map(mp =>
            mp.userId === response.userId ? response : mp
          );
          const hasExisting = trial.memberProgress.some(mp => mp.userId === response.userId);
          if (!hasExisting) {
            updatedProgress.push(response);
          }

          let complete = 0, missing = 0, wanting = 0, canBuy = 0;
          for (const mp of updatedProgress) {
            if (mp.hasMount) {
              complete++;
            } else {
              missing++;
              if (mp.wantsMount) wanting++;
              if (mp.totemCount >= 99) canBuy++;
            }
          }

          return {
            ...trial,
            memberProgress: updatedProgress,
            membersComplete: complete,
            membersMissing: missing,
            membersWanting: wanting,
            membersCanBuy: canBuy,
          };
        });

        const hasTrialEntry = current.trials.some(t => t.trialId === update.trialId);
        if (!hasTrialEntry) {
          updatedTrials.push({
            trialId: update.trialId,
            totalMembers: 1,
            membersComplete: response.hasMount ? 1 : 0,
            membersMissing: response.hasMount ? 0 : 1,
            membersWanting: !response.hasMount && response.wantsMount ? 1 : 0,
            membersCanBuy: !response.hasMount && response.totemCount >= 99 ? 1 : 0,
            memberProgress: [response],
          });
        }

        set({ data: { ...current, trials: updatedTrials }, isSaving: false });
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      logMountFarmApiFailure(endpoint, err);
      set({ error: getMountFarmSaveError(err), isSaving: false });
      throw err;
    }
  },

  clearData: () => set({ data: null, recommendations: [], error: null }),
}));
