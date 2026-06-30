import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { GearSlotStatus, SnapshotPlayer } from '../../types';

const mocks = vi.hoisted(() => ({ players: [] as SnapshotPlayer[] }));
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => mocks.players }));

import { RosterReadinessCard } from './RosterReadinessCard';

function slot(partial: Partial<GearSlotStatus>): GearSlotStatus {
  return { slot: 'head', bisSource: 'raid', hasItem: false, isAugmented: false, ...partial };
}

function player(partial: Partial<SnapshotPlayer>): SnapshotPlayer {
  return {
    id: 'p',
    tierSnapshotId: 't',
    name: 'Player',
    job: 'WAR',
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {} as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('RosterReadinessCard', () => {
  it('renders the readiness stat labels and the BiS-complete bar', () => {
    mocks.players = [];
    render(<RosterReadinessCard />);
    expect(screen.getByText(/roster readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/avg iLvl/i)).toBeInTheDocument();
    expect(screen.getByText(/% BiS/i)).toBeInTheDocument();
    expect(screen.getByText(/raiders/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /bis complete/i })).toBeInTheDocument();
  });

  it('computes stats, bar fill, and footer from the roster', () => {
    mocks.players = [
      // raider, fully BiS — iLvs 730/730/740 (avg 733.33), 3/3 BiS slots
      player({
        id: 'A',
        gear: [
          slot({ slot: 'head', bisSource: 'raid', hasItem: true, itemLevel: 730 }),
          slot({ slot: 'body', bisSource: 'raid', hasItem: true, itemLevel: 730 }),
          slot({ slot: 'hands', bisSource: 'raid', hasItem: true, itemLevel: 740 }),
        ],
      }),
      // raider, partial — equipped 710 + 700 (avg 705), 1/2 BiS slots
      player({
        id: 'B',
        gear: [
          slot({ slot: 'head', bisSource: 'raid', hasItem: true, itemLevel: 720, equippedItemLevel: 710 }),
          slot({ slot: 'body', bisSource: 'tome', hasItem: false, itemLevel: 700 }),
        ],
      }),
      // substitute — excluded from every stat
      player({ id: 'C', isSubstitute: true, gear: [slot({ hasItem: true, itemLevel: 999 })] }),
      // unconfigured member — needs setup, excluded from raiders/avg/slots
      player({ id: 'D', configured: false }),
    ];

    render(<RosterReadinessCard />);

    // Avg iLv: (733.33 + 705) / 2 → 719
    expect(screen.getByText('719')).toBeInTheDocument();
    // % BiS: 1 of 2 raiders fully BiS → 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
    // Raiders: 2 configured non-subs
    expect(screen.getByText('2')).toBeInTheDocument();
    // Bar: obtained 4 / total 5 = 0.8 → aria-valuenow 80
    const bar = screen.getByRole('progressbar', { name: /bis complete/i });
    expect(bar).toHaveAttribute('aria-valuenow', '80');
    // Footer: slot tally + needs-setup count (D)
    expect(screen.getByText(/4 \/ 5 BiS slots obtained/i)).toBeInTheDocument();
    expect(screen.getByText(/1 member needs setup/i)).toBeInTheDocument();
  });
});
