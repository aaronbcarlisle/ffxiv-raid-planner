/**
 * StaticTab — D-50 (HS-30): Delete Static is hidden while an admin is using
 * View As, whatever role the viewed user has. The raw `group.userRole` can be
 * the backend's virtual `owner` for a non-member admin, so the gate must not
 * trust it under View As. Admin-mode moderation delete (no View As) stays.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { StaticGroup } from '../../types';
import { useViewAsStore, type ViewAsUserInfo } from '../../stores/viewAsStore';

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({ updateGroup: vi.fn(), deleteGroup: vi.fn() }),
}));

import { StaticTab } from './StaticTab';

function makeGroup(overrides: Partial<StaticGroup> = {}): StaticGroup {
  return {
    id: 'g1',
    name: 'Test Static',
    shareCode: 'ABC123',
    isPublic: false,
    ownerId: 'owner-1',
    userRole: 'owner',
    settings: {},
    ...overrides,
  } as StaticGroup;
}

function viewingAs(role: ViewAsUserInfo['role']): ViewAsUserInfo {
  return {
    userId: 'u2',
    discordUsername: 'viewed',
    displayName: 'Viewed',
    avatarUrl: null,
    groupId: 'g1',
    groupName: 'Test Static',
    isMember: role !== null,
    role,
    isLinkedPlayer: false,
    linkedPlayerId: null,
    linkedPlayerName: null,
  };
}

function renderTab(group: StaticGroup) {
  return render(
    <MemoryRouter>
      <StaticTab group={group} onClose={() => {}} />
    </MemoryRouter>
  );
}

describe('StaticTab — Delete Static under View As (D-50)', () => {
  afterEach(() => {
    useViewAsStore.setState({ viewAsUser: null, isLoading: false, error: null });
  });

  it('shows Delete Static for an owner group with no View As', () => {
    renderTab(makeGroup());
    expect(screen.getByRole('button', { name: /Delete Static/ })).toBeInTheDocument();
  });

  it('hides Delete Static for the same group under View As', () => {
    useViewAsStore.setState({ viewAsUser: viewingAs('owner') });
    renderTab(makeGroup());
    expect(screen.queryByRole('button', { name: /Delete Static/ })).toBeNull();
  });

  it('keeps Delete Static for admin-mode moderation (isAdminAccess, no View As)', () => {
    renderTab(makeGroup({ userRole: 'owner', isAdminAccess: true }));
    expect(screen.getByRole('button', { name: /Delete Static/ })).toBeInTheDocument();
  });

  it('hides Delete Static for an admin-access group that also has View As set (?adminMode&viewAs)', () => {
    useViewAsStore.setState({ viewAsUser: viewingAs('member') });
    renderTab(makeGroup({ userRole: 'owner', isAdminAccess: true }));
    expect(screen.queryByRole('button', { name: /Delete Static/ })).toBeNull();
  });

  it('hides Delete Static when the raw virtual owner role is viewed as a member (any role)', () => {
    useViewAsStore.setState({ viewAsUser: viewingAs('member') });
    renderTab(makeGroup({ userRole: 'owner' }));
    expect(screen.queryByRole('button', { name: /Delete Static/ })).toBeNull();
  });
});
