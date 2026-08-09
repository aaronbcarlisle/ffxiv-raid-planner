// V1 GearTable off-hand row gating (D2). V1 is the default shell — the row,
// the data-driven gate, and the compact grid-cols branch are pinned here, not
// just exercised in the browser pass.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GearTable } from './GearTable';
import { TooltipProvider } from '../primitives';
import { GEAR_SLOTS } from '../../types';
import type { GearSlotStatus, SnapshotPlayer } from '../../types';

function makeGear(overrides: Partial<GearSlotStatus> = {}): GearSlotStatus {
  return { slot: 'body', bisSource: 'raid', hasItem: false, isAugmented: false, ...overrides };
}

function fullGear(offhandOverrides: Partial<GearSlotStatus> = {}): GearSlotStatus[] {
  return GEAR_SLOTS.map((slot) =>
    slot === 'offhand'
      ? makeGear({ slot, bisSource: null, ...offhandOverrides })
      : makeGear({ slot })
  );
}

function makePlayer(job: string, gear: GearSlotStatus[]): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Test Player',
    job,
    role: 'tank',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear,
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
  };
}

function renderTable(job: string, gear: GearSlotStatus[], compact = false) {
  const player = makePlayer(job, gear);
  return render(
    <TooltipProvider>
      <GearTable
        gear={gear}
        tomeWeapon={player.tomeWeapon}
        onGearChange={vi.fn()}
        onTomeWeaponChange={vi.fn()}
        player={player}
        userRole="owner"
        compact={compact}
      />
    </TooltipProvider>
  );
}

describe('GearTable — off-hand row gating (V1)', () => {
  it('PLD renders an Off Hand row directly under the weapon', () => {
    renderTable('PLD', fullGear());
    const offhandRow = document.getElementById('gear-row-p1-offhand');
    expect(offhandRow).not.toBeNull();
    const weaponRow = document.getElementById('gear-row-p1-weapon');
    expect(weaponRow).not.toBeNull();
    expect(screen.getByText('Off Hand')).toBeInTheDocument();
  });

  it('a non-offhand job with an empty minted entry renders NO Off Hand row', () => {
    renderTable('DRG', fullGear());
    expect(document.getElementById('gear-row-p1-offhand')).toBeNull();
    expect(screen.queryByText('Off Hand')).not.toBeInTheDocument();
  });

  it('a non-offhand job whose offhand carries synced data renders the row', () => {
    renderTable('WHM', fullGear({ equippedItemId: 49679, equippedItemName: "Kite Shield" }));
    expect(document.getElementById('gear-row-p1-offhand')).not.toBeNull();
  });

  it('compact grid uses 12 columns for PLD and 11 otherwise', () => {
    const { container: pldC } = renderTable('PLD', fullGear(), true);
    expect(pldC.querySelector('.grid-cols-12')).not.toBeNull();
    const { container: drgC } = renderTable('DRG', fullGear(), true);
    expect(drgC.querySelector('.grid-cols-11')).not.toBeNull();
    expect(drgC.querySelector('.grid-cols-12')).toBeNull();
  });
});
