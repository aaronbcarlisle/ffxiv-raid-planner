/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserMenu } from './UserMenu';

vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', discordId: '123456789', discordUsername: 'tester', displayName: 'Tester', isAdmin: false, activityDisplayMode: 'named' },
    logout: vi.fn(), updatePreferences: vi.fn(),
  }),
}));
vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: () => ({ unreadCount: 0, fetchNotifications: vi.fn() }),
}));
vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));
vi.mock('./NotificationCenter', () => ({ NotificationCenter: () => null }));

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
});

describe('UserMenu rail variant', () => {
  it('shows the display name when rail variant is expanded', () => {
    render(<MemoryRouter><UserMenu variant="rail" collapsed={false} /></MemoryRouter>);
    expect(screen.getByText('Tester')).toBeInTheDocument();
  });

  it('hides the display name when rail variant is collapsed', () => {
    render(<MemoryRouter><UserMenu variant="rail" collapsed /></MemoryRouter>);
    expect(screen.queryByText('Tester')).not.toBeInTheDocument();
  });
});
