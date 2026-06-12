/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { JobProfileCard } from './JobProfileCard';
import type { GearSnapshot, PlayerJobProfile } from '../../stores/playerProfileStore';

const deleteJobProfile = vi.fn();

vi.mock('../../stores/playerProfileStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/playerProfileStore')>('../../stores/playerProfileStore');
  return {
    ...actual,
    usePlayerProfileStore: () => ({
      deleteJobProfile,
    }),
  };
});

const baseJob: PlayerJobProfile = {
  id: 'job-1',
  job: 'BRD',
  role: 'ranged',
  priority: 'preferred_alt',
  readiness: 'ready',
  notes: null,
  gearSnapshotId: null,
  gearSnapshot: null,
  bisTargets: [],
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
};

const pluginSnapshot: GearSnapshot = {
  id: 'snapshot-1',
  characterId: 'character-1',
  job: 'BRD',
  avgItemLevel: 735,
  source: 'plugin',
  syncedAt: '2026-06-08T00:00:00Z',
  lastPluginSeenAt: null,
  createdAt: '2026-06-08T00:00:00Z',
  updatedAt: '2026-06-08T00:00:00Z',
  gear: [
    {
      slot: 'weapon',
      equippedItemName: 'Skyruin Bow of the Gracefully Long Test Name',
      equippedItemLevel: 735,
    },
  ],
};

describe('JobProfileCard', () => {
  beforeEach(() => {
    deleteJobProfile.mockReset();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  it('shows "No gear saved" and no context box when no snapshot', () => {
    render(<JobProfileCard jobProfile={baseJob} onEdit={vi.fn()} />);
    expect(screen.getAllByText(/No gear saved for this job yet/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Characters\s+tab/i)).toBeNull();
  });

  it('shows iLv badge and plugin source badge, no gear context box for plugin snapshot', () => {
    render(<JobProfileCard jobProfile={baseJob} resolvedSnapshot={pluginSnapshot} onEdit={vi.fn()} />);
    expect(screen.getByText('iLv 735')).toBeInTheDocument();
    // Source badge for plugin is "Plugin" — no gear context text box
    expect(screen.queryByText(/BRD loadout/i)).toBeNull();
    expect(screen.queryByText(/Matched\s+BRD/i)).toBeNull();
  });

  it('expands gear rows on "Show gear" click', () => {
    render(<JobProfileCard jobProfile={baseJob} resolvedSnapshot={pluginSnapshot} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /show gear/i }));
    const gearRows = screen.getByTestId('gear-slots-BRD');
    expect(gearRows).toBeInTheDocument();
    expect(screen.getByText('Skyruin Bow of the Gracefully Long Test Name')).toHaveClass('truncate');
  });

  it('unknown readiness + plugin snapshot does not show a scary badge', () => {
    const unknownJob: PlayerJobProfile = { ...baseJob, readiness: 'unknown' };
    render(<JobProfileCard jobProfile={unknownJob} resolvedSnapshot={pluginSnapshot} onEdit={vi.fn()} />);
    // Should NOT show "Unknown" or "Not self-rated" badge when gear exists
    expect(screen.queryByText(/unknown/i)).toBeNull();
    expect(screen.queryByText(/not self-rated/i)).toBeNull();
  });

  it('unknown readiness without a snapshot shows "Not self-rated" badge', () => {
    const unknownJob: PlayerJobProfile = { ...baseJob, readiness: 'unknown' };
    render(<JobProfileCard jobProfile={unknownJob} onEdit={vi.fn()} />);
    expect(screen.getByText(/not self-rated/i)).toBeInTheDocument();
  });

  it('needs_gear + snapshot shows "Needs review" badge (not "Missing gear")', () => {
    const needsGearJob: PlayerJobProfile = { ...baseJob, readiness: 'needs_gear' };
    render(<JobProfileCard jobProfile={needsGearJob} resolvedSnapshot={pluginSnapshot} onEdit={vi.fn()} />);
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.queryByText('Missing gear')).toBeNull();
  });

  it('needs_gear + no snapshot shows "Missing gear" badge', () => {
    const needsGearJob: PlayerJobProfile = { ...baseJob, readiness: 'needs_gear' };
    render(<JobProfileCard jobProfile={needsGearJob} onEdit={vi.fn()} />);
    expect(screen.getByText('Missing gear')).toBeInTheDocument();
    expect(screen.queryByText('Below target')).toBeNull();
  });
});
