import { create } from 'zustand';
import type {
  JoinRequest,
  JoinRequestCreatePayload,
  JoinRequestListResponse,
} from '../types';
import { api } from '../services/api';

/** The Applicants tab's own slice (R-RH-R): independent of `groupRequests`,
 *  which the V2 bell and the Settings dock keep polling without `fit`. */
interface ApplicantsState {
  groupId: string;
  items: JoinRequest[];
  pendingCount: number;
}

interface JoinRequestState {
  myRequests: JoinRequest[];
  groupRequests: JoinRequest[];
  pendingCount: number;
  /** The static `groupRequests`/`pendingCount` were last fetched for (null
   *  before the first fetch). Readers that show the count for a specific
   *  static gate on it, so a static switch never shows the previous one's. */
  groupRequestsGroupId: string | null;
  applicants: ApplicantsState | null;
  isLoading: boolean;
  error: string | null;

  fetchMyRequests: () => Promise<void>;
  fetchGroupRequests: (groupId: string, includeResolved?: boolean) => Promise<void>;
  fetchApplicants: (groupId: string) => Promise<void>;
  createRequest: (shareCode: string, data: JoinRequestCreatePayload) => Promise<JoinRequest>;
  cancelRequest: (requestId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  markUnderReview: (requestId: string) => Promise<void>;
  linkRoster: (requestId: string, rosterPlayerId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Guards `fetchApplicants` against a stale response (two overlapping calls
 * where the first resolves last): only the call holding the latest sequence
 * number at resolution time is allowed to write `applicants`.
 */
let applicantsRequestSeq = 0;

/** Merges a mutation response into an applicants row, keeping its previous
 *  `fit` — accept/decline/under-review responses carry `fit: null`. */
function mergeApplicantRow(row: JoinRequest, updated: JoinRequest): JoinRequest {
  return { ...updated, fit: updated.fit ?? row.fit };
}

/**
 * Shared write for every request-mutation action (accept/decline/under-review/
 * link-roster): updates the row in `groupRequests`, and in `applicants.items`
 * when that slice is loaded (keeping the row's previous `fit`), and moves both
 * pending counts by `pendingDelta` (0 for actions that don't resolve a
 * waiting request, per §R-RH-R). The applicants count only moves when the
 * row is in the slice: the V1 dock and Static Home act on whatever static
 * they show, while `applicants` holds the static the Recruiting page last
 * loaded, so an unscoped decrement would drift its "N waiting" down.
 */
function patchApplicants(
  state: Pick<JoinRequestState, 'groupRequests' | 'pendingCount' | 'applicants'>,
  requestId: string,
  updated: JoinRequest,
  pendingDelta: number,
): Pick<JoinRequestState, 'groupRequests' | 'pendingCount' | 'applicants'> {
  return {
    groupRequests: state.groupRequests.map((r) => (r.id === requestId ? updated : r)),
    pendingCount: Math.max(0, state.pendingCount - pendingDelta),
    applicants: state.applicants && {
      ...state.applicants,
      items: state.applicants.items.map((r) => (r.id === requestId ? mergeApplicantRow(r, updated) : r)),
      pendingCount: Math.max(
        0,
        state.applicants.pendingCount -
          (state.applicants.items.some((r) => r.id === requestId) ? pendingDelta : 0),
      ),
    },
  };
}

export const useJoinRequestStore = create<JoinRequestState>((set) => ({
  myRequests: [],
  groupRequests: [],
  pendingCount: 0,
  groupRequestsGroupId: null,
  applicants: null,
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
        groupRequestsGroupId: groupId,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch requests',
        isLoading: false,
      });
    }
  },

  fetchApplicants: async (groupId: string) => {
    const seq = ++applicantsRequestSeq;
    try {
      const response = await api.get<JoinRequestListResponse>(
        `/api/static-groups/${groupId}/join-requests?include_resolved=true&fit=true`
      );
      if (seq !== applicantsRequestSeq) return; // a newer call already resolved
      set({
        applicants: { groupId, items: response.items, pendingCount: response.pendingCount },
      });
    } catch (error) {
      if (seq !== applicantsRequestSeq) return;
      set({ error: error instanceof Error ? error.message : 'Failed to fetch applicants' });
      throw error;
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
    set((state) => patchApplicants(state, requestId, updated, 1));
  },

  declineRequest: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/decline`);
    set((state) => patchApplicants(state, requestId, updated, 1));
  },

  markUnderReview: async (requestId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(`/api/join-requests/${requestId}/under-review`);
    set((state) => patchApplicants(state, requestId, updated, 0));
  },

  linkRoster: async (requestId: string, rosterPlayerId: string) => {
    set({ error: null });
    const updated = await api.post<JoinRequest>(
      `/api/join-requests/${requestId}/link-roster`,
      { rosterPlayerId },
    );
    set((state) => patchApplicants(state, requestId, updated, 0));
  },

  clearError: () => set({ error: null }),
}));
