/**
 * ViewAs Store - Admin "View As" functionality
 *
 * Allows admins to view the application from another user's perspective.
 * This is read-only - actual API calls still go through as the admin.
 */

import { create } from 'zustand';
import { API_BASE_URL } from '../config';
import { useAuthStore } from './authStore';
import type { MemberRole } from '../types';

// ViewAs user info returned from the API
export interface ViewAsUserInfo {
  userId: string;
  discordUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  groupId: string;
  groupName: string;
  isMember: boolean;
  role: MemberRole | null;
  isLinkedPlayer: boolean;
  linkedPlayerId: string | null;
  linkedPlayerName: string | null;
}

interface ViewAsState {
  // The user we're viewing as (null = normal view)
  viewAsUser: ViewAsUserInfo | null;

  // Loading state
  isLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  startViewAs: (groupId: string, userId: string) => Promise<void>;
  stopViewAs: () => void;
  clearError: () => void;
}

export const useViewAsStore = create<ViewAsState>((set) => ({
  viewAsUser: null,
  isLoading: false,
  error: null,

  startViewAs: async (groupId: string, userId: string) => {
    const { accessToken, user } = useAuthStore.getState();

    if (!accessToken || !user?.isAdmin) {
      set({ error: 'Admin access required' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/static-groups/admin/user-role/${groupId}/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch user info');
      }

      const data: ViewAsUserInfo = await response.json();
      set({ viewAsUser: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start View As',
        isLoading: false,
      });
    }
  },

  stopViewAs: () => {
    set({ viewAsUser: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

/**
 * Hook to get the effective role for permission checks.
 * Returns the viewAs user's role if active, otherwise the actual user's role.
 */
export function useEffectiveRole(actualRole: MemberRole | null | undefined): MemberRole | null | undefined {
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);

  if (viewAsUser) {
    return viewAsUser.role;
  }

  return actualRole;
}

/**
 * Hook to get the effective user ID for ownership checks.
 * Returns the viewAs user's ID if active, otherwise the actual user's ID.
 */
export function useEffectiveUserId(actualUserId: string | undefined): string | undefined {
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);

  if (viewAsUser) {
    return viewAsUser.userId;
  }

  return actualUserId;
}

/**
 * Check if currently viewing as another user
 */
export function useIsViewingAs(): boolean {
  return useViewAsStore((s) => s.viewAsUser !== null);
}
