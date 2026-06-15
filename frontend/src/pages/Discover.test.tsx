/**
 * Discover page tests
 *
 * Tests the public static finder / recruitment board.
 * Uses MemoryRouter to satisfy react-router dependency.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Discover } from './Discover';

// ── Mock matchMedia (required by Modal → useDevice) ──────────

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

// ── Mock API ──────────────────────────────────────────────────

const mockAuthRequest = vi.fn();

vi.mock('../services/api', () => ({
  authRequest: (...args: unknown[]) => mockAuthRequest(...args),
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn() },
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { user: null, login: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      myRequests: [],
      fetchMyRequests: vi.fn(),
      cancelRequest: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

// ── Helpers ───────────────────────────────────────────────────

function renderDiscover(initialPath = '/discover') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Discover />
    </MemoryRouter>,
  );
}

const MOCK_ITEMS = [
  {
    name: 'Crystal Raiders',
    shareCode: 'abc123',
    recruitmentStatus: 'open',
    description: 'Friendly midcore static looking for DPS.',
    contactMethod: 'discord',
    contactValue: 'raider#1234',
    neededRoles: ['melee', 'caster'],
    neededJobs: ['MNK'],
    scheduleDays: ['Tuesday', 'Thursday'],
    scheduleStartTime: '20:00',
    scheduleEndTime: '23:00',
    timezone: 'America/New_York',
    languages: ['en'],
    intensity: 'midcore',
    dataCenter: 'Crystal',
    server: 'Balmung',
    memberCount: 6,
    lastUpdated: '2026-05-30T12:00:00Z',
  },
  {
    name: 'Primal Pros',
    shareCode: 'def456',
    recruitmentStatus: 'limited',
    description: null,
    neededRoles: ['healer'],
    memberCount: 0,
    lastUpdated: '2026-05-29T12:00:00Z',
  },
];

// ── Tests ─────────────────────────────────────────────────────

describe('Discover page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading and subheading', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [], total: 0 });

    renderDiscover();

    expect(screen.getByText('Find a Static')).toBeInTheDocument();
    expect(screen.getByText(/Browse public recruitment listings/)).toBeInTheDocument();
  });

  it('shows empty state when no results', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [], total: 0 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('No statics found')).toBeInTheDocument();
    });
    expect(screen.getByText(/No statics are recruiting here yet/)).toBeInTheDocument();
  });

  it('renders search input', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [], total: 0 });

    renderDiscover();

    expect(screen.getByPlaceholderText(/Search by name or description/)).toBeInTheDocument();
  });

  it('renders listing cards with public fields only', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: MOCK_ITEMS, total: 2 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });

    expect(screen.getByText('Primal Pros')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('limited')).toBeInTheDocument();
    expect(screen.getByText('2 listings')).toBeInTheDocument();
  });

  it('does not expose private fields in card output', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: MOCK_ITEMS, total: 2 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });

    // shareCode is used for links but not displayed as text
    expect(screen.queryByText('abc123')).not.toBeInTheDocument();
    expect(screen.queryByText('def456')).not.toBeInTheDocument();
  });

  it('renders structured contact info when provided', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: MOCK_ITEMS, total: 2 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('raider#1234')).toBeInTheDocument();
    });
    expect(screen.getByText('Discord:')).toBeInTheDocument();
  });

  it('renders card sections: Looking For, Raid Nights, About', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [MOCK_ITEMS[0]], total: 1 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    expect(screen.getByText('Looking For')).toBeInTheDocument();
    expect(screen.getByText('Raid Nights')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('shows fallback text when card has no description and no contact', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ name: 'Empty Static', shareCode: 'zzz', recruitmentStatus: 'open', memberCount: 0 }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText(/No details yet/)).toBeInTheDocument();
    });
  });

  it('renders View Static link pointing to group page', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [MOCK_ITEMS[0]], total: 1 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });

    const viewLink = screen.getByText('View Static');
    expect(viewLink.closest('a')).toHaveAttribute('href', '/group/abc123');
  });

  it('renders copy link button with accessible label', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [MOCK_ITEMS[0]], total: 1 });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Copy listing link')).toBeInTheDocument();
  });

  it('renders expandable description for long text', async () => {
    const longDesc = 'A'.repeat(200);
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], description: longDesc }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Show more')).toBeInTheDocument();
    });
  });

  it('shows error state and retry button on API failure', async () => {
    mockAuthRequest.mockRejectedValueOnce(new Error('Network error'));

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load listings/)).toBeInTheDocument();
    });
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('respects URL filter params on initial load', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [], total: 0 });

    renderDiscover('/discover?role=tank&dataCenter=Crystal');

    await waitFor(() => {
      expect(mockAuthRequest).toHaveBeenCalled();
    });
    const callUrl = mockAuthRequest.mock.calls[0][0] as string;
    expect(callUrl).toContain('role=tank');
    expect(callUrl).toContain('dataCenter=Crystal');
  });

  it('hides member count when 0 (opt-in hidden)', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], memberCount: 0 }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    expect(screen.queryByText(/member/)).not.toBeInTheDocument();
  });

  it('shows member count when > 0 (opted in)', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], memberCount: 6 }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('6 members')).toBeInTheDocument();
    });
  });

  it('displays privacy reassurance in header', async () => {
    mockAuthRequest.mockResolvedValueOnce({ items: [], total: 0 });

    renderDiscover();

    expect(screen.getByText(/All listings are opt-in/)).toBeInTheDocument();
  });

  it('renders unsafe contact URL as plain text instead of link', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{
        ...MOCK_ITEMS[0],
        contactMethod: 'url',
        contactValue: 'javascript:alert(1)',
      }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    // Should render as plain text, not a clickable link
    const contactText = screen.getByText('javascript:alert(1)');
    expect(contactText.tagName).not.toBe('A');
    expect(contactText.closest('a')).toBeNull();
  });

  it('renders safe contact URL as clickable link', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{
        ...MOCK_ITEMS[0],
        contactMethod: 'url',
        contactValue: 'https://discord.gg/example',
      }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    const link = screen.getByText('discord.gg/example');
    expect(link.closest('a')).toHaveAttribute('href', 'https://discord.gg/example');
    expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('renders discord contact as plain text not a link', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [MOCK_ITEMS[0]],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('raider#1234')).toBeInTheDocument();
    });
    const discordText = screen.getByText('raider#1234');
    expect(discordText.tagName).toBe('SPAN');
    expect(discordText.closest('a')).toBeNull();
  });
});

// ── Fit Summary section ───────────────────────────────────────

const STRONG_FIT_SUMMARY = {
  overall: 'strong' as const,
  goals: { aligned: 2, partial: 0, conflicts: 0, missing: 0 },
  jobs: { status: 'match' as const, matchedJobs: ['BRD'] },
  schedule: { status: 'match' as const },
  comms: { status: 'match' as const },
  bis: { status: 'ready' as const },
};

const WEAK_FIT_SUMMARY = {
  overall: 'weak' as const,
  goals: { aligned: 0, partial: 0, conflicts: 1, missing: 0 },
  jobs: { status: 'none' as const, matchedJobs: [] },
  schedule: { status: 'conflict' as const },
  comms: { status: 'unknown' as const },
  bis: { status: 'unknown' as const },
};

describe('Fit Summary section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fit summary section when fitSummary is provided', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], fitSummary: STRONG_FIT_SUMMARY }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByTestId('fit-summary')).toBeInTheDocument();
    });
    expect(screen.getByTestId('fit-overall')).toHaveTextContent('Strong fit');
  });

  it('hides fit summary section when fitSummary is null', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], fitSummary: null }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('fit-summary')).not.toBeInTheDocument();
  });

  it('hides fit summary section when fitSummary is undefined', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0] }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByText('Crystal Raiders')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('fit-summary')).not.toBeInTheDocument();
  });

  it('renders conflict warning with text-status-error class on weak fit', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], fitSummary: WEAK_FIT_SUMMARY }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByTestId('fit-overall')).toBeInTheDocument();
    });
    const overallEl = screen.getByTestId('fit-overall');
    expect(overallEl).toHaveTextContent('Weak fit');
    expect(overallEl.className).toContain('text-status-error');
  });

  it('renders strong fit label with text-status-success class', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], fitSummary: STRONG_FIT_SUMMARY }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByTestId('fit-overall')).toBeInTheDocument();
    });
    const overallEl = screen.getByTestId('fit-overall');
    expect(overallEl.className).toContain('text-status-success');
  });

  it('shows matched job name in fit summary tokens', async () => {
    mockAuthRequest.mockResolvedValueOnce({
      items: [{ ...MOCK_ITEMS[0], fitSummary: STRONG_FIT_SUMMARY }],
      total: 1,
    });

    renderDiscover();

    await waitFor(() => {
      expect(screen.getByTestId('fit-summary')).toBeInTheDocument();
    });
    expect(screen.getByText(/BRD wanted/)).toBeInTheDocument();
  });
});
