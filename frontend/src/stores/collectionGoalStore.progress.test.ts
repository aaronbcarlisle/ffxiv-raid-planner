/**
 * collectionGoalStore — the Progress tab's read model (S2a-2·F2 Task TF3, R-S2-13).
 * New cases live here so `collectionGoalStore.test.ts` stays unedited (vet M-2).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useCollectionGoalStore, type ParticipantStateEntry } from './collectionGoalStore';

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

/** A participant row as the server sends it; `extra` carries the S2a-1 / S2-13 fields. */
const apiRow = (goalId: string, userId: string, extra: Record<string, unknown> = {}) => ({
  id: `${goalId}-${userId}`,
  goal_id: goalId,
  user_id: userId,
  static_group_id: 'group-1',
  state: 'need',
  token_count: null,
  priority_rank: null,
  source: 'manual',
  last_synced_at: null,
  notes: null,
  updated_at: '2026-10-01T00:00:00Z',
  display_name: userId,
  member_role: 'member',
  ...extra,
});

const apiRecord = {
  character_id: 'c1',
  ownership_state: 'have',
  token_count: 3,
  source: 'plugin',
  updated_by_user_id: 'u9',
  updated_via: 'plugin',
  state_changed_at: '2026-10-02T00:00:00Z',
  token_count_updated_at: '2026-10-03T00:00:00Z',
  last_synced_at: '2026-10-04T00:00:00Z',
};

const cachedRow = (goalId: string): ParticipantStateEntry => ({
  id: `${goalId}-cached`,
  goalId,
  userId: 'u-cached',
  staticGroupId: 'group-1',
  state: 'have',
  tokenCount: null,
  priorityRank: null,
  source: 'manual',
  lastSyncedAt: null,
  notes: null,
  updatedAt: '2026-09-01T00:00:00Z',
  displayName: 'Cached',
  memberRole: 'member',
});

describe('collectionGoalStore: the participant mapper (R-S2-13)', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, goals: [] });
    vi.clearAllMocks();
  });

  it('reads every new snake_case field, count_hidden included', async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        goal_id: 'a',
        participants: [
          apiRow('a', 'u1', {
            updated_by_user_id: 'u9',
            updated_via: 'plugin',
            state_changed_at: '2026-10-02T00:00:00Z',
            token_count_updated_at: '2026-10-03T00:00:00Z',
            state_from_record: true,
            count_from_record: true,
            count_hidden: true,
            record: apiRecord,
          }),
        ],
        record_only: [],
      },
    ]);

    await useCollectionGoalStore.getState().fetchProgress('group-1');

    const row = useCollectionGoalStore.getState().participants.a[0];
    expect(row.updatedByUserId).toBe('u9');
    expect(row.updatedVia).toBe('plugin');
    expect(row.stateChangedAt).toBe('2026-10-02T00:00:00Z');
    expect(row.tokenCountUpdatedAt).toBe('2026-10-03T00:00:00Z');
    expect(row.stateFromRecord).toBe(true);
    expect(row.countFromRecord).toBe(true);
    expect(row.countHidden).toBe(true);
    expect(row.record).toEqual({
      characterId: 'c1',
      ownershipState: 'have',
      tokenCount: 3,
      source: 'plugin',
      updatedByUserId: 'u9',
      updatedVia: 'plugin',
      stateChangedAt: '2026-10-02T00:00:00Z',
      tokenCountUpdatedAt: '2026-10-03T00:00:00Z',
      lastSyncedAt: '2026-10-04T00:00:00Z',
    });
  });

  it('defaults the new fields (false, null) on a V1-shaped payload', async () => {
    vi.mocked(api.get).mockResolvedValue([apiRow('a', 'u1')]);

    await useCollectionGoalStore.getState().fetchParticipants('group-1', 'a');

    const row = useCollectionGoalStore.getState().participants.a[0];
    expect(row.updatedByUserId).toBeNull();
    expect(row.updatedVia).toBeNull();
    expect(row.stateChangedAt).toBeNull();
    expect(row.tokenCountUpdatedAt).toBeNull();
    expect(row.stateFromRecord).toBe(false);
    expect(row.countFromRecord).toBe(false);
    expect(row.countHidden).toBe(false);
    expect(row.record).toBeNull();
  });

  it('maps a record-only cell, with its record and count_hidden', async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        goal_id: 'a',
        participants: [],
        record_only: [
          {
            user_id: 'u2',
            display_name: 'Bea',
            member_role: 'lead',
            state: 'have',
            token_count: null,
            count_hidden: true,
            record: apiRecord,
          },
          {
            user_id: 'u3',
            display_name: null,
            member_role: 'member',
            state: null,
            token_count: 2,
            count_hidden: false,
            record: { ...apiRecord, character_id: null },
          },
        ],
      },
    ]);

    await useCollectionGoalStore.getState().fetchProgress('group-1');

    const cells = useCollectionGoalStore.getState().recordOnly.a;
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({
      userId: 'u2',
      displayName: 'Bea',
      memberRole: 'lead',
      state: 'have',
      tokenCount: null,
      countHidden: true,
    });
    expect(cells[0].record.ownershipState).toBe('have');
    expect(cells[1]).toMatchObject({ userId: 'u3', displayName: null, state: null, tokenCount: 2, countHidden: false });
    expect(cells[1].record.characterId).toBeNull();
  });
});

