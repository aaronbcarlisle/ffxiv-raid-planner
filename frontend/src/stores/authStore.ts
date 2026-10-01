/**
 * Auth Store - Manages user authentication state
 *
 * Handles Discord OAuth and user session.
 * JWT tokens are stored in httpOnly cookies (set by backend) for XSS protection.
 * The frontend never has direct access to tokens - they're sent automatically via cookies.
 */

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, DiscordAuthUrl } from '../types';
import { API_BASE_URL, isProduction, isLocalhostApi } from '../config';
import { storeCSRFTokenFromResponse } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('auth-store');

if (isProduction && isLocalhostApi) {
  logger.error(
    'Production environment detected but API URL points to localhost!',
    'Current API URL:', API_BASE_URL,
    'This will cause authentication to fail.',
    'Ensure VITE_API_URL is set correctly during build.'
  );
}

// CSRF token cookie name (must match backend)
const CSRF_COOKIE_NAME = 'csrf_token';

// OAuth state cookie name - using cookie instead of sessionStorage
// because sessionStorage is per-origin, and www.domain.com vs domain.com
// are different origins. Cookies with domain=.domain.com work across both.
const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

// sessionStorage key AuthCallback reads (and clears) to land the user back
// where they started the login. Also written directly by InviteAccept,
// PluginAuth and ProtectedRoute, which then call bare login().
const AUTH_REDIRECT_KEY = 'auth_redirect';

/**
 * Whether `value` is a path inside this app: starts with "/" and not "//"
 * (a protocol-relative URL would leave the app). Anything that is not a
 * string — including an event object from a bare `onClick={login}` — fails.
 */
function isInAppPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

/**
 * Get the root domain for cookie settings.
 * Returns ".xivraidplanner.app" for production, or current hostname for dev.
 */
function getCookieDomain(): string {
  const hostname = window.location.hostname;
  // For localhost or IP addresses, don't set domain
  if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return '';
  }
  // For production, use root domain with leading dot
  // This makes the cookie accessible from both www.xivraidplanner.app and xivraidplanner.app
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return '';
}

/**
 * Set OAuth state in a cookie that works across www/non-www subdomains.
 */
function setOAuthState(state: string): void {
  const domain = getCookieDomain();
  const domainAttr = domain ? `; domain=${domain}` : '';
  // Short expiry (10 minutes) - just needs to survive the OAuth redirect
  const expires = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
  const cookieString = `${OAUTH_STATE_COOKIE_NAME}=${state}; path=/; expires=${expires}; SameSite=Lax${domainAttr}`;
  logger.debug('Setting OAuth state cookie:', { domain, currentHostname: window.location.hostname });
  document.cookie = cookieString;
}

/**
 * Get OAuth state from cookie.
 * Exported so AuthCallback can capture it immediately on render.
 */
export function getOAuthStateCookie(): string | null {
  logger.debug('Reading OAuth state cookie:', { currentHostname: window.location.hostname });
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (name === OAUTH_STATE_COOKIE_NAME) {
      logger.debug('Found OAuth state cookie');
      return value;
    }
  }
  logger.debug('OAuth state cookie NOT found');
  return null;
}

/**
 * Clear OAuth state cookie.
 */
function clearOAuthState(): void {
  const domain = getCookieDomain();
  const domainAttr = domain ? `; domain=${domain}` : '';
  // Set expired date to delete the cookie
  document.cookie = `${OAUTH_STATE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domainAttr}`;
}

/**
 * Get CSRF token from cookie for state-changing requests.
 */
function getCSRFToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Singleton promise for token refresh.
 * Prevents multiple concurrent refresh requests when many API calls fail with 401 simultaneously.
 * All callers share the same refresh promise until it completes.
 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * Timer ID for proactive token refresh.
 * Refreshes the token before it expires to prevent 401/403 errors.
 * Uses `number` type for browser setTimeout (not NodeJS.Timeout).
 */
