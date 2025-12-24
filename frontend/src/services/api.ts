/**
 * API Client for FFXIV Raid Planner Backend
 *
 * Handles all communication with the FastAPI backend.
 */

import type { Static, Player, StaticSettings } from '../types';

// Get API base URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
 * Make an API request with error handling
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
    throw new ApiError(response.status, message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ==================== Statics API ====================

export interface CreateStaticRequest {
  name: string;
  tier: string;
  settings?: StaticSettings;
}

export interface UpdateStaticRequest {
  name?: string;
  tier?: string;
  settings?: StaticSettings;
}

/**
 * Create a new static
 */
export async function createStatic(data: CreateStaticRequest): Promise<Static> {
  return request<Static>('/api/statics', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get a static by its share code
 */
export async function getStaticByShareCode(shareCode: string): Promise<Static> {
  return request<Static>(`/api/statics/${shareCode}`);
}

/**
 * Update a static
 */
export async function updateStatic(
  staticId: string,
  data: UpdateStaticRequest
): Promise<Static> {
  return request<Static>(`/api/statics/${staticId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a static
 */
export async function deleteStatic(staticId: string): Promise<void> {
  return request<void>(`/api/statics/${staticId}`, {
    method: 'DELETE',
  });
}

// ==================== Players API ====================

export interface CreatePlayerRequest {
  name?: string;
  job?: string;
  role?: string;
  position?: string;
  tankRole?: string;
  configured?: boolean;
  sortOrder?: number;
  isSubstitute?: boolean;
  notes?: string;
  lodestoneId?: string;
  bisLink?: string;
  fflogsId?: number;
  gear?: Player['gear'];
  tomeWeapon?: Player['tomeWeapon'];
}

export interface UpdatePlayerRequest {
  name?: string;
  job?: string;
  role?: string;
  position?: string;
  tankRole?: string;
  configured?: boolean;
  sortOrder?: number;
  isSubstitute?: boolean;
  notes?: string;
  lodestoneId?: string;
  bisLink?: string;
  fflogsId?: number;
  gear?: Player['gear'];
  tomeWeapon?: Player['tomeWeapon'];
}

/**
 * Add a new player to a static
 */
export async function createPlayer(
  staticId: string,
  data: CreatePlayerRequest
): Promise<Player> {
  return request<Player>(`/api/statics/${staticId}/players`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update a player
 */
export async function updatePlayer(
  staticId: string,
  playerId: string,
  data: UpdatePlayerRequest
): Promise<Player> {
  return request<Player>(`/api/statics/${staticId}/players/${playerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Remove a player from a static
 */
export async function deletePlayer(
  staticId: string,
  playerId: string
): Promise<void> {
  return request<void>(`/api/statics/${staticId}/players/${playerId}`, {
    method: 'DELETE',
  });
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
  return request<HealthResponse>('/health');
}

// ==================== Debounced Save ====================

export type DebouncedFn<T extends (...args: unknown[]) => unknown> = {
  (...args: Parameters<T>): void;
  cancel: () => void;
};

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
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
