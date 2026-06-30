import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MountFarmData } from '../../stores/mountFarmStore';

type User = { id: string; activityDisplayMode?: 'named' | 'anonymous' } | null;

const mocks = vi.hoisted(() => ({
  data: null as MountFarmData | null,
  user: { id: 'u1', activityDisplayMode: 'named' } as User,
}));

vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (selector: (s: { data: MountFarmData | null }) => unknown) =>
    selector({ data: mocks.data }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User }) => unknown) => selector({ user: mocks.user }),
}));

import { StaticActivityFeed } from './StaticActivityFeed';

function dataWithMount(): MountFarmData {
  return {
    currentUserId: null,
    trials: [
      {
        trialId: 'dt-valigarmanda',
        totalMembers: 1,
        membersComplete: 1,
        membersMissing: 0,
        membersWanting: 0,
        membersCanBuy: 0,
        memberProgress: [
          {
            userId: 'u-alice',
            displayName: 'Alice',
            discordUsername: null,
            discordAvatar: null,
            trialId: 'dt-valigarmanda',
            hasMount: true,
            wantsMount: false,
            totemCount: 0,
            notes: null,
            updatedAt: '2026-06-30T11:58:00Z',
            ownershipSource: 'manual',
            totemSource: 'manual',
            lastImportedAt: null,
            lastPluginSyncAt: null,
            lastManualOverrideAt: null,
          },
        ],
      },
    ],
  };
}

describe('StaticActivityFeed', () => {
  beforeEach(() => {
    mocks.data = null;
    mocks.user = { id: 'u1', activityDisplayMode: 'named' };
  });

  it('renders the CardShell header', () => {
    render(<StaticActivityFeed />);
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument();
    expect(screen.getByText('this week')).toBeInTheDocument();
  });

  it('shows an empty state when there is no activity', () => {
    mocks.data = null;
    render(<StaticActivityFeed />);
    expect(screen.getByText(/no activity yet this week/i)).toBeInTheDocument();
  });

  it('shows an empty state when data has no qualifying rows', () => {
    mocks.data = { currentUserId: null, trials: [] };
    render(<StaticActivityFeed />);
    expect(screen.getByText(/no activity yet this week/i)).toBeInTheDocument();
  });

  it('renders activity rows with label and relative time when data is present', () => {
    mocks.data = dataWithMount();
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice obtained Wings of Ruin')).toBeInTheDocument();
    // No empty state once rows exist.
    expect(screen.queryByText(/no activity yet this week/i)).not.toBeInTheDocument();
  });
});
