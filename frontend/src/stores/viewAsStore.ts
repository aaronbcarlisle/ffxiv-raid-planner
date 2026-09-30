/**
 * ViewAs Store - Admin "View As" functionality
 *
 * Allows admins to view the application from another user's perspective.
 * Writes still go through as the admin; while View As is active every
 * request carries the X-View-As header (see setViewAsHeaderUserId), and the
 * API refuses only the static delete and removing the viewed member (HS-30).
 */

import { create } from 'zustand';
import { api, setViewAsHeaderUserId } from '../services/api';
// eslint-disable-next-line boundaries/dependencies -- impersonation is inherently auth-coupled: view-as reads the real admin identity (isAuthenticated / user.isAdmin) to impersonate from. The second store wanting auth must add its own justified entry.
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

/**
 * Generation counter for startViewAs. A start captures the generation before
 * its await and writes nothing on resolve or reject unless it is still the
 * latest, so a GET that resolves after stopViewAs (the admin already left the
 * group view) can't bring View As back, and a newer start supersedes an older
 * one.
 */
let viewAsGeneration = 0;

export const useViewAsStore = create<ViewAsState>((set) => ({
  viewAsUser: null,
  isLoading: false,
  error: null,

  startViewAs: async (groupId: string, userId: string) => {
    const { isAuthenticated, user } = useAuthStore.getState();

    if (!isAuthenticated || !user?.isAdmin) {
      set({ error: 'Admin access required' });
      return;
    }

    const gen = ++viewAsGeneration;
    set({ isLoading: true, error: null });

    try {
      // Use api wrapper for automatic token refresh on 401
      const data = await api.get<ViewAsUserInfo>(
        `/api/static-groups/admin/user-role/${groupId}/${userId}`
      );
      if (gen !== viewAsGeneration) return;
      set({ viewAsUser: data, isLoading: false });
    } catch (error) {
      if (gen !== viewAsGeneration) return;
      set({
        error: error instanceof Error ? error.message : 'Failed to start View As',
        isLoading: false,
      });
    }
  },

  stopViewAs: () => {
    // Bump the generation so an in-flight start is dropped, and clear
    // isLoading here since that dropped start will no longer clear it.
    viewAsGeneration++;
    set({ viewAsUser: null, error: null, isLoading: false });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Keeps services/api.ts's X-View-As header in step with the store without
// api.ts importing the store (which would add an import cycle).
useViewAsStore.subscribe((s) => setViewAsHeaderUserId(s.viewAsUser?.userId ?? null));

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
