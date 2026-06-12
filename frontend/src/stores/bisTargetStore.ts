import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BisTargetSet, BisTargetSource, BisTargetPurpose } from '../types';

function makeKey(groupId: string, playerId: string, job: string): string {
  return `${groupId}:${playerId}:${job}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return `bis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface BisTargetState {
  /** Map of composite key → list of target sets */
  targets: Record<string, BisTargetSet[]>;

  getTargets(groupId: string, playerId: string, job: string): BisTargetSet[];
  getActive(groupId: string, playerId: string, job: string): BisTargetSet | null;

  addTarget(
    groupId: string,
    playerId: string,
    job: string,
    fields: {
      name: string;
      source: BisTargetSource;
      purpose: BisTargetPurpose;
      externalUrl?: string;
      patch?: string;
      tier?: string;
      targetItemLevel?: number;
      makeActive?: boolean;
    }
  ): BisTargetSet;

  updateTarget(
    groupId: string,
    playerId: string,
    job: string,
    id: string,
    patch: Partial<Pick<BisTargetSet, 'name' | 'source' | 'purpose' | 'externalUrl' | 'patch' | 'tier' | 'targetItemLevel'>>
  ): void;

  removeTarget(groupId: string, playerId: string, job: string, id: string): void;

  setActive(groupId: string, playerId: string, job: string, id: string): void;
}

export const useBisTargetStore = create<BisTargetState>()(
  persist(
    (set, get) => ({
      targets: {},

      getTargets(groupId, playerId, job) {
        return get().targets[makeKey(groupId, playerId, job)] ?? [];
      },

      getActive(groupId, playerId, job) {
        const list = get().getTargets(groupId, playerId, job);
        return list.find((t) => t.isActive) ?? null;
      },

      addTarget(groupId, playerId, job, fields) {
        const key = makeKey(groupId, playerId, job);
        const existing = get().targets[key] ?? [];
        const makeActive = fields.makeActive ?? existing.length === 0;

        const newTarget: BisTargetSet = {
          id: randomId(),
          job,
          name: fields.name,
          source: fields.source,
          purpose: fields.purpose,
          externalUrl: fields.externalUrl,
          patch: fields.patch,
          tier: fields.tier,
          targetItemLevel: fields.targetItemLevel,
          isActive: makeActive,
          importedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        const updated = makeActive
          ? [...existing.map((t) => ({ ...t, isActive: false })), newTarget]
          : [...existing, newTarget];

        set((s) => ({ targets: { ...s.targets, [key]: updated } }));
        return newTarget;
      },

      updateTarget(groupId, playerId, job, id, patch) {
        const key = makeKey(groupId, playerId, job);
        const existing = get().targets[key] ?? [];
        const updated = existing.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t
        );
        set((s) => ({ targets: { ...s.targets, [key]: updated } }));
      },

      removeTarget(groupId, playerId, job, id) {
        const key = makeKey(groupId, playerId, job);
        const existing = get().targets[key] ?? [];
        const removed = existing.filter((t) => t.id !== id);
        // If we removed the active one, promote the first remaining
        const hasActive = removed.some((t) => t.isActive);
        const promoted = !hasActive && removed.length > 0
          ? [{ ...removed[0], isActive: true }, ...removed.slice(1)]
          : removed;
        set((s) => ({ targets: { ...s.targets, [key]: promoted } }));
      },

      setActive(groupId, playerId, job, id) {
        const key = makeKey(groupId, playerId, job);
        const existing = get().targets[key] ?? [];
        const updated = existing.map((t) => ({ ...t, isActive: t.id === id }));
        set((s) => ({ targets: { ...s.targets, [key]: updated } }));
      },
    }),
    { name: 'bis-targets-v1' }
  )
);
