/**
 * RecruitmentTab overview — the Recruitment status card labels every stored
 * status (RH1a, R-RH-E): `selective` and `paused` used to fall through to
 * "Closed".
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruitmentTab } from './RecruitmentTab';
import type { DiscoverySettings, StaticGroup } from '../../types';

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

function renderOverview(recruitmentStatus: DiscoverySettings['recruitmentStatus']) {
  const group = {
    id: 'g1',
    name: 'Test Static',
    shareCode: 'share1',
    isPublic: true,
    ownerId: 'u1',
    memberCount: 5,
    userRole: 'owner',
    settings: { discovery: { enabled: true, recruitmentStatus } },
  } as StaticGroup;
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
    ['limited', 'Limited'],
  ] as const)('labels %s as %s', (status, label) => {
    renderOverview(status);
    expect(screen.getByText('Recruitment')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    if (label !== 'Closed') expect(screen.queryByText('Closed')).not.toBeInTheDocument();
  });
});
