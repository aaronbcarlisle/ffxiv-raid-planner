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
          await authRequest('/api/auth/discord/callback', {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          });

          set({ isAuthenticated: true });

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
       * Logout user by calling backend to clear httpOnly cookies
       */
      logout: async () => {
        try {
          // Call logout endpoint to clear httpOnly cookies
          await authRequest('/api/auth/logout', { method: 'POST' }).catch(() => {
            // Ignore errors - we're logging out anyway
          });
        } finally {
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
       * Note: Uses fetch directly instead of authRequest to prevent infinite
       * recursion (authRequest calls refreshAccessToken on 401).
       */
      refreshAccessToken: async () => {
        try {
          // Call refresh endpoint directly - avoid authRequest to prevent infinite loop
          const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('Refresh failed');
          }

          return true;
        } catch {
          // Refresh failed - log out user
          set({
            user: null,
            isAuthenticated: false,
          });
          return false;
        }
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
 */
export async function initializeAuth(): Promise<void> {
  const state = useAuthStore.getState();
  const { user, fetchUser } = state;

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
  }
}
