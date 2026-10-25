/**
 * collectionGoalStore.setQueueOrder (S2a-3c·C2 Task TC2; design E-6, R-C-5): PUT the queue
 * order, then refresh the one goal's cells (`refreshGoalProgress`, R-S3-5). A failed PUT rejects
 * and refreshes nothing. New cases live here so `collectionGoalStore.test.ts` stays unedited.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useCollectionGoalStore } from './collectionGoalStore';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, api: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const ROUTE = '/api/static-groups/group-1/collection-goals/goal-1/queue-order';
const CELLS = '/api/static-groups/group-1/collection-participants?goal_id=goal-1';

describe('collectionGoalStore.setQueueOrder (E-6, R-C-5)', () => {
  afterEach(() => vi.clearAllMocks());

  it('PUTs { user_ids } to the queue-order route, then fetches the one goal\'s cells, and resolves the counts', async () => {
    let answer = (_: unknown) => {};
    vi.mocked(api.put).mockReturnValue(new Promise((resolve) => (answer = resolve)));
    vi.mocked(api.get).mockResolvedValue([]);

    const pending = useCollectionGoalStore.getState().setQueueOrder('group-1', 'goal-1', ['u2', 'u1']);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith(ROUTE, { user_ids: ['u2', 'u1'] });
    // Nothing is refetched before the PUT settles.
    expect(api.get).not.toHaveBeenCalled();

    answer({ ranked: 2, cleared: 1, skipped: 0 });
    await expect(pending).resolves.toEqual({ ranked: 2, cleared: 1, skipped: 0 });
    expect(vi.mocked(api.get).mock.calls).toEqual([[CELLS]]);
  });

  it('sends an empty list for Back to automatic', async () => {
    vi.mocked(api.put).mockResolvedValue({ ranked: 0, cleared: 3, skipped: 0 });
    vi.mocked(api.get).mockResolvedValue([]);
    await useCollectionGoalStore.getState().setQueueOrder('group-1', 'goal-1', []);
    expect(api.put).toHaveBeenCalledWith(ROUTE, { user_ids: [] });
    expect(vi.mocked(api.get).mock.calls).toEqual([[CELLS]]);
  });

  it('sends a copy of the ids: a caller mutating its list afterwards changes nothing sent', async () => {
    vi.mocked(api.put).mockResolvedValue({ ranked: 1, cleared: 0, skipped: 0 });
    vi.mocked(api.get).mockResolvedValue([]);
    const ids = ['u1'];
    const pending = useCollectionGoalStore.getState().setQueueOrder('group-1', 'goal-1', ids);
    const sent = vi.mocked(api.put).mock.calls[0][1] as { user_ids: string[] };
    expect(sent.user_ids).not.toBe(ids);
    ids.push('u9');
    expect(sent.user_ids).toEqual(['u1']);
    await pending;
  });

  it('rejects on a failed PUT and fetches nothing', async () => {
    const failure = new Error('You need to be a lead');
    vi.mocked(api.put).mockRejectedValue(failure);
    vi.mocked(api.get).mockResolvedValue([]);
    await expect(useCollectionGoalStore.getState().setQueueOrder('group-1', 'goal-1', ['u1'])).rejects.toBe(failure);
    expect(api.get).not.toHaveBeenCalled();
  });
});
