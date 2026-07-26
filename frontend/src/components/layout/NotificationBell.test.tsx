/**
 * @vitest-environment jsdom
 *
 * NotificationBell — v2 TopBar bell affordance.
 * Tests: combined badge count, 99+ cap, hidden at 0, click calls onOpen,
 * a11y label includes count, join-request fetch replication, and (Stage-1 T4 /
 * RC5) the ROUTE gate on the pending-join-request contribution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Hoisted mock state (available in vi.mock factories before module eval) ───
const mocks = vi.hoisted(() => ({
  unreadCount: 0,
  syntheticUnread: 0,
  pendingCount: 0,
  currentGroupId: null as string | null,
  canManageInvitations: false,
  fetchGroupRequests: vi.fn(() => Promise.resolve()),
  onOpen: vi.fn(),
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

// ── Tests ────────────────────────────────────────────────────────────────────

import { NotificationBell } from './NotificationBell';

/** The bell now reads the route (RC5), so every render needs a router. The
 *  default is a group route: that is where the pendingCount contribution is
 *  live, which is what the pre-existing rows below assert. */
function renderBell(path = `/group/TEST`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotificationBell onOpen={mocks.onOpen} />
    </MemoryRouter>,
  );
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
    }))
  );
  // Reset state for each test
  mocks.unreadCount = 0;
  mocks.syntheticUnread = 0;
  mocks.pendingCount = 0;
  mocks.currentGroupId = null;
  mocks.canManageInvitations = false;
  mocks.fetchGroupRequests.mockClear();
  mocks.onOpen.mockClear();
});

describe('NotificationBell', () => {
  it('renders a bell button with aria-label "Notifications" when count is zero', () => {
    renderBell();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows combined badge: unreadCount + syntheticUnread + pendingCount', () => {
    mocks.unreadCount = 2;
    mocks.syntheticUnread = 1;
    mocks.pendingCount = 3;
    const { container } = renderBell();
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('6');
  });

  it('caps the badge at "99+" when total exceeds 99', () => {
    mocks.unreadCount = 50;
    mocks.syntheticUnread = 30;
    mocks.pendingCount = 25;
    const { container } = renderBell();
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('99+');
  });

  it('hides the badge when total is 0', () => {
    const { container } = renderBell();
    expect(container.querySelector('.bg-status-error')).toBeNull();
  });

  it('folds the unread count into aria-label when total > 0', () => {
    mocks.unreadCount = 3;
    renderBell();
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('uses "99+ unread" in aria-label when total exceeds 99', () => {
    mocks.unreadCount = 100;
    renderBell();
    expect(screen.getByRole('button', { name: 'Notifications, 99+ unread' })).toBeInTheDocument();
  });

  it('clicking the bell calls onOpen', () => {
    renderBell();
    expect(mocks.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(mocks.onOpen).toHaveBeenCalledTimes(1);
  });

  it('fetches join requests when canManageInvitations and currentGroup are set', () => {
    mocks.canManageInvitations = true;
    mocks.currentGroupId = 'group-1';
    renderBell();
    expect(mocks.fetchGroupRequests).toHaveBeenCalledWith('group-1');
  });

  it('does not fetch join requests when canManageInvitations is false', () => {
    mocks.canManageInvitations = false;
    mocks.currentGroupId = 'group-1';
    renderBell();
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
  });
});

/**
 * RC5 — the pending-join-request contribution is gated on the ROUTE, not on
 * `currentGroup`. The store keeps both `currentGroup` and `pendingCount` after
 * you leave a static, so a currentGroup-keyed gate would still show a stale,
 * untappable badge on /profile (matrix H7). These rows fix that in place.
 */
describe('NotificationBell — off-group join-request gating (RC5)', () => {
  it('drops the pendingCount contribution off-group even with a stale currentGroup', () => {
    mocks.unreadCount = 2;
    mocks.pendingCount = 5;
    mocks.currentGroupId = 'group-1'; // never cleared on navigation — the leak
    const { container } = renderBell('/profile');
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('2');
  });

  it('shows no badge at all off-group when join requests are the only source', () => {
    mocks.pendingCount = 4;
    mocks.currentGroupId = 'group-1';
    const { container } = renderBell('/profile');
    expect(container.querySelector('.bg-status-error')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('keeps the pendingCount contribution in-static', () => {
    mocks.pendingCount = 4;
    mocks.currentGroupId = 'group-1';
    const { container } = renderBell('/group/TEST');
    expect(container.querySelector('.bg-status-error')).toHaveTextContent('4');
  });

  it('does not refetch group join requests off-group', () => {
    mocks.canManageInvitations = true;
    mocks.currentGroupId = 'group-1';
    renderBell('/profile');
    expect(mocks.fetchGroupRequests).not.toHaveBeenCalled();
  });
});
