/**
 * fetchGroupByShareCode: a 404 is the not-found state, a stale group is cleared on
 * other failures for a different code, and superseded responses write nothing
 * (R-V1B-1, R-V1B-2, R-V1B-3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStaticGroupStore } from './staticGroupStore';
import { authRequest, ApiError } from '../services/api';
import type { StaticGroup } from '../types';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, authRequest: vi.fn() };
});

const mockAuthRequest = vi.mocked(authRequest);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeGroup(shareCode: string): StaticGroup {
  return { id: `id-${shareCode}`, name: `Static ${shareCode}`, shareCode } as StaticGroup;
}

function reset(seed: StaticGroup | null = null) {
  useStaticGroupStore.setState({
    groups: [],
    currentGroup: seed,
    isLoading: false,
    isCreating: false,
    error: null,
    errorStack: null,
    errorSource: null,
  });
}

const fetchByCode = (code: string) => useStaticGroupStore.getState().fetchGroupByShareCode(code);

describe('staticGroupStore.fetchGroupByShareCode', () => {
  beforeEach(() => {
    mockAuthRequest.mockReset();
    reset();
  });

  it('S1: a direct 404 is not-found (no group, no error, not loading)', async () => {
    mockAuthRequest.mockRejectedValueOnce(new ApiError(404, 'Static group not found'));

    await fetchByCode('ZZZZZZ');

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup).toBeNull();
    expect(s.error).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('S2: a 404 for a different code clears the previous static', async () => {
    reset(makeGroup('DEVTST'));
    mockAuthRequest.mockRejectedValueOnce(new ApiError(404, 'Static group not found'));

    await fetchByCode('ZZZZZZ');

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup).toBeNull();
    expect(s.error).toBeNull();
  });

  it('S3: a 403 for a different code clears the previous static and keeps the load error', async () => {
    reset(makeGroup('DEVTST'));
    mockAuthRequest.mockRejectedValueOnce(new ApiError(403, 'This static group is private'));

    await fetchByCode('PRIV01');

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup).toBeNull();
    expect(s.error).toBe('This static group is private');
    expect(s.errorSource).toBe('load');
  });

  it('S4: a non-404 failure for the same code (case-insensitive) keeps the static', async () => {
    reset(makeGroup('DEVTST'));
    mockAuthRequest.mockRejectedValueOnce(new ApiError(500, 'Server exploded'));

    await fetchByCode('devtst');

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup?.shareCode).toBe('DEVTST');
    expect(s.error).toBe('Server exploded');
    expect(s.errorSource).toBe('load');
  });

  it('S5: a superseded rejection writes nothing while the latest request is pending', async () => {
    const z = deferred<StaticGroup>();
    const b = deferred<StaticGroup>();
    mockAuthRequest.mockReturnValueOnce(z.promise).mockReturnValueOnce(b.promise);

    const pZ = fetchByCode('ZZZZZZ');
    const pB = fetchByCode('BBBBBB');

    z.reject(new ApiError(404, 'Static group not found'));
    await pZ;

    let s = useStaticGroupStore.getState();
    expect(s.isLoading).toBe(true);
    expect(s.error).toBeNull();

    b.resolve(makeGroup('BBBBBB'));
    await pB;

    s = useStaticGroupStore.getState();
    expect(s.currentGroup?.shareCode).toBe('BBBBBB');
    expect(s.isLoading).toBe(false);
  });

  it('S6: a superseded success does not overwrite the newer static', async () => {
    const a = deferred<StaticGroup>();
    const b = deferred<StaticGroup>();
    mockAuthRequest.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);

    const pA = fetchByCode('AAAAAA');
    const pB = fetchByCode('BBBBBB');

    b.resolve(makeGroup('BBBBBB'));
    await pB;
    a.resolve(makeGroup('AAAAAA'));
    await pA;

    expect(useStaticGroupStore.getState().currentGroup?.shareCode).toBe('BBBBBB');
  });

  it('S7: a 403 with no group loaded sets the error and does not throw', async () => {
    mockAuthRequest.mockRejectedValueOnce(new ApiError(403, 'This static group is private'));

    await expect(fetchByCode('PRIV01')).resolves.toBeUndefined();

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup).toBeNull();
    expect(s.error).toBe('This static group is private');
  });

  it('S8: a 404 for the same code also clears the static (deleted meanwhile)', async () => {
    reset(makeGroup('DEVTST'));
    mockAuthRequest.mockRejectedValueOnce(new ApiError(404, 'Static group not found'));

    await fetchByCode('DEVTST');

    const s = useStaticGroupStore.getState();
    expect(s.currentGroup).toBeNull();
    expect(s.error).toBeNull();
  });
});
