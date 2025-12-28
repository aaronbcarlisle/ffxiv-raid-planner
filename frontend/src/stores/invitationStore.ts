/**
 * Invitation Store - Manages invitation state
 *
 * Handles CRUD operations for invitations and accepting invites.
 */

import { create } from 'zustand';
import type { Invitation, InvitationCreate, InvitationPreview, InvitationAcceptResponse } from '../types';
import { authRequest } from '../services/api';

interface InvitationState {
  // Invitations for current group
  invitations: Invitation[];

  // Preview of an invitation (for accept page)
  preview: InvitationPreview | null;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isAccepting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchInvitations: (groupId: string) => Promise<void>;
  createInvitation: (groupId: string, data?: InvitationCreate) => Promise<Invitation>;
  revokeInvitation: (groupId: string, invitationId: string) => Promise<void>;
  fetchPreview: (inviteCode: string) => Promise<InvitationPreview>;
  acceptInvitation: (inviteCode: string) => Promise<InvitationAcceptResponse>;
  clearInvitations: () => void;
  clearPreview: () => void;
  clearError: () => void;
}

export const useInvitationStore = create<InvitationState>((set) => ({
  // Initial state
  invitations: [],
  preview: null,
  isLoading: false,
  isCreating: false,
  isAccepting: false,
  error: null,

  /**
   * Fetch all invitations for a static group
   */
  fetchInvitations: async (groupId: string) => {
    set({ isLoading: true, error: null });

    try {
      const invitations = await authRequest<Invitation[]>(
        `/api/static-groups/${groupId}/invitations`
      );
      set({ invitations, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch invitations',
        isLoading: false,
      });
    }
  },

  /**
   * Create a new invitation
   */
  createInvitation: async (groupId: string, data: InvitationCreate = {}) => {
    set({ isCreating: true, error: null });

    try {
      const invitation = await authRequest<Invitation>(
        `/api/static-groups/${groupId}/invitations`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );

      set((state) => ({
        invitations: [invitation, ...state.invitations],
        isCreating: false,
      }));

      return invitation;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create invitation',
        isCreating: false,
      });
      throw error;
    }
  },

  /**
   * Revoke an invitation
   */
  revokeInvitation: async (groupId: string, invitationId: string) => {
    set({ error: null });

    try {
      await authRequest<void>(
        `/api/static-groups/${groupId}/invitations/${invitationId}`,
        { method: 'DELETE' }
      );

      // Update local state - mark as inactive
      set((state) => ({
        invitations: state.invitations.map((inv) =>
          inv.id === invitationId
            ? { ...inv, isActive: false, isValid: false }
            : inv
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to revoke invitation',
      });
      throw error;
    }
  },

  /**
   * Fetch invitation preview (public endpoint)
   */
  fetchPreview: async (inviteCode: string) => {
    set({ isLoading: true, error: null, preview: null });

    try {
      const preview = await authRequest<InvitationPreview>(
        `/api/invitations/${inviteCode}`
      );
      set({ preview, isLoading: false });
      return preview;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Invitation not found',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Accept an invitation
   */
  acceptInvitation: async (inviteCode: string) => {
    set({ isAccepting: true, error: null });

    try {
      const response = await authRequest<InvitationAcceptResponse>(
        `/api/invitations/${inviteCode}/accept`,
        { method: 'POST' }
      );

      set({ isAccepting: false });

      if (!response.success) {
        set({ error: response.message });
      }

      return response;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to accept invitation',
        isAccepting: false,
      });
      throw error;
    }
  },

  /**
   * Clear invitations (when switching groups)
   */
  clearInvitations: () => {
    set({ invitations: [], error: null });
  },

  /**
   * Clear preview
   */
  clearPreview: () => {
    set({ preview: null, error: null });
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));
