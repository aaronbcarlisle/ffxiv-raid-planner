/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OverviewTab } from './OverviewTab';
import type { PlayerProfile } from '../../stores/playerProfileStore';

const fetchPersonalAvailability = vi.fn();
const availabilityState = {
  days: [
    { dayOfWeek: 'TU', slots: ['19:00'], timezone: 'Asia/Tokyo' },
    { dayOfWeek: 'WE', slots: ['19:00'], timezone: 'Asia/Tokyo' },
    { dayOfWeek: 'TH', slots: ['19:00'], timezone: 'Asia/Tokyo' },
    { dayOfWeek: 'SA', slots: ['20:00'], timezone: 'Asia/Tokyo' },
  ],
  fetchPersonalAvailability,
};

vi.mock('../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: () => availabilityState,
}));

vi.mock('../../utils/timezone', () => ({
  getBrowserTimezone: () => 'Asia/Tokyo',
}));

const profile: PlayerProfile = {
  id: 'profile-1',
  userId: 'user-1',
  visibility: 'shareable',
  shareCode: 'PLAYER1',
  shareEnabled: true,
  bio: null,
  characters: [{
    id: 'character-1',
    lodestoneId: '123',
    name: 'Rin Applicant',
    server: 'Balmung',
    dataCenter: 'Crystal',
    avatarUrl: null,
    isMain: true,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  }],
  jobProfiles: [{
    id: 'job-1',
    job: 'BRD',
    role: 'ranged',
    priority: 'main',
    readiness: 'ready',
    notes: null,
    gearSnapshotId: null,
    gearSnapshot: null,
    bisTargets: [],
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  }],
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
};

describe('OverviewTab', () => {
  beforeEach(() => {
    fetchPersonalAvailability.mockClear();
  });

  it('shows availability as above-fold command summary data', () => {
    render(
      <MemoryRouter>
        <OverviewTab
          profile={profile}
          goals={[]}
          gearSnapshots={{}}
          collectionSuggestions={[]}
          staticSuggestions={[]}
          onNavigate={vi.fn()}
          onOpenLinkModal={vi.fn()}
          onOpenJobModal={vi.fn()}
          primaryStatic={null}
        />
      </MemoryRouter>
    );

    expect(fetchPersonalAvailability).toHaveBeenCalled();
    expect(screen.getByText('Profile status')).toBeInTheDocument();
    expect(screen.getByText('Ready at a glance')).toBeInTheDocument();
    expect(screen.getAllByText('Collections').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Availability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4 days · 2h').length).toBeGreaterThan(0);
    expect(screen.getByText('Tue / Wed / Thu / Sat')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Availability/i })).toHaveAttribute('href', '/profile?tab=availability');
    expect(screen.queryByText('Rin Applicant')).toBeNull();
    expect(screen.queryByText('Balmung')).toBeNull();
  });

  it('uses multi-static wording instead of primary-static copy', () => {
    render(
      <MemoryRouter>
        <OverviewTab
          profile={profile}
          goals={[]}
          gearSnapshots={{}}
          collectionSuggestions={[]}
          staticSuggestions={[]}
          onNavigate={vi.fn()}
          onOpenLinkModal={vi.fn()}
          onOpenJobModal={vi.fn()}
          primaryStatic={{
            id: 'static-1',
            name: 'Weeknight Static',
            shareCode: 'WKNT01',
            userRole: 'lead',
          } as never}
          staticGroups={[
            { id: 'static-1', name: 'Weeknight Static', shareCode: 'WKNT01', userRole: 'lead' },
            { id: 'static-2', name: 'Weekend Static', shareCode: 'WKND01', userRole: 'member' },
          ] as never}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByText('My Statics (2)').length).toBeGreaterThan(0);
    expect(screen.getByText('Use My Statics menu')).toBeInTheDocument();
    expect(screen.queryByText(/Primary\s+static/i)).toBeNull();
  });
});
