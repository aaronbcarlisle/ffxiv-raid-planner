/**
 * Unit tests for useViewAsUrlSync — the shared `?viewAs=` URL-sync hook
 * promoted out of GroupView so admin "View As" also works in the v2 shell.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useViewAsUrlSync } from './useViewAsUrlSync';
import { useAuthStore } from '../stores/authStore';
import { useViewAsStore } from '../stores/viewAsStore';
import type { ViewAsUserInfo } from '../stores/viewAsStore';

const authInitialState = useAuthStore.getState();
const viewAsInitialState = useViewAsStore.getState();

function makeViewAsUser(overrides: Partial<ViewAsUserInfo> = {}): ViewAsUserInfo {
  return {
    userId: 'u9',
    discordUsername: 'someone',
    displayName: null,
    avatarUrl: null,
    groupId: 'g1',
    groupName: 'Static',
    isMember: true,
    role: 'member',
    isLinkedPlayer: false,
    linkedPlayerId: null,
    linkedPlayerName: null,
    ...overrides,
  };
}

function setup(initialPath: string, currentGroupId: string | undefined) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
  return renderHook(({ groupId }: { groupId: string | undefined }) => useViewAsUrlSync(groupId), {
    wrapper,
    initialProps: { groupId: currentGroupId },
  });
}

describe('useViewAsUrlSync', () => {
  beforeEach(() => {
    useAuthStore.setState(authInitialState, true);
    useViewAsStore.setState(viewAsInitialState, true);
  });

  afterEach(() => {
    useAuthStore.setState(authInitialState, true);
    useViewAsStore.setState(viewAsInitialState, true);
  });

  it('starts viewAs when ?viewAs= is present, user is admin, groupId is known, and the store is empty', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'admin1', isAdmin: true } as never });
    useViewAsStore.setState({ viewAsUser: null, startViewAs, stopViewAs });

    setup('/?viewAs=u9', 'g1');

    expect(startViewAs).toHaveBeenCalledTimes(1);
    expect(startViewAs).toHaveBeenCalledWith('g1', 'u9');
  });

  it('does not call startViewAs again when the store already matches the URL', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'admin1', isAdmin: true } as never });
    useViewAsStore.setState({ viewAsUser: makeViewAsUser({ userId: 'u9', groupId: 'g1' }), startViewAs, stopViewAs });

    setup('/?viewAs=u9', 'g1');

    expect(startViewAs).not.toHaveBeenCalled();
  });

  it('stops viewAs when the param is absent but the store is set', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'admin1', isAdmin: true } as never });
    useViewAsStore.setState({ viewAsUser: makeViewAsUser(), startViewAs, stopViewAs });

    setup('/', 'g1');

    expect(stopViewAs).toHaveBeenCalled();
  });

  it('never starts viewAs for a non-admin user', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'member1', isAdmin: false } as never });
    useViewAsStore.setState({ viewAsUser: null, startViewAs, stopViewAs });

    setup('/?viewAs=u9', 'g1');

    expect(startViewAs).not.toHaveBeenCalled();
  });

  it('stops viewAs when the current group changes out from under the stored viewAs group', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'admin1', isAdmin: true } as never });
    useViewAsStore.setState({ viewAsUser: makeViewAsUser({ groupId: 'g1' }), startViewAs, stopViewAs });

    const { rerender } = setup('/?viewAs=u9', 'g1');
    stopViewAs.mockClear();

    rerender({ groupId: 'g2' });

    expect(stopViewAs).toHaveBeenCalled();
  });

  it('stops viewAs on unmount', () => {
    const startViewAs = vi.fn();
    const stopViewAs = vi.fn();
    useAuthStore.setState({ user: { id: 'admin1', isAdmin: true } as never });
    useViewAsStore.setState({ viewAsUser: null, startViewAs, stopViewAs });

    const { unmount } = setup('/', 'g1');
    stopViewAs.mockClear();

    unmount();

    expect(stopViewAs).toHaveBeenCalled();
  });
});
