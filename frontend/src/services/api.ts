/**
 * API Client for FFXIV Raid Planner Backend
 *
 * Contains utility functions for API communication including
 * authenticated requests with automatic token refresh.
 */

import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { logger as baseLogger } from '../lib/logger';
import type { BiSImportData, BiSPresetsResponse } from '../types';
import { API_BASE_URL } from '../config';

const logger = baseLogger.scope('api');

// Re-export for backward compatibility
export { API_BASE_URL } from '../config';

// CSRF token cookie name and header (must match backend)
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * In-memory CSRF token storage for cross-domain scenarios.
 * When frontend and API are on different domains, cookies aren't accessible,
 * so we store the token from response headers instead.
 */
let csrfTokenFromHeader: string | null = null;

/**
 * Store CSRF token from a response header (for cross-domain scenarios).
 * Called after every fetch to capture the token from the X-CSRF-Token header.
 * Exported for use in authStore which makes direct fetch calls.
 */
export function storeCSRFTokenFromResponse(response: Response): void {
  const headerToken = response.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    csrfTokenFromHeader = headerToken;
  }
}

/**
 * Get CSRF token from cookie for state-changing requests.
 * Falls back to in-memory token from response headers for cross-domain scenarios.
 */
export function getCSRFToken(): string | null {
  // Try cookie first (same-domain scenario)
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
  // Fall back to token from response header (cross-domain scenario)
  return csrfTokenFromHeader;
}

/**
 * HTTP methods that require CSRF token
 */
const CSRF_REQUIRED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * API Error class for handling HTTP errors
 */
export class ApiError extends Error {
  status: number;
  /** True when `authRequest` already showed a toast for this error (true 403s). */
  toasted: boolean;

  constructor(status: number, message: string, toasted = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.toasted = toasted;
  }
}

/**
 * Whether `authRequest` already toasted this error, so a caller's own generic
 * failure toast would be a duplicate (#324).
 */
