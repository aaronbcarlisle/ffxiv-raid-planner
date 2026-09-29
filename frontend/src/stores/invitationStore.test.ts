/**
 * invitationStore — `fetchInvitations` stale-response guard (PR #316 review):
 * with two overlapping fetches (static A then static B) where A resolves last,
 * B's list must win, and `clearInvitations` must stop an in-flight response
 * from refilling the cleared list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authRequest } from '../services/api';
import { useInvitationStore } from './invitationStore';
import type { Invitation } from '../types';

vi.mock('../services/api', () => ({
  authRequest: vi.fn(),
}));

function invitation(id: string, staticGroupId: string): Invitation {
  return { id, staticGroupId } as unknown as Invitation;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('fetchInvitations', () => {
  afterEach(() => {
    useInvitationStore.setState({ invitations: [], isLoading: false, error: null });
    vi.clearAllMocks();
  });

  it('two overlapping calls where the first resolves last: the second call wins', async () => {
    const a = deferred<Invitation[]>();
    const b = deferred<Invitation[]>();
    vi.mocked(authRequest).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);

    const callA = useInvitationStore.getState().fetchInvitations('gA');
    const callB = useInvitationStore.getState().fetchInvitations('gB');
    b.resolve([invitation('ib', 'gB')]);
    await callB;
    a.resolve([invitation('ia', 'gA')]);
    await callA;

    const state = useInvitationStore.getState();
    expect(state.invitations.map((i) => i.id)).toEqual(['ib']);
    expect(state.isLoading).toBe(false);
  });

  it('a stale call that fails after a newer one succeeded sets no error', async () => {
    const a = deferred<Invitation[]>();
    vi.mocked(authRequest)
      .mockReturnValueOnce(a.promise)
      .mockResolvedValueOnce([invitation('ib', 'gB')]);

    const callA = useInvitationStore.getState().fetchInvitations('gA');
    await useInvitationStore.getState().fetchInvitations('gB');
    a.reject(new Error('Network error'));
    await callA;

    const state = useInvitationStore.getState();
    expect(state.error).toBeNull();
    expect(state.invitations.map((i) => i.id)).toEqual(['ib']);
  });

  it('clearInvitations drops a response still in flight', async () => {
    const a = deferred<Invitation[]>();
    vi.mocked(authRequest).mockReturnValueOnce(a.promise);

    const callA = useInvitationStore.getState().fetchInvitations('gA');
    useInvitationStore.getState().clearInvitations();
    a.resolve([invitation('ia', 'gA')]);
    await callA;

    const state = useInvitationStore.getState();
    expect(state.invitations).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});
