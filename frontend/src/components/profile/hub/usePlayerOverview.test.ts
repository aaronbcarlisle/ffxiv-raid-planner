/**
 * usePlayerOverview — hook data flow (R-PH2-I).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../../../services/api';
import { usePlayerOverview } from './usePlayerOverview';
import type { PlayerOverview } from './usePlayerOverview';

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

interface PendingGet {
  resolve: (value: PlayerOverview) => void;
  reject: (err: Error) => void;
}

function emptyOverview(): PlayerOverview {
  return { statics: [], actionItems: [] };
}

describe('usePlayerOverview', () => {
  it('starts loading on the first render, before the effect runs, then resolves', async () => {
    let pending!: PendingGet;
    vi.mocked(api.get).mockImplementation(
      () => new Promise((resolve, reject) => { pending = { resolve, reject }; }),
    );

    const { result } = renderHook(() => usePlayerOverview());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    const overview = emptyOverview();
    await act(async () => { pending.resolve(overview); });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(overview);
    expect(api.get).toHaveBeenCalledWith('/api/player/overview');
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('a rejection sets error and leaves data as it was', async () => {
    const gets: PendingGet[] = [];
    vi.mocked(api.get).mockImplementation(
      () => new Promise((resolve, reject) => { gets.push({ resolve, reject }); }),
    );

    const { result } = renderHook(() => usePlayerOverview());
    const first = emptyOverview();
    await act(async () => { gets[0].resolve(first); });
    expect(result.current.data).toBe(first);

    act(() => { result.current.retry(); });
    await act(async () => { gets[1].reject(new Error('boom')); });

    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBe(first);
  });

  it('retry refetches', async () => {
    const gets: PendingGet[] = [];
    vi.mocked(api.get).mockImplementation(
      () => new Promise((resolve, reject) => { gets.push({ resolve, reject }); }),
    );

    const { result } = renderHook(() => usePlayerOverview());
    await act(async () => { gets[0].resolve(emptyOverview()); });

    act(() => { result.current.retry(); });
    expect(api.get).toHaveBeenCalledTimes(2);

    const second = emptyOverview();
    await act(async () => { gets[1].resolve(second); });
    expect(result.current.data).toBe(second);
  });

  it('a response resolving after unmount sets nothing (no act warning)', async () => {
    let pending!: PendingGet;
    vi.mocked(api.get).mockImplementation(
      () => new Promise((resolve, reject) => { pending = { resolve, reject }; }),
    );

    const { unmount } = renderHook(() => usePlayerOverview());
    unmount();

    // Resolving after unmount must not touch React state (no act warning,
    // no thrown error from setting state on an unmounted hook).
    await act(async () => { pending.resolve(emptyOverview()); });
  });

  it('an older response resolving after a newer one is ignored', async () => {
    const gets: PendingGet[] = [];
    vi.mocked(api.get).mockImplementation(
      () => new Promise((resolve, reject) => { gets.push({ resolve, reject }); }),
    );

    const { result } = renderHook(() => usePlayerOverview());
    act(() => { result.current.retry(); });
    expect(gets).toHaveLength(2);

    const newer = { statics: [], actionItems: [{ type: 'rsvp_pending', staticId: 's1', staticName: 'N', title: 'T', detail: 'D', href: '/group/X?tab=schedule&sessionId=1', startsAt: null }] } as PlayerOverview;
    const older = emptyOverview();

    // Newer request settles first; the older, in-flight request's later
    // resolution must not overwrite it.
    await act(async () => { gets[1].resolve(newer); });
    expect(result.current.data).toBe(newer);

    await act(async () => { gets[0].resolve(older); });
    expect(result.current.data).toBe(newer);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
