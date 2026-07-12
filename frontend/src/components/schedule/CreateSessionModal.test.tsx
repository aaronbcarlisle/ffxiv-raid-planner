/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateSessionModal } from './CreateSessionModal';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
import type { ScheduleSession, ScheduleSessionCreate } from '../../types';

const baseSession: ScheduleSession = {
  id: 'session-1',
  staticGroupId: 'group-1',
  createdById: 'user-1',
  title: 'Weekly Savage',
  description: 'M4S prog',
  startTime: '2026-06-14T11:00:00Z',
  endTime: '2026-06-14T14:00:00Z',
  timezone: 'Asia/Tokyo',
  isRecurring: true,
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=SA,SU',
  trackAvailability: true,
  category: 'raid',
  contentId: null,
  contentName: null,
  bannerUrl: null,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  rsvps: [],
};

function renderModal(props?: Partial<Parameters<typeof CreateSessionModal>[0]>) {
  const onSubmit = vi.fn<(data: ScheduleSessionCreate) => Promise<void>>().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <CreateSessionModal
      isOpen={true}
      onClose={onClose}
      onSubmit={onSubmit}
      {...props}
    />
  );
  return { onSubmit, onClose };
}

describe('CreateSessionModal', () => {
  it('populates form from editSession including recurrence days', () => {
    renderModal({ editSession: baseSession });

    expect(screen.getByTestId('session-title-input')).toHaveValue('Weekly Savage');

    const satBtn = screen.getByRole('button', { name: 'Sat' });
    const sunBtn = screen.getByRole('button', { name: 'Sun' });
    expect(satBtn.className).toContain('bg-accent');
    expect(sunBtn.className).toContain('bg-accent');
  });

  it('submits updated recurrenceRule when a day is removed', async () => {
    const { onSubmit } = renderModal({ editSession: baseSession });

    const sunBtn = screen.getByRole('button', { name: 'Sun' });
    fireEvent.click(sunBtn);

    expect(screen.getByText('Every Sat')).toBeInTheDocument();

    const submitBtn = screen.getByTestId('session-submit-btn');
    fireEvent.click(submitBtn);

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=SA');
    expect(submitted.isRecurring).toBe(true);
  });

  it('hides initial RSVP field when editing an existing session', () => {
    renderModal({ editSession: baseSession });
    expect(screen.queryByTestId('initial-rsvp-field')).toBeNull();
  });

  it('shows initial RSVP field when creating a new session', () => {
    renderModal();
    expect(screen.getByTestId('initial-rsvp-field')).toBeInTheDocument();
  });

  it('respects trackAvailability toggle', () => {
    renderModal({ editSession: { ...baseSession, trackAvailability: true } });

    expect(screen.getByText('Track availability')).toBeInTheDocument();
    expect(screen.getByText(/Members are expected to mark/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Track availability'));
    expect(screen.getByText(/fixed sessions where attendance is expected/)).toBeInTheDocument();
  });

  it('seeds the recurrence day from the chosen start date for a new session', () => {
    renderModal();

    fireEvent.change(screen.getByTestId('session-start-input'), {
      target: { value: '2026-07-09T20:00' }, // Thursday
    });
    fireEvent.click(screen.getByText('Recurring weekly'));

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sat' }).className).not.toContain('bg-accent');
  });

  it('re-seeds the day when the start date changes while the picker is untouched', () => {
    renderModal();
    fireEvent.click(screen.getByText('Recurring weekly'));

    const startInput = screen.getByTestId('session-start-input');
    fireEvent.change(startInput, { target: { value: '2026-07-09T20:00' } }); // Thursday
    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');

    fireEvent.change(startInput, { target: { value: '2026-07-10T20:00' } }); // Friday
    expect(screen.getByRole('button', { name: 'Fri' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Thu' }).className).not.toContain('bg-accent');
  });

  it('stops re-seeding after the user manually toggles a day', () => {
    renderModal();
    fireEvent.click(screen.getByText('Recurring weekly'));

    const startInput = screen.getByTestId('session-start-input');
    fireEvent.change(startInput, { target: { value: '2026-07-09T20:00' } }); // Thursday → TH seeded
    fireEvent.click(screen.getByRole('button', { name: 'Mon' })); // manual pick → picker is dirty

    fireEvent.change(startInput, { target: { value: '2026-07-10T20:00' } }); // Friday — must NOT re-seed

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Mon' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Fri' }).className).not.toContain('bg-accent');
  });

  it('seeds from an initialDraft start date on open', () => {
    const draft: ScheduleSessionCreate = {
      title: 'Prog Night',
      startTime: '2026-07-09T11:00:00Z', // Thu Jul 9 2026 8 PM JST
      endTime: '2026-07-09T14:00:00Z',
      timezone: 'Asia/Tokyo',
      isRecurring: true,
      recurrenceRule: null,
    };
    renderModal({ initialDraft: draft });

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sat' }).className).not.toContain('bg-accent');
  });

  it('keeps rule-derived days when editing, even after the start date changes', () => {
    renderModal({ editSession: baseSession }); // BYDAY=SA,SU

    fireEvent.change(screen.getByTestId('session-start-input'), {
      target: { value: '2026-07-09T20:00' }, // Thursday
    });

    expect(screen.getByRole('button', { name: 'Sat' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sun' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Thu' }).className).not.toContain('bg-accent');
  });

  it('seeds from the start date when editing a rule with no explicit BYDAY', () => {
    // A bare FREQ=WEEKLY rule (legacy/API-created) recurs on DTSTART's weekday —
    // the picker must seed that weekday, not the 'SA' literal, or saving the
    // edit would silently convert the session's recurrence to Saturday.
    renderModal({
      editSession: {
        ...baseSession,
        startTime: '2026-07-09T11:00:00Z', // Thu Jul 9 2026 8 PM JST
        endTime: '2026-07-09T14:00:00Z',
        recurrenceRule: 'FREQ=WEEKLY', // no BYDAY
      },
    });

    expect(screen.getByRole('button', { name: 'Thu' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'Sat' }).className).not.toContain('bg-accent');
  });
});
