/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityFeedCard } from './ActivityFeed';
import type { ActivityItem } from './ActivityFeed';

const baseItem = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: 'item-1',
  type: 'application_submitted',
  title: 'Application sent',
  subtitle: 'Test Static',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  ...overrides,
});

describe('ActivityFeedCard', () => {
  it('renders empty state when no items', () => {
    render(<ActivityFeedCard items={[]} />);
    expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders notification rows when items present', () => {
    const items = [
      baseItem({ id: '1', type: 'application_submitted', title: 'Application sent', subtitle: 'Omega FC' }),
      baseItem({ id: '2', type: 'application_accepted', title: 'Application accepted', subtitle: 'Crystal Static' }),
    ];
    render(<ActivityFeedCard items={items} />);
    expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
    expect(screen.getByText('Application sent')).toBeInTheDocument();
    expect(screen.getByText('Application accepted')).toBeInTheDocument();
    expect(screen.getByText('Omega FC')).toBeInTheDocument();
    expect(screen.getByText('Crystal Static')).toBeInTheDocument();
  });

  it('does not render private notes or goals text', () => {
    const items = [
      baseItem({ id: '1', title: 'Application sent', subtitle: 'Primal Static' }),
    ];
    render(<ActivityFeedCard items={items} />);
    expect(screen.queryByText(/private notes/i)).toBeNull();
    expect(screen.queryByText(/personal goal/i)).toBeNull();
    expect(screen.queryByText(/goals are never/i)).toBeNull();
  });

  it('shows relative time for items', () => {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const items = [baseItem({ id: '1', createdAt: oneHourAgo })];
    render(<ActivityFeedCard items={items} />);
    expect(screen.getByText('1h ago')).toBeInTheDocument();
  });

  it('renders correct icon context for accepted application', () => {
    const items = [
      baseItem({ id: '1', type: 'application_accepted', title: 'Application accepted' }),
    ];
    render(<ActivityFeedCard items={items} />);
    expect(screen.getByTestId('activity-feed-list')).toBeInTheDocument();
  });

  it('renders schedule upcoming type', () => {
    const items = [
      baseItem({ id: '1', type: 'schedule_upcoming', title: 'M8S Prog', subtitle: 'Sat Jun 14 at 8:00 PM' }),
    ];
    render(<ActivityFeedCard items={items} />);
    expect(screen.getByText('M8S Prog')).toBeInTheDocument();
    expect(screen.getByText('Sat Jun 14 at 8:00 PM')).toBeInTheDocument();
  });

  it('renders gear_sync type', () => {
    const items = [
      baseItem({ id: '1', type: 'gear_sync', title: 'Gear synced', subtitle: 'BRD · iLv 735' }),
    ];
    render(<ActivityFeedCard items={items} />);
    expect(screen.getByText('Gear synced')).toBeInTheDocument();
    expect(screen.getByText('BRD · iLv 735')).toBeInTheDocument();
  });
});
