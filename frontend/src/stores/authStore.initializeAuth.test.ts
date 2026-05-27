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

import { initializeAuth, useAuthStore } from './authStore';

const mockUser: User = {
  id: 'dev-member-user',
  discordId: '1234567890',
  discordUsername: 'DevMember',
  displayName: 'DevMember',
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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

  it('hydrates a valid cookie session even when persisted user state is empty', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockUser), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    await initializeAuth();

    const state = useAuthStore.getState();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8001/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
      })
    );
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.authInitialized).toBe(true);
  });

  it('still marks auth as initialized when no valid cookie session exists', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Refresh failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    await initializeAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.authInitialized).toBe(true);
  });
});
