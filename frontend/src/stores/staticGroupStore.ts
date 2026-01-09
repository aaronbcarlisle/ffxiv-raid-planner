/**
 * Static Group Store - Manages static group state
 *
 * Handles CRUD operations for static groups and memberships.
 */

import { create } from 'zustand';
import type { StaticGroup, StaticGroupListItem, StaticGroupSettings, MemberRole, Membership } from '../types';
import { authRequest } from '../services/api';

interface StaticGroupState {
  // List of user's static groups (dashboard)
  groups: StaticGroupListItem[];

  // Currently selected static group (full details)
  currentGroup: StaticGroup | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchGroups: () => Promise<void>;
  fetchGroup: (groupId: string) => Promise<void>;
  fetchGroupByShareCode: (shareCode: string) => Promise<void>;
  createGroup: (name: string, isPublic?: boolean) => Promise<StaticGroup>;
  duplicateGroup: (sourceGroupId: string, newName: string) => Promise<StaticGroup>;
  updateGroup: (groupId: string, data: { name?: string; isPublic?: boolean; settings?: StaticGroupSettings }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  setCurrentGroup: (group: StaticGroup | null) => void;
  clearError: () => void;

  // Membership actions
  addMember: (groupId: string, userId: string, role?: MemberRole) => Promise<Membership>;
  updateMemberRole: (groupId: string, userId: string, role: MemberRole) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  transferOwnership: (groupId: string, newOwnerId: string) => Promise<void>;
}

export const useStaticGroupStore = create<StaticGroupState>((set, get) => ({
  // Initial state
  groups: [],
  currentGroup: null,
  isLoading: false,
  isCreating: false,
  error: null,

  /**
   * Fetch all static groups for the current user
   */
  fetchGroups: async () => {
    set({ isLoading: true, error: null });

    try {
      const groups = await authRequest<StaticGroupListItem[]>('/api/static-groups');
      set({ groups, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch groups',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch a specific static group by ID
   */
  fetchGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });

    try {
      const group = await authRequest<StaticGroup>(`/api/static-groups/${groupId}`);
      set({ currentGroup: group, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch group',
        isLoading: false,
      });
    }
  },

  /**
   * Fetch a static group by share code
   */
  fetchGroupByShareCode: async (shareCode: string) => {
    set({ isLoading: true, error: null });

    try {
      const group = await authRequest<StaticGroup>(`/api/static-groups/by-code/${shareCode}`);
      set({ currentGroup: group, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch group',
        isLoading: false,
      });
    }
  },

  /**
   * Create a new static group
   */
  createGroup: async (name: string, isPublic: boolean = false) => {
    set({ isCreating: true, error: null });

    try {
      const group = await authRequest<StaticGroup>('/api/static-groups', {
        method: 'POST',
        body: JSON.stringify({ name, isPublic }),
      });

      // Add to groups list
      set((state) => ({
        groups: [
          ...state.groups,
          {
            id: group.id,
            name: group.name,
            shareCode: group.shareCode,
            isPublic: group.isPublic,
            ownerId: group.ownerId,
            memberCount: group.memberCount,
            userRole: 'owner' as MemberRole,
            isAdminAccess: false,
            source: 'membership' as const,
            settings: group.settings,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
          },
        ],
        currentGroup: group,
        isCreating: false,
      }));

      return group;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create group',
        isCreating: false,
      });
      throw error;
    }
  },

  /**
   * Duplicate a static group with all tiers and players.
   * Uses the bulk duplication endpoint for efficiency (single API call).
   */
  duplicateGroup: async (sourceGroupId: string, newName: string) => {
    set({ isCreating: true, error: null });

    try {
      // Single API call to duplicate entire group with tiers and players
      const newGroup = await authRequest<StaticGroup>(
        `/api/static-groups/${sourceGroupId}/duplicate`,
        {
          method: 'POST',
          body: JSON.stringify({
            newName,
            copyTiers: true,
            copyPlayers: true,
          }),
        }
      );

      // Add to groups list
      set((state) => ({
        groups: [
          ...state.groups,
          {
            id: newGroup.id,
            name: newGroup.name,
            shareCode: newGroup.shareCode,
            isPublic: newGroup.isPublic,
            ownerId: newGroup.ownerId,
            memberCount: newGroup.memberCount,
            userRole: 'owner' as MemberRole,
            isAdminAccess: false,
            source: 'membership' as const,
            settings: newGroup.settings,
            createdAt: newGroup.createdAt,
            updatedAt: newGroup.updatedAt,
          },
        ],
        isCreating: false,
      }));

      return newGroup;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to duplicate group',
        isCreating: false,
      });
      throw error;
    }
  },

