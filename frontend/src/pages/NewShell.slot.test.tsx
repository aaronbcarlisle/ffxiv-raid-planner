/**
 * NewShell — ShellContent slot-wiring test (F6b).
 *
 * Locks that the v2 chrome injects `<Home/>` as the `overview` slot when a
 * static is active. With no current group, `ShellContentStates` renders the
 * not-found state instead (GroupViewContent never mounts, so no slot is
 * passed at all — the legacy no-slots fallback body was deleted in flip-P3).
 *
 * GroupViewContent and Home are stubbed — the point is the wiring, not the
 * rendered screens. See `GroupViewContent.slots.test.tsx` for the slot-contract
 * regression lock (no legacy leaf renders when slots are provided).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useShellPreferenceStore } from '../lib/shellPreference';

const mocks = vi.hoisted(() => ({
  currentGroup: { id: 'g1', name: 'Crescent', userRole: 'owner' } as unknown | null,
  tier: { tierId: 't1', players: [] } as unknown,
  canEdit: true,
}));

// Real analytics buffers + fetches — spy instead (same shape as
// TryNewUiBanner.test.tsx). The toggle handler under test fires through it.
const track = vi.fn();
vi.mock('../services/analytics', () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

vi.mock('./GroupViewContent', () => ({
  GroupViewContent: (p: { slots?: { overview?: unknown; goals?: React.ReactNode }; onSwitchToClassicUi?: () => void }) => (
    <div data-testid="gvc" data-has-overview={String(!!p.slots?.overview)}>
      {p.onSwitchToClassicUi && (
        <button onClick={p.onSwitchToClassicUi}>switch-to-classic</button>
      )}
      {/* The goals slot is rendered so the ProgressPage stub can report its props. */}
      <div data-testid="gvc-goals-slot">{p.slots?.goals}</div>
    </div>
  ),
}));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
// S2a-2 (R-S2-4): the stub reports the props the shell hands the Progress slot.
vi.mock('../components/progress/ProgressPage', () => ({
  ProgressPage: (p: {
    group: { id: string };
    tier: { tierId: string } | null;
    canManage: boolean;
    userRole: string | null | undefined;
    currentUserId: string | null;
    isViewingAs: boolean;
    onNavigate: (tab: string, extra?: Record<string, string>) => void;
  }) => (
    <div
      data-testid="progress-page"
      data-group={p.group.id}
      data-tier={p.tier?.tierId ?? 'none'}
      data-can-manage={String(p.canManage)}
      data-user-role={String(p.userRole)}
      data-current-user={String(p.currentUserId)}
      data-viewing-as={String(p.isViewingAs)}
    >
      <button onClick={() => p.onNavigate('roster', { rview: 'board' })}>progress-open-board</button>
    </div>
  ),
}));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
const setPageMode = vi.fn();
vi.mock('../hooks/useGroupViewState', async () => {
  const { makeGroupViewStateMock } = await import('./newShellTestScaffold');
  return { useGroupViewState: () => makeGroupViewStateMock({ pageMode: 'overview', setPageMode }) };
});
vi.mock('../stores/staticGroupStore', () => ({
  useStaticGroupStore: (sel: (s: { currentGroup: unknown }) => unknown) => sel({ currentGroup: mocks.currentGroup }),
}));
vi.mock('../stores/tierStore', () => ({
  useCurrentTier: () => mocks.tier,
  // ShellContentStates reads `tiers` + `isLoading` via a selector — a non-empty
  // list keeps the no-tiers state from firing so the states pass through to gvc.
  useTierStore: (sel?: (s: { tiers: unknown[]; isLoading: boolean }) => unknown) => {
    const state = { tiers: mocks.tier ? [mocks.tier] : [], isLoading: false };
    return sel ? sel(state) : state;
  },
}));
vi.mock('../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({
    userRole: 'owner',
    isAdmin: false,
    isAdminAccess: false,
    isMember: true,
    canEdit: mocks.canEdit,
    canManageInvitations: mocks.canEdit,
  }),
}));

import { ShellContent } from './NewShell';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore, type ViewAsUserInfo } from '../stores/viewAsStore';
import type { User } from '../types';

beforeEach(() => {
  mocks.currentGroup = { id: 'g1', name: 'Crescent', userRole: 'owner' };
  mocks.tier = { tierId: 't1', players: [] };
  mocks.canEdit = true;
  track.mockClear();
  setPageMode.mockClear();
  localStorage.clear();
  useShellPreferenceStore.setState({ preference: null });
  useAuthStore.setState({ user: { id: 'u-self' } as unknown as User });
  useViewAsStore.setState({ viewAsUser: null });
});

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell ShellContent slot wiring', () => {
  it('passes an overview slot to GroupViewContent when a static is active', () => {
    renderShell();
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'true');
  });

  it('threads a v2-only onSwitchToClassicUi that flips the shell to legacy with v2-more-page telemetry', () => {
    renderShell();
    fireEvent.click(screen.getByText('switch-to-classic'));
    expect(track).toHaveBeenCalledWith('navigation', 'ui_shell_toggle',
      { direction: 'to-legacy', surface: 'v2-more-page' });
    expect(useShellPreferenceStore.getState().preference).toBe('legacy');
  });

  it('passes a goals slot that renders ProgressPage with the group, tier and the user (S2a-2, R-S2-4)', () => {
    renderShell();
    const page = screen.getByTestId('progress-page');
    expect(screen.getByTestId('gvc-goals-slot')).toContainElement(page);
    expect(page).toHaveAttribute('data-group', 'g1');
    expect(page).toHaveAttribute('data-tier', 't1');
    expect(page).toHaveAttribute('data-can-manage', 'true');
    expect(page).toHaveAttribute('data-user-role', 'owner');
    expect(page).toHaveAttribute('data-current-user', 'u-self');
    expect(page).toHaveAttribute('data-viewing-as', 'false');
    fireEvent.click(screen.getByText('progress-open-board'));
    expect(setPageMode).toHaveBeenCalledWith('roster', { rview: 'board' });
  });

  it("ProgressPage's canManage is the shell's canEdit, not the roster gate (an owner role with canEdit false)", () => {
    // canManageRoster('owner') would say true; canEdit says false — the slot must follow canEdit.
    mocks.canEdit = false;
    renderShell();
    expect(screen.getByTestId('progress-page')).toHaveAttribute('data-can-manage', 'false');
  });

  it('under View As, ProgressPage gets the viewed user as currentUserId and isViewingAs true', () => {
    useViewAsStore.setState({ viewAsUser: { userId: 'u-viewed', role: 'member' } as unknown as ViewAsUserInfo });
    renderShell();
    const page = screen.getByTestId('progress-page');
    expect(page).toHaveAttribute('data-current-user', 'u-viewed');
    expect(page).toHaveAttribute('data-viewing-as', 'true');
  });

  it('renders the not-found state (no gvc) when there is no current group', () => {
    // ShellContentStates now gates the content: with no group loaded it renders
    // the not-found state instead of GroupViewContent, so the withheld-slot branch
    // of ShellContent is unreachable — the states layer owns the empty content area.
    mocks.currentGroup = null;
    renderShell();
    expect(screen.getByTestId('shell-state-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('gvc')).not.toBeInTheDocument();
  });
});
