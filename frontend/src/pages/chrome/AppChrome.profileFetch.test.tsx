/**
 * AppChrome ↔ REAL playerProfileStore — the rail portrait's profile fetch
 * (PR #282 review, R-PH1-G).
 *
 *   • on /profile the page's own mount fetch and AppChrome's fetch share ONE
 *     GET (the GET creates a missing profile row server-side);
 *   • an account switch while the previous account's GET is still pending
 *     ends with the NEW account's portrait, even when the old response lands
 *     last.
 *
 * The api mock models the server: each GET answers for whichever account the
 * session cookie belonged to when it was issued, and is released by the test
 * (newest first — the order that let a stale response win).
 */
import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerProfile } from '../../stores/playerProfileStore';

const server = vi.hoisted(() => ({
  cookieUserId: 'u1',
  pending: [] as Array<{ release: () => void }>,
  profileFor: (userId: string) => ({
    id: `profile-${userId}`,
    userId,
    visibility: 'private',
    shareCode: null,
    shareEnabled: false,
    bio: null,
    characters: [{
      id: `char-${userId}`, lodestoneId: '1', name: `Hero ${userId}`, server: 'Tonberry', dataCenter: null,
      avatarUrl: `https://img2.finalfantasyxiv.com/${userId}.png`, isMain: true, createdAt: '', updatedAt: '',
    }],
    jobProfiles: [],
    createdAt: '',
    updatedAt: '',
  }) as PlayerProfile,
}));

const auth = vi.hoisted(() => ({ user: null as { id: string; discordUsername: string } | null }));

vi.mock('../../services/api', () => ({
  api: {
    get: vi.fn((endpoint: string) => {
      if (endpoint !== '/api/player/profile') return Promise.resolve([]);
      const owner = server.cookieUserId;
      return new Promise((resolve) => {
        server.pending.push({ release: () => resolve(server.profileFor(owner)) });
      });
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel?: (s: { user: unknown }) => unknown) => {
    const state = { user: auth.user };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groups: [], fetchGroups: vi.fn() }),
}));
vi.mock('../../components/auth', () => ({ UserMenu: () => null }));
vi.mock('./NonGroupTopBar', () => ({ NonGroupTopBar: () => null }));

import { api } from '../../services/api';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { AppChrome } from './AppChrome';

/** Stands in for Profile.tsx: an unconditional mount fetch below the host. */
function PageWithMountFetch() {
  useEffect(() => {
    void usePlayerProfileStore.getState().fetchProfile();
  }, []);
  return null;
}

function tree(path: string, children: React.ReactNode = null) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<AppChrome>{children}</AppChrome>} />
      </Routes>
    </MemoryRouter>
  );
}

const profileGets = () =>
  vi.mocked(api.get).mock.calls.filter(([endpoint]) => endpoint === '/api/player/profile').length;

/** Releases pending GETs newest first, including any a release triggers. */
async function releaseNewestFirst() {
  for (let request = server.pending.pop(); request; request = server.pending.pop()) {
    const current = request;
    await act(async () => {
      current.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  server.cookieUserId = 'u1';
  server.pending = [];
  auth.user = { id: 'u1', discordUsername: 'first' };
  usePlayerProfileStore.setState({ profile: null, loading: false, error: null });
});

afterEach(async () => {
  await releaseNewestFirst();
  vi.clearAllMocks();
});

describe('AppChrome rail portrait — profile fetch with the real store', () => {
  it('shares ONE profile GET with the page\'s own mount fetch on /profile', async () => {
    render(tree('/profile', <PageWithMountFetch />));
    expect(profileGets()).toBe(1);
    await releaseNewestFirst();
    expect(profileGets()).toBe(1);
    expect(usePlayerProfileStore.getState().profile?.userId).toBe('u1');
  });

  it('ends on the new account\'s portrait when the previous account\'s GET lands last', async () => {
    const { rerender } = render(tree('/discover'));
    expect(server.pending).toHaveLength(1);

    // Account switch while u1's GET is still pending.
    server.cookieUserId = 'u2';
    auth.user = { id: 'u2', discordUsername: 'second' };
    rerender(tree('/discover'));

    await releaseNewestFirst();

    expect(usePlayerProfileStore.getState().profile?.userId).toBe('u2');
    const portrait = screen.getByRole('button', { name: 'Player Hub' }).querySelector('img');
    expect(portrait).toHaveAttribute('src', 'https://img2.finalfantasyxiv.com/u2.png');
  });
});
