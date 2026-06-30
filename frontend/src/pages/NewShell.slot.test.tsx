/**
 * NewShell — ShellContent slot-wiring test (F6b).
 *
 * Locks that the v2 chrome injects `<Home/>` as the `overview` slot:
 *   - with a current group, ShellContent passes `slots.overview` to GroupViewContent;
 *   - with no current group, it passes no slots (so GroupViewContent falls through
 *     to its legacy body).
 *
 * The "absent slots → legacy StaticHomeTab" branch itself is owned by
 * GroupViewContent.test.tsx (the slot-contract regression lock); here we only
 * verify ShellContent's decision to pass / withhold the slot. GroupViewContent
 * and Home are stubbed — the point is the wiring, not the rendered screens.
 */
import { render, screen } from '@testing-library/react';
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
vi.mock('../stores/tierStore', () => ({ useCurrentTier: () => mocks.tier }));
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

describe('NewShell ShellContent slot wiring', () => {
  it('passes an overview slot to GroupViewContent when a static is active', () => {
    render(<ShellContent />);
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'true');
  });

  it('passes no overview slot when there is no current group', () => {
    mocks.currentGroup = null;
    render(<ShellContent />);
    expect(screen.getByTestId('gvc')).toHaveAttribute('data-has-overview', 'false');
  });
});
