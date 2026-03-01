/**
 * API Key Store
 *
 * Manages API keys for external integrations (e.g., Dalamud plugin).
 * Keys are created/listed/revoked via the backend API.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { logger as baseLogger } from '../lib/logger';

const logger = baseLogger.scope('apiKeyStore');

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string; // Raw key shown once
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
}

interface ApiKeyState {
  keys: ApiKey[];
  isLoading: boolean;
  error: string | null;

  fetchKeys: () => Promise<void>;
  createKey: (name: string) => Promise<ApiKeyCreateResponse>;
  revokeKey: (keyId: string) => Promise<void>;
}

export const useApiKeyStore = create<ApiKeyState>((set, get) => ({
  keys: [],
  isLoading: false,
  error: null,

  fetchKeys: async () => {
    set({ isLoading: true, error: null });
    try {
      const keys = await api.get<ApiKey[]>('/api/auth/api-keys');
      set({ keys, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch API keys';
      logger.error('Failed to fetch API keys', { error: message });
      set({ error: message, isLoading: false });
    }
  },

  createKey: async (name: string) => {
    const result = await api.post<ApiKeyCreateResponse>('/api/auth/api-keys', { name });

    // Refresh the key list (don't let failure here lose the raw key)
    try {
      await get().fetchKeys();
    } catch {
      // Key was created successfully; list refresh can be retried
    }

    return result;
  },

  revokeKey: async (keyId: string) => {
    await api.delete(`/api/auth/api-keys/${keyId}`);

    // Refresh the key list
    await get().fetchKeys();
  },
}));