let refreshTimerId: number | null = null;

/**
 * How many seconds before expiry to refresh the token.
 * Refreshing 60 seconds early provides a buffer for network latency.
 */
const REFRESH_BUFFER_SECONDS = 60;

/**
 * Response from token endpoints (callback, refresh)
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Schedule a proactive token refresh before the current token expires.
 * Clears any existing scheduled refresh first.
 *
 * @param expiresIn - Seconds until the token expires
 * @param refreshFn - Function to call to refresh the token
 */
function scheduleTokenRefresh(expiresIn: number, refreshFn: () => Promise<boolean>): void {
  // Clear any existing timer
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }

  // Calculate when to refresh (expiresIn - buffer, minimum 10 seconds)
  const refreshInSeconds = Math.max(expiresIn - REFRESH_BUFFER_SECONDS, 10);
  const refreshInMs = refreshInSeconds * 1000;

  refreshTimerId = window.setTimeout(async () => {
    refreshTimerId = null;
    try {
      await refreshFn();
    } catch (error) {
      logger.error('Proactive token refresh failed:', error);
    }
  }, refreshInMs);
}

/**
 * Cancel any scheduled proactive token refresh.
 */
function cancelScheduledRefresh(): void {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

interface AuthState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /**
   * Whether initializeAuth() has completed.
   * False until the initial auth check on app load finishes.
   * Used to prevent components from making auth decisions based on stale persisted data.
   */
  authInitialized: boolean;

  // Actions
  /**
   * Start the Discord OAuth login.
   * @param redirectTo - In-app path to return to after the callback. Written
   *   to sessionStorage synchronously, before any await; ignored unless it
   *   starts with "/" and not "//". Bare login() never touches the key.
   */
  login: (redirectTo?: string) => Promise<void>;
  handleCallback: (code: string, state: string, capturedOAuthState?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUser: () => Promise<void>;
  updatePreferences: (prefs: {
    activityDisplayMode?: 'named' | 'anonymous';
    tabPersistence?: 'remember' | 'reset';
    uiShell?: 'legacy' | 'v2';
  }) => Promise<void>;
  clearError: () => void;
}

/**
 * Make an API request with credentials (cookies).
 * Tokens are stored in httpOnly cookies and sent automatically.
 */
async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Attach the CSRF token on state-changing requests (double-submit cookie
  // pattern). Without this, mutating calls made through authRequest — e.g.
  // updatePreferences — are rejected with 403 csrf_validation_failed.
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const csrfToken = getCSRFToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send httpOnly cookies
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  // Capture CSRF token from response header for cross-domain scenarios
  storeCSRFTokenFromResponse(response);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      authInitialized: false,

      /**
       * Initiate Discord OAuth login
       */
      login: async (redirectTo?: string) => {
        // Record the return path first, before the first set or await, so a
        // caller can rely on it even if the redirect happens elsewhere.
        // Bare login() must not read, write or clear the key: InviteAccept,
        // PluginAuth and ProtectedRoute set it themselves and then call this.
        if (isInAppPath(redirectTo)) {
          try {
            sessionStorage.setItem(AUTH_REDIRECT_KEY, redirectTo);
          } catch {
            // Storage unavailable (blocked or private mode): log in without
            // a return path rather than fail the login.
          }
        }

        set({ isLoading: true, error: null });

        try {
          const data = await authRequest<DiscordAuthUrl>('/api/auth/discord');

          // Store state for verification in cookie (works across www/non-www subdomains)
          setOAuthState(data.state);

          // Redirect to Discord
          window.location.href = data.url;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to initiate login',
            isLoading: false,
          });
        }
      },

      /**
       * Handle OAuth callback after Discord redirect
       * @param capturedOAuthState - Pre-captured OAuth state from cookie (captured before async init clears cookies)
       */
      handleCallback: async (code: string, state: string, capturedOAuthState?: string | null) => {
        logger.info('handleCallback started');
        set({ isLoading: true, error: null });

        try {
          // Use pre-captured state if provided, otherwise try reading from cookie
          // (The cookie may have been cleared by initializeAuth before we get here)
          const savedState = capturedOAuthState !== undefined ? capturedOAuthState : getOAuthStateCookie();
          logger.debug('handleCallback verifying state:', {
            urlState: state,
            savedState,
            usedCapturedState: capturedOAuthState !== undefined,
          });
          if (state !== savedState) {
            throw new Error('Invalid OAuth state - possible CSRF attack');
          }
          clearOAuthState();

          // Exchange code for tokens (tokens are set as httpOnly cookies by backend)
          logger.info('Exchanging code for tokens');
          const tokenResponse = await authRequest<TokenResponse>('/api/auth/discord/callback', {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          });
          logger.info('Token exchange successful', { expiresIn: tokenResponse.expiresIn });

          set({ isAuthenticated: true });

          // Schedule proactive token refresh before expiry
          scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

          // Fetch user info
          logger.info('Calling fetchUser');
          await get().fetchUser();

          // Log final state after handleCallback completes
          const finalState = get();
          logger.info('handleCallback completed', {
            hasUser: !!finalState.user,
            userName: finalState.user?.displayName,
            isAuthenticated: finalState.isAuthenticated,
            isLoading: finalState.isLoading,
          });
        } catch (error) {
          // Cancel any scheduled refresh since login failed
          cancelScheduledRefresh();
          logger.error('handleCallback failed', { error: error instanceof Error ? error.message : String(error) });
          set({
            error: error instanceof Error ? error.message : 'Failed to complete login',
            isLoading: false,
            isAuthenticated: false,
          });
        }
      },

      /**
       * Logout user by calling backend to clear httpOnly cookies.
       * Attempts to refresh token if access token is expired to ensure
       * cookies are properly cleared on the server.
       */
      logout: async () => {
        try {
          // Get CSRF token for the logout POST request
          const csrfToken = getCSRFToken();
          const headers: Record<string, string> = {};
          if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
          }

          // First attempt to logout
          const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers,
          });

          // If access token expired (401) or CSRF failed (403), try refreshing then retry logout
          if (response.status === 401 || response.status === 403) {
            const refreshed = await get().refreshAccessToken();
            if (refreshed) {
              // Get fresh CSRF token after refresh
              const newCsrfToken = getCSRFToken();
              const retryHeaders: Record<string, string> = {};
              if (newCsrfToken) {
                retryHeaders['X-CSRF-Token'] = newCsrfToken;
              }
              // Retry logout with new tokens
              await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: retryHeaders,
              });
            }
            // If refresh fails, cookies may remain but we clear local state anyway
          }
        } catch {
          // Network error - cookies may remain but we clear local state
        } finally {
          // Cancel any scheduled token refresh
          cancelScheduledRefresh();

          // Clear local state regardless of API result
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
        }
      },

      /**
       * Refresh access token using refresh token cookie.
       * The refresh token is sent automatically via httpOnly cookie.
       *
       * Uses a singleton promise to prevent multiple concurrent refresh requests.
       * When many API calls fail with 401 simultaneously (e.g., on page load after
       * token expiration), they all share the same refresh request instead of each
       * making their own. This prevents rate limiting issues and race conditions.
       *
       * On success, schedules the next proactive refresh before the new token expires.
       *
       * Note: Uses fetch directly instead of authRequest to prevent infinite
       * recursion (authRequest calls refreshAccessToken on 401).
       */
      refreshAccessToken: async () => {
        // If a refresh is already in progress, return the existing promise
        // This prevents multiple concurrent refresh requests from hitting rate limits
        if (refreshPromise) {
          return refreshPromise;
        }

        // Create and store the refresh promise
        refreshPromise = (async () => {
          try {
            // Call refresh endpoint directly - avoid authRequest to prevent infinite loop
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                // Real auth failure: the refresh token is expired/invalid.
                // Cancel the proactive refresh and log the user out.
                cancelScheduledRefresh();
                set({
                  user: null,
                  isAuthenticated: false,
                });
              }
              // Transient failure (429 rate limit, 5xx): leave the session and
              // the scheduled proactive refresh intact — the un-cancelled timer
              // plus the reactive 401 retry in services/api.ts will recover.
              return false;
            }

            // Capture CSRF token from response header for cross-domain scenarios
            storeCSRFTokenFromResponse(response);

            // Parse response to get new token expiry
            const tokenResponse: TokenResponse = await response.json();

            // Schedule next proactive refresh before the new token expires
            scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

            return true;
          } catch {
            // Network failure (fetch rejected): transient by definition —
            // return false without touching state or the scheduled refresh
            return false;
          } finally {
            // Clear the promise so future refreshes can proceed
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      /**
       * Fetch current user info using httpOnly cookie authentication
       */
      fetchUser: async () => {
        logger.info('fetchUser started');
        set({ isLoading: true });

        try {
          const user = await authRequest<User>('/api/auth/me');
          logger.info('fetchUser succeeded', { userName: user.displayName, userId: user.id });
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err) {
          logger.warn('fetchUser initial request failed, attempting refresh', {
            error: err instanceof Error ? err.message : String(err),
          });
          // Token might be expired - try refreshing
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            // Retry with new cookies
            try {
              const user = await authRequest<User>('/api/auth/me');
              logger.info('fetchUser retry succeeded', { userName: user.displayName, userId: user.id });
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
              });
            } catch (retryErr) {
              logger.error('fetchUser retry failed', {
                error: retryErr instanceof Error ? retryErr.message : String(retryErr),
              });
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } else {
            // refreshAccessToken has already decided what happens to the
            // session: it cleared user/isAuthenticated for a real auth failure
            // (401/403) and left them intact for transient failures
            // (429/5xx/network). Only settle the loading flag here.
            logger.warn('fetchUser refresh failed; session state decided by refreshAccessToken');
            set({ isLoading: false });
          }
        }
      },

      updatePreferences: async (prefs) => {
        const updated = await authRequest<User>('/api/auth/me/preferences', {
          method: 'PATCH',
          body: JSON.stringify(prefs),
        });
        set({ user: updated });
      },

      /**
       * Clear error state
       */
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user data - tokens are now in httpOnly cookies
      // isAuthenticated is derived from API responses, not persisted
      // (prevents stale auth state when cookies expire)
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);

