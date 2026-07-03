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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentGroup: { id: 'g1', name: 'Crescent', userRole: 'owner' } as unknown | null,
  tier: { tierId: 't1', players: [] } as unknown,
  canEdit: true,
}));

vi.mock('./GroupViewContent', () => ({
  GroupViewContent: (p: { slots?: { overview?: unknown } }) => (
    <div data-testid="gvc" data-has-overview={String(!!p.slots?.overview)} />
  ),
}));
vi.mock('../components/home/Home', () => ({ Home: () => <div data-testid="home" /> }));
vi.mock('./groupActionsContext', () => ({
  GroupActionModals: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGroupActions: () => ({}),
}));
vi.mock('../hooks/useGroupViewState', () => ({
  useGroupViewState: () => ({ setPageMode: vi.fn(), pageMode: 'overview' }),
}));
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

beforeEach(() => {
  mocks.currentGroup = { id: 'g1', name: 'Crescent', userRole: 'owner' };
  mocks.tier = { tierId: 't1', players: [] };
  mocks.canEdit = true;
});

const renderShell = () => render(<MemoryRouter><ShellContent /></MemoryRouter>);

describe('NewShell ShellContent slot wiring', () => {
  it('passes an overview slot to GroupViewContent when a static is active', () => {
    renderShell();
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'true');
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
