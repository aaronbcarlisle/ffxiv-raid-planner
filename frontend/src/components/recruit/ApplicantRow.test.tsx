/**
 * ApplicantRow — RH1c, spec §4 / R-RH-S. Actions per status, the tier tag,
 * `missing` hints, `fit: null` renders nothing extra, private-profile gating,
 * and "Full details" opening the (mocked) review modal.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ApplicantRow, type ApplicantRowProps } from './ApplicantRow';
import type { JoinRequest } from '../../types';
import type { FitV2 } from '../finder/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}));

vi.mock('../static-group/JoinRequestReviewModal', () => ({
  JoinRequestReviewModal: ({ isOpen, request }: { isOpen: boolean; request: JoinRequest }) =>
    isOpen ? <div data-testid="review-modal">{request.id}</div> : null,
}));

vi.mock('../../stores/toastStore', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  mockNavigate.mockClear();
});

function request(overrides: Partial<JoinRequest> = {}): JoinRequest {
  return {
    id: 'r1',
    staticGroupId: 'g1',
    requesterUserId: 'u1',
    status: 'pending',
    characterNameAtApply: 'Alysa Moonshade',
    characterWorldAtApply: 'Balmung',
    selectedJob: 'WHM',
    selectedRole: 'healer',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fit(overrides: Partial<FitV2> = {}): FitV2 {
  return {
    tier: 'strong', missing: [],
    role: { status: 'match', matchedJob: 'WHM', matchedRole: 'healer', priority: 'needed', isMain: true, asRole: null },
    schedule: { status: 'match', basis: 'time', nights: [] },
    reasons: [],
    ...overrides,
  };
}

function renderRow(props: Partial<ApplicantRowProps> = {}) {
  return render(
    <ApplicantRow
      request={request()}
      staticName="Twilight Wardens"
      groupId="g1"
      onAccept={vi.fn().mockResolvedValue(undefined)}
      onDecline={vi.fn().mockResolvedValue(undefined)}
      onUnderReview={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  );
}

describe('ApplicantRow — identity', () => {
  it('renders name, job/role, world and applied time', () => {
    renderRow();
    expect(screen.getByText('Alysa Moonshade')).toBeInTheDocument();
    expect(screen.getByText('WHM · Healer · Balmung')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('falls back to jobInterest/roleInterest when selectedJob/selectedRole are absent', () => {
    renderRow({
      request: request({
        selectedJob: undefined, selectedRole: undefined, characterWorldAtApply: undefined,
        jobInterest: ['SGE'], roleInterest: ['healer'],
      }),
    });
    expect(screen.getByText('SGE · Healer')).toBeInTheDocument();
  });

  it('navigates via the router (SPA), not a raw <a href>, when shareable with a code', () => {
    renderRow({ request: request({ profileVisibilityAtApply: 'shareable', profileShareCodeAtApply: 'abc123' }) });
    const link = screen.getByText('View profile');
    expect(link.closest('a')).toBeNull();
    fireEvent.click(link);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/abc123');
  });

  it('hides View profile for a private applicant', () => {
    renderRow({ request: request({ profileVisibilityAtApply: 'private', profileShareCodeAtApply: 'abc123' }) });
    expect(screen.queryByText('View profile')).toBeNull();
  });

  it('hides View profile when shareable but no code', () => {
    renderRow({ request: request({ profileVisibilityAtApply: 'shareable', profileShareCodeAtApply: undefined }) });
    expect(screen.queryByText('View profile')).toBeNull();
  });
});

describe('ApplicantRow — fit', () => {
  it('renders the tier tag and third-person reason rows', () => {
    renderRow({
      request: request({
        fit: fit({ tier: 'good', reasons: [{ kind: 'bis', status: 'match', params: {} }] }),
      }),
    });
    expect(screen.getByText('Good fit')).toBeInTheDocument();
    expect(screen.getByText('Their BiS is ready to share')).toBeInTheDocument();
  });

  it('renders missing hints', () => {
    renderRow({ request: request({ fit: fit({ missing: ['template', 'jobs'] }) }) });
    expect(screen.getByText('No typical week yet')).toBeInTheDocument();
    expect(screen.getByText('No jobs on their Hub')).toBeInTheDocument();
  });

  it('renders nothing extra when fit is null', () => {
    renderRow({ request: request({ fit: null }) });
    expect(screen.queryByText(/fit$/)).toBeNull();
    expect(screen.queryByText(/No typical week/)).toBeNull();
  });

  it('ignores an unrecognized missing key rather than rendering an empty hint', () => {
    const { container } = renderRow({
      request: request({ fit: fit({ missing: ['template', 'bogus' as unknown as 'template'] }) }),
    });
    expect(screen.getByText('No typical week yet')).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll('p')).some((p) => p.textContent === '')).toBe(false);
  });

  it('a resolved row (declined) does not render reason rows or missing hints, even though its fit is retained (M2)', () => {
    renderRow({
      request: request({
        status: 'declined',
        fit: fit({ tier: 'good', missing: ['template'], reasons: [{ kind: 'bis', status: 'match', params: {} }] }),
      }),
    });
    expect(screen.queryByText('Their BiS is ready to share')).toBeNull();
    expect(screen.queryByText('No typical week yet')).toBeNull();
    // The resolved status tag still shows, not the fit tier tag.
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.queryByText('Good fit')).toBeNull();
  });
});

describe('ApplicantRow — words and contact', () => {
  it('renders the full message with no truncation', () => {
    const longMessage = 'a'.repeat(300);
    renderRow({ request: request({ message: longMessage }) });
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('availabilitySummary wins over availabilityNote', () => {
    renderRow({
      request: request({
        availabilityNote: 'ignored note',
        availabilitySummary: { configuredDays: 3, timezone: 'America/New_York', detailLevel: 'summary_only' },
      }),
    });
    expect(screen.getByText('3 Player Hub availability days, America/New_York')).toBeInTheDocument();
    expect(screen.queryByText('ignored note')).toBeNull();
  });

  it('falls back to availabilityNote when there is no summary', () => {
    renderRow({ request: request({ availabilityNote: 'Weeknights after 8pm ET' }) });
    expect(screen.getByText('Weeknights after 8pm ET')).toBeInTheDocument();
  });

  it('shows a Copy button for contactDiscord', () => {
    renderRow({ request: request({ contactDiscord: 'alysa#1234' }) });
    expect(screen.getByText('alysa#1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Discord handle' })).toBeInTheDocument();
  });
});

describe('ApplicantRow — actions per status', () => {
  it('pending: Accept, Under review, Decline', () => {
    renderRow({ request: request({ status: 'pending' }) });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Under review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('under_review: Accept, Decline, no Under review button', () => {
    renderRow({ request: request({ status: 'under_review' }) });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Under review' })).toBeNull();
  });

  it('accept is one click', () => {
    const onAccept = vi.fn().mockResolvedValue(undefined);
    renderRow({ request: request({ status: 'pending' }), onAccept });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledWith('r1');
  });

  it('a double-click on Accept only calls it once while the first call is in flight (M3)', async () => {
    let resolveAccept!: () => void;
    const onAccept = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveAccept = resolve; }));
    renderRow({ request: request({ status: 'pending' }), onAccept });
    const button = screen.getByRole('button', { name: 'Accept' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolveAccept();
  });

  it('Under review is disabled while Accept is in flight', async () => {
    let resolveAccept!: () => void;
    const onAccept = vi.fn().mockReturnValue(new Promise<void>((resolve) => { resolveAccept = resolve; }));
    renderRow({ request: request({ status: 'pending' }), onAccept });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.getByRole('button', { name: 'Under review' })).toBeDisabled();
    resolveAccept();
  });

  it('decline needs two clicks', () => {
    const onDecline = vi.fn().mockResolvedValue(undefined);
    renderRow({ request: request({ status: 'pending' }), onDecline });
    const button = screen.getByRole('button', { name: 'Decline' });
    fireEvent.click(button);
    expect(onDecline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));
    expect(onDecline).toHaveBeenCalledWith('r1');
  });

  it('accepted without rosterPlayerId shows Link to roster slot', () => {
    const onLinkRoster = vi.fn();
    const req = request({ status: 'accepted', rosterPlayerId: undefined });
    renderRow({ request: req, onLinkRoster });
    const button = screen.getByRole('button', { name: 'Link to roster slot' });
    fireEvent.click(button);
    expect(onLinkRoster).toHaveBeenCalledWith(req);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('accepted with rosterPlayerId: no roster action, no accept/decline', () => {
    renderRow({ request: request({ status: 'accepted', rosterPlayerId: 'p1' }) });
    expect(screen.queryByRole('button', { name: 'Link to roster slot' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('resolved rows (declined) show a status tag, Full details, and no other actions', () => {
    renderRow({ request: request({ status: 'declined' }) });
    expect(screen.getByText('Declined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Full details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Under review' })).toBeNull();
  });
});

describe('ApplicantRow — Full details', () => {
  it('opens the (mocked) review modal with the request', () => {
    renderRow({ request: request({ id: 'r42' }) });
    expect(screen.queryByTestId('review-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Full details' }));
    expect(within(screen.getByTestId('review-modal')).getByText('r42')).toBeInTheDocument();
  });
});
