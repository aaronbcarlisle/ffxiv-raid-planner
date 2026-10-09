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

  it('keeps the cache and rethrows nothing when the request fails, resolving with its own error', async () => {
    useCollectionGoalStore.setState({ participants: { c: [cachedRow('c')] } });
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));

    await expect(useCollectionGoalStore.getState().fetchProgress('group-1')).resolves.toEqual({ error: 'boom' });

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

describe('collectionGoalStore.fetchProgress per-call result (TF6 ruling 3c)', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, progressLoading: false, progressError: null });
    vi.clearAllMocks();
  });

  it('resolves { error: null } on success and its own failure otherwise', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);
    await expect(useCollectionGoalStore.getState().fetchProgress('group-1')).resolves.toEqual({ error: null });

    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'));
    await expect(useCollectionGoalStore.getState().fetchProgress('group-1')).resolves.toEqual({ error: 'boom' });
  });

  it('keeps the results of overlapping calls apart even though progressError is one slot', async () => {
    const settlers: Array<{ ok: (v: unknown[]) => void; fail: (e: Error) => void }> = [];
    vi.mocked(api.get).mockImplementation(
      () => new Promise((ok, fail) => { settlers.push({ ok: ok as (v: unknown[]) => void, fail }); }),
    );
    const failing = useCollectionGoalStore.getState().fetchProgress('group-1');
    const succeeding = useCollectionGoalStore.getState().fetchProgress('group-1', ['done']);
    settlers[0].fail(new Error('boom'));
    settlers[1].ok([]);

    await expect(failing).resolves.toEqual({ error: 'boom' });
    // The store's one slot holds the failure, yet the other call's own result is clean.
    await expect(succeeding).resolves.toEqual({ error: null });
    expect(useCollectionGoalStore.getState().progressError).toBe('boom');
  });
});

// ── setCell and undoCells (S2a-2·F5 Task TF7; R-S2-10, R-S2-11) ─────────────

const recordOnlyCell = (userId: string) => ({
  userId,
  displayName: userId,
  memberRole: 'member',
  state: 'have' as const,
  tokenCount: null,
  countHidden: false,
  record: {
    characterId: 'c1', ownershipState: 'have', tokenCount: null, source: 'plugin', updatedByUserId: null,
    updatedVia: 'api_key', stateChangedAt: null, tokenCountUpdatedAt: null, lastSyncedAt: null,
  },
});

describe('collectionGoalStore.setCell (R-S2-10)', () => {
  const setCell = (...args: Parameters<ReturnType<typeof useCollectionGoalStore.getState>['setCell']>) =>
    useCollectionGoalStore.getState().setCell(...args);

  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, goals: [] });
    vi.clearAllMocks();
  });

  it('writes the caller\'s own cell through the self route with state and token_count only', async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...apiRow('a', 'u1', { state: 'need', token_count: 62 }), undo_token: 'tok-1' });

    const result = await setCell('group-1', 'a', { state: 'need', tokenCount: 62 });

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/group-1/collection-goals/a/participants', { state: 'need', token_count: 62 });
    expect(result.undoToken).toBe('tok-1');
    expect(result.entry).toMatchObject({ userId: 'u1', state: 'need', tokenCount: 62 });
  });

  it('writes another member\'s cell through the lead route, with null for a count left alone', async () => {
    vi.mocked(api.patch).mockResolvedValue({ ...apiRow('a', 'u2'), undo_token: 'tok-2' });

    await setCell('group-1', 'a', { targetUserId: 'u2', state: 'need' });

    expect(api.patch).toHaveBeenCalledWith('/api/static-groups/group-1/collection-goals/a/participants/u2', { state: 'need', token_count: null });
  });

  it('replaces the member\'s row, drops their record-only cell, keeps everyone else, and refetches no goals', async () => {
    useCollectionGoalStore.setState({
      participants: { a: [cachedRow('a'), { ...cachedRow('a'), id: 'a-u1', userId: 'u1', state: 'want' }] },
      recordOnly: { a: [recordOnlyCell('u1'), recordOnlyCell('u3')] },
    });
    vi.mocked(api.patch).mockResolvedValue({ ...apiRow('a', 'u1', { state: 'have' }), undo_token: null });

    const result = await setCell('group-1', 'a', { state: 'have' });

    const s = useCollectionGoalStore.getState();
    expect(s.participants.a.map((p) => [p.userId, p.state])).toEqual([['u-cached', 'have'], ['u1', 'have']]);
    expect(s.recordOnly.a.map((c) => c.userId)).toEqual(['u3']);
    expect(result.undoToken).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('appends the row of a member who had none, and leaves another goal\'s record-only cells alone', async () => {
    useCollectionGoalStore.setState({ participants: { a: [cachedRow('a')] }, recordOnly: { b: [recordOnlyCell('u1')] } });
    vi.mocked(api.patch).mockResolvedValue({ ...apiRow('a', 'u1', { state: 'pass' }) });

    await setCell('group-1', 'a', { state: 'pass' });

    const s = useCollectionGoalStore.getState();
    expect(s.participants.a.map((p) => p.userId)).toEqual(['u-cached', 'u1']);
    expect(s.recordOnly.b.map((c) => c.userId)).toEqual(['u1']);
  });

  it('propagates a failed write and leaves the rows as they were', async () => {
    useCollectionGoalStore.setState({ participants: { a: [cachedRow('a')] } });
    vi.mocked(api.patch).mockRejectedValue(new Error('boom'));

    await expect(setCell('group-1', 'a', { state: 'need' })).rejects.toThrow('boom');

    expect(useCollectionGoalStore.getState().participants.a).toEqual([cachedRow('a')]);
  });
});

