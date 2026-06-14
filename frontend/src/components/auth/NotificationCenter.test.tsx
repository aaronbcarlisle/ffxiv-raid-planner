/**
 * NotificationCenter unit tests.
 *
 * Verifies:
 *   - Renders notification list with title, body, and timestamp
 *   - Clicking a notification calls markRead
 *   - "Mark all read" button calls markAllRead
 *   - Empty state renders "No notifications" when list is empty
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCenter } from './NotificationCenter';
import type { AppNotification } from '../../stores/notificationStore';

// ── Store mock ────────────────────────────────────────────────────────────────

const markRead = vi.fn().mockResolvedValue(undefined);
const markAllRead = vi.fn().mockResolvedValue(undefined);
const fetchNotifications = vi.fn().mockResolvedValue(undefined);

const notificationStoreState = {
  notifications: [] as AppNotification[],
  unreadCount: 0,
  loading: false,
  error: null as string | null,
  markRead,
  markAllRead,
  fetchNotifications,
};

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => notificationStoreState,
}));

vi.mock('../../stores/staticGroupStore', () => ({
  useStaticGroupStore: () => ({
    currentGroup: null,
  }),
}));

// ── React Router mock — avoid needing MemoryRouter ────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// ── Modal: render children + footer directly (no portals) ────────────────────
vi.mock('../ui/Modal', () => ({
  Modal: ({
    isOpen,
    children,
    footer,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-body">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
      </div>
    ) : null,
}));

// ── Primitives: render a real button so fireEvent works ───────────────────────
vi.mock('../primitives', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

// ── releaseNotes: empty so synthetic notifications stay absent ────────────────
vi.mock('../../data/releaseNotes', () => ({
  RELEASES: [],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'notif-1',
    notification_type: 'suggestion_vote',
    title: 'Someone voted on your suggestion',
    body: 'Voted "Want" on "Farm BiS"',
    href: '/group/ABC123?tab=goals',
    is_read: false,
    created_at: new Date(Date.now() - 60000).toISOString(),
    ...overrides,
  };
}

function renderCenter(props: { isOpen?: boolean; onClose?: () => void } = {}) {
  return render(
    <NotificationCenter
      isOpen={props.isOpen ?? true}
      onClose={props.onClose ?? vi.fn()}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationStoreState.notifications = [];
    notificationStoreState.unreadCount = 0;
    notificationStoreState.loading = false;
    notificationStoreState.error = null;
    // Clear localStorage synthetic read state
    localStorage.clear();
  });

  it('renders notification list with title and body', () => {
    notificationStoreState.notifications = [makeNotification()];
    notificationStoreState.unreadCount = 1;

    renderCenter();

    expect(screen.getByText('Someone voted on your suggestion')).toBeInTheDocument();
    expect(screen.getByText('Voted "Want" on "Farm BiS"')).toBeInTheDocument();
  });

  it('clicking a notification calls markRead with notification id', async () => {
    const notif = makeNotification({ id: 'notif-abc', is_read: false });
    notificationStoreState.notifications = [notif];
    notificationStoreState.unreadCount = 1;

    renderCenter();

    const title = screen.getByText('Someone voted on your suggestion');
    // The notification row is the parent element with onClick
    fireEvent.click(title.closest('[role="button"]') ?? title);

    expect(markRead).toHaveBeenCalledWith('notif-abc');
  });

  it('mark all read button calls markAllRead', () => {
    notificationStoreState.notifications = [makeNotification({ is_read: false })];
    notificationStoreState.unreadCount = 1;

    renderCenter();

    const markAllBtn = screen.getByText(/mark all read/i);
    fireEvent.click(markAllBtn);

    expect(markAllRead).toHaveBeenCalled();
  });

  it('renders empty state when notifications list is empty', () => {
    notificationStoreState.notifications = [];
    notificationStoreState.unreadCount = 0;

    renderCenter();

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('does not render mark-all-read button when there are no unread notifications', () => {
    notificationStoreState.notifications = [makeNotification({ is_read: true })];
    notificationStoreState.unreadCount = 0;

    renderCenter();

    expect(screen.queryByText(/mark all read/i)).not.toBeInTheDocument();
  });

  it('shows relative timestamp on notification', () => {
    notificationStoreState.notifications = [
      makeNotification({ created_at: new Date(Date.now() - 120000).toISOString() }),
    ];
    notificationStoreState.unreadCount = 1;

    renderCenter();

    // "2m ago" for a 2-minute-old notification
    expect(screen.getByText('2m ago')).toBeInTheDocument();
  });

  it('does not call markRead when clicking an already-read notification', () => {
    notificationStoreState.notifications = [makeNotification({ is_read: true })];
    notificationStoreState.unreadCount = 0;

    renderCenter();

    const title = screen.getByText('Someone voted on your suggestion');
    fireEvent.click(title.closest('[role="button"]') ?? title);

    expect(markRead).not.toHaveBeenCalled();
  });
});
