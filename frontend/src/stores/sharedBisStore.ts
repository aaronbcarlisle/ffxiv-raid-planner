import { create } from 'zustand';
import { api } from '../services/api';
import { logger } from '../lib/logger';
import type {
  SharedBiSTargetSet,
  SharedBiSTargetCreate,
  SharedBiSTargetUpdate,
  BiSOwnerType,
  BisTargetPurpose,
} from '../types';

function ownerKey(ownerType: string, ownerId: string): string {
  return `${ownerType}:${ownerId}`;
}

interface SharedBisState {
  targets: Record<string, SharedBiSTargetSet[]>;
  loading: Record<string, boolean>;

  getTargets(ownerType: BiSOwnerType, ownerId: string): SharedBiSTargetSet[];
  getActive(ownerType: BiSOwnerType, ownerId: string, job: string): SharedBiSTargetSet | null;
  isLoading(ownerType: BiSOwnerType, ownerId: string): boolean;

  fetchTargets(ownerType: BiSOwnerType, ownerId: string): Promise<void>;
  createTarget(data: SharedBiSTargetCreate): Promise<SharedBiSTargetSet>;
  createMultipleTargets(dataList: SharedBiSTargetCreate[]): Promise<SharedBiSTargetSet[]>;
  updateTarget(id: string, data: SharedBiSTargetUpdate): Promise<SharedBiSTargetSet>;
  deleteTarget(id: string, ownerType: BiSOwnerType, ownerId: string): Promise<void>;
  setTargetActive(id: string, ownerType: BiSOwnerType, ownerId: string): Promise<void>;
  importTarget(id: string, ownerType: BiSOwnerType, ownerId: string): Promise<SharedBiSTargetSet>;
}

export const useSharedBisStore = create<SharedBisState>((set, get) => ({
  targets: {},
  loading: {},

  getTargets(ownerType, ownerId) {
    return get().targets[ownerKey(ownerType, ownerId)] ?? [];
  },

  getActive(ownerType, ownerId, job) {
    return (
      get()
        .getTargets(ownerType, ownerId)
        .find((t) => t.job.toUpperCase() === job.toUpperCase() && t.isActive) ?? null
    );
  },

  isLoading(ownerType, ownerId) {
    return get().loading[ownerKey(ownerType, ownerId)] ?? false;
  },

  async fetchTargets(ownerType, ownerId) {
    const key = ownerKey(ownerType, ownerId);
    set((s) => ({ loading: { ...s.loading, [key]: true } }));
    try {
      const targets = await api.get<SharedBiSTargetSet[]>(
        `/api/bis-targets?ownerType=${ownerType}&ownerId=${ownerId}`,
      );
      set((s) => ({
        targets: { ...s.targets, [key]: targets },
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      logger.error('sharedBisStore.fetchTargets failed', { ownerType, ownerId, err });
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  },

  async createTarget(data) {
    const target = await api.post<SharedBiSTargetSet>('/api/bis-targets', data);
    await get().fetchTargets(data.ownerType, data.ownerId);
    return target;
  },

  async createMultipleTargets(dataList) {
    if (dataList.length === 0) return [];
    const results = await Promise.all(
      dataList.map((d) => api.post<SharedBiSTargetSet>('/api/bis-targets', d)),
    );
    // Re-fetch once after all creates rather than N times
    const { ownerType, ownerId } = dataList[0];
    await get().fetchTargets(ownerType, ownerId);
    return results;
  },

  async updateTarget(id, data) {
    const updated = await api.patch<SharedBiSTargetSet>(`/api/bis-targets/${id}`, data);
    set((s) => {
      const key = ownerKey(updated.ownerType, updated.ownerId);
      const list = s.targets[key] ?? [];
      return {
        targets: {
          ...s.targets,
          [key]: list.map((t) => (t.id === id ? updated : t)),
        },
      };
    });
    return updated;
  },

  async deleteTarget(id, ownerType, ownerId) {
    await api.delete(`/api/bis-targets/${id}`);
    const key = ownerKey(ownerType, ownerId);
    set((s) => ({
      targets: {
        ...s.targets,
        [key]: (s.targets[key] ?? []).filter((t) => t.id !== id),
      },
    }));
  },

  async setTargetActive(id, ownerType, ownerId) {
    await api.post<SharedBiSTargetSet>(`/api/bis-targets/${id}/set-active`);
    await get().fetchTargets(ownerType, ownerId);
  },

  async importTarget(id, ownerType, ownerId) {
    const updated = await api.post<SharedBiSTargetSet>(`/api/bis-targets/${id}/import`);
    await get().fetchTargets(ownerType, ownerId);
    return updated;
  },
}));

// Convenience selector hook
export function useSharedBisTargets(ownerType: BiSOwnerType, ownerId: string) {
  return useSharedBisStore((s) => s.getTargets(ownerType, ownerId));
}

export function useSharedBisActiveTarget(
  ownerType: BiSOwnerType,
  ownerId: string,
  job: string,
): SharedBiSTargetSet | null {
  return useSharedBisStore((s) => s.getActive(ownerType, ownerId, job));
}

export const PURPOSE_OPTIONS: { value: BisTargetPurpose; label: string }[] = [
  { value: 'savage', label: 'Savage prog/clear' },
  { value: 'ultimate', label: 'Ultimate prog/clear' },
  { value: 'prog', label: 'General prog' },
  { value: 'farm', label: 'Farm set' },
  { value: 'speed', label: 'Speed kill / parse' },
  { value: 'comfort', label: 'Comfort / casual' },
  { value: 'custom', label: 'Custom' },
];

export const PURPOSE_LABELS: Record<string, string> = {
  savage: 'Savage', ultimate: 'Ultimate', prog: 'Prog',
  farm: 'Farm', speed: 'Speed', comfort: 'Comfort', custom: 'Custom',
};

export const SOURCE_LABELS: Record<string, string> = {
  preset: 'Preset', manual: 'Manual', xivgear: 'XIVGear',
  etro: 'Etro', ariyala: 'Ariyala', custom_link: 'Link',
};

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  linked_only: 'Linked only',
  imported: 'Imported',
  import_failed: 'Import failed',
  unsupported: 'Unsupported',
};
