import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { GearSlotStatus, SnapshotPlayer } from '../../types';

const mocks = vi.hoisted(() => ({ players: [] as SnapshotPlayer[] }));
vi.mock('../../stores/tierStore', () => ({ useTierPlayers: () => mocks.players }));

import { RoleBisCard } from './RoleBisCard';

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

describe('RoleBisCard', () => {
  it('renders the role rows and the gear-source legend', () => {
    mocks.players = [];
    render(<RoleBisCard />);
    expect(screen.getByText(/bis progress by role/i)).toBeInTheDocument();
    expect(screen.getByText(/to current tier/i)).toBeInTheDocument();
    // all five role labels present
    expect(screen.getByText(/Tanks/i)).toBeInTheDocument();
    expect(screen.getByText(/Healers/i)).toBeInTheDocument();
    expect(screen.getByText(/Melee/i)).toBeInTheDocument();
    expect(screen.getByText(/Ranged/i)).toBeInTheDocument();
    expect(screen.getByText(/Casters/i)).toBeInTheDocument();
    // legend swatch (gear source)
    expect(screen.getByText(/^raid$/i)).toBeInTheDocument();
  });

  it('shows per-role X/Y counts and a role-labeled progress bar', () => {
    mocks.players = [
      player({
        id: 'A',
        role: 'tank',
        gear: [
          slot({ slot: 'weapon', bisSource: 'raid', hasItem: true }),
          slot({ slot: 'head', bisSource: 'tome', hasItem: false }),
        ],
      }),
      player({
        id: 'B',
        role: 'healer',
        gear: [
          slot({ slot: 'weapon', bisSource: 'raid', hasItem: false }),
          slot({ slot: 'head', bisSource: 'raid', hasItem: false }),
        ],
      }),
    ];

    render(<RoleBisCard />);

    // Tank 1/2 = 50% → progressbar valuenow 50
    const tankBar = screen.getByRole('progressbar', { name: /tank bis progress/i });
    expect(tankBar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Healer 0/2 = 0%
    const healerBar = screen.getByRole('progressbar', { name: /healer bis progress/i });
    expect(healerBar).toHaveAttribute('aria-valuenow', '0');
    // 0 / 2 (healer) and 0 / 0 (empty roles) both render
    expect(screen.getByText('0 / 2')).toBeInTheDocument();
  });
});