/**
 * Hook to check if the auth store has been hydrated from localStorage.
 * Use this to prevent flash of unauthenticated content on page load.
 *
 * Uses React's useSyncExternalStore for race-condition-free subscription
 * to Zustand's hydration state. This properly handles the edge case where
 * hydration might complete between initial render and effect subscription.
 */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    // Subscribe function - called when React needs to listen for changes
    (onStoreChange) => useAuthStore.persist.onFinishHydration(onStoreChange),
    // Get snapshot - returns current hydration state
    () => useAuthStore.persist.hasHydrated(),
    // Get server snapshot - for SSR (always false since no localStorage)
    () => false
  );
}

/**
 * Answer of GET /api/auth/session. `user` has the same shape as /api/auth/me;
 * `canRefresh` is the presence of the refresh cookie, which only the server
 * can see (it is httpOnly, and a JS-readable hint cookie fails cross-subdomain).
 */
interface SessionProbe {
  user: User | null;
  canRefresh: boolean;
}

/**
 * Ask the backend whether this browser has a session. The route always
 * answers 200, so a guest's bootstrap makes no 401.
 *
 * Returns null for anything that is not a valid answer: a non-2xx (a 404 from
 * a backend that has not shipped the route yet — the frontend and backend
 * deploy separately — a 429, a 5xx), a body that is not JSON or has no
 * boolean `canRefresh`, or a network rejection. The caller then takes the
 * /me path exactly as before; reading a 404 as "no session" would sign every
 * user out until the backend ships.
 */
