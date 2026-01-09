/**
 * Auth Store - Manages user authentication state
 *
 * Handles Discord OAuth, JWT token management, and user session.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, DiscordAuthUrl } from '../types';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Production detection and misconfiguration warning
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const isLocalhostApi = API_BASE_URL.includes('localhost');

if (isProduction && isLocalhostApi) {
  console.error(
    '[Auth Error] Production environment detected but API URL points to localhost!',
    '\nCurrent API URL:', API_BASE_URL,
    '\nThis will cause authentication to fail.',
    '\nEnsure VITE_API_URL is set correctly during build.'
  );
}

/**
 * Decode JWT payload (without verification - just for expiration check)
 * Returns null if token is invalid/malformed
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is expired or expiring soon
 * @param token JWT token string
 * @param bufferSeconds Seconds before actual expiry to consider it "expired" (default: 60)
 */
function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true; // Invalid token = treat as expired

  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;

  return now >= expiresAt - bufferMs;
}

interface AuthState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Token management (stored in localStorage via persist middleware)
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  login: () => Promise<void>;
  handleCallback: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

/**
 * Make an authenticated API request
 */
async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
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
      accessToken: null,
      refreshToken: null,

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

          // Exchange code for tokens
          const tokens = await authRequest<AuthTokens>('/api/auth/discord/callback', {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          });

          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
          });

          // Fetch user info
          await get().fetchUser();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to complete login',
            isLoading: false,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
          });
        }
      },

      /**
       * Logout user
       */
      logout: async () => {
        try {
          // Call logout endpoint (optional - just discards tokens on server side if implemented)
          const { accessToken } = get();
          if (accessToken) {
            await authRequest('/api/auth/logout', { method: 'POST' }, accessToken).catch(
              () => {
                // Ignore errors - we're logging out anyway
              }
            );
          }
        } finally {
          // Clear local state regardless of API result
          set({
            user: null,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            error: null,
          });
        }
      },

      /**
       * Refresh access token using refresh token
       */
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          return false;
        }

        try {
          const tokens = await authRequest<AuthTokens>('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });

          set({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          });

          return true;
        } catch {
          // Refresh failed - log out user
          set({
            user: null,
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
          });
          return false;
        }
      },

      /**
       * Fetch current user info
       */
      fetchUser: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          return;
        }

        set({ isLoading: true });

        try {
          const user = await authRequest<User>('/api/auth/me', {}, accessToken);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Token might be expired - try refreshing
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            // Retry with new token
            const newAccessToken = get().accessToken;
            try {
              const user = await authRequest<User>('/api/auth/me', {}, newAccessToken);
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
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

/**
 * Hook to get the current access token (for use in API calls)
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * Initialize auth on app load
 * Call this once when the app starts to check for existing session
 *
 * This function proactively refreshes the access token if it's expired,
 * preventing unnecessary 401 errors on first API call.
 */
export async function initializeAuth(): Promise<void> {
  const state = useAuthStore.getState();
  const { accessToken, refreshToken, refreshAccessToken, fetchUser } = state;

  // Warn in console if in production with localhost API
  if (isProduction && isLocalhostApi) {
    console.warn(
      '[Auth] Session may not persist - API URL misconfiguration detected.',
      '\nCheck browser console for details.'
    );
  }

  if (!accessToken && !refreshToken) {
    // No tokens at all - user needs to login
    return;
  }

  if (accessToken && !isTokenExpired(accessToken)) {
    // Access token exists and is still valid - fetch user
    await fetchUser();
    return;
  }

  // Access token is missing or expired - try to refresh first
  if (refreshToken && !isTokenExpired(refreshToken, 0)) {
    // Refresh token exists and is valid - refresh access token
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Successfully refreshed - now fetch user
      await fetchUser();
      return;
    }
  }

  // Refresh failed or refresh token expired - clear state and require re-login
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
  });
}
