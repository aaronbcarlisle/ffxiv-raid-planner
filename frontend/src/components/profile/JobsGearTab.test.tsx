/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JobsGearTab } from './JobsGearTab';
import type { GearSnapshot, PlayerProfile } from '../../stores/playerProfileStore';

vi.mock('./GearSnapshotView', () => ({
  GearSnapshotView: () => <div data-testid="gear-snapshot-view" />,
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

function snapshot(overrides: Partial<GearSnapshot>): GearSnapshot {
  return {
    id: 'snapshot',
    characterId: 'character-1',
    job: 'BRD',
    gear: [],
    avgItemLevel: 730,
    source: 'plugin',
    syncedAt: '2026-06-08T00:00:00Z',
    lastPluginSeenAt: null,
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
    ...overrides,
  };
}

function jobProfile(overrides: Partial<import('../../stores/playerProfileStore').PlayerJobProfile>): import('../../stores/playerProfileStore').PlayerJobProfile {
  return {
    id: 'job-x',
    job: 'BRD',
    role: 'ranged',
    priority: 'flex',
    readiness: 'ready',
    notes: null,
    gearSnapshotId: null,
    gearSnapshot: null,
    bisTargets: [],
    createdAt: '2026-06-08T00:00:00Z',
    updatedAt: '2026-06-08T00:00:00Z',
    ...overrides,
  };
}

const JOBS = ['BRD', 'MCH', 'AST', 'WHM', 'SGE', 'DRG', 'NIN'] as const;

describe('JobsGearTab', () => {
  it('summary tiles: 7 tracked, all have gear, 2 needs_gear → Missing:0 NeedsReview:2', () => {
    const jobs = JOBS.map((job, i) => jobProfile({
      id: `job-${job}`,
      job,
      priority: i === 0 ? 'main' : 'flex',
      readiness: job === 'MCH' || job === 'AST' ? 'needs_gear' : 'ready',
    }));
    const snapshots = JOBS.map((job) => snapshot({
      id: `snap-${job}`,
      job,
      gear: [{ slot: 'weapon', equippedItemName: `${job} Weapon`, equippedItemLevel: 730 }],
    }));

    render(
      <JobsGearTab
        profile={{ ...profile, jobProfiles: jobs }}
        gearSnapshots={{ 'character-1': snapshots }}
        onAddJob={vi.fn()}
        onEditJob={vi.fn()}
        onOpenLinkModal={vi.fn()}
      />
    );

    const tracked = screen.getByTestId('tile-tracked-jobs');
    expect(tracked.querySelector('p:last-child')?.textContent).toBe('7');

    const gearSaved = screen.getByTestId('tile-gear-saved');
    expect(gearSaved.querySelector('p:last-child')?.textContent).toBe('7');

    const missingGear = screen.getByTestId('tile-missing-gear');
    expect(missingGear.querySelector('p:last-child')?.textContent).toBe('0');

    const belowTarget = screen.getByTestId('tile-below-target');
    expect(belowTarget.querySelector('p:last-child')?.textContent).toBe('2');
  });

  it('keeps the page focused and maps plugin gear to the matching job card only', () => {
    const brdSnapshot = snapshot({
      id: 'brd-snapshot',
      job: 'BRD',
      gear: [{ slot: 'weapon', equippedItemName: 'Skyruin Harp Bow', equippedItemLevel: 735 }],
    });
    const mchSnapshot = snapshot({
      id: 'mch-snapshot',
      job: 'MCH',
      gear: [{ slot: 'weapon', equippedItemName: 'Wrong MCH Cannon', equippedItemLevel: 730 }],
    });

    render(
      <JobsGearTab
        profile={profile}
        gearSnapshots={{ 'character-1': [brdSnapshot, mchSnapshot] }}
        onAddJob={vi.fn()}
        onEditJob={vi.fn()}
        onOpenLinkModal={vi.fn()}
      />
    );

    expect(screen.getByTestId('jobs-gear-tab')).toHaveClass('min-w-0', 'pb-24');
    expect(screen.getByText('Application gear')).toBeInTheDocument();
    expect(screen.queryByText('What static leads see')).toBeNull();
    expect(screen.queryByText('Sync summary')).toBeNull();
    expect(screen.queryByText('All gear snapshots')).toBeNull();
    expect(screen.queryByTestId('gear-snapshot-view')).toBeNull();
    expect(screen.queryByText('Wrong MCH Cannon')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /show gear/i }));

    expect(screen.getByTestId('gear-slots-BRD')).toBeInTheDocument();
    expect(screen.getByText('Skyruin Harp Bow')).toBeInTheDocument();
    expect(screen.queryByText('Wrong MCH Cannon')).toBeNull();
  });
});
