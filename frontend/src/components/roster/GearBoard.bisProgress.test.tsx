/**
 * R-E2-F (#7): the Board's summary column prints RosterCard's fraction
 * (`playerBisProgress`) — number AND color — while the no-BiS gate stays on
 * `bisSlotTotals` (pinned unchanged in GearBoard.test.tsx).
 *
 * The fixture DIVERGES the two definitions: a tome slot owned but not
 * augmented counts as obtained for `bisSlotTotals` (6/11, ≥ 50% → primary)
 * and as incomplete for `isSlotComplete` (5/11, < 50% → warning), so an
 * assertion cannot pass by the two coinciding.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GearBoard } from './GearBoard';
import { RosterCard } from './RosterCard';
import { TooltipProvider } from '../primitives';
import { playerBisProgress } from '../../utils/playerBisProgress';
import { bisSlotTotals } from '../../utils/rosterReadiness';
import type { GearSlot, GearSlotStatus, SnapshotPlayer } from '../../types';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('hover: hover'),
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

afterEach(() => {
  vi.unstubAllGlobals();
});

const SLOTS: GearSlot[] = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];

/** 5 raid slots owned + 1 tome slot owned, NOT augmented; the rest missing. */
function divergingGear(): GearSlotStatus[] {
  return SLOTS.map((slot, i) => ({
    slot,
    bisSource: i === 1 ? 'tome' : 'raid',
    hasItem: i < 6,
    isAugmented: false,
  })) as GearSlotStatus[];
}

function player(over: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1', tierSnapshotId: 't1', name: 'Dragoon One', job: 'DRG', role: 'melee', position: 'M1',
    configured: true, isSubstitute: false, sortOrder: 0, userId: 'u1', bisLink: 'https://xivgear.app/x',
    tomeWeapon: { enabled: false, pursuing: false, hasItem: false, isAugmented: false } as SnapshotPlayer['tomeWeapon'],
    weaponPriorities: [], weaponPrioritiesLocked: false, createdAt: '', updatedAt: '',
    gear: divergingGear(), ...over,
  } as SnapshotPlayer;
}

const OWNER_GATE = { userRole: 'owner', currentUserId: 'u1', isAdminAccess: false } as const;

function summaryCell(name: string): HTMLElement {
  const table = screen.getByRole('table');
  const row = within(table).getByText(name).closest('tr') as HTMLElement;
  return row.lastElementChild as HTMLElement;
}

describe('GearBoard summary = RosterCard fraction (R-E2-F)', () => {
  it('the fixture really diverges the two definitions', () => {
    const p = player();
    expect(bisSlotTotals([p])).toEqual({ obtained: 6, total: 11 });
    expect(playerBisProgress(p)).toEqual({ completed: 5, total: 11 });
  });

  it("prints the card's number and colors it by the card's fraction", () => {
    const p = player();
    render(
      <MemoryRouter>
        <TooltipProvider>
          <GearBoard players={[p]} {...OWNER_GATE} actionsForPlayer={() => ({ onUpdate: vi.fn() })} />
          <RosterCard
            player={p}
            userRole="owner"
            currentUserId="u1"
            isAdminAccess={false}
            canManage
            clipboardPlayer={null}
            reorderMode={false}
            actions={{ onUpdate: vi.fn(), onCopy: vi.fn(), onDuplicate: vi.fn() }}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    // The card's own line for the same player…
    expect(screen.getByText('5/11 BiS')).toBeInTheDocument();
    // …and the Board's summary cell: the same number and denominator.
    const cell = summaryCell('Dragoon One');
    expect(cell).toHaveTextContent('5/11');
    // 5/11 < 50% → warning; bisSlotTotals' 6/11 would have been primary.
    expect(cell).toHaveClass('text-status-warning');
    expect(cell).not.toHaveClass('text-text-primary');
  });

  it('the color tracks the same fraction at the top end (10/11 is not "complete")', () => {
    // 10 raid owned + 1 tome owned unaugmented: bisSlotTotals says 11/11
    // (success); the card's fraction is 10/11 (primary).
    const gear = SLOTS.map((slot, i) => ({
      slot, bisSource: i === 1 ? 'tome' : 'raid', hasItem: true, isAugmented: false,
    })) as GearSlotStatus[];
    render(<GearBoard players={[player({ gear })]} {...OWNER_GATE} actionsForPlayer={() => ({ onUpdate: vi.fn() })} />);
    const cell = summaryCell('Dragoon One');
    expect(cell).toHaveTextContent('10/11');
    expect(cell).toHaveClass('text-text-primary');
    expect(cell).not.toHaveClass('text-status-success');
  });

  it('a substitute row prints real numbers too (pin)', () => {
    render(
      <GearBoard
        players={[player({ isSubstitute: true })]}
        {...OWNER_GATE}
        actionsForPlayer={() => ({ onUpdate: vi.fn() })}
      />
    );
    expect(screen.getByText('Substitutes')).toBeInTheDocument();
    const cell = summaryCell('Dragoon One');
    expect(cell).toHaveTextContent('5/11');
    expect(cell).toHaveClass('text-status-warning');
    expect(within(cell).queryByText('—')).not.toBeInTheDocument();
  });
});
