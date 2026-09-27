/**
 * FinderCard — header (Task 2) + body (Task 3, R-SF-N/P): objective tags,
 * description, members, reason rows, the "Your time:" line, Looking for,
 * the footer (Copy link / Updated) and View static.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FinderCard } from './FinderCard';
import type { FinderItem, FitV2 } from './types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: { id: 'u1' } }),
}));
vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector: (s: { myRequests: unknown[]; cancelRequest: () => void }) => unknown) =>
    selector({ myRequests: [], cancelRequest: vi.fn() }),
}));

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

function fitV2(overrides: Partial<FitV2> = {}): FitV2 {
  return {
    tier: 'strong', missing: [],
    role: { status: 'match', matchedJob: 'DRG', matchedRole: 'melee', priority: 'needed', isMain: true, asRole: null },
    schedule: { status: 'match', basis: 'time', nights: [] },
    reasons: [],
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof FinderCard>[0]> = {}) {
  return render(
    <MemoryRouter>
      <FinderCard item={item()} onRequestJoin={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('FinderCard — header (Task 2 baseline)', () => {
  it('renders the name and DC/server', () => {
    renderCard();
    expect(screen.getByText('Twilight Wardens')).toBeInTheDocument();
    expect(screen.getByText('Crystal — Balmung')).toBeInTheDocument();
  });

  it('renders the tier tag from fitV2, with its tone', () => {
    renderCard({ item: item({ fitV2: fitV2({ tier: 'strong' }) }) });
    const tag = screen.getByText('Strong fit');
    expect(tag.className).toMatch(/status-success/);
  });

  it('renders no tier tag when fitV2 is null (guest)', () => {
    renderCard();
    expect(screen.queryByText(/fit$/)).toBeNull();
  });
});

describe('FinderCard — reason rows', () => {
  it('render in API order', () => {
    const reasons: FitV2['reasons'] = [
      { kind: 'comms', status: 'match', params: {} },
      { kind: 'bis', status: 'partial', params: {} },
    ];
    renderCard({ item: item({ fitV2: fitV2({ reasons }) }) });
    const card = screen.getByTestId('finder-card');
    const texts = within(card).getAllByText(/Comms match|Your BiS is partly set/).map(el => el.textContent);
    expect(texts).toEqual(['Comms match', 'Your BiS is partly set']);
  });

  it('a night with coverage: null renders the "Your time:" line and no reason row', () => {
    renderCard({
      item: item({
        fitV2: fitV2({
          schedule: {
            status: 'unknown', basis: 'day',
            nights: [{ day: 'FR', localDay: 'FR', localStart: '20:00', localEnd: '23:00', coverage: null }],
          },
          reasons: [],
        }),
      }),
    });
    expect(screen.getByText('Your time: Fri 8:00 PM–11:00 PM')).toBeInTheDocument();
    expect(screen.queryByText(/Raids/)).toBeNull();
  });
});

describe('FinderCard — members', () => {
  it('hidden at memberCount 0', () => {
    renderCard({ item: item({ memberCount: 0 }) });
    expect(screen.queryByText(/member/)).toBeNull();
  });

  it('shown when memberCount > 0', () => {
    renderCard({ item: item({ memberCount: 3 }) });
    expect(screen.getByText('3 members')).toBeInTheDocument();
  });
});

describe('FinderCard — Looking for', () => {
  it('a needed entry, a nice-to-have entry, and the your-fit mark', () => {
    renderCard({
      item: item({
        recruitingRoles: [
          { role: 'melee', priority: 'needed', jobs: ['DRG'] },
          { role: 'healer', priority: 'nice_to_have', jobs: [] },
        ],
        fitV2: fitV2({ role: { status: 'match', matchedJob: 'DRG', matchedRole: 'melee', priority: 'needed', isMain: true, asRole: null } }),
      }),
    });
    expect(screen.getByText('Melee — your fit')).toBeInTheDocument();
    expect(screen.getByText('Healer (nice to have)')).toBeInTheDocument();
    expect(screen.getByText('DRG')).toBeInTheDocument();
  });

  it('legacy fallback: neededRoles/neededJobs when recruitingRoles is absent', () => {
    renderCard({ item: item({ recruitingRoles: null, neededRoles: ['tank'], neededJobs: ['WAR'] }) });
    expect(screen.getByText('Tank')).toBeInTheDocument();
    expect(screen.getByText('WAR')).toBeInTheDocument();
  });

  it('a malformed entry (no jobs, an unrecognized priority) reads as needed with no job tags (whole-branch review item 8)', () => {
    renderCard({
      item: item({
        recruitingRoles: [{ role: 'caster' }] as unknown as FinderItem['recruitingRoles'],
      }),
    });
    expect(screen.getByText('Caster open')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).toBeNull();
  });
});

describe('FinderCard — Copy link', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('writes the /group/ URL and flips the label for 2s', async () => {
    vi.useFakeTimers();
    renderCard({ item: item({ shareCode: 'xyz789' }) });
    const button = screen.getByRole('button', { name: 'Copy listing link' });
    fireEvent.click(button);
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/group/xyz789`));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument());
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Copy listing link' })).toBeInTheDocument());
    vi.useRealTimers();
  });
});

describe('FinderCard — Updated', () => {
  it('renders "Updated {date}"', () => {
    renderCard({ item: item({ lastUpdated: '2026-01-15T00:00:00Z' }) });
    expect(screen.getByText(new RegExp(`Updated ${new Date('2026-01-15T00:00:00Z').toLocaleDateString()}`))).toBeInTheDocument();
  });
});

describe('FinderCard — Show more/less', () => {
  it('shows the toggle at 121 characters', () => {
    renderCard({ item: item({ description: 'a'.repeat(121) }) });
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('shows no toggle at 120 characters', () => {
    renderCard({ item: item({ description: 'a'.repeat(120) }) });
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('toggles to Show less on click', () => {
    renderCard({ item: item({ description: 'a'.repeat(121) }) });
    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });
});

describe('FinderCard — No details yet', () => {
  it('with no description and no contact', () => {
    renderCard({ item: item({ description: null, contactMethod: null, contactValue: null }) });
    expect(screen.getByText('No details yet. Open the listing to learn more.')).toBeInTheDocument();
  });

  it('not shown when contact info is present', () => {
    renderCard({ item: item({ description: null, contactMethod: 'discord', contactValue: 'foo#1234' }) });
    expect(screen.queryByText('No details yet. Open the listing to learn more.')).toBeNull();
  });
});

describe('FinderCard — Contact', () => {
  it('keeps V1\'s method label, not the value alone (whole-branch review item 10)', () => {
    renderCard({ item: item({ description: null, contactMethod: 'discord', contactValue: 'foo#1234' }) });
    expect(screen.getByText('Discord:')).toBeInTheDocument();
    expect(screen.getByText('foo#1234', { exact: false })).toBeInTheDocument();
  });
});

describe('FinderCard — View static', () => {
  it('calls navigate and renders no <a href>', () => {
    renderCard({ item: item({ shareCode: 'zzz111' }) });
    const link = screen.getByText('View static');
    expect(link.closest('a')).toBeNull();
    fireEvent.click(link);
    expect(mockNavigate).toHaveBeenCalledWith('/group/zzz111');
  });
});
