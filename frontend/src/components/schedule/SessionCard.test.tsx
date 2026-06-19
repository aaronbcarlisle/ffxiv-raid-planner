import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCard } from './SessionCard';
import type { ScheduleSession } from '../../types';

// Mock the schedule store so createException doesn't hit the network
vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: () => ({ createException: vi.fn().mockResolvedValue(undefined) }),
}));

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

  describe('recurring session behavior', () => {
    // A session that started weekly on Thursdays in the past — next occurrence
    // should be computed from today, NOT from 2020-01-02.
    const recurringSession: ScheduleSession = {
      ...baseSession,
      startTime: '2020-01-02T20:00:00Z', // A past Thursday
      endTime: '2020-01-02T23:00:00Z',
      isRecurring: true,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
    };

    it('does NOT show the raw 2020-01-02 start date as the primary date', () => {
      render(
        <SessionCard
          session={recurringSession}
          canManage={false}
          canRsvp={false}
          groupId="group-1"
          onRsvp={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      // The original creation year (2020) should not be the primary date shown
      // (it may appear in aria-labels etc., but not as the displayed session date)
      const jan2020 = screen.queryByText(/jan.*2020/i);
      expect(jan2020).toBeNull();
    });

    it('clicking delete on a recurring session opens the choice modal', () => {
      render(
        <SessionCard
          session={recurringSession}
          canManage
          canRsvp={false}
          groupId="group-1"
          onRsvp={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Click the delete / trash button
      const deleteBtn = screen.getByRole('button', { name: /delete|trash|remove/i });
      fireEvent.click(deleteBtn);

      // Recurring choice modal should open
      expect(screen.getByText('Recurring Session')).toBeInTheDocument();
      expect(screen.getByText(/Delete entire series/i)).toBeInTheDocument();
      expect(screen.getByText(/Cancel.*only/i)).toBeInTheDocument();
    });

    it('"Delete entire series" calls onDelete with the session id', () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <SessionCard
          session={recurringSession}
          canManage
          canRsvp={false}
          groupId="group-1"
          onRsvp={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete|trash|remove/i });
      fireEvent.click(deleteBtn);
      fireEvent.click(screen.getByText(/Delete entire series/i));

      expect(onDelete).toHaveBeenCalledWith(recurringSession.id);
    });

    it('non-recurring delete goes straight to existing confirm modal without choice', () => {
      const onDelete = vi.fn();
      render(
        <SessionCard
          session={{ ...baseSession, isRecurring: false, recurrenceRule: null }}
          canManage
          canRsvp={false}
          groupId="group-1"
          onRsvp={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      );

      const deleteBtn = screen.getByRole('button', { name: /delete|trash|remove/i });
      fireEvent.click(deleteBtn);

      // Should NOT see the recurring choice modal
      expect(screen.queryByText('Recurring Session')).toBeNull();
    });
  });
});
