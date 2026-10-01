/**
 * initializeAuth — probe-first bootstrap (GUEST-1 R-G1-3).
 *
 * The app asks GET /api/auth/session first. It always answers 200 with
 * `{ user, canRefresh }`, so a guest's bootstrap is one request and no 401.
 * Only a valid answer (2xx, a JSON body, a boolean `canRefresh`) is trusted;
 * anything else — a 404 from a backend that has not shipped the route yet, a
 * 429, a 5xx, a malformed body, a network rejection — falls back to today's
 * fetchUser() path, which never signs anyone out on a transient failure
 * (vet I-2). The frontend and backend deploy separately.
 *
 * `services/api` is the real module here so the CSRF capture (vet M-1) is
 * exercised end to end: the probe's X-CSRF-Token header must reach
 * getCSRFToken(). jsdom has no csrf cookie, so only the header path can win.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

vi.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:8001',
  isProduction: false,
  isLocalhostApi: false,
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

import { initializeAuth, useAuthStore } from './authStore';
import { getCSRFToken } from '../services/api';

const SESSION_URL = 'http://localhost:8001/api/auth/session';
const ME_URL = 'http://localhost:8001/api/auth/me';
const REFRESH_URL = 'http://localhost:8001/api/auth/refresh';

const mockUser: User = {
  id: 'dev-member-user',
  discordId: '1234567890',
  discordUsername: 'DevMember',
  displayName: 'DevMember',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** GET /api/auth/session — always 200 (Task 1). */
function sessionResponse(
  user: User | null,
  canRefresh: boolean,
  headers: Record<string, string> = {}
): Response {
  return jsonResponse(200, { user, canRefresh }, headers);
}

function errorResponse(status: number, detail: string): Response {
  return jsonResponse(status, { detail });
}

function tokenOkResponse(): Response {
  return jsonResponse(200, {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
  });
}

/** Stubs fetch with the given answers in order; an Error rejects that call. */
function stubFetch(...answers: Array<Response | Error>) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const answer of answers) {
    if (answer instanceof Error) fetchMock.mockRejectedValueOnce(answer);
    else fetchMock.mockResolvedValueOnce(answer);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function calledUrls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.map(([url]) => url);
}

describe('initializeAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.persist.clearStorage();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      authInitialized: false,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a guest makes exactly one request, /api/auth/session, and still initializes', async () => {
    const fetchMock = stubFetch(sessionResponse(null, false));

    await initializeAuth();

    // Never /api/auth/me, never /api/auth/refresh: no 401 for a guest.
    expect(calledUrls(fetchMock)).toEqual([SESSION_URL]);
    expect(fetchMock).toHaveBeenCalledWith(
      SESSION_URL,
      expect.objectContaining({ credentials: 'include' })
    );
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  it('hydrates a valid cookie session even when persisted user state is empty', async () => {
    const fetchMock = stubFetch(sessionResponse(mockUser, true), tokenOkResponse());

    await initializeAuth();

    // The probe, then the one proactive refresh that sets the schedule.
    expect(calledUrls(fetchMock)).toEqual([SESSION_URL, REFRESH_URL]);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  it('expired access cookie with a live refresh cookie: refresh then /me, no /me before the refresh, no third refresh', async () => {
    const fetchMock = stubFetch(
      sessionResponse(null, true),
      tokenOkResponse(),
      jsonResponse(200, mockUser)
    );

    await initializeAuth();

    // The successful refresh already scheduled the proactive timer, so the
    // canRefresh branch adds no second refresh (auth tier is 10/min).
    expect(calledUrls(fetchMock)).toEqual([SESSION_URL, REFRESH_URL, ME_URL]);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  it('lapsed refresh cookie (refresh 401) clears the persisted user', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: false });
    const fetchMock = stubFetch(sessionResponse(null, true), errorResponse(401, 'Refresh failed'));

    await initializeAuth();

    expect(calledUrls(fetchMock)).toEqual([SESSION_URL, REFRESH_URL]);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  it('retains a persisted session when the refresh call is rate-limited (429)', async () => {
    // Simulate app load with a persisted session: zustand persist only stores
    // `user` (isAuthenticated is derived, never persisted, so it starts false).
    useAuthStore.setState({ user: mockUser, isAuthenticated: false });
    const fetchMock = stubFetch(
      sessionResponse(null, true),
      errorResponse(429, 'Rate limit exceeded')
    );

    await initializeAuth();

    const state = useAuthStore.getState();
    // The transient 429 must NOT force a logout — the persisted user survives
    // and the reactive 401 retry in services/api.ts recovers the session later.
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
    expect(calledUrls(fetchMock)).toEqual([SESSION_URL, REFRESH_URL]);
  });

  it('a persisted user with no cookies is cleared', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: false });
    const fetchMock = stubFetch(sessionResponse(null, false));

    await initializeAuth();

    expect(calledUrls(fetchMock)).toEqual([SESSION_URL]);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.authInitialized).toBe(true);
  });

  describe('falls back to fetchUser() when the probe is not a valid answer (vet I-2)', () => {
    it('404 (deploy skew: backend without /session yet), then /me 200 signs the user in', async () => {
      const fetchMock = stubFetch(
        errorResponse(404, 'Not Found'),
        jsonResponse(200, mockUser),
        tokenOkResponse()
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.authInitialized).toBe(true);
    });

    it('404 with a persisted user, /me 401 and refresh 429 keeps the persisted user', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: false });
      const fetchMock = stubFetch(
        errorResponse(404, 'Not Found'),
        errorResponse(401, 'Unauthorized'),
        errorResponse(429, 'Rate limit exceeded')
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
      expect(state.authInitialized).toBe(true);
    });

    it('200 with {} (no boolean canRefresh) falls back to /me', async () => {
      const fetchMock = stubFetch(
        jsonResponse(200, {}),
        jsonResponse(200, mockUser),
        tokenOkResponse()
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().authInitialized).toBe(true);
    });

    it('200 with a non-JSON body falls back to /me', async () => {
      const fetchMock = stubFetch(
        new Response('<!doctype html><title>maintenance</title>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
        jsonResponse(200, mockUser),
        tokenOkResponse()
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().authInitialized).toBe(true);
    });

    it('429 falls back to /me, and a persisted user survives a rate-limited refresh', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: false });
      const fetchMock = stubFetch(
        errorResponse(429, 'Rate limit exceeded'),
        errorResponse(401, 'Unauthorized'),
        errorResponse(429, 'Rate limit exceeded')
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isLoading).toBe(false);
      expect(state.authInitialized).toBe(true);
    });

    it('a rejected probe (network) falls back to /me', async () => {
      const fetchMock = stubFetch(
        new TypeError('Failed to fetch'),
        jsonResponse(200, mockUser),
        tokenOkResponse()
      );

      await initializeAuth();

      expect(calledUrls(fetchMock)).toEqual([SESSION_URL, ME_URL, REFRESH_URL]);
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().authInitialized).toBe(true);
    });
  });

  it('stores the CSRF token from the guest probe response header (vet M-1)', async () => {
    expect(getCSRFToken()).not.toBe('t1');
    stubFetch(sessionResponse(null, false, { 'X-CSRF-Token': 't1' }));

    await initializeAuth();

    expect(getCSRFToken()).toBe('t1');
  });

  it('(pin) isLoading is true synchronously once initializeAuth() starts', async () => {
    stubFetch(sessionResponse(null, false));

    const pending = initializeAuth();
    // ProtectedRoute's mount effect fires fetchUser() only while !isLoading;
    // the flag must be up before the first await so the two never race.
    expect(useAuthStore.getState().isLoading).toBe(true);

    await pending;
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