export function wasToastedByApi(err: unknown): boolean {
  return err instanceof ApiError && err.toasted;
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

/**
 * Patterns that indicate a 403 is actually an authentication issue
 * (e.g., from get_current_user_optional returning None for expired tokens)
 * rather than a true permission/authorization issue.
 */
const AUTH_RELATED_403_PATTERNS = [
  'log in',
  'login',
  'authenticated',
  'authentication',
  'session expired',
  'session invalid',
];

/**
 * Check if a 403 error message indicates an authentication issue
 * rather than a true authorization/permission issue.
 * @internal Exported for testing
 */
export function isAuthRelated403(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return AUTH_RELATED_403_PATTERNS.some((pattern) => lowerMessage.includes(pattern));
}

// ==================== View As header ====================

// Must match backend permissions.VIEW_AS_HEADER.
const VIEW_AS_HEADER_NAME = 'X-View-As';

/**
 * The user id an admin is currently viewing as (View As), or null.
 * viewAsStore keeps it in sync through one subscription; authRequest sends
 * it as X-View-As on every request while it is set, so the backend refuses
 * the static delete and the viewed member's removal (HS-30 / D-50) and the
 * audit log records the impersonation.
 */
let viewAsUserId: string | null = null;

export function setViewAsHeaderUserId(id: string | null): void {
  viewAsUserId = id || null;
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
  const method = (options.method || 'GET').toUpperCase();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Only while admin View As is active. Lives in `headers`, which is spread
  // after options.headers (callers can't override it) and reused by the retry.
  // Snapshot on purpose: the header describes the View As state the request
  // was made in. A Delete clicked under View As stays refused even if View As
  // stops during the CSRF-refresh await or before the 401 retry; re-reading it
  // late would let that delete through as a plain admin delete (HS-30).
  if (viewAsUserId) {
    headers[VIEW_AS_HEADER_NAME] = viewAsUserId;
  }

  // Add CSRF token for state-changing requests
  // If token is missing, try refresh first (cookie may have been cleared by browser)
  if (CSRF_REQUIRED_METHODS.has(method)) {
    let csrfToken = getCSRFToken();
    if (!csrfToken) {
      logger.warn('CSRF token missing, attempting refresh', { method, endpoint });
      // Try refresh - this will set new cookies including CSRF token
      await useAuthStore.getState().refreshAccessToken();
      // Always try to read cookie after refresh (might have succeeded even if it returned false)
      csrfToken = getCSRFToken();

      // If still missing, try a simple GET request to trigger CSRF token retrieval
      // The response header will contain the token even if cookies aren't accessible
      if (!csrfToken) {
        logger.warn('CSRF token still missing after refresh, trying fallback GET', { method, endpoint });
        try {
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' });
          // Capture token from response header for cross-domain scenarios
          storeCSRFTokenFromResponse(fallbackResponse);
          csrfToken = getCSRFToken();
        } catch {
          // Ignore errors - we just want to trigger CSRF token retrieval
        }
      }

      if (!csrfToken) {
        logger.error('CSRF token missing after all recovery attempts', { method, endpoint });
        throw new ApiError(403, 'Session expired - please log in again');
      }
    }
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send httpOnly cookies
    headers: {
      // Spread options.headers first, then our headers, to ensure
      // security-critical headers (CSRF token) cannot be overwritten
      ...options.headers,
      ...headers,
    },
  });

  // Capture CSRF token from response header for cross-domain scenarios
  storeCSRFTokenFromResponse(response);

  if (!response.ok) {
    const message = await extractErrorMessage(response, `HTTP ${response.status}`);

    // Determine if we should attempt token refresh:
    // - 401: Always try refresh (explicit auth failure)
    // - 403: Only if the error message indicates an auth issue
    //        (e.g., "Please log in" from get_current_user_optional returning None)
    const shouldAttemptRefresh =
      response.status === 401 || (response.status === 403 && isAuthRelated403(message));

    if (shouldAttemptRefresh) {
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      if (refreshed) {
        // Re-fetch CSRF token after refresh (may have been updated)
        if (CSRF_REQUIRED_METHODS.has(method)) {
          const newCsrfToken = getCSRFToken();
          if (!newCsrfToken) {
            logger.error('CSRF token missing after refresh', { method, endpoint });
            throw new ApiError(403, 'Session expired - please refresh the page');
          }
          headers['X-CSRF-Token'] = newCsrfToken;
        }

        // Retry with cookies (new tokens set by refresh endpoint)
        const retryResponse = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            // Spread options.headers first, then our headers, to ensure
            // security-critical headers (CSRF token) cannot be overwritten
            ...options.headers,
            ...headers,
          },
        });

        // Capture CSRF token from response header for cross-domain scenarios
        storeCSRFTokenFromResponse(retryResponse);

        if (!retryResponse.ok) {
          const retryMessage = await extractErrorMessage(
            retryResponse,
            `HTTP ${retryResponse.status}`
          );

          // Show toast for permission errors (true 403s after refresh)
          const retryToasted = retryResponse.status === 403;
          if (retryToasted) {
            toast.error(retryMessage);
          }

          throw new ApiError(retryResponse.status, retryMessage, retryToasted);
        }

        if (retryResponse.status === 204) {
          return undefined as T;
        }

        return retryResponse.json();
      }
    }

    // Show toast for permission errors (true 403s, not auth-related)
    const toasted = response.status === 403 && !isAuthRelated403(message);
    if (toasted) {
      toast.error(message);
    }

    throw new ApiError(response.status, message, toasted);
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

  patch: <T>(endpoint: string, body?: unknown) =>
    authRequest<T>(endpoint, {
      method: 'PATCH',
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
 * Store a selected XIVGear set index on a pasted URL without mutating the
 * sheet identifier. Legacy sl|uuid strings are preserved as sl|uuid|index.
 */
export function withXivGearSetIndex(urlOrId: string, setIndex: number): string {
  const trimmed = urlOrId.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('sl|')) {
    const [prefix, uuid] = trimmed.split('|');
    return uuid ? `${prefix}|${uuid}|${setIndex}` : trimmed;
  }

  if (trimmed.startsWith('bis|')) {
    const parts = trimmed.split('|');
    const base = parts.slice(0, 3).join('|');
    return parts.length >= 3 ? `${base}|${setIndex}` : trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.searchParams.delete('onlySetIndex');
    url.searchParams.delete('setIndex');
    url.searchParams.set('selectedIndex', String(setIndex));
    return url.toString();
  } catch {
    return trimmed;
  }
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
