/**
 * @vitest-environment jsdom
 */

import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncCenterTab } from './SyncCenterTab';
import type { GearSnapshot, PlayerProfile } from '../../stores/playerProfileStore';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, 'data-testid': dtid }: React.HTMLAttributes<HTMLDivElement> & { 'data-testid'?: string }) => (
      <div className={className} data-testid={dtid}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const storeMock = {
  fetchProfile: vi.fn().mockResolvedValue(undefined),
  fetchGoals: vi.fn().mockResolvedValue(undefined),
  fetchCollectionSuggestions: vi.fn().mockResolvedValue(undefined),
  fetchStaticSuggestions: vi.fn().mockResolvedValue(undefined),
  fetchGearSnapshots: vi.fn().mockResolvedValue(undefined),
  syncGear: vi.fn(),
  syncing: false,
};

vi.mock('../../stores/playerProfileStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/playerProfileStore')>('../../stores/playerProfileStore');
  return {
    ...actual,
    usePlayerProfileStore: () => storeMock,
  };
});

vi.mock('../../stores/personalAvailabilityStore', () => ({
  usePersonalAvailabilityStore: () => ({
    days: [],
    fetchPersonalAvailability: vi.fn(),
  }),
}));

vi.mock('../../stores/toastStore', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
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
    lodestoneId: '123456',
    name: 'Rin Applicant',
    server: 'Balmung',
    dataCenter: 'Crystal',
    avatarUrl: null,
    isMain: true,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
  }],
  jobProfiles: [{
    id: 'job-brd',
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

const profileNoCharacter: PlayerProfile = {
  ...profile,
  characters: [],
};

function makeSnapshot(overrides: Partial<GearSnapshot> = {}): GearSnapshot {
  return {
    id: 'snapshot-1',
    characterId: 'character-1',
    job: 'BRD',
    gear: [{ slot: 'weapon', equippedItemName: 'Skyruin Harp Bow', equippedItemLevel: 730 }],
    avgItemLevel: 730,
    source: 'plugin',
    syncedAt: '2026-06-08T00:00:00Z',
    lastPluginSeenAt: '2026-06-08T00:00:00Z',
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
    ...overrides,
  };
}

function renderSyncCenter(props?: Partial<Parameters<typeof SyncCenterTab>[0]>) {
  return render(
    <MemoryRouter>
      <SyncCenterTab
        profile={profile}
        gearSnapshots={{}}
        goals={[]}
        onNavigate={vi.fn()}
        onOpenLinkModal={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

describe('SyncCenterTab — Sync Status section', () => {
  beforeEach(() => {
    storeMock.fetchProfile.mockReset().mockResolvedValue(undefined);
    storeMock.fetchGoals.mockReset().mockResolvedValue(undefined);
    storeMock.fetchCollectionSuggestions.mockReset().mockResolvedValue(undefined);
    storeMock.fetchStaticSuggestions.mockReset().mockResolvedValue(undefined);
    storeMock.fetchGearSnapshots.mockReset().mockResolvedValue(undefined);
  });

  it('shows plugin CTA linking to plugin repo when disconnected', () => {
    renderSyncCenter();

    expect(screen.getByText('Plugin not connected')).toBeInTheDocument();
    expect(screen.getByText('Set up automatic sync')).toBeInTheDocument();

    const pluginLink = screen.getByRole('link', { name: /get the plugin/i });
    expect(pluginLink).toHaveAttribute('href', 'https://github.com/aaronbcarlisle/XIVRaidPlannerPlugin');
  });

  it('shows "Plugin connected" and Refresh button when plugin snapshots present', () => {
    renderSyncCenter({
      gearSnapshots: {
        'character-1': [makeSnapshot()],
      },
    });

    expect(screen.getByText('Plugin connected')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /refresh status/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /get the plugin/i })).toBeNull();
  });

  it('shows character name when character is linked', () => {
    renderSyncCenter();
    expect(screen.getByText(/Rin Applicant · Balmung/)).toBeInTheDocument();
  });

  it('shows "Link" prompt when no character is linked', () => {
    renderSyncCenter({ profile: profileNoCharacter });
    expect(screen.getByText(/No character linked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link/i })).toBeInTheDocument();
  });

  it('calls onOpenLinkModal when "Link" clicked', () => {
    const onOpenLinkModal = vi.fn();
    renderSyncCenter({ profile: profileNoCharacter, onOpenLinkModal });
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    expect(onOpenLinkModal).toHaveBeenCalled();
  });

  it('opens link modal and shows toast when refreshing without a character', async () => {
    const onOpenLinkModal = vi.fn();
    const snap = makeSnapshot();
    renderSyncCenter({
      profile: profileNoCharacter,
      gearSnapshots: { 'character-1': [snap] },
      onOpenLinkModal,
    });
    fireEvent.click(screen.getByTestId('plugin-primary-cta'));
    await waitFor(() => expect(onOpenLinkModal).toHaveBeenCalled());
  });

  it('calls all fetch actions on refresh when character exists', async () => {
    const snap = makeSnapshot();
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    fireEvent.click(screen.getByTestId('plugin-primary-cta'));
    await waitFor(() => expect(storeMock.fetchProfile).toHaveBeenCalled());
    await waitFor(() => expect(storeMock.fetchGoals).toHaveBeenCalled());
    await waitFor(() => expect(storeMock.fetchGearSnapshots).toHaveBeenCalledWith('character-1'));
  });
});

describe('SyncCenterTab — Sync Sources section', () => {
  it('always renders the Sync Sources section', () => {
    renderSyncCenter();
    expect(screen.getByText('Sync Sources')).toBeInTheDocument();
  });

  it('shows all three source labels', () => {
    renderSyncCenter();
    expect(screen.getByText('Plugin')).toBeInTheDocument();
    expect(screen.getByText('Lodestone')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('explains Lodestone fallback behavior', () => {
    renderSyncCenter();
    expect(screen.getByText(/Lodestone fallback/)).toBeInTheDocument();
    expect(screen.getByText(/missing or stale/)).toBeInTheDocument();
  });

  it('explains gear priority order', () => {
    renderSyncCenter();
    expect(screen.getByText(/Plugin overrides Lodestone/)).toBeInTheDocument();
  });
});

describe('SyncCenterTab — Sync Coverage section', () => {
  it('does not render coverage section when no tracked jobs', () => {
    renderSyncCenter({ profile: { ...profile, jobProfiles: [] } });
    expect(screen.queryByText('Sync Coverage')).not.toBeInTheDocument();
  });

  it('renders coverage section when tracked jobs exist', () => {
    renderSyncCenter();
    expect(screen.getByText('Sync Coverage')).toBeInTheDocument();
  });

  it('shows correct gear count (0 with no snapshots)', () => {
    renderSyncCenter();
    expect(screen.getByText(/0 of 1 tracked job/)).toBeInTheDocument();
  });

  it('shows gear count when snapshot provided', () => {
    const snap = makeSnapshot();
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText(/1 of 1 tracked job/)).toBeInTheDocument();
  });

  it('shows "Readiness is managed in Jobs & Gear"', () => {
    renderSyncCenter();
    expect(screen.getByText(/Readiness is managed in Jobs/)).toBeInTheDocument();
  });

  it('shows source distribution pills when gear exists', () => {
    const snap = makeSnapshot({ source: 'plugin' });
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText(/Plugin · 1/)).toBeInTheDocument();
  });

  it('"View in Jobs & Gear" calls onNavigate with jobs-gear', () => {
    const onNavigate = vi.fn();
    renderSyncCenter({ onNavigate });
    fireEvent.click(screen.getByText(/View in Jobs & Gear/));
    expect(onNavigate).toHaveBeenCalledWith('jobs-gear');
  });

  it('explains that applications capture gear at time of applying', () => {
    renderSyncCenter();
    expect(screen.getByText(/captures your selected job and gear/)).toBeInTheDocument();
  });
});

describe('SyncCenterTab — Sync Log section', () => {
  it('does not render log section when no usable snapshots', () => {
    renderSyncCenter();
    expect(screen.queryByText('Sync Log')).not.toBeInTheDocument();
  });

  it('renders log section when plugin snapshot exists', () => {
    const snap = makeSnapshot({ source: 'plugin' });
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText('Sync Log')).toBeInTheDocument();
  });

  it('shows plugin sync copy in log', () => {
    const snap = makeSnapshot({ source: 'plugin' });
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText(/Plugin synced 1 job gearset/)).toBeInTheDocument();
  });

  it('shows lodestone copy in log', () => {
    const snap = makeSnapshot({ source: 'lodestone' });
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText(/Lodestone updated 1 job/)).toBeInTheDocument();
  });

  it('shows manual copy in log', () => {
    const snap = makeSnapshot({ source: 'manual' });
    renderSyncCenter({ gearSnapshots: { 'character-1': [snap] } });
    expect(screen.getByText(/Manually updated 1 job gearset/)).toBeInTheDocument();
  });

  it('groups multiple same-source snapshots into one log entry', () => {
    const snap1 = makeSnapshot({ id: 's1', source: 'plugin', job: 'BRD' });
    const snap2 = makeSnapshot({ id: 's2', source: 'plugin', job: 'WAR' });
    renderSyncCenter({ gearSnapshots: { 'c1': [snap1], 'c2': [snap2] } });
    expect(screen.getByText(/Plugin synced 2 job gearsets/)).toBeInTheDocument();
  });
});