describe('collectionGoalStore.undoCells (R-S2-11)', () => {
  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, progressLoading: false, progressError: null });
    vi.clearAllMocks();
  });

  it('posts the token, then refetches the active cells, and resolves with the counts', async () => {
    vi.mocked(api.post).mockResolvedValue({ restored: 2, skipped: 0 });
    vi.mocked(api.get).mockResolvedValue([{ goal_id: 'a', participants: [apiRow('a', 'u1', { state: 'want' })], record_only: [] }]);

    const result = await useCollectionGoalStore.getState().undoCells('group-1', 'tok-1');

    expect(api.post).toHaveBeenCalledWith('/api/static-groups/group-1/collection-participants/undo', { token: 'tok-1' });
    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-participants');
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.get).mock.invocationCallOrder[0]);
    expect(result).toEqual({ restored: 2, skipped: 0 });
    expect(useCollectionGoalStore.getState().participants.a[0].state).toBe('want');
  });

  it('propagates a failed post and fetches nothing', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('boom'));

    await expect(useCollectionGoalStore.getState().undoCells('group-1', 'tok-1')).rejects.toThrow('boom');

    expect(api.get).not.toHaveBeenCalled();
  });
});

// ── markNeed (S2a-2·F6 Task TF8; R-S2-12) ───────────────────────────────────

describe('collectionGoalStore.markNeed (R-S2-12)', () => {
  const MARK_NEED = '/api/static-groups/group-1/collection-participants/mark-need';
  const markNeed = (cells: { goalId: string; userId: string }[]) => useCollectionGoalStore.getState().markNeed('group-1', cells);
  const cellsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ goalId: `g${i}`, userId: `u${i}` }));

  afterEach(() => {
    useCollectionGoalStore.setState({ participants: {}, recordOnly: {}, progressLoading: false, progressError: null });
    vi.clearAllMocks();
  });

  it('posts the cells in snake_case, then refetches the active cells once, and resolves with the counts and the token', async () => {
    vi.mocked(api.post).mockResolvedValue({ created: [apiRow('a', 'u1'), apiRow('a', 'u2')], skipped: 1, undo_token: 'tok-1' });
    vi.mocked(api.get).mockResolvedValue([]);

    const result = await markNeed([{ goalId: 'a', userId: 'u1' }, { goalId: 'a', userId: 'u2' }, { goalId: 'b', userId: 'u1' }]);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(MARK_NEED, { cells: [{ goal_id: 'a', user_id: 'u1' }, { goal_id: 'a', user_id: 'u2' }, { goal_id: 'b', user_id: 'u1' }] });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/api/static-groups/group-1/collection-participants');
    expect(vi.mocked(api.post).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.get).mock.invocationCallOrder[0]);
    expect(result).toEqual({ created: 2, skipped: 1, undoTokens: ['tok-1'] });
  });

  it('chunks at 200 cells, one request after another, sums the counts and keeps every non-null token in order', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ created: cellsOf(200).map((c) => apiRow(c.goalId, c.userId)), skipped: 0, undo_token: 'tok-1' })
      .mockResolvedValueOnce({ created: [], skipped: 200, undo_token: null })
      .mockResolvedValueOnce({ created: [apiRow('g400', 'u400')], skipped: 0, undo_token: 'tok-3' });
    vi.mocked(api.get).mockResolvedValue([]);

    const result = await markNeed(cellsOf(401));

    const bodies = vi.mocked(api.post).mock.calls.map(([, body]) => (body as { cells: unknown[] }).cells.length);
    expect(bodies).toEqual([200, 200, 1]);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(Math.max(...vi.mocked(api.post).mock.invocationCallOrder)).toBeLessThan(vi.mocked(api.get).mock.invocationCallOrder[0]);
    expect(result).toEqual({ created: 201, skipped: 200, undoTokens: ['tok-1', 'tok-3'] });
  });

  it('throws on the first failed request, sends no later chunk, and refetches only when an earlier chunk succeeded', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('boom'));
    await expect(markNeed(cellsOf(201))).rejects.toThrow('boom');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(api.post)
      .mockResolvedValueOnce({ created: [apiRow('g0', 'u0')], skipped: 199, undo_token: 'tok-1' })
      .mockRejectedValueOnce(new Error('later'));
    vi.mocked(api.get).mockResolvedValue([]);
    await expect(markNeed(cellsOf(401))).rejects.toThrow('later');
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('sends nothing and fetches nothing for an empty list', async () => {
    await expect(markNeed([])).resolves.toEqual({ created: 0, skipped: 0, undoTokens: [] });
    expect(api.post).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });
});
