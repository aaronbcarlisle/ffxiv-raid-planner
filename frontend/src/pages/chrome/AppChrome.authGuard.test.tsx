/**
 * AppChrome — v2 skips the auth-required fetchGroups() cold-fetch for guests
 * (flip-P1 browser-validation fix; moved here with the fetch in Stage-1 T3,
 * same assertions as the retired NewShell.authGuard suite).
 *
 * Regression this pins: the cold-fetch effect unconditionally called
 * `fetchGroups()` whenever `groups.length === 0` on mount, regardless of auth
 * state. `fetchGroups()` hits the AUTH-REQUIRED `GET /api/static-groups` ("my
 * statics" list) — for a logged-out guest this 401s and writes into the
 * shared `staticGroupStore.error`. `ShellContentStates`' branch 5 error-modal
 * check (`error && currentGroup`) then fires for a guest viewing an otherwise-
 * correctly-loaded PUBLIC static (loaded via the separate, unauthenticated
 * `fetchGroupByShareCode` call) — a false "Not authenticated" modal over a
 * correct read-only guest view.
 *
 * Legacy never has this problem: legacy's Header/TopBar chrome only calls
 * `fetchGroups` lazily, when the static-switcher dropdown opens AND the
 * viewer `isMember` (`StaticPicker.tsx:76`). It is never called eagerly on
 * mount for anyone, authenticated or not.
 *
 * Fix: gate the mount-fetch on `useAuthStore`'s `user` — a guest has no
 * "my statics" list to fetch, so the auth-required endpoint must not be hit
 * for them. The `user` mock lives on the shared `mocks` object (not a fresh
 * literal per call) so its identity is stable across re-renders — an unstable
 * identity would re-fire the `user`-keyed effect every render.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  groups: [] as unknown[],
  fetchGroups: vi.fn(),
  user: null as { id: string } | null,
}));

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ groups: mocks.groups, fetchGroups: mocks.fetchGroups }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (sel?: (s: { user: unknown }) => unknown) => {
    const state = { user: mocks.user };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../../components/auth', () => ({
  UserMenu: () => null,
}));

import { AppChrome } from './AppChrome';

beforeEach(() => {
  mocks.fetchGroups.mockClear();
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
  // Empty groups list on every test — the unconditional call in the buggy
  // code fires whenever `groups.length === 0`, so this is the discriminating
  // precondition for both cases below.
  mocks.groups = [];
  mocks.user = null;
});

function renderChrome() {
  return render(
    <MemoryRouter initialEntries={['/group/ABC']}>
      <Routes>
        <Route path="/group/:shareCode" element={<AppChrome><div /></AppChrome>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppChrome — guest guard on the auth-required fetchGroups() cold-fetch', () => {
  it('does NOT call fetchGroups for a logged-out guest (no user), even with an empty groups list', () => {
    mocks.user = null;
    renderChrome();
    expect(mocks.fetchGroups).not.toHaveBeenCalled();
  });

  it('DOES call fetchGroups for an authenticated user with an empty groups list', () => {
    mocks.user = { id: 'u1' };
    renderChrome();
    expect(mocks.fetchGroups).toHaveBeenCalledTimes(1);
  });
});
