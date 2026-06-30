/**
 * @vitest-environment jsdom
 *
 * NotificationBell — v2 TopBar bell affordance.
 * Tests: combined badge count, 99+ cap, hidden at 0, click opens NotificationCenter,
 * and join-request fetch replication.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Hoisted mock state (available in vi.mock factories before module eval) ───
const mocks = vi.hoisted(() => ({
  unreadCount: 0,
  syntheticUnread: 0,
  pendingCount: 0,
  currentGroupId: null as string | null,
  canManageInvitations: false,
  fetchGroupRequests: vi.fn(() => Promise.resolve()),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: (selector?: (s: { unreadCount: number }) => unknown) => {
    const state = { unreadCount: mocks.unreadCount };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../lib/syntheticNotifications', () => ({
  useSyntheticUnreadCount: () => mocks.syntheticUnread,
  getSyntheticNotifications: () => [],
  markSyntheticRead: vi.fn(),
  markAllSyntheticRead: vi.fn(),
  subscribeSyntheticNotifications: vi.fn(() => () => {}),
  getSyntheticUnreadCount: () => mocks.syntheticUnread,
}));

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: Object.assign(
    (selector?: (s: { pendingCount: number }) => unknown) => {
      const state = { pendingCount: mocks.pendingCount };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ fetchGroupRequests: mocks.fetchGroupRequests }) }
  ),
}));

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: (selector?: (s: { currentGroup: { id: string } | null }) => unknown) => {
    const state = {
      currentGroup: mocks.currentGroupId ? { id: mocks.currentGroupId, shareCode: 'TEST' } : null,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../hooks/useStaticPermissions', () => ({
  useStaticPermissions: () => ({ canManageInvitations: mocks.canManageInvitations }),
}));

// Lightweight NotificationCenter stub — avoids its full dependency chain.
vi.mock('../auth/NotificationCenter', () => ({
  NotificationCenter: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="notification-center-modal" /> : null,
}));

// ── Tests ────────────────────────────────────────────────────────────────────

import { NotificationBell } from './NotificationBell';

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
    }))
  );
  // Reset state for each test
  mocks.unreadCount = 0;
  mocks.syntheticUnread = 0;
  mocks.pendingCount = 0;
  mocks.currentGroupId = null;
  mocks.canManageInvitations = false;
  mocks.fetchGroupRequests.mockClear();
});

describe('NotificationBell', () => {
  it('renders a bell button with aria-label "Notifications"', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows combined badge: unreadCount + syntheticUnread + pendingCount', () => {
    mocks.unreadCount = 2;
    mocks.syntheticUnread = 1;
    mocks.pendingCount = 3;
    const { container } = render(<NotificationBell />);
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('6');
  });

  it('caps the badge at "99+" when total exceeds 99', () => {
    mocks.unreadCount = 50;
    mocks.syntheticUnread = 30;
    mocks.pendingCount = 25;
    const { container } = render(<NotificationBell />);
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('99+');
  });

  it('hides the badge when total is 0', () => {
    const { container } = render(<NotificationBell />);
    expect(container.querySelector('.bg-status-error')).toBeNull();
  });

  it('clicking the bell opens the NotificationCenter modal', () => {
    render(<NotificationBell />);
    expect(screen.queryByTestId('notification-center-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByTestId('notification-center-modal')).toBeInTheDocument();
  });

  it('fetches join requests when canManageInvitations and currentGroup are set', () => {
    mocks.canManageInvitations = true;
    mocks.currentGroupId = 'group-1';
    render(<NotificationBell />);
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('group-1');
  });

  it('does not fetch join requests when canManageInvitations is false', () => {
    mocks.canManageInvitations = false;
    mocks.currentGroupId = 'group-1';
    render(<NotificationBell />);
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
  });
});
