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

// BUILD MARKER - If you see this in console, the Jan 18 21:05 fix is deployed
console.log('[AUTH-STORE] Build version: 2026-01-18-2105 - Cookie-based OAuth state fix');

if (isProduction && isLocalhostApi) {
  console.error(
    '[Auth Error] Production environment detected but API URL points to localhost!',
    '\nCurrent API URL:', API_BASE_URL,
    '\nThis will cause authentication to fail.',
    '\nEnsure VITE_API_URL is set correctly during build.'
  );
}

// CSRF token cookie name (must match backend)
const CSRF_COOKIE_NAME = 'csrf_token';

// OAuth state cookie name - using cookie instead of sessionStorage
// because sessionStorage is per-origin, and www.domain.com vs domain.com
// are different origins. Cookies with domain=.domain.com work across both.
const OAUTH_STATE_COOKIE_NAME = 'oauth_state';

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
  document.cookie = `${OAUTH_STATE_COOKIE_NAME}=${state}; path=/; expires=${expires}; SameSite=Lax${domainAttr}`;
  logger.info('OAuth state cookie set', { domain: domain || '(none)' });
}

/**
 * Get OAuth state from cookie.
 */
function getOAuthState(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const name = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (name === OAUTH_STATE_COOKIE_NAME) {
      return value;
    }
  }
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
      console.error('[Auth] Proactive token refresh failed:', error);
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
  login: () => Promise<void>;
  handleCallback: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUser: () => Promise<void>;
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
      login: async () => {
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
       */
      handleCallback: async (code: string, state: string) => {
        logger.info('handleCallback started');
        set({ isLoading: true, error: null });

        try {
          // Verify state matches (using cookie for cross-subdomain support)
          const savedState = getOAuthState();
          logger.info('Verifying OAuth state', {
            hasState: !!state,
            hasSavedState: !!savedState,
            statesMatch: state === savedState,
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
              throw new Error('Refresh failed');
            }

            // Capture CSRF token from response header for cross-domain scenarios
            storeCSRFTokenFromResponse(response);

            // Parse response to get new token expiry
            const tokenResponse: TokenResponse = await response.json();

            // Schedule next proactive refresh before the new token expires
            scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

            return true;
          } catch {
            // Refresh failed - cancel any scheduled refresh and log out user
            cancelScheduledRefresh();
            set({
              user: null,
              isAuthenticated: false,
            });
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
            logger.error('fetchUser refresh failed, clearing auth state');
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
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
 * Initialize auth on app load.
 * Call this once when the app starts to check for existing session.
 *
 * With httpOnly cookies, we can't check token expiration client-side.
 * Instead, we simply try to fetch the user - if cookies are valid, it works.
 * If not, the backend will return 401 and we'll try to refresh.
 *
 * After successful authentication, schedules proactive token refresh
 * to prevent 401/403 errors during the session.
 */
export async function initializeAuth(): Promise<void> {
  const state = useAuthStore.getState();
  const { user, fetchUser, refreshAccessToken } = state;

  // Warn in console if in production with localhost API
  if (isProduction && isLocalhostApi) {
    console.warn(
      '[Auth] Session may not persist - API URL misconfiguration detected.',
      '\nCheck browser console for details.'
    );
  }

  try {
    // If we have a persisted user, verify session is still valid with backend
    // This handles the case where httpOnly cookies have expired
    if (user) {
      await fetchUser();

      // If still authenticated after fetchUser, do a proactive refresh to
      // establish the refresh schedule. This ensures we know when to refresh
      // even if the initial fetchUser succeeded with an existing valid token.
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        // Await refresh to ensure consistent auth state; silent catch since
        // failure just means user will re-auth on first API call
        await refreshAccessToken().catch(() => {
          // Silent - will re-auth on first API call if needed
        });
      }
    }
  } finally {
    // Mark auth as initialized regardless of outcome
    // This allows components to know that the initial auth check is complete
    // and they can now trust the auth state (not stale persisted data)
    useAuthStore.setState({ authInitialized: true });
  }
}
