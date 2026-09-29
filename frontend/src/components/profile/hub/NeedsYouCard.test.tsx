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

const bisItem: OverviewActionItem = {
  type: 'bis_stale',
  staticId: 's3',
  staticName: 'Prog Static',
  title: 'Your BiS may be out of date',
  detail: '2 items logged since your BiS was last updated',
  href: '/profile?tab=characters',
  startsAt: null,
};

const joinRequestsItem: OverviewActionItem = {
  type: 'join_requests',
  staticId: 's5',
  staticName: 'Recruit Static',
  title: '2 join requests waiting',
  detail: 'Applicants are waiting on a decision',
  href: '/group/abc/recruit',
  startsAt: null,
};

function renderCard(props: Partial<ComponentProps<typeof NeedsYouCard>> = {}) {
  const retry = vi.fn();
  render(
    <MemoryRouter>
      <NeedsYouCard data={null} error={null} retry={retry} {...props} />
    </MemoryRouter>,
  );
  return { retry };
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('NeedsYouCard — loading', () => {
  it('a cold frame ({ data: null, error: null }, before the first response lands) shows the skeleton, never the empty state', () => {
    renderCard({ data: null, error: null });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText(/nothing needs you/i)).toBeNull();
  });

  it('renders exactly two skeleton placeholder rows', () => {
    renderCard({ data: null, error: null });
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(2);
  });
});

describe('NeedsYouCard — error', () => {
  it('shows an error message and Retry calls retry', () => {
    const { retry } = renderCard({ data: null, error: 'Network error' });
    expect(screen.getByText(/couldn't load what needs you/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    retryBtn.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('an error with stale data keeps the rows (no blanking on a failed refetch)', () => {
    renderCard({ data: overviewOf([rsvpItem]), error: 'Network error' });
    expect(screen.getByText('RSVP for Prog Night')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load what needs you/i)).toBeNull();
  });
});

describe('NeedsYouCard — empty', () => {
  it('shows the empty state when there are no items', () => {
    renderCard({ data: overviewOf([]), error: null });
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('an item whose href does not start with /group/ is filtered out; the empty state shows if it is the only one', () => {
    const badItem = { ...lootItem, href: '/discover' };
    renderCard({ data: overviewOf([badItem]), error: null });
    expect(screen.queryByText(badItem.title)).toBeNull();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('an item of a type the card does not know renders no row and no button', () => {
    // A future backend type the card has not learned yet; the union does not
    // include it, hence the cast. `join_requests` is now a known type (RH1d).
    const unknownItem = {
      ...lootItem,
      type: 'mystery_type',
      title: 'Something unfamiliar',
      detail: 'Recruit Static',
      href: '/group/XYZ789/recruit',
    } as unknown as OverviewActionItem;

    renderCard({ data: overviewOf([unknownItem]), error: null });
    expect(screen.queryByText('Something unfamiliar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('an unknown-type item is dropped while a known type next to it still renders', () => {
    const unknownItem = {
      ...lootItem,
      type: 'mystery_type',
      title: 'Something unfamiliar',
      href: '/group/XYZ789/recruit',
    } as unknown as OverviewActionItem;

    renderCard({ data: overviewOf([unknownItem, rsvpItem]), error: null });
    expect(screen.getByText('RSVP for Prog Night')).toBeInTheDocument();
    expect(screen.queryByText('Something unfamiliar')).toBeNull();
    // Exactly one action button, and it is the labelled one.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('RSVP');
  });

  it('shows the empty-state description naming RSVPs, loot and out-of-date BiS', () => {
    renderCard({ data: overviewOf([]), error: null });
    expect(
      screen.getByText("Session RSVPs, loot you're first in line for and out-of-date BiS show up here."),
    ).toBeInTheDocument();
  });
});

describe('NeedsYouCard — rows', () => {
  it('renders title, static tag, rsvp meta and loot meta, with RSVP / View loot action labels', () => {
    renderCard({ data: overviewOf([rsvpItem, lootItem]), error: null });

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
    renderCard({ data: overviewOf([rsvpItem]), error: null });
    screen.getByRole('button', { name: 'RSVP' }).click();
    expect(mockNavigate).toHaveBeenCalledWith(rsvpItem.href);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('clicking View loot navigates with exactly the item href', () => {
    renderCard({ data: overviewOf([lootItem]), error: null });
    screen.getByRole('button', { name: 'View loot' }).click();
    expect(mockNavigate).toHaveBeenCalledWith(lootItem.href);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('the leading icon slot is aria-hidden and the action is a real button', () => {
    renderCard({ data: overviewOf([rsvpItem]), error: null });
    const button = screen.getByRole('button', { name: 'RSVP' });
    expect(button.tagName).toBe('BUTTON');
    // Scoped to the row itself (AttentionRow's `div.flex.items-center.gap-3.py-2`),
    // not the CardShell header's own aria-hidden BellRing icon, which is always
    // present and would satisfy an unscoped query regardless of the row's markup.
    const row = button.closest('.py-2') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders a bis_stale row with its title, static tag, detail as meta and a Review BiS button', () => {
    renderCard({ data: overviewOf([bisItem]), error: null });

    expect(screen.getByText('Your BiS may be out of date')).toBeInTheDocument();
    expect(screen.getByText('Prog Static')).toBeInTheDocument();
    expect(screen.getByText('2 items logged since your BiS was last updated')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Review BiS' });
    button.click();
    expect(mockNavigate).toHaveBeenCalledWith(bisItem.href);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('two bis_stale items sharing the same href both render (two Review BiS buttons)', () => {
    const second = { ...bisItem, staticId: 's4', staticName: 'Other Static', title: 'Your BiS may be out of date' };
    renderCard({ data: overviewOf([bisItem, second]), error: null });

    expect(screen.getAllByRole('button', { name: 'Review BiS' })).toHaveLength(2);
    expect(screen.getByText('Prog Static')).toBeInTheDocument();
    expect(screen.getByText('Other Static')).toBeInTheDocument();
  });

  it('renders a join_requests row with its title, static tag, detail as meta and a Review button, linking to /group/abc/recruit', () => {
    renderCard({ data: overviewOf([joinRequestsItem]), error: null });

    expect(screen.getByText('2 join requests waiting')).toBeInTheDocument();
    expect(screen.getByText('Recruit Static')).toBeInTheDocument();
    expect(screen.getByText('Applicants are waiting on a decision')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Review' });
    button.click();
    expect(mockNavigate).toHaveBeenCalledWith('/group/abc/recruit');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
