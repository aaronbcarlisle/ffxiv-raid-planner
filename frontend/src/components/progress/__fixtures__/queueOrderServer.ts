/**
 * A fake queue-order route over a test's mocked `api` (S2a-3c·C3): PUT `…/queue-order` answers
 * the counts, and the store's `refreshGoalProgress` spy then applies the last PUT's `user_ids`
 * to the live specs the way the server does (listed members rank 1…n in order, every other row
 * with a participant loses its rank), so the component re-renders with the refreshed ranks.
 * `gate()` holds the next PUT until released. A `mockRejectedValueOnce` on `api.put` still wins.
 */
import { useSyncExternalStore } from 'react';
import { vi, type Mock } from 'vitest';
import type { api as Api } from '../../../services/api';
import type { ColumnSpec } from './progressFixtures';

/** Specs a test and the fake refresh can both change; `useSpecs` re-renders on each change. */
export function liveSpecs(initial: ColumnSpec[]) {
  let current = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    get: () => current,
    /** Call inside `act` from a test; the fake refresh calls it bare. */
    set: (next: ColumnSpec[] | ((prev: ColumnSpec[]) => ColumnSpec[])) => {
      current = typeof next === 'function' ? next(current) : next;
      listeners.forEach((l) => l());
    },
    useSpecs: () => useSyncExternalStore(subscribe, () => current),
  };
}

export type LiveSpecs = ReturnType<typeof liveSpecs>;

/** The server's rule: listed ids rank by position, every other participant row clears. */
export function applyQueueOrder(specs: ColumnSpec[], userIds: readonly string[]): ColumnSpec[] {
  return specs.map((spec) => {
    if (!spec.cell) return spec;
    const at = userIds.indexOf(spec.id);
    return { ...spec, cell: { ...spec.cell, priorityRank: at >= 0 ? at + 1 : null } };
  });
}

export const QUEUE_ORDER_URL = '/api/static-groups/g1/collection-goals/wings/queue-order';

export function serveQueueOrder(api: typeof Api, refresh: Mock, live: LiveSpecs) {
  let held: Promise<void> | null = null;
  vi.mocked(api.put).mockImplementation(async (_url: string, body?: unknown) => {
    if (held) await held;
    const ids = (body as { user_ids: string[] }).user_ids;
    return { ranked: ids.length, cleared: 0, skipped: 0 } as never;
  });
  refresh.mockImplementation(async () => {
    const last = vi.mocked(api.put).mock.calls.at(-1);
    if (last) live.set(applyQueueOrder(live.get(), (last[1] as { user_ids: string[] }).user_ids));
  });
  return {
    /** The `user_ids` of every PUT so far, in order. */
    sent: () => vi.mocked(api.put).mock.calls.map((call) => (call[1] as { user_ids: string[] }).user_ids),
    urls: () => vi.mocked(api.put).mock.calls.map((call) => call[0]),
    /** Holds every PUT until the returned release runs. */
    gate: () => {
      let release = () => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return () => release();
    },
  };
}