describe('SyncCenterTab — Privacy section', () => {
  it('always renders the Privacy section', () => {
    renderSyncCenter();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('explains plugin sync is shown as "A member synced"', () => {
    renderSyncCenter();
    expect(screen.getByText(/A member synced/)).toBeInTheDocument();
  });

  it('explains name is not shown to other members', () => {
    renderSyncCenter();
    expect(screen.getByText(/your name is not shown/)).toBeInTheDocument();
  });

  it('mentions system label for aggregate updates', () => {
    renderSyncCenter();
    expect(screen.getByText(/system label/)).toBeInTheDocument();
  });
});

describe('SyncCenterTab — Roster links', () => {
  it('renders roster links when staticGroups provided', () => {
    const groups = [{ id: 'g1', name: 'Crystal Static', shareCode: 'abc123', userRole: 'member' as const, isPublic: false, ownerId: 'u1', memberCount: 1, isAdminAccess: false, source: 'membership' as const, createdAt: '', updatedAt: '' }];
    renderSyncCenter({ staticGroups: groups });
    expect(screen.getByText('Crystal Static')).toBeInTheDocument();
    expect(screen.getByText('Roster links')).toBeInTheDocument();
  });

  it('does not render roster links section when no groups', () => {
    renderSyncCenter({ staticGroups: [] });
    expect(screen.queryByText('Roster links')).not.toBeInTheDocument();
  });
});
