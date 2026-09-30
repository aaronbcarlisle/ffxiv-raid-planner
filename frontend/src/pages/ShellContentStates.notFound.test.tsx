/**
 * ShellContentStates — v2 not-found flow against the REAL group store (V1B Task 2).
 *
 * `ShellContentStates.test.tsx` seeds store state and never fetches. This file
 * drives `fetchGroupByShareCode` with a mocked 404 so the store → shell wiring is
 * proven end to end: a 404 becomes the not-found state (R-V1B-1), a stale static is
 * replaced by it (N2, the mid-switch state `NewShell` produces), and the state
 * carries a "Go to My Statics" action (R-V1B-7). Button queries are scoped to the
 * not-found region: the Error card renders the same button, so an unscoped query
 * would also pass on `main`.
 */
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./groupActionsContext', () => ({
  useGroupActions: () => ({ onNewTier: vi.fn() }),
  useGroupAddToRoster: () => vi.fn(),
}));
vi.mock('../hooks/useDevice', () => ({
  useDevice: () => ({ isSmallScreen: false, isTouch: false, canHover: false, prefersReducedMotion: false }),
}));
vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, authRequest: vi.fn() };
});

import { ShellContentStates } from './ShellContentStates';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import { authRequest, ApiError } from '../services/api';
import type { StaticGroup } from '../types';

const mockAuthRequest = vi.mocked(authRequest);

const devGroup = {
  id: 'g1',
  name: 'Test Static',
  shareCode: 'DEVTST',
  userRole: 'owner',
  isAdminAccess: false,
  settings: {},
} as StaticGroup;

function resetStores() {
  useStaticGroupStore.setState({
    currentGroup: null,
    isLoading: false,
    error: null,
    errorStack: null,
    errorSource: null,
  });
  useTierStore.setState({ tiers: [], isLoading: false, error: null, errorStack: null });
  useAuthStore.setState({ user: null });
  useViewAsStore.setState({ viewAsUser: null });
}

function renderStates() {
  return render(
    <MemoryRouter initialEntries={['/group/ZZZZZZ']}>
      <Routes>
        <Route
          path="/group/:shareCode"
          element={
            <ShellContentStates>
              <div data-testid="content">CONTENT</div>
            </ShellContentStates>
          }
        />
        <Route path="/profile" element={<div data-testid="profile-probe">PROFILE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fetchByCode = (code: string) => useStaticGroupStore.getState().fetchGroupByShareCode(code);

describe('ShellContentStates — not-found flow with the real group store', () => {
  beforeEach(() => {
    mockAuthRequest.mockReset();
    resetStores();
  });

  it('N1: a 404 shows Static Not Found (not the Error card) with a Go to My Statics action', async () => {
    mockAuthRequest.mockRejectedValueOnce(new ApiError(404, 'Static group not found'));
    renderStates();

    await act(() => fetchByCode('ZZZZZZ'));

    const region = await screen.findByTestId('shell-state-not-found');
    expect(within(region).getByText('Static Not Found')).toBeInTheDocument();
    expect(screen.queryByTestId('shell-state-error')).toBeNull();

    fireEvent.click(within(region).getByRole('button', { name: 'Go to My Statics' }));
    expect(await screen.findByTestId('profile-probe')).toBeInTheDocument();
  });

  it('N2: a 404 mid-switch (previous static, tiers cleared) replaces it with not-found, no No Raid Tiers, no dialog', async () => {
    // The real mid-switch state: NewShell clears tiers (tierStore.clearTiers) on a
    // shareCode change while the previous static is still the current group.
    useStaticGroupStore.setState({ currentGroup: devGroup, isLoading: false });
    useTierStore.setState({ tiers: [], isLoading: false });
    mockAuthRequest.mockRejectedValueOnce(new ApiError(404, 'Static group not found'));
    renderStates();
    expect(screen.getByTestId('shell-state-no-tiers')).toBeInTheDocument();

    await act(() => fetchByCode('ZZZZZZ'));

    expect(await screen.findByTestId('shell-state-not-found')).toBeInTheDocument();
    expect(screen.getByText('Static Not Found')).toBeInTheDocument();
    expect(screen.queryByText('No Raid Tiers')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
