/**
 * API Client for FFXIV Raid Planner Backend
 *
 * Contains utility functions for API communication including
 * authenticated requests with automatic token refresh.
 */

import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import type { BiSImportData, BiSPresetsResponse } from '../types';
import { API_BASE_URL } from '../config';

// Re-export for backward compatibility
export { API_BASE_URL } from '../config';

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

/**
 * Extract error message from API response
 */
function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  return response
    .json()
    .then((data) => {
      // Handle both string and object details
      if (typeof data.detail === 'string') {
        return data.detail;
      } else if (typeof data.detail === 'object' && data.detail !== null) {
        // If detail is an object (like validation errors), stringify it
        return JSON.stringify(data.detail);
      }
      return data.message || fallback;
    })
    .catch(() => fallback);
}

// ==================== Authenticated Request ====================

/**
 * Make an authenticated API request with automatic token refresh on 401.
 *
 * Authentication is handled via httpOnly cookies (set by backend).
 * Cookies are automatically sent with credentials: 'include'.
 */
export async function authRequest<T>(
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
    const message = await extractErrorMessage(response, `HTTP ${response.status}`);

    // If unauthorized, try refreshing token
    if (response.status === 401) {
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      if (refreshed) {
        // Retry with cookies (new tokens set by refresh endpoint)
        const retryResponse = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...headers,
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          const retryMessage = await extractErrorMessage(
            retryResponse,
            `HTTP ${retryResponse.status}`
          );

          // Show toast for permission errors
          if (retryResponse.status === 403) {
            toast.error(retryMessage);
          }

          throw new ApiError(retryResponse.status, retryMessage);
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      }
    }

    // Show toast for permission errors
    if (response.status === 403) {
      toast.error(message);
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
 * Check API health (public endpoint - no auth required)
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

// ==================== BiS Import ====================

/**
 * Fetch available BiS presets for a job
 * @param job - Job abbreviation (e.g., "DRG")
 * @param category - Optional filter: 'savage', 'ultimate', or undefined for all
 */
export async function fetchBiSPresets(
  job: string,
  category?: 'savage' | 'ultimate' | 'prog'
): Promise<BiSPresetsResponse> {
  const params = category ? `?category=${category}` : '';
  return api.get(`/api/bis/presets/${job.toLowerCase()}${params}`);
}

/**
 * Fetch BiS gear set from XIVGear.app
 * Accepts UUID or full URL - backend handles extraction
 * @param uuidOrUrl - XIVGear UUID, share URL, or curated BiS path
 * @param setIndex - Optional index for preset selection (0-based)
 */
export async function fetchBiSFromXIVGear(
  uuidOrUrl: string,
  setIndex?: number
): Promise<BiSImportData> {
  // Encode the URL/UUID for safe path parameter
  const encoded = encodeURIComponent(uuidOrUrl);
  const queryString = setIndex !== undefined ? `?set_index=${setIndex}` : '';
  return api.get(`/api/bis/xivgear/${encoded}${queryString}`);
}

/**
 * Fetch BiS gear set from Etro.gg
 * Accepts UUID or full URL - backend handles extraction
 */
export async function fetchBiSFromEtro(uuidOrUrl: string): Promise<BiSImportData> {
  const encoded = encodeURIComponent(uuidOrUrl);
  return api.get(`/api/bis/etro/${encoded}`);
}

/**
 * Detect whether a BiS link is from Etro or XIVGear
 */
export function detectBiSSource(link: string): 'etro' | 'xivgear' {
  // Explicit Etro URLs
  if (link.includes('etro.gg')) return 'etro';

  // Explicit XIVGear URLs
  if (link.includes('xivgear.app')) return 'xivgear';

  // XIVGear-specific formats (sl|, bis|)
  if (link.includes('|')) return 'xivgear';

  // Plain UUID - default to Etro per user preference
  return 'etro';
}

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
