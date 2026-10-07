/**
 * login(redirectTo?) — the post-login return path (GUEST-1 R-G1-6).
 *
 * `sessionStorage['auth_redirect']` is written synchronously, before the first
 * set or await, and only for an in-app path (starts with "/" and not "//"; a
 * protocol-relative URL would leave the app). Bare login() never reads, writes
 * or clears the key (vet I-6): InviteAccept, PluginAuth and ProtectedRoute set
 * it themselves and then call bare login(), relying on it surviving.
 *
 * The /api/auth/discord request is left pending for the whole test, so every
 * assertion runs before login()'s first await: a late write could not pass.
 * The negative cases hold on `main` by construction; they guard the filter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const REDIRECT_KEY = 'auth_redirect';

describe('login(redirectTo)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      authInitialized: true,
    });
    // Leave the /api/auth/discord request pending.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('writes auth_redirect synchronously for an in-app path, before any await', () => {
    void useAuthStore.getState().login('/group/ABC?tab=schedule');

    expect(sessionStorage.getItem(REDIRECT_KEY)).toBe('/group/ABC?tab=schedule');
  });

  it('does not write an absolute URL', () => {
    void useAuthStore.getState().login('https://evil.example/x');

    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it('does not write a protocol-relative URL', () => {
    void useAuthStore.getState().login('//evil.example');

    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });

  it('bare login() leaves a preset auth_redirect alone (vet I-6)', () => {
    sessionStorage.setItem(REDIRECT_KEY, '/invite/XYZ');

    void useAuthStore.getState().login();

    expect(sessionStorage.getItem(REDIRECT_KEY)).toBe('/invite/XYZ');
  });

  it('bare login() writes nothing', () => {
    void useAuthStore.getState().login();

    expect(sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });
});
