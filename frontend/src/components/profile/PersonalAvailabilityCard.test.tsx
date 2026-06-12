/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PersonalAvailabilityCard } from './PersonalAvailabilityCard';

const storeState = {
  days: [] as Array<{ dayOfWeek: string; slots: string[]; timezone: string }>,
  isLoading: false,
  fetchPersonalAvailability: vi.fn(),
};

vi.mock('../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: () => storeState,
}));

vi.mock('../../utils/timezone', () => ({
  getBrowserTimezone: () => 'Asia/Tokyo',
}));

describe('PersonalAvailabilityCard', () => {
  beforeEach(() => {
    storeState.days = [];
    storeState.isLoading = false;
    storeState.fetchPersonalAvailability.mockClear();
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

  it('renders helpful empty state and setup CTA', () => {
    render(
      <MemoryRouter>
        <PersonalAvailabilityCard />
      </MemoryRouter>
    );

    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Your personal weekly default')).toBeInTheDocument();
    expect(screen.getByText(/Set your usual availability once/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set availability' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find a static/ })).toHaveAttribute('href', '/discover');
  });

  it('renders configured day count, day chips, and schedule CTA', () => {
    storeState.days = [
      { dayOfWeek: 'MO', slots: ['18:00', '18:30'], timezone: 'Asia/Tokyo' },
      { dayOfWeek: 'TU', slots: [], timezone: 'Asia/Tokyo' },
      { dayOfWeek: 'TH', slots: ['20:00'], timezone: 'Asia/Tokyo' },
    ];

    render(
      <MemoryRouter>
        <PersonalAvailabilityCard
          primaryStatic={{
            id: 'group-1',
            name: 'Narita Top Raid',
            shareCode: 'E1FPZK',
            isPublic: false,
            ownerId: 'user-1',
            memberCount: 8,
            isAdminAccess: false,
            source: 'membership',
            createdAt: '',
            updatedAt: '',
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Days')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit availability' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Use in schedule/ })).toHaveAttribute('href', '/group/E1FPZK?tab=schedule');
  });

  it('opens the availability editor from the card CTA', () => {
    render(
      <MemoryRouter>
        <PersonalAvailabilityCard />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set availability' }));
    expect(screen.getByText('Set your personal weekly default')).toBeInTheDocument();
  });
});
