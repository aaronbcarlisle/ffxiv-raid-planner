/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PreviewShareTab } from './PreviewShareTab';
import type { PlayerProfile } from '../../stores/playerProfileStore';

const updateProfile = vi.fn();
const rotateShareCode = vi.fn();
const { buildPublicProfileUrlMock } = vi.hoisted(() => ({
  buildPublicProfileUrlMock: vi.fn((shareCode: string) => `https://www.xivraidplanner.app/profile/${shareCode}`),
}));

vi.mock('../../stores/playerProfileStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/playerProfileStore')>('../../stores/playerProfileStore');
  return {
    ...actual,
    usePlayerProfileStore: () => ({
      updateProfile,
      rotateShareCode,
    }),
  };
});

vi.mock('../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: (selector?: (s: { days: unknown[] }) => unknown) => {
    const state = { days: [] };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../utils/publicUrl', () => ({
  buildPublicProfileUrl: buildPublicProfileUrlMock,
}));

const profile: PlayerProfile = {
  id: 'profile-1',
  userId: 'user-1',
  visibility: 'shareable',
  shareCode: 'BT7M27EB',
  shareEnabled: true,
  bio: null,
  characters: [{
    id: 'character-1',
    lodestoneId: '123',
    name: 'Rin Applicant',
    server: 'Balmung',
    dataCenter: 'Crystal',
    avatarUrl: null,
    isMain: true,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  }],
  jobProfiles: [{
    id: 'job-1',
    job: 'BRD',
    role: 'ranged',
    priority: 'main',
    readiness: 'ready',
    notes: null,
    gearSnapshotId: null,
    gearSnapshot: null,
    bisTargets: [],
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  }],
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
};

describe('PreviewShareTab', () => {
  beforeEach(() => {
    updateProfile.mockReset();
    rotateShareCode.mockReset();
    buildPublicProfileUrlMock.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    });
  });

  it('shows sharing controls and copies the public profile URL', async () => {
    render(<PreviewShareTab profile={profile} gearSnapshots={{}} />);

    expect(screen.getByText('Profile Sharing')).toBeInTheDocument();
    expect(screen.getByText('Choose who can view your profile. Private notes and goals are never shown.')).toBeInTheDocument();
    expect(screen.getByText('https://www.xivraidplanner.app/profile/BT7M27EB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));

    expect(buildPublicProfileUrlMock).toHaveBeenCalledWith('BT7M27EB');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://www.xivraidplanner.app/profile/BT7M27EB');
  });

  it('shows the application preview with character name and main job', () => {
    render(<PreviewShareTab profile={profile} gearSnapshots={{}} />);

    expect(screen.getByText('Rin Applicant')).toBeInTheDocument();
    expect(screen.getByText('Balmung')).toBeInTheDocument();
    expect(screen.getByText('Bard')).toBeInTheDocument();
    expect(screen.getByText('Main Job')).toBeInTheDocument();
  });

  it('preview card shows the parchment header band', () => {
    render(<PreviewShareTab profile={profile} gearSnapshots={{}} />);
    const elements = screen.getAllByText('Application Preview');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('never shows private notes or goals in the preview', () => {
    const profileWithNotes = {
      ...profile,
      bio: null,
      jobProfiles: [{ ...profile.jobProfiles[0], notes: 'SECRET NOTES DO NOT SHOW' }],
    };
    render(<PreviewShareTab profile={profileWithNotes} gearSnapshots={{}} />);
    expect(screen.queryByText('SECRET NOTES DO NOT SHOW')).toBeNull();
  });

  it('shows snapshot disclaimer about applications keeping a copy', () => {
    render(<PreviewShareTab profile={profile} gearSnapshots={{}} />);
    expect(screen.getByText(/Applications keep a copy/i)).toBeInTheDocument();
    expect(screen.getByText(/Private notes and goals are never included/i)).toBeInTheDocument();
  });

  it('shows gear iLv badge when gear snapshot exists for main job', () => {
    const snapshot = {
      id: 'snap-1',
      characterId: 'character-1',
      job: 'BRD',
      avgItemLevel: 735,
      source: 'plugin' as const,
      syncedAt: '2026-06-08T00:00:00Z',
      lastPluginSeenAt: null,
      createdAt: '2026-06-08T00:00:00Z',
      updatedAt: '2026-06-08T00:00:00Z',
      gear: [{ slot: 'weapon', equippedItemName: 'Skyruin Harp Bow', equippedItemLevel: 735 }],
    };
    render(<PreviewShareTab profile={profile} gearSnapshots={{ 'character-1': [snapshot] }} />);
    expect(screen.getByText('iLv 735')).toBeInTheDocument();
  });

  it('shows incomplete setup prompt when no character linked', () => {
    const incomplete = { ...profile, characters: [] };
    render(<PreviewShareTab profile={incomplete} gearSnapshots={{}} />);
    expect(screen.getByText(/Complete your character and job setup/i)).toBeInTheDocument();
  });
});
