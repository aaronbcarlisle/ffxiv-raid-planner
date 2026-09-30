import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { api, isAuthRelated403 } from './api';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore, type ViewAsUserInfo } from '../stores/viewAsStore';

describe('isAuthRelated403', () => {
  describe('detects auth-related 403 messages', () => {
    it('matches "Please log in" message from backend', () => {
      expect(isAuthRelated403('This static group is private. Please log in.')).toBe(true);
    });

    it('matches "login" variations', () => {
      expect(isAuthRelated403('You must login first')).toBe(true);
      expect(isAuthRelated403('Please Login to continue')).toBe(true);
    });

    it('matches "authenticated" variations', () => {
      expect(isAuthRelated403('Not authenticated')).toBe(true);
      expect(isAuthRelated403('User is not authenticated')).toBe(true);
      expect(isAuthRelated403('Authentication required')).toBe(true);
    });

    it('matches "session" variations', () => {
      expect(isAuthRelated403('Session expired')).toBe(true);
      expect(isAuthRelated403('Your session invalid')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(isAuthRelated403('PLEASE LOG IN')).toBe(true);
      expect(isAuthRelated403('NOT AUTHENTICATED')).toBe(true);
      expect(isAuthRelated403('Session EXPIRED')).toBe(true);
    });
  });

  describe('does not match true permission errors', () => {
    it('rejects generic permission denied', () => {
      expect(isAuthRelated403('Permission denied')).toBe(false);
    });

    it('rejects insufficient permissions', () => {
      expect(isAuthRelated403('You do not have permission to edit this')).toBe(false);
    });

    it('rejects role-based denials', () => {
      expect(isAuthRelated403('Only owners can delete this group')).toBe(false);
      expect(isAuthRelated403('Leads and above can edit the roster')).toBe(false);
    });

    it('rejects private group without auth hint', () => {
      // This is a true permission error - user is logged in but not a member
      expect(isAuthRelated403('This static group is private')).toBe(false);
    });

    it('rejects generic forbidden', () => {
      expect(isAuthRelated403('Forbidden')).toBe(false);
      expect(isAuthRelated403('Access denied')).toBe(false);
    });

    it('rejects empty and generic messages', () => {
      expect(isAuthRelated403('')).toBe(false);
      expect(isAuthRelated403('HTTP 403')).toBe(false);
      expect(isAuthRelated403('Error occurred')).toBe(false);
    });

    it('treats the View-As refusal as a true 403', () => {
      // Must stay in sync with backend permissions.VIEW_AS_REFUSAL.
      expect(isAuthRelated403('Not available while viewing as another user')).toBe(false);
    });
  });
});

// ── X-View-As header (P1 Task 1, HS-30) ────────────────────────────────────

const VIEW_AS_HEADER = 'X-View-As';

function viewedUser(userId: string): ViewAsUserInfo {
  return {
    userId,
    discordUsername: 'viewed',
    displayName: null,
    avatarUrl: null,
    groupId: 'g1',
    groupName: 'Test Static',
    isMember: true,
    role: 'member',
    isLinkedPlayer: false,
    linkedPlayerId: null,
    linkedPlayerName: null,
  };
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

describe('authRequest X-View-As header', () => {
  const originalRefresh = useAuthStore.getState().refreshAccessToken;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.cookie = 'csrf_token=t';
    fetchMock = vi.fn().mockResolvedValue(noContent());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    useViewAsStore.getState().stopViewAs();
    useAuthStore.setState({ refreshAccessToken: originalRefresh });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends X-View-As on DELETE and GET while viewAsUser is set', async () => {
    useViewAsStore.setState({ viewAsUser: viewedUser('u-view') });

    await api.delete('/api/static-groups/g1');
    await api.get('/api/static-groups/g1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentHeaders(fetchMock, 0)).toHaveProperty(VIEW_AS_HEADER, 'u-view');
    expect(sentHeaders(fetchMock, 0)).toHaveProperty('X-CSRF-Token', 't');
    expect(sentHeaders(fetchMock, 1)).toHaveProperty(VIEW_AS_HEADER, 'u-view');
  });

  it('sends no X-View-As key after stopViewAs', async () => {
    useViewAsStore.setState({ viewAsUser: viewedUser('u-view') });
    useViewAsStore.getState().stopViewAs();

    await api.delete('/api/static-groups/g1');

    expect(sentHeaders(fetchMock, 0)).not.toHaveProperty(VIEW_AS_HEADER);
  });

  it('sends no X-View-As key from a fresh module with the store never set', async () => {
    vi.resetModules();
    const fresh = await import('./api');

    await fresh.api.delete('/api/static-groups/g1');

    expect(sentHeaders(fetchMock, 0)).not.toHaveProperty(VIEW_AS_HEADER);
  });

  it('keeps X-View-As on the retry after a 401 refresh', async () => {
    useViewAsStore.setState({ viewAsUser: viewedUser('u-view') });
    useAuthStore.setState({ refreshAccessToken: vi.fn().mockResolvedValue(true) });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 })
      )
      .mockResolvedValueOnce(noContent());

    await api.delete('/api/static-groups/g1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentHeaders(fetchMock, 0)).toHaveProperty(VIEW_AS_HEADER, 'u-view');
    expect(sentHeaders(fetchMock, 1)).toHaveProperty(VIEW_AS_HEADER, 'u-view');
  });

  it('sends no X-View-As key when viewAsUser.userId is empty', async () => {
    useViewAsStore.setState({ viewAsUser: viewedUser('') });

    await api.delete('/api/static-groups/g1');

    expect(sentHeaders(fetchMock, 0)).not.toHaveProperty(VIEW_AS_HEADER);
  });
});