  /**
   * Update a static group (name, visibility, and/or settings)
   */
  updateGroup: async (groupId: string, data: { name?: string; isPublic?: boolean; settings?: StaticGroupSettings }) => {
    set({ error: null });

    try {
      const updatedGroup = await authRequest<StaticGroup>(`/api/static-groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      // Update in groups list and currentGroup
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                name: updatedGroup.name,
                isPublic: updatedGroup.isPublic,
                settings: updatedGroup.settings,
                updatedAt: updatedGroup.updatedAt,
              }
            : g
        ),
        currentGroup:
          state.currentGroup?.id === groupId
            ? { ...state.currentGroup, ...updatedGroup }
            : state.currentGroup,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update group',
      });
      throw error;
    }
  },

  /**
   * Delete a static group
   */
  deleteGroup: async (groupId: string) => {
    set({ error: null });

    try {
      await authRequest<void>(`/api/static-groups/${groupId}`, {
        method: 'DELETE',
      });

      // Remove from groups list
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId),
        currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete group',
      });
      throw error;
    }
  },

  /**
   * Set the current static group
   */
  setCurrentGroup: (group: StaticGroup | null) => {
    set({ currentGroup: group });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },

  // ==================== Membership Actions ====================

  /**
   * Add a member to a static group
   */
  addMember: async (groupId: string, userId: string, role: MemberRole = 'member') => {
    set({ error: null });

    try {
      const membership = await authRequest<Membership>(
        `/api/static-groups/${groupId}/members?user_id=${userId}&role=${role}`,
        { method: 'POST' }
      );

      // Update current group's members if loaded
      set((state) => {
        if (state.currentGroup?.id === groupId && state.currentGroup.members) {
          return {
            currentGroup: {
              ...state.currentGroup,
              members: [...state.currentGroup.members, membership],
              memberCount: state.currentGroup.memberCount + 1,
            },
          };
        }
        return state;
      });

      return membership;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add member',
      });
      throw error;
    }
  },

  /**
   * Update a member's role
   */
  updateMemberRole: async (groupId: string, userId: string, role: MemberRole) => {
    set({ error: null });

    try {
      const membership = await authRequest<Membership>(
        `/api/static-groups/${groupId}/members/${userId}?role=${role}`,
        { method: 'PUT' }
      );

      // Update current group's members if loaded
      set((state) => {
        if (state.currentGroup?.id === groupId && state.currentGroup.members) {
          return {
            currentGroup: {
              ...state.currentGroup,
              members: state.currentGroup.members.map((m) =>
                m.userId === userId ? membership : m
              ),
            },
          };
        }
        return state;
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update member role',
      });
      throw error;
    }
  },

  /**
   * Remove a member from a static group
   */
  removeMember: async (groupId: string, userId: string) => {
    set({ error: null });

    try {
      await authRequest<void>(`/api/static-groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      });

      // Update current group's members if loaded
      set((state) => {
        if (state.currentGroup?.id === groupId && state.currentGroup.members) {
          return {
            currentGroup: {
              ...state.currentGroup,
              members: state.currentGroup.members.filter((m) => m.userId !== userId),
              memberCount: state.currentGroup.memberCount - 1,
            },
          };
        }
        return state;
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove member',
      });
      throw error;
    }
  },

  /**
   * Transfer ownership to another member
   */
  transferOwnership: async (groupId: string, newOwnerId: string) => {
    set({ error: null });

    try {
      await authRequest<StaticGroup>(
        `/api/static-groups/${groupId}/transfer-ownership?new_owner_id=${newOwnerId}`,
        { method: 'POST' }
      );

      // Refresh the group to get updated data
      await get().fetchGroup(groupId);
      await get().fetchGroups();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to transfer ownership',
      });
      throw error;
    }
  },
}));
