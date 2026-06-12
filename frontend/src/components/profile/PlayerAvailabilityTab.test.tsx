/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerAvailabilityTab } from './PlayerAvailabilityTab';

const fetchPersonalAvailability = vi.fn();

vi.mock('../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: () => ({
    days: [
      { dayOfWeek: 'TU', slots: ['19:00', '19:30'], timezone: 'Asia/Tokyo' },
      { dayOfWeek: 'TH', slots: ['20:00', '20:30'], timezone: 'Asia/Tokyo' },
    ],
    fetchPersonalAvailability,
  }),
}));

vi.mock('../../utils/timezone', () => ({
  getBrowserTimezone: () => 'Asia/Tokyo',
}));

vi.mock('./PersonalAvailabilityEditor', () => ({
  PersonalAvailabilityEditor: () => <div>Availability editor</div>,
}));

describe('PlayerAvailabilityTab', () => {
  beforeEach(() => {
    fetchPersonalAvailability.mockClear();
  });

  it('uses player-facing copy and shows a multi-static schedule chooser', () => {
    render(
      <MemoryRouter>
        <PlayerAvailabilityTab
          staticGroups={[
            { id: 'static-1', name: 'Weeknight Static', shareCode: 'WKNT01', userRole: 'lead' },
            { id: 'static-2', name: 'Weekend Static', shareCode: 'WKND01', userRole: 'member' },
          ] as never}
        />
      </MemoryRouter>
    );

    expect(fetchPersonalAvailability).toHaveBeenCalled();
    expect(screen.getByText('Typical Availability')).toBeInTheDocument();
    expect(screen.getByText(/Set your usual raid times once/i)).toBeInTheDocument();
    expect(screen.queryByText(/Future\s*-\s*ready/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Choose static schedule/i })).toBeInTheDocument();
  });
});
