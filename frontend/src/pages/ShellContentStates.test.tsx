/**
 * ShellContentStates — v2 load / error / not-found / no-tiers states (flip-P1 Task 3).
 *
 * Locks the precedence + copy of the v2 states component that `ShellContent`
 * renders BEFORE `GroupViewContent`. The COPY is verbatim-legacy (mirrors the
 * deleted legacy GroupView); the MARKUP is new v2 (EmptyState / CardShell / Modal). Uses the
 * REAL stores via `setState` (nothing hits the network — the component only READS
 * store state, it never triggers a fetch) with `./groupActionsContext` mocked so
 * `onNewTier` is a spy, and `../hooks/useDevice` mocked so the error Modal's
 * device reads (matchMedia) don't blow up in jsdom. Interaction uses `fireEvent`
 * (never `@testing-library/user-event`, not a dependency here); `navigate` is
 * asserted via a MemoryRouter probe route.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

const mockOnNewTier = vi.hoisted(() => vi.fn());

vi.mock('./groupActionsContext', () => ({
  useGroupActions: () => ({ onNewTier: mockOnNewTier }),
}));
vi.mock('../hooks/useDevice', () => ({
  useDevice: () => ({ isSmallScreen: false, isTouch: false, canHover: false, prefersReducedMotion: false }),
}));

import { ShellContentStates } from './ShellContentStates';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';

const group = {
  id: 'g1',
  name: 'Test Static',
  shareCode: 'DEVTST',
  userRole: 'owner',
  isAdminAccess: false,
  settings: {},
} as unknown as never;

const tier = { id: 'snap1', tierId: 'm5s', players: [] } as unknown as never;

// Captured once, before any test mutates the real stores, so `resetStores()`
// can restore the genuine `clearError` actions after a test stubs them (e.g.
// 5b / 6a below). Without this, a spy assigned via `setState({ clearError })`
// leaks into every later test in the file (order-coupled leakage).
const originalClearGroupError = useStaticGroupStore.getState().clearError;
const originalClearTierError = useTierStore.getState().clearError;

function resetStores() {
  useStaticGroupStore.setState({
    currentGroup: null,
    isLoading: false,
    error: null,
    errorStack: null,
    clearError: originalClearGroupError,
  });
  useTierStore.setState({
    tiers: [],
    isLoading: false,
    error: null,
    errorStack: null,
    clearError: originalClearTierError,
  });
  useAuthStore.setState({ user: null, login: vi.fn() as never });
  useViewAsStore.setState({ viewAsUser: null });
}

function renderStates(children: ReactNode = <div data-testid="content">CONTENT</div>) {
  return render(
    <MemoryRouter initialEntries={['/group/DEVTST']}>
      <Routes>
        <Route path="/group/:shareCode" element={<ShellContentStates>{children}</ShellContentStates>} />
        <Route path="/profile" element={<div data-testid="profile-probe">PROFILE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetStores();
  mockOnNewTier.mockClear();
});

describe('ShellContentStates', () => {
  it('1. loading: renders the skeleton state (not children) while loading with no group', () => {
    useStaticGroupStore.setState({ isLoading: true, currentGroup: null });
    renderStates();
    expect(screen.getByTestId('shell-state-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('2a. error: renders the generic Error page with the raw error message', () => {
    useStaticGroupStore.setState({ error: 'Something exploded', currentGroup: null });
    renderStates();
    const root = screen.getByTestId('shell-state-error');
    expect(root).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to My Statics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log In with Discord' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('2b. error (private, logged out): shows Private Static copy + both buttons; login fires', () => {
    const loginSpy = vi.fn();
    useStaticGroupStore.setState({ error: 'This static is private', currentGroup: null });
    useAuthStore.setState({ user: null, login: loginSpy as never });
    renderStates();
    expect(screen.getByText('Private Static')).toBeInTheDocument();
    expect(screen.getByText('This static is private. Please log in to view it.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log In with Discord' }));
    expect(loginSpy).toHaveBeenCalledTimes(1);
  });

  it('2c. error (private): Go to My Statics navigates to /profile?tab=statics', () => {
    useStaticGroupStore.setState({ error: 'This static is private', currentGroup: null });
    renderStates();
    fireEvent.click(screen.getByRole('button', { name: 'Go to My Statics' }));
    expect(screen.getByTestId('profile-probe')).toBeInTheDocument();
  });

  it('2d. error (private, logged in): hides the login button', () => {
    useStaticGroupStore.setState({ error: 'This static is private', currentGroup: null });
    useAuthStore.setState({ user: { id: 'u1' } as never, login: vi.fn() as never });
    renderStates();
    expect(screen.getByText('Private Static')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log In with Discord' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to My Statics' })).toBeInTheDocument();
  });

  it('3. not-found: no group, no error, not loading → Group Not Found', () => {
    useStaticGroupStore.setState({ currentGroup: null, error: null, isLoading: false });
    renderStates();
    expect(screen.getByTestId('shell-state-not-found')).toBeInTheDocument();
    expect(screen.getByText('Group Not Found')).toBeInTheDocument();
    expect(screen.getByText("The static group you're looking for doesn't exist.")).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('4a. no-tiers (canEdit): shows the empty state + Create First Tier CTA; onNewTier fires', () => {
    useStaticGroupStore.setState({ currentGroup: group });
    useTierStore.setState({ tiers: [], isLoading: false });
    renderStates();
    expect(screen.getByTestId('shell-state-no-tiers')).toBeInTheDocument();
    expect(screen.getByText('No Raid Tiers')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first tier snapshot to start tracking gear progress.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create First Tier' }));
    expect(mockOnNewTier).toHaveBeenCalledTimes(1);
  });

  it('4b. no-tiers (cannot edit): hides the Create First Tier CTA', () => {
    useStaticGroupStore.setState({
      currentGroup: {
        id: 'g1',
        name: 'Test Static',
        shareCode: 'DEVTST',
        userRole: 'member',
        isAdminAccess: false,
        settings: {},
      } as unknown as never,
    });
    useTierStore.setState({ tiers: [], isLoading: false });
    renderStates();
    expect(screen.getByTestId('shell-state-no-tiers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create First Tier' })).not.toBeInTheDocument();
  });

  it('4c. no-tiers suppressed while tiers are still loading', () => {
    useStaticGroupStore.setState({ currentGroup: group });
    useTierStore.setState({ tiers: [], isLoading: true });
    renderStates();
    expect(screen.queryByTestId('shell-state-no-tiers')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('5a. precedence: error WITH a group renders children AND the error modal overlay', () => {
    useStaticGroupStore.setState({ currentGroup: group, error: 'Save failed' });
    useTierStore.setState({ tiers: [tier], isLoading: false });
    renderStates();
    // children render (states did NOT replace content)…
    expect(screen.getByTestId('content')).toBeInTheDocument();
    // …AND the error modal overlays on top.
    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.getByText('Technical Details')).toBeInTheDocument();
    expect(screen.getByText('Report Bug')).toBeInTheDocument();
  });

  it('5b. closing the error modal calls clearError', () => {
    const clearSpy = vi.fn();
    useStaticGroupStore.setState({ currentGroup: group, error: 'Save failed', clearError: clearSpy });
    useTierStore.setState({ tiers: [tier], isLoading: false });
    renderStates();
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('5c. happy path (group + tiers, no error): renders children with no state overlay', () => {
    useStaticGroupStore.setState({ currentGroup: group, error: null });
    useTierStore.setState({ tiers: [tier], isLoading: false });
    renderStates();
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('shell-state-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-state-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-state-not-found')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-state-no-tiers')).not.toBeInTheDocument();
    expect(screen.queryByText('Report Bug')).not.toBeInTheDocument();
  });

  it('6a. tier-only error (group loaded, no group error): still raises the error modal, and dismiss clears BOTH stores (legacy parity: error = groupError || tierError)', () => {
    const clearGroupSpy = vi.fn();
    const clearTierSpy = vi.fn();
    useStaticGroupStore.setState({ currentGroup: group, error: null, clearError: clearGroupSpy });
    useTierStore.setState({ tiers: [tier], isLoading: false, error: 'tier save failed', clearError: clearTierSpy });
    renderStates();
    // children still render underneath the overlay…
    expect(screen.getByTestId('content')).toBeInTheDocument();
    // …AND the error modal fires off the tier-only error.
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('tier save failed')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(clearGroupSpy).toHaveBeenCalledTimes(1);
    expect(clearTierSpy).toHaveBeenCalledTimes(1);
  });

  it('6b. no-tiers suppressed while the group store is mid-switch (stale currentGroup + isLoading, legacy parity: !isLoading guard)', () => {
    // Simulates a rail static-switch mid-flight: fetchGroupByShareCode has set
    // isLoading:true WITHOUT nulling the stale currentGroup, and the tier list
    // is momentarily empty because the tier-fetch effect hasn't populated it
    // for the new group yet. This must NOT flash "No Raid Tiers".
    useStaticGroupStore.setState({ currentGroup: group, isLoading: true, error: null });
    useTierStore.setState({ tiers: [], isLoading: false });
    renderStates();
    expect(screen.queryByTestId('shell-state-no-tiers')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('7. copy error: a rejected clipboard write does not set the Copied state (no false-positive UI, no unhandled rejection)', async () => {
    // PR-bot fix (Copilot): handleCopyError previously called
    // navigator.clipboard.writeText(...) without awaiting/catching, and set
    // errorCopied unconditionally. In a blocked-clipboard context this is an
    // unhandled rejection AND a false "Copied!" UI state.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    useStaticGroupStore.setState({ currentGroup: group, error: 'Save failed' });
    useTierStore.setState({ tiers: [tier], isLoading: false });
    renderStates();
    fireEvent.click(screen.getByRole('button', { name: 'Copy error details' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy error details' })).toBeInTheDocument();
  });

  it('7b. copy error: a successful clipboard write sets the Copied state', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    useStaticGroupStore.setState({ currentGroup: group, error: 'Save failed' });
    useTierStore.setState({ tiers: [tier], isLoading: false });
    renderStates();
    fireEvent.click(screen.getByRole('button', { name: 'Copy error details' }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });
});
