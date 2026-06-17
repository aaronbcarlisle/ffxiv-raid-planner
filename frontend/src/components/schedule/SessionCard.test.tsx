import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCard } from './SessionCard';
import type { ScheduleSession } from '../../types';

const baseSession: ScheduleSession = {
  id: 'session-1',
  staticGroupId: 'group-1',
  createdById: 'user-1',
  title: 'Ultimate Night',
  description: null,
  startTime: '2099-07-05T12:00:00+00:00',
  endTime: '2099-07-05T15:00:00+00:00',
  timezone: 'UTC',
  isRecurring: false,
  recurrenceRule: null,
  trackAvailability: true,
  category: 'ultimate',
  contentId: 'ult-fru',
  contentName: 'Futures Rewritten (Ultimate)',
  bannerUrl: null,
  createdAt: '2099-07-01T00:00:00+00:00',
  updatedAt: '2099-07-01T00:00:00+00:00',
  rsvps: [],
};

describe('SessionCard', () => {
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

  it('renders Ultimate as a first-class schedule category', () => {
    render(
      <SessionCard
        session={baseSession}
        canManage={false}
        canRsvp={false}
        onRsvp={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Ultimate')).toBeInTheDocument();
    expect(screen.getByText('Futures Rewritten (Ultimate)')).toBeInTheDocument();
  });

  it('does not show RSVP pressure when availability tracking is disabled', () => {
    render(
      <SessionCard
        session={{ ...baseSession, trackAvailability: false }}
        canManage={false}
        canRsvp
        onRsvp={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Availability not required')).toBeInTheDocument();
    expect(screen.queryByTestId('rsvp-available')).not.toBeInTheDocument();
    expect(screen.queryByText(/short/i)).not.toBeInTheDocument();
  });
});
