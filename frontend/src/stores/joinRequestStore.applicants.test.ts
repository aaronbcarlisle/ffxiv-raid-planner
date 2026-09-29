/**
 * joinRequestStore — the `applicants` slice (RH1c, R-RH-R). `fetchApplicants`
 * requests `fit=true` and never touches `groupRequests`; a stale response is
 * guarded by a per-call sequence number; the mutation actions keep a row's
 * previous `fit` (mutation responses carry `fit: null`) and adjust both
 * pending counts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useJoinRequestStore } from './joinRequestStore';
import type { JoinRequest, JoinRequestListResponse } from '../types';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

function resetStore() {
  useJoinRequestStore.setState({
    myRequests: [], groupRequests: [], pendingCount: 0, applicants: null, isLoading: false, error: null,
  });
}

function request(overrides: Partial<JoinRequest> = {}): JoinRequest {
  return {
    id: 'r1', staticGroupId: 'g1', requesterUserId: 'u1', status: 'pending',
    createdAt: '2026-09-28T00:00:00Z', updatedAt: '2026-09-28T00:00:00Z',
    ...overrides,
  };
}

function listResponse(items: JoinRequest[], pendingCount = items.length): JoinRequestListResponse {
  return { items, pendingCount };
}

describe('fetchApplicants', () => {
  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('requests fit=true and include_resolved=true, and fills applicants', async () => {
    const items = [request({ id: 'r1' })];
    vi.mocked(api.get).mockResolvedValue(listResponse(items, 1));

    await useJoinRequestStore.getState().fetchApplicants('g1');

    expect(api.get).toHaveBeenCalledWith('/api/static-groups/g1/join-requests?include_resolved=true&fit=true');
    expect(useJoinRequestStore.getState().applicants).toEqual({ groupId: 'g1', items, pendingCount: 1 });
  });

  it('never touches groupRequests', async () => {
    useJoinRequestStore.setState({ groupRequests: [request({ id: 'existing' })], pendingCount: 5 });
    vi.mocked(api.get).mockResolvedValue(listResponse([request({ id: 'r1' })], 1));

    await useJoinRequestStore.getState().fetchApplicants('g1');

    const state = useJoinRequestStore.getState();
    expect(state.groupRequests).toEqual([request({ id: 'existing' })]);
    expect(state.pendingCount).toBe(5);
  });

  it('two overlapping calls where the first resolves last: the second call\'s items win', async () => {
    let resolveFirst!: (v: JoinRequestListResponse) => void;
    const first = new Promise<JoinRequestListResponse>((resolve) => { resolveFirst = resolve; });
    const second = Promise.resolve(listResponse([request({ id: 'second' })], 1));
    vi.mocked(api.get).mockReturnValueOnce(first).mockReturnValueOnce(second);

    const call1 = useJoinRequestStore.getState().fetchApplicants('g1');
    const call2 = useJoinRequestStore.getState().fetchApplicants('g1');
    await call2;
    // The first call resolves after the second (stale-response guard).
    resolveFirst(listResponse([request({ id: 'first' })], 1));
    await call1;

    expect(useJoinRequestStore.getState().applicants).toEqual({
      groupId: 'g1', items: [request({ id: 'second' })], pendingCount: 1,
    });
  });

  it('fetchGroupRequests afterwards leaves applicants intact', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(listResponse([request({ id: 'r1' })], 1));
    await useJoinRequestStore.getState().fetchApplicants('g1');
    const applicantsAfterFirst = useJoinRequestStore.getState().applicants;

    vi.mocked(api.get).mockResolvedValueOnce(listResponse([request({ id: 'r2' })], 1));
    await useJoinRequestStore.getState().fetchGroupRequests('g1', true);

    expect(useJoinRequestStore.getState().applicants).toEqual(applicantsAfterFirst);
    expect(useJoinRequestStore.getState().groupRequests).toEqual([request({ id: 'r2' })]);
  });
});

describe('acceptRequest / declineRequest / markUnderReview — applicants slice', () => {
  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('acceptRequest updates the row in both lists, keeps its previous fit, and decrements both pending counts', async () => {
    const fit = { tier: 'strong', missing: [], role: {} as never, schedule: {} as never, reasons: [] };
    const pending = request({ id: 'r1', status: 'pending', fit: fit as JoinRequest['fit'] });
    useJoinRequestStore.setState({
      groupRequests: [pending],
      pendingCount: 1,
      applicants: { groupId: 'g1', items: [pending], pendingCount: 1 },
    });
    const accepted = request({ id: 'r1', status: 'accepted', fit: null });
    vi.mocked(api.post).mockResolvedValue(accepted);

    await useJoinRequestStore.getState().acceptRequest('r1');

    const state = useJoinRequestStore.getState();
    expect(state.groupRequests[0].status).toBe('accepted');
    expect(state.pendingCount).toBe(0);
    expect(state.applicants?.pendingCount).toBe(0);
    expect(state.applicants?.items[0].status).toBe('accepted');
    expect(state.applicants?.items[0].fit).toEqual(fit);
  });

  it('declineRequest keeps applicants.pendingCount at 0, never negative', async () => {
    const pending = request({ id: 'r1', status: 'pending' });
    useJoinRequestStore.setState({
      groupRequests: [pending], pendingCount: 0,
      applicants: { groupId: 'g1', items: [pending], pendingCount: 0 },
    });
    vi.mocked(api.post).mockResolvedValue(request({ id: 'r1', status: 'declined', fit: null }));

    await useJoinRequestStore.getState().declineRequest('r1');

    expect(useJoinRequestStore.getState().applicants?.pendingCount).toBe(0);
  });

  it('markUnderReview updates the applicants row without touching pendingCount', async () => {
    const pending = request({ id: 'r1', status: 'pending' });
    useJoinRequestStore.setState({
      groupRequests: [pending],
      applicants: { groupId: 'g1', items: [pending], pendingCount: 1 },
    });
    vi.mocked(api.post).mockResolvedValue(request({ id: 'r1', status: 'under_review', fit: null }));

    await useJoinRequestStore.getState().markUnderReview('r1');

    const state = useJoinRequestStore.getState();
    expect(state.applicants?.items[0].status).toBe('under_review');
    expect(state.applicants?.pendingCount).toBe(1);
  });

  it('does nothing to applicants when the slice is null', async () => {
    useJoinRequestStore.setState({ groupRequests: [request({ id: 'r1' })], pendingCount: 1, applicants: null });
    vi.mocked(api.post).mockResolvedValue(request({ id: 'r1', status: 'accepted', fit: null }));

    await useJoinRequestStore.getState().acceptRequest('r1');

    expect(useJoinRequestStore.getState().applicants).toBeNull();
  });

  it('linkRoster updates the row in both lists, keeps its previous fit, and leaves pendingCount unchanged', async () => {
    const fit = { tier: 'strong', missing: [], role: {} as never, schedule: {} as never, reasons: [] };
    const accepted = request({ id: 'r1', status: 'accepted', rosterPlayerId: undefined, fit: fit as JoinRequest['fit'] });
    useJoinRequestStore.setState({
      groupRequests: [accepted],
      applicants: { groupId: 'g1', items: [accepted], pendingCount: 0 },
    });
    vi.mocked(api.post).mockResolvedValue(request({ id: 'r1', status: 'accepted', rosterPlayerId: 'p1', fit: null }));

    await useJoinRequestStore.getState().linkRoster('r1', 'p1');

    const state = useJoinRequestStore.getState();
    expect(state.groupRequests[0].rosterPlayerId).toBe('p1');
    expect(state.applicants?.items[0].rosterPlayerId).toBe('p1');
    expect(state.applicants?.items[0].fit).toEqual(fit);
    expect(state.applicants?.pendingCount).toBe(0);
  });
});
