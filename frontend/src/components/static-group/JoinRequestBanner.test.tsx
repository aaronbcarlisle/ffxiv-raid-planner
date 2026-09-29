/**
 * JoinRequestBanner — the Request to Join button follows the listing's
 * recruitment status, normalised exactly as the backend does (RH1a, R-RH-A):
 * open and selective offer the button, paused and closed say the static
 * isn't taking requests, `limited` reads as selective, and a missing or
 * non-string status reads as open (as it always has).
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JoinRequestBanner } from './JoinRequestBanner';
import type { StaticGroupSettings } from '../../types';

// Read at render time (the factory is hoisted, the value is not), so a test can
// switch between a signed-in user and a guest.
let mockUser: { id: string } | null = { id: 'u1' };
const mockLogin = vi.fn();

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: () => ({
    myRequests: [],
    fetchMyRequests: vi.fn(),
    cancelRequest: vi.fn(),
  }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({ user: mockUser, login: mockLogin }),
}));
vi.mock('./JoinRequestModal', () => ({ JoinRequestModal: () => null }));

const NOT_TAKING = "This static isn't taking requests right now.";
const LOG_IN_PROMPT = 'Interested in joining this static? Log in to send a request.';

beforeEach(() => {
  mockUser = { id: 'u1' };
  mockLogin.mockClear();
});

function renderBanner(recruitmentStatus: unknown) {
  const discovery = { enabled: true } as StaticGroupSettings['discovery'] & Record<string, unknown>;
  if (recruitmentStatus !== undefined) discovery.recruitmentStatus = recruitmentStatus as never;
  return render(
    <JoinRequestBanner
      shareCode="share1"
      staticName="Test Static"
      groupId="g1"
      settings={{ discovery }}
      userRole={null}
    />,
  );
}

describe('JoinRequestBanner recruitment status', () => {
  it.each(['open', 'selective', 'limited'])('%s shows the Request to Join button', (status) => {
    renderBanner(status);
    expect(screen.getByRole('button', { name: /request to join/i })).toBeInTheDocument();
    expect(screen.queryByText(NOT_TAKING)).not.toBeInTheDocument();
  });

  it.each(['paused', 'closed'])('%s shows the not-taking sentence and no button', (status) => {
    renderBanner(status);
    expect(screen.getByText(NOT_TAKING)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request to join/i })).not.toBeInTheDocument();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['non-string', 7],
    ['unknown', 'whatever'],
  ])('a %s status shows the button as today', (_label, status) => {
    renderBanner(status);
    expect(screen.getByRole('button', { name: /request to join/i })).toBeInTheDocument();
  });

  it('a guest on an open listing gets the Log In prompt, not the Request to Join button', () => {
    mockUser = null;
    renderBanner('open');
    expect(screen.getByText(LOG_IN_PROMPT)).toBeInTheDocument();
    const logIn = screen.getByRole('button', { name: /log in/i });
    logIn.click();
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /request to join/i })).not.toBeInTheDocument();
    expect(screen.queryByText(NOT_TAKING)).not.toBeInTheDocument();
  });

  it('a guest on a paused listing gets the not-taking sentence and no Log In prompt', () => {
    mockUser = null;
    renderBanner('paused');
    expect(screen.getByText(NOT_TAKING)).toBeInTheDocument();
    expect(screen.queryByText(LOG_IN_PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when the listing is not enabled', () => {
    const { container } = render(
      <JoinRequestBanner
        shareCode="share1"
        staticName="Test Static"
        groupId="g1"
        settings={{ discovery: { enabled: false, recruitmentStatus: 'open' } }}
        userRole={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
