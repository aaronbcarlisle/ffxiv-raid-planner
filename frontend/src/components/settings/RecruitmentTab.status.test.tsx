/**
 * RecruitmentTab overview — the Recruitment status card labels every stored
 * status (RH1a, R-RH-E) from the backend's normalisation, and the Listing card
 * says Live only when the static is actually in the Static Finder (public,
 * enabled and open or selective — the backend's `is_discoverable`).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruitmentTab } from './RecruitmentTab';
import type { StaticGroup } from '../../types';

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: (selector: (s: { pendingCount: number }) => unknown) =>
    selector({ pendingCount: 0 }),
}));
vi.mock('../../stores/invitationStore', () => ({
  useInvitationStore: () => ({ invitations: [] }),
}));
vi.mock('./DiscoveryTab', () => ({ DiscoveryTab: () => <div data-testid="discovery-tab" /> }));
vi.mock('../static-group/InvitationsPanel', () => ({
  InvitationsPanel: () => <div data-testid="invitations-panel" />,
}));
vi.mock('../static-group/JoinRequestsPanel', () => ({
  JoinRequestsPanel: () => <div data-testid="join-requests-panel" />,
}));

/** `recruitmentStatus` is set only when given, so `undefined` renders a missing key. */
function renderOverview(recruitmentStatus: unknown, { isPublic = true, enabled = true } = {}) {
  const discovery: Record<string, unknown> = { enabled };
  if (recruitmentStatus !== undefined) discovery.recruitmentStatus = recruitmentStatus;
  const group = {
    id: 'g1',
    name: 'Test Static',
    shareCode: 'share1',
    isPublic,
    ownerId: 'u1',
    memberCount: 5,
    userRole: 'owner',
    settings: { discovery },
  } as unknown as StaticGroup;
  return render(
    <MemoryRouter>
      <RecruitmentTab group={group} canManage onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('RecruitmentTab overview status label', () => {
  it.each([
    ['open', 'Open'],
    ['selective', 'Selective'],
    ['paused', 'Paused'],
    ['closed', 'Closed'],
    ['limited', 'Selective'],
  ])('labels %s as %s', (status, label) => {
    renderOverview(status);
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    if (label !== 'Closed') expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['non-string', 7],
    ['unknown', 'whatever'],
  ])('a %s status reads Open, never Closed', (_label, status) => {
    renderOverview(status);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });
});

describe('RecruitmentTab overview listing card', () => {
  it.each(['open', 'selective', 'limited'])('%s is Live when public and enabled', (status) => {
    renderOverview(status);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('a missing status is Live when public and enabled', () => {
    renderOverview(undefined);
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it.each(['paused', 'closed'])('%s is not Live: the listing has left the Static Finder', (status) => {
    renderOverview(status);
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('is not Live when the static is private, whatever the status', () => {
    renderOverview('open', { isPublic: false });
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('is not Live when the listing is not enabled', () => {
    renderOverview('open', { enabled: false });
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });
});
