/**
 * refreshAccessToken — status-aware failure handling (Phase A, item A8).
 *
 * A refresh failure is only a real logout when the backend says the refresh
 * token is invalid (401/403). Transient failures — 429 (the backend auth tier
 * is rate-limited to 10/min), 5xx, network — must leave the session AND the
 * scheduled proactive refresh untouched, so the un-cancelled timer plus the
 * reactive 401 retry in services/api.ts can recover the session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

vi.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:8001',
  isProduction: false,
  isLocalhostApi: false,
}));

vi.mock('../services/api', () => ({
  storeCSRFTokenFromResponse: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import { useAuthStore } from './authStore';

const mockUser: User = {
  id: 'dev-member-user',
  discordId: '1234567890',
  discordUsername: 'DevMember',
  displayName: 'DevMember',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function errorResponse(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tokenOkResponse(): Response {
  return new Response(
    JSON.stringify({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * When the proactive refresh timer fires for expiresIn=3600:
 * (3600 - REFRESH_BUFFER_SECONDS 60) * 1000.
 */
const PROACTIVE_REFRESH_MS = 3_540_000;

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.persist.clearStorage();
    // Pre-seed an authenticated session so "cleared" vs "kept" is observable.
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      authInitialized: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears auth state and returns false on 401 (refresh token invalid)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('clears auth state and returns false on 403', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(403, 'Forbidden'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('keeps auth state and returns false on 429 (rate limited)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('keeps auth state and returns false on 500', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('keeps auth state and returns false when fetch rejects (network error)', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('leaves the scheduled proactive refresh pending after a transient (429) failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      // 1: successful refresh — schedules the proactive timer
      .mockResolvedValueOnce(tokenOkResponse())
      // 2: reactive refresh call hits the rate limit
      .mockResolvedValueOnce(errorResponse(429, 'Rate limit exceeded'))
      // 3: the surviving proactive timer fires and retries
      .mockResolvedValueOnce(tokenOkResponse());
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore.getState().refreshAccessToken();
    const transient = await useAuthStore.getState().refreshAccessToken();

    expect(transient).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // The proactive timer scheduled by the first success must survive the 429
    // (cancelScheduledRefresh must NOT have been called) and fire a 3rd fetch.
    await vi.advanceTimersByTimeAsync(PROACTIVE_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('cancels the scheduled proactive refresh on 401', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      // 1: successful refresh — schedules the proactive timer
      .mockResolvedValueOnce(tokenOkResponse())
      // 2: real auth failure — must cancel the timer
      .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore.getState().refreshAccessToken();
    await useAuthStore.getState().refreshAccessToken();

    // The cancelled timer must NOT fire a third refresh attempt.
    await vi.advanceTimersByTimeAsync(PROACTIVE_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