async function probeSession(): Promise<SessionProbe | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/session`, {
      credentials: 'include',
    });

    // Capture CSRF token from response header for cross-domain scenarios,
    // as /me did through authRequest.
    storeCSRFTokenFromResponse(response);

    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const { user, canRefresh } = body as { user?: unknown; canRefresh?: unknown };
    if (typeof canRefresh !== 'boolean') return null;

    return { user: (user ?? null) as User | null, canRefresh };
  } catch {
    // Network failure, or a body that is not JSON: not a valid answer.
    return null;
  }
}

/**
 * Initialize auth on app load.
 * Call this once when the app starts to check for existing session.
 *
 * With httpOnly cookies, we can't check token expiration client-side, so we
 * ask GET /api/auth/session first. A valid answer decides the session:
 * - a user: signed in, then one proactive refresh to set the refresh schedule;
 * - no user but a refresh cookie: refresh, then /me (which now answers 200);
 * - neither: signed out, and a stale persisted user is cleared.
 * Anything else (a 404 during deploy skew, a 429, a 5xx, a malformed body, a
 * rejected request) takes the fetchUser() path unchanged, which never signs
 * anyone out on a transient failure.
 *
 * `isLoading` goes up before the first await so ProtectedRoute's mount effect
 * cannot start a parallel fetchUser(). `authInitialized` is set regardless.
 */
export async function initializeAuth(): Promise<void> {
  const state = useAuthStore.getState();
  const { fetchUser, refreshAccessToken } = state;

  // Warn if in production with localhost API
  if (isProduction && isLocalhostApi) {
    logger.warn(
      'Session may not persist - API URL misconfiguration detected.',
      'Check browser console for details.'
    );
  }

  useAuthStore.setState({ isLoading: true });

  try {
    const probe = await probeSession();

    if (probe === null) {
      // Not a valid answer: reconcile auth state with the backend the way we
      // always have. A valid httpOnly cookie session can exist even when
      // persisted Zustand state is empty, such as in fresh dev-auth or
      // incognito sessions.
      await fetchUser();

      // If still authenticated after fetchUser, do a proactive refresh to
      // establish the refresh schedule. This ensures we know when to refresh
      // even if the initial fetchUser succeeded with an existing valid token.
      if (useAuthStore.getState().isAuthenticated) {
        // Await refresh to ensure consistent auth state; silent catch since
        // failure just means user will re-auth on first API call
        await refreshAccessToken().catch(() => {
          // Silent - will re-auth on first API call if needed
        });
      }
    } else if (probe.user) {
      useAuthStore.setState({ user: probe.user, isAuthenticated: true, isLoading: false });

      // The access cookie is valid but we don't know when it expires: one
      // proactive refresh establishes the refresh schedule, as before.
      await refreshAccessToken().catch(() => {
        // Silent - will re-auth on first API call if needed
      });
    } else if (probe.canRefresh) {
      // Expired access cookie, live refresh cookie: refresh first, so /me
      // never answers 401. A successful refresh schedules the next one itself,
      // so this branch adds no second proactive refresh (the auth tier is
      // rate-limited to 10/min).
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        await fetchUser();
      } else {
        // refreshAccessToken has already decided the session: cleared on
        // 401/403, kept on a transient failure (429/5xx/network).
        useAuthStore.setState({ isLoading: false });
      }
    } else {
      // No session. A stale persisted user is cleared, which is today's
      // outcome too.
      useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  } finally {
    // Mark auth as initialized regardless of outcome
    // This allows components to know that the initial auth check is complete
    // and they can now trust the auth state (not stale persisted data)
    useAuthStore.setState({ authInitialized: true });
  }
}
