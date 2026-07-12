import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MountFarmData } from '../../stores/mountFarmStore';
import type { LootLogEntry, MaterialLogEntry } from '../../types';

type User = { id: string; activityDisplayMode?: 'named' | 'anonymous' } | null;

const mocks = vi.hoisted(() => ({
  data: null as MountFarmData | null,
  user: { id: 'u1', activityDisplayMode: 'named' } as User,
  lootLog: [] as LootLogEntry[],
  materialLog: [] as MaterialLogEntry[],
}));

vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: (selector: (s: { data: MountFarmData | null }) => unknown) =>
    selector({ data: mocks.data }),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: User }) => unknown) => selector({ user: mocks.user }),
}));
vi.mock('../../stores/lootTrackingStore', () => ({
  useLootTrackingStore: (
    selector: (s: { lootLog: LootLogEntry[]; materialLog: MaterialLogEntry[] }) => unknown,
  ) => selector({ lootLog: mocks.lootLog, materialLog: mocks.materialLog }),
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

function makeLootEntry(partial: Partial<LootLogEntry> & { id: number }): LootLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M11S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-30T11:59:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

function makeMaterialEntry(partial: Partial<MaterialLogEntry> & { id: number }): MaterialLogEntry {
  return {
    tierSnapshotId: 't1',
    weekNumber: 3,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p2',
    recipientPlayerName: 'Bob',
    method: 'drop',
    createdAt: '2026-06-30T11:57:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'alice',
    ...partial,
  };
}

describe('StaticActivityFeed', () => {
  beforeEach(() => {
    mocks.data = null;
    mocks.user = { id: 'u1', activityDisplayMode: 'named' };
    mocks.lootLog = [];
    mocks.materialLog = [];
  });

  it('renders the CardShell header', () => {
    render(<StaticActivityFeed />);
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument();
    expect(screen.getByText('latest')).toBeInTheDocument();
  });

  it('shows an empty state when there is no activity', () => {
    mocks.data = null;
    render(<StaticActivityFeed />);
    expect(screen.getByText(/no recent activity yet/i)).toBeInTheDocument();
  });

  it('shows an empty state when data has no qualifying rows', () => {
    mocks.data = { currentUserId: null, trials: [] };
    render(<StaticActivityFeed />);
    expect(screen.getByText(/no recent activity yet/i)).toBeInTheDocument();
  });

  it('renders activity rows with label and relative time when data is present', () => {
    mocks.data = dataWithMount();
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice obtained Wings of Ruin')).toBeInTheDocument();
    // No empty state once rows exist.
    expect(screen.queryByText(/no recent activity yet/i)).not.toBeInTheDocument();
  });

  it('renders a loot row with recipient, slot name, and fight', () => {
    mocks.lootLog = [makeLootEntry({ id: 1 })];
    render(<StaticActivityFeed />);
    expect(screen.getByText('Alice received Body — M11S')).toBeInTheDocument();
    expect(screen.queryByText(/no recent activity yet/i)).not.toBeInTheDocument();
  });

  it('renders a material row with recipient and material name', () => {
    mocks.materialLog = [makeMaterialEntry({ id: 7 })];
    render(<StaticActivityFeed />);
    expect(screen.getByText('Bob received Twine')).toBeInTheDocument();
  });

  it('interleaves loot, mount, and material rows by recency', () => {
    mocks.data = dataWithMount(); // "Alice obtained Wings of Ruin" @ 11:58
    mocks.lootLog = [makeLootEntry({ id: 1, createdAt: '2026-06-30T11:59:00Z' })]; // newest
    mocks.materialLog = [makeMaterialEntry({ id: 7, createdAt: '2026-06-30T11:57:00Z' })]; // oldest
    render(<StaticActivityFeed />);
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Alice received Body — M11S');
    expect(rows[1]).toContain('Alice obtained Wings of Ruin');
    expect(rows[2]).toContain('Bob received Twine');
  });

  it('caps the merged feed at 5 rows', () => {
    mocks.data = dataWithMount(); // 1 mount row
    mocks.lootLog = [1, 2, 3, 4, 5, 6].map((n) =>
      makeLootEntry({ id: n, createdAt: `2026-06-30T11:5${n}:00Z` }),
    ); // 6 loot rows → 7 candidates total
    render(<StaticActivityFeed />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
