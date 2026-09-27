/**
 * FinderCard — minimal V2 card (name, DC/server, tier Tag).
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinderCard } from './FinderCard';
import type { FinderItem } from './types';

function item(overrides: Partial<FinderItem> = {}): FinderItem {
  return {
    name: 'Twilight Wardens',
    shareCode: 'abc123',
    recruitmentStatus: 'open',
    description: null,
    contactMethod: null,
    contactValue: null,
    neededRoles: null,
    neededJobs: null,
    scheduleDays: null,
    scheduleStartTime: null,
    scheduleEndTime: null,
    timezone: null,
    languages: null,
    intensity: null,
    dataCenter: 'Crystal',
    server: 'Balmung',
    memberCount: 0,
    lastUpdated: null,
    recruitingRoles: null,
    communicationStyle: null,
    objectiveCategories: [],
    goalAlignment: null,
    fitSummary: null,
    fitV2: null,
    ...overrides,
  };
}

describe('FinderCard', () => {
  it('renders the name and DC/server', () => {
    render(<FinderCard item={item()} />);
    expect(screen.getByText('Twilight Wardens')).toBeInTheDocument();
    expect(screen.getByText('Crystal — Balmung')).toBeInTheDocument();
  });

  it('renders the tier tag from fitV2', () => {
    render(<FinderCard item={item({
      fitV2: {
        tier: 'strong', missing: [],
        role: { status: 'match', matchedJob: 'DRG', matchedRole: null, priority: 'needed', isMain: true, asRole: null },
        schedule: { status: 'match', basis: 'time', nights: [] },
        reasons: [],
      },
    })} />);
    expect(screen.getByText('Strong fit')).toBeInTheDocument();
  });

  it('renders no tier tag when fitV2 is null (guest)', () => {
    render(<FinderCard item={item()} />);
    expect(screen.queryByText(/fit$/)).toBeNull();
  });
});
