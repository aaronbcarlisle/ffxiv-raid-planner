/**
 * API Client for FFXIV Raid Planner Backend
 *
 * Contains utility functions for API communication including
 * authenticated requests with automatic token refresh.
 */

import { useAuthStore } from '../stores/authStore';

// Get API base URL from environment or default to localhost
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * API Error class for handling HTTP errors
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ==================== Authenticated Request ====================

/**
 * Make an authenticated API request with automatic token refresh on 401
 */
export async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const accessToken = useAuthStore.getState().accessToken;

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

    // If unauthorized, try refreshing token
    if (response.status === 401) {
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const newAccessToken = useAuthStore.getState().accessToken;
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          try {
            const data = await retryResponse.json();
            message = data.detail || `HTTP ${retryResponse.status}`;
          } catch {
            message = `HTTP ${retryResponse.status}`;
          }
          throw new ApiError(retryResponse.status, message);
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      }
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ==================== Health Check ====================

export interface HealthResponse {
  status: string;
  version: string;
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new ApiError(response.status, 'Health check failed');
  }
  return response.json();
}

// ==================== Convenience Methods ====================

/**
 * API client with convenience methods
 */
export const api = {
  get: <T>(endpoint: string) => authRequest<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    authRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    authRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => authRequest<T>(endpoint, { method: 'DELETE' }),
};

// ==================== Utilities ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebouncedFn<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

/**
 * Create a debounced function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): DebouncedFn<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}
