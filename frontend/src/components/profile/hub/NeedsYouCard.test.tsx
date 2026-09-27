import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NeedsYouCard } from './NeedsYouCard';
import type { OverviewActionItem, PlayerOverview } from './usePlayerOverview';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

function overviewOf(items: OverviewActionItem[]): PlayerOverview {
  return { statics: [], actionItems: items };
}

const rsvpItem: OverviewActionItem = {
  type: 'rsvp_pending',
  staticId: 's1',
  staticName: 'Weeknight Static',
  title: 'RSVP for Prog Night',
  detail: 'No response yet',
  href: '/group/ABC123?tab=schedule&sessionId=sess-1',
  startsAt: '2026-10-03T18:30:00Z',
};

const lootItem: OverviewActionItem = {
  type: 'loot_priority',
  staticId: 's2',
  staticName: 'Weekend Static',
  title: "You're first in line for 2 drops",
  detail: 'M9S Earring · M10S Head',
  href: '/group/XYZ789?tab=gear',
  startsAt: null,
};

function renderCard(props: Partial<ComponentProps<typeof NeedsYouCard>> = {}) {
  const retry = vi.fn();
  render(
    <MemoryRouter>
      <NeedsYouCard data={null} isLoading={true} error={null} retry={retry} {...props} />
    </MemoryRouter>,
  );
  return { retry };
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('NeedsYouCard — loading', () => {
  it('shows a skeleton while loading', () => {
    renderCard({ data: null, isLoading: true, error: null });
    expect(screen.queryByText(/nothing needs you/i)).toBeNull();
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('a cold frame ({ data: null, error: null, isLoading: false }) shows the skeleton, never the empty state', () => {
    renderCard({ data: null, isLoading: false, error: null });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText(/nothing needs you/i)).toBeNull();
  });
});

describe('NeedsYouCard — error', () => {
  it('shows an error message and Retry calls retry', () => {
    const { retry } = renderCard({ data: null, isLoading: false, error: 'Network error' });
    expect(screen.getByText(/couldn't load what needs you/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    retryBtn.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('an error with stale data keeps the rows (no blanking on a failed refetch)', () => {
    renderCard({ data: overviewOf([rsvpItem]), isLoading: false, error: 'Network error' });
    expect(screen.getByText('RSVP for Prog Night')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load what needs you/i)).toBeNull();
  });
});

describe('NeedsYouCard — empty', () => {
  it('shows the empty state when there are no items', () => {
    renderCard({ data: overviewOf([]), isLoading: false, error: null });
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('an item whose href does not start with /group/ is filtered out; the empty state shows if it is the only one', () => {
    const badItem = { ...lootItem, href: '/discover' };
    renderCard({ data: overviewOf([badItem]), isLoading: false, error: null });
    expect(screen.queryByText(badItem.title)).toBeNull();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });
});

describe('NeedsYouCard — rows', () => {
  it('renders title, static tag, rsvp meta and loot meta, with RSVP / View loot action labels', () => {
    renderCard({ data: overviewOf([rsvpItem, lootItem]), isLoading: false, error: null });

    expect(screen.getByText('RSVP for Prog Night')).toBeInTheDocument();
    expect(screen.getByText('Weeknight Static')).toBeInTheDocument();
    expect(screen.getByText(/No response yet/)).toBeInTheDocument();

    expect(screen.getByText("You're first in line for 2 drops")).toBeInTheDocument();
    expect(screen.getByText('Weekend Static')).toBeInTheDocument();
    expect(screen.getByText('M9S Earring · M10S Head')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'RSVP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View loot' })).toBeInTheDocument();
  });

  it('clicking RSVP navigates with exactly the item href', () => {
    renderCard({ data: overviewOf([rsvpItem]), isLoading: false, error: null });
    screen.getByRole('button', { name: 'RSVP' }).click();
    expect(mockNavigate).toHaveBeenCalledWith(rsvpItem.href);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('clicking View loot navigates with exactly the item href', () => {
    renderCard({ data: overviewOf([lootItem]), isLoading: false, error: null });
    screen.getByRole('button', { name: 'View loot' }).click();
    expect(mockNavigate).toHaveBeenCalledWith(lootItem.href);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('the leading icon slot is aria-hidden and the action is a real button', () => {
    renderCard({ data: overviewOf([rsvpItem]), isLoading: false, error: null });
    const button = screen.getByRole('button', { name: 'RSVP' });
    expect(button.tagName).toBe('BUTTON');
    const hiddenIcon = document.querySelector('[aria-hidden="true"]');
    expect(hiddenIcon).not.toBeNull();
  });
});
