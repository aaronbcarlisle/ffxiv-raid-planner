/**
 * viewAsStore — the startViewAs generation guard (P1 Task 1, vet finding V1).
 *
 * A late or superseded startViewAs resolve must write nothing: otherwise a
 * GET that resolves after the admin left the group view would bring View As
 * back, and every following request would carry X-View-As (the admin's own
 * static delete from Profile would then get the HS-30 403).
 *
 * api.get is stubbed with vi.spyOn, never vi.mock('../services/api'): a
 * module mock would drop the real api.delete and setViewAsHeaderUserId, so
 * the no-header assertions below would prove nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../services/api';
import { useAuthStore } from './authStore';
import { useViewAsStore, type ViewAsUserInfo } from './viewAsStore';
import type { User } from '../types';

const VIEW_AS_HEADER = 'X-View-As';

const adminUser: User = {
  id: 'admin-1',
  discordId: '1234567890',
  discordUsername: 'Admin',
  displayName: 'Admin',
  isAdmin: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function viewedUser(userId: string): ViewAsUserInfo {
  return {
    userId,
    discordUsername: `viewed-${userId}`,
    displayName: null,
    avatarUrl: null,
    groupId: 'g1',
    groupName: 'Test Static',
    isMember: true,
    role: 'member',
    isLinkedPlayer: false,
    linkedPlayerId: null,
    linkedPlayerName: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

describe('viewAsStore generation guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, user: adminUser });
    useViewAsStore.setState({ viewAsUser: null, isLoading: false, error: null });
    document.cookie = 'csrf_token=t';
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    useViewAsStore.getState().stopViewAs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('drops a start that resolves after stopViewAs, and sends no header afterwards', async () => {
    const pending = deferred<ViewAsUserInfo>();
    vi.spyOn(api, 'get').mockReturnValueOnce(pending.promise);

    const started = useViewAsStore.getState().startViewAs('g1', 'u-view');
    expect(useViewAsStore.getState().isLoading).toBe(true);

    useViewAsStore.getState().stopViewAs();
    pending.resolve(viewedUser('u-view'));
    await started;

    expect(useViewAsStore.getState().viewAsUser).toBeNull();
    expect(useViewAsStore.getState().isLoading).toBe(false);

    await api.delete('/api/static-groups/g1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders(fetchMock)).not.toHaveProperty(VIEW_AS_HEADER);
  });

  it('drops a start that rejects after stopViewAs', async () => {
    const pending = deferred<ViewAsUserInfo>();
    vi.spyOn(api, 'get').mockReturnValueOnce(pending.promise);

    const started = useViewAsStore.getState().startViewAs('g1', 'u-view');
    useViewAsStore.getState().stopViewAs();
    pending.reject(new Error('late failure'));
    await started;

    expect(useViewAsStore.getState().error).toBeNull();
    expect(useViewAsStore.getState().isLoading).toBe(false);
    expect(useViewAsStore.getState().viewAsUser).toBeNull();
  });

  it('lets the newer of two overlapping starts win, and sends its id', async () => {
    const older = deferred<ViewAsUserInfo>();
    const newer = deferred<ViewAsUserInfo>();
    vi.spyOn(api, 'get')
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const startedOlder = useViewAsStore.getState().startViewAs('g1', 'u-old');
    const startedNewer = useViewAsStore.getState().startViewAs('g1', 'u-new');

    newer.resolve(viewedUser('u-new'));
    await startedNewer;
    older.resolve(viewedUser('u-old'));
    await startedOlder;

    expect(useViewAsStore.getState().viewAsUser?.userId).toBe('u-new');
    expect(useViewAsStore.getState().isLoading).toBe(false);

    await api.delete('/api/static-groups/g1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders(fetchMock)).toHaveProperty(VIEW_AS_HEADER, 'u-new');
  });
});