describe('collectionGoalStore.fetchProgress (R-S2-13)', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, participantsLoading: {}, goals: [] });
    vi.clearAllMocks();
  });

  it('populates participants and recordOnly for the goals returned and keeps a third goal cached', async () => {
    useCollectionGoalStore.setState({
      participants: { c: [cachedRow('c')] },
      recordOnly: { c: [] },
    });
    vi.mocked(api.get).mockResolvedValue([
      {
        goal_id: 'a',
        participants: [apiRow('a', 'u1'), apiRow('a', 'u2', { state: 'want' })],
        record_only: [{ user_id: 'u3', display_name: 'Cy', member_role: 'member', state: 'have', token_count: null, count_hidden: false, record: apiRecord }],
      },
      { goal_id: 'b', participants: [apiRow('b', 'u1')], record_only: [] },
    ]);

    await useCollectionGoalStore.getState().fetchProgress('group-1');

    const s = useCollectionGoalStore.getState();
    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-participants');
    expect(s.participants.a.map((p) => p.userId)).toEqual(['u1', 'u2']);
    expect(s.participants.b.map((p) => p.userId)).toEqual(['u1']);
    expect(s.recordOnly.a.map((c) => c.userId)).toEqual(['u3']);
    expect(s.recordOnly.b).toEqual([]);
    // The third goal was not returned: its cache stays.
    expect(s.participants.c).toEqual([cachedRow('c')]);
    expect(s.recordOnly.c).toEqual([]);
  });

  it('requests repeated goal_id params when goalIds are given', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await useCollectionGoalStore.getState().fetchProgress('group-1', ['a', 'b']);

    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-participants?goal_id=a&goal_id=b');
  });

  it('keeps the cache and rethrows nothing when the request fails', async () => {
    useCollectionGoalStore.setState({ participants: { c: [cachedRow('c')] } });
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));

    await expect(useCollectionGoalStore.getState().fetchProgress('group-1')).resolves.toBeUndefined();

    expect(useCollectionGoalStore.getState().participants.c).toEqual([cachedRow('c')]);
  });

  it('merges a goal_id fetch into the cache without replacing other goals (TF5 ruling 4)', async () => {
    useCollectionGoalStore.setState({
      participants: { active: [cachedRow('active')] },
      recordOnly: { active: [] },
    });
    vi.mocked(api.get).mockResolvedValue([{ goal_id: 'done', participants: [apiRow('done', 'u1')], record_only: [] }]);

    await useCollectionGoalStore.getState().fetchProgress('group-1', ['done']);

    const s = useCollectionGoalStore.getState();
    expect(s.participants.active).toEqual([cachedRow('active')]);
    expect(s.participants.done.map((p) => p.userId)).toEqual(['u1']);
  });
});

describe('collectionGoalStore.fetchProgress loading and error (TF5 ruling 3)', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, progressLoading: false, progressError: null });
    vi.clearAllMocks();
  });

  it('is loading while the request is pending and settles false on success', async () => {
    let resolve: (v: unknown[]) => void = () => {};
    vi.mocked(api.get).mockReturnValue(new Promise((r) => { resolve = r as (v: unknown[]) => void; }));

    const pending = useCollectionGoalStore.getState().fetchProgress('group-1');
    expect(useCollectionGoalStore.getState().progressLoading).toBe(true);
    expect(useCollectionGoalStore.getState().progressError).toBeNull();

    resolve([]);
    await pending;
    expect(useCollectionGoalStore.getState().progressLoading).toBe(false);
    expect(useCollectionGoalStore.getState().progressError).toBeNull();
  });

  it('records the failure message, settles false, and clears the error when the next call starts', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'));
    await useCollectionGoalStore.getState().fetchProgress('group-1');
    expect(useCollectionGoalStore.getState().progressLoading).toBe(false);
    expect(useCollectionGoalStore.getState().progressError).toBe('boom');

    vi.mocked(api.get).mockResolvedValue([]);
    const retry = useCollectionGoalStore.getState().fetchProgress('group-1');
    expect(useCollectionGoalStore.getState().progressError).toBeNull();
    await retry;
    expect(useCollectionGoalStore.getState().progressError).toBeNull();
  });

  it('stays loading until the last of two overlapping calls settles', async () => {
    const resolvers: Array<(v: unknown[]) => void> = [];
    vi.mocked(api.get).mockImplementation(() => new Promise((r) => { resolvers.push(r as (v: unknown[]) => void); }));

    const first = useCollectionGoalStore.getState().fetchProgress('group-1');
    const second = useCollectionGoalStore.getState().fetchProgress('group-1', ['a']);
    resolvers[0]([]);
    await first;
    expect(useCollectionGoalStore.getState().progressLoading).toBe(true);
    resolvers[1]([]);
    await second;
    expect(useCollectionGoalStore.getState().progressLoading).toBe(false);
  });
});
