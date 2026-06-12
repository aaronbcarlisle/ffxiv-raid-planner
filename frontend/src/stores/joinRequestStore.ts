import { create } from 'zustand';
import type {
  JoinRequest,
  JoinRequestCreatePayload,
  JoinRequestListResponse,
} from '../types';
import { api } from '../services/api';

interface JoinRequestState {
  myRequests: JoinRequest[];
  groupRequests: JoinRequest[];
  pendingCount: number;
  isLoading: boolean;
  error: string | null;

  fetchMyRequests: () => Promise<void>;
  fetchGroupRequests: (groupId: string, includeResolved?: boolean) => Promise<void>;
  createRequest: (shareCode: string, data: JoinRequestCreatePayload) => Promise<JoinRequest>;
  cancelRequest: (requestId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  markUnderReview: (requestId: string) => Promise<void>;
  linkRoster: (requestId: string, rosterPlayerId: string) => Promise<void>;
  clearError: () => void;
}

export const useJoinRequestStore = create<JoinRequestState>((set) => ({
  myRequests: [],
  groupRequests: [],
  pendingCount: 0,
  isLoading: false,
  error: null,

  fetchMyRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const requests = await api.get<JoinRequest[]>('/api/me/join-requests');
      set({ myRequests: requests, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch requests',
        isLoading: false,
      });
    }
  },

  fetchGroupRequests: async (groupId: string, includeResolved = false) => {
    set({ isLoading: true, error: null });
    try {
      const qs = includeResolved ? '?include_resolved=true' : '';
      const response = await api.get<JoinRequestListResponse>(
        `/api/static-groups/${groupId}/join-requests${qs}`
      );
      set({
        groupRequests: response.items,
        pendingCount: response.pendingCount,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch requests',
        isLoading: false,
      });
    }
  },

  createRequest: async (shareCode: string, data: JoinRequestCreatePayload) => {
    set({ error: null });
    const request = await api.post<JoinRequest>(
      `/api/static-groups/${shareCode}/join-requests`,
      data
    );
    set((state) => ({ myRequests: [request, ...state.myRequests] }));
    return request;
  },

  cancelRequest: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/cancel`);
    set((state) => ({
      myRequests: state.myRequests.map((r) => (r.id === requestId ? updated : r)),
    }));
  },

  acceptRequest: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/accept`);
    set((state) => ({
      groupRequests: state.groupRequests.map((r) => (r.id === requestId ? updated : r)),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  declineRequest: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/decline`);
    set((state) => ({
      groupRequests: state.groupRequests.map((r) => (r.id === requestId ? updated : r)),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  markUnderReview: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/under-review`);
    set((state) => ({
      groupRequests: state.groupRequests.map((r) => (r.id === requestId ? updated : r)),
    }));
  },

  linkRoster: async (requestId: string, rosterPlayerId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(
      `/api/join-requests/${requestId}/link-roster`,
      { rosterPlayerId },
    );
    set((state) => ({
      groupRequests: state.groupRequests.map((r) => (r.id === requestId ? updated : r)),
    }));
  },

  clearError: () => set({ error: null }),
}));
