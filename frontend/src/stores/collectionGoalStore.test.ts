import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useCollectionGoalStore, type RewardDrop } from './collectionGoalStore';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const makeDrop = (id: string): RewardDrop => ({
  id,
  goalId: 'goal-1',
  staticGroupId: 'group-1',
  recipientUserId: null,
  createdById: 'u1',
  quantity: 1,
  droppedAt: '2026-09-30T00:00:00Z',
  notes: null,
  createdAt: '2026-09-30T00:00:00Z',
  recipientDisplayName: null,
  recipientPriorState: null,
});

describe('collectionGoalStore', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ drops: {}, participants: {}, goals: [] });
    vi.clearAllMocks();
  });

  it('maps memberRole and recipientPriorState from the snake_case API fields', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/participants')) {
        return [
          {
            id: 'ps1', goal_id: 'goal-1', user_id: 'u1', static_group_id: 'group-1', state: 'need',
            token_count: null, priority_rank: null, source: 'manual', last_synced_at: null,
            notes: null, updated_at: '2026-09-30T00:00:00Z', display_name: 'Aria', member_role: 'viewer',
          },
        ];
      }
      return [
        {
          id: 'd1', goal_id: 'goal-1', static_group_id: 'group-1', recipient_user_id: 'u1',
          created_by_id: 'u2', quantity: 1, dropped_at: '2026-09-30T00:00:00Z', notes: null,
          created_at: '2026-09-30T00:00:00Z', recipient_display_name: 'Aria', recipient_prior_state: 'want',
        },
      ];
    });

    await useCollectionGoalStore.getState().fetchParticipants('group-1', 'goal-1');
    await useCollectionGoalStore.getState().fetchDrops('group-1', 'goal-1');

    expect(useCollectionGoalStore.getState().participants['goal-1'][0].memberRole).toBe('viewer');
    expect(useCollectionGoalStore.getState().drops['goal-1'][0].recipientPriorState).toBe('want');
  });

  it('deleteDrop DELETEs the drop, removes it locally, and refetches participants and goals', async () => {
    useCollectionGoalStore.setState({ drops: { 'goal-1': [makeDrop('d1'), makeDrop('d2')] } });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.mocked(api.get).mockResolvedValue([]);

    await useCollectionGoalStore.getState().deleteDrop('group-1', 'goal-1', 'd1');

    expect(api.delete).toHaveBeenCalledWith(
      '/api/static-groups/group-1/collection-goals/goal-1/drops/d1',
    );
    expect(api.get).toHaveBeenCalledWith(
      '/api/static-groups/group-1/collection-goals/goal-1/participants',
    );
    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-goals');
  });

  it('deleteDrop refetches the drops so the prior-state hand-off reaches the remaining rows', async () => {
    // Cached: d2 holds no prior. The server hands d1's prior ('need') to d2 on delete.
    useCollectionGoalStore.setState({ drops: { 'goal-1': [makeDrop('d1'), makeDrop('d2')] } });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/drops')) {
        return [
          {
            id: 'd2', goal_id: 'goal-1', static_group_id: 'group-1', recipient_user_id: null,
            created_by_id: 'u1', quantity: 1, dropped_at: '2026-09-30T00:00:00Z', notes: null,
            created_at: '2026-09-30T00:00:00Z', recipient_display_name: null,
            recipient_prior_state: 'need',
          },
        ];
      }
      return [];
    });

    await useCollectionGoalStore.getState().deleteDrop('group-1', 'goal-1', 'd1');

    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-goals/goal-1/drops');
    const remaining = useCollectionGoalStore.getState().drops['goal-1'];
    expect(remaining.map((d) => d.id)).toEqual(['d2']);
    expect(remaining[0].recipientPriorState).toBe('need');
  });

  it('deleteDrop hides the row immediately, before the refetched drops arrive', async () => {
    useCollectionGoalStore.setState({ drops: { 'goal-1': [makeDrop('d1'), makeDrop('d2')] } });
    vi.mocked(api.delete).mockResolvedValue(undefined);
    let idsAtFirstGet: string[] = [];
    vi.mocked(api.get).mockImplementation(async () => {
      if (idsAtFirstGet.length === 0) {
        idsAtFirstGet = (useCollectionGoalStore.getState().drops['goal-1'] ?? []).map((d) => d.id);
      }
      return [];
    });

    await useCollectionGoalStore.getState().deleteDrop('group-1', 'goal-1', 'd1');

    expect(idsAtFirstGet).toEqual(['d2']);
  });

  it('deleteDrop keeps the drop locally when the server refuses', async () => {
    useCollectionGoalStore.setState({ drops: { 'goal-1': [makeDrop('d1')] } });
    vi.mocked(api.delete).mockRejectedValue(new Error('forbidden'));

    await expect(
      useCollectionGoalStore.getState().deleteDrop('group-1', 'goal-1', 'd1'),
    ).rejects.toThrow('forbidden');

    expect(useCollectionGoalStore.getState().drops['goal-1']).toHaveLength(1);
  });
});
