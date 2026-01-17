/**
 * Auth Store - Manages user authentication state
 *
 * Handles Discord OAuth and user session.
 * JWT tokens are stored in httpOnly cookies (set by backend) for XSS protection.
 * The frontend never has direct access to tokens - they're sent automatically via cookies.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, DiscordAuthUrl } from '../types';
import { API_BASE_URL, isProduction, isLocalhostApi } from '../config';

if (isProduction && isLocalhostApi) {
  console.error(
    '[Auth Error] Production environment detected but API URL points to localhost!',
    '\nCurrent API URL:', API_BASE_URL,
    '\nThis will cause authentication to fail.',
    '\nEnsure VITE_API_URL is set correctly during build.'
  );
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

      /**
       * Initiate Discord OAuth login
       */
      login: async () => {
        set({ isLoading: true, error: null });

        try {
          const data = await authRequest<DiscordAuthUrl>('/api/auth/discord');

          // Store state for verification
          sessionStorage.setItem('oauth_state', data.state);

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
        set({ isLoading: true, error: null });

        try {
          // Verify state matches
          const savedState = sessionStorage.getItem('oauth_state');
          if (state !== savedState) {
            throw new Error('Invalid OAuth state - possible CSRF attack');
          }
          sessionStorage.removeItem('oauth_state');

          // Exchange code for tokens (tokens are set as httpOnly cookies by backend)
          const tokenResponse = await authRequest<TokenResponse>('/api/auth/discord/callback', {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          });

          set({ isAuthenticated: true });

          // Schedule proactive token refresh before expiry
          scheduleTokenRefresh(tokenResponse.expiresIn, get().refreshAccessToken);

          // Fetch user info
          await get().fetchUser();
        } catch (error) {
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
          // First attempt to logout
          const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });

          // If access token expired (401), try refreshing then retry logout
          if (response.status === 401) {
            const refreshed = await get().refreshAccessToken();
            if (refreshed) {
              // Retry logout with new access token
              await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include',
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
        set({ isLoading: true });

        try {
          const user = await authRequest<User>('/api/auth/me');
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token might be expired - try refreshing
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            // Retry with new cookies
            try {
              const user = await authRequest<User>('/api/auth/me');
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
              });
            } catch {
              set({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } else {
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
}
