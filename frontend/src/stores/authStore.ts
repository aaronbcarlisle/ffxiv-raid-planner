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

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

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
 */
export async function initializeAuth(): Promise<void> {
  const { accessToken, fetchUser } = useAuthStore.getState();
  if (accessToken) {
    await fetchUser();
  }
}
