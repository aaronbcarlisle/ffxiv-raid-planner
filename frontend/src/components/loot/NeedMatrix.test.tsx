import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { NeedMatrix } from './NeedMatrix';
import { TooltipProvider } from '../primitives';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import type { SnapshotPlayer } from '../../types';

// jsdom has no matchMedia; Tooltip → useDevice needs it to resolve canHover.
// Mirrors the stub in hooks/useDevice.test.ts — always resolve to "can hover"
// so the Tooltip-wrapped cells render normally instead of the touch bypass.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(hover: hover) and (pointer: fine)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

const FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];
const settings = { ...DEFAULT_SETTINGS };

// T1 tank — needs Ring only.
const t1: SnapshotPlayer = {
  id: 't1-id', tierSnapshotId: 'ts1', name: 'Tanky', job: 'PLD', role: 'tank', position: 'T1',
  configured: true, sortOrder: 0, isSubstitute: false,
  gear: [
    { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: false },
  ],
  tomeWeapon: {}, weaponPriorities: [],
} as unknown as SnapshotPlayer;

// H1 healer — has everything, needs nothing.
const h1: SnapshotPlayer = {
  id: 'h1-id', tierSnapshotId: 'ts1', name: 'Healy', job: 'WHM', role: 'healer', position: 'H1',
  configured: true, sortOrder: 0, isSubstitute: false,
  gear: [
    { slot: 'weapon', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'ring1', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'head', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'hands', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'feet', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'body', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'legs', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'earring', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'necklace', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'bracelet', bisSource: 'raid', hasItem: true, isAugmented: false },
  ],
  tomeWeapon: {}, weaponPriorities: [],
} as unknown as SnapshotPlayer;

// M1 melee — needs Ring + Weapon, and 2 twine via two unaugmented "Aug." tome slots.
const m1: SnapshotPlayer = {
  id: 'm1-id', tierSnapshotId: 'ts1', name: 'Meleey', job: 'DRG', role: 'melee', position: 'M1',
  configured: true, sortOrder: 0, isSubstitute: false,
  gear: [
    { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Body Piece' },
    { slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Legs Piece' },
  ],
  tomeWeapon: {}, weaponPriorities: [],
} as unknown as SnapshotPlayer;

// Deliberately unsorted — the component sorts by position itself.
const players = [m1, t1, h1];

function renderMatrix(overrides: Partial<React.ComponentProps<typeof NeedMatrix>> = {}) {
  return render(
    <TooltipProvider>
      <NeedMatrix
        players={players}
        floors={FLOORS}
        floorScope="all"
        materialLog={[]}
        settings={settings}
        canEdit={false}
        onLogGear={vi.fn()}
        onLogMaterial={vi.fn()}
        {...overrides}
      />
    </TooltipProvider>
  );
}

describe('NeedMatrix', () => {
  it('renders one <th scope="col"> per player with position + name, and an accessible caption', () => {
    renderMatrix();
    const table = screen.getByRole('table');
    expect(within(table).getByText(/who needs each drop/i)).toBeInTheDocument();
    for (const p of players) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(p.name) })).toBeInTheDocument();
    }
  });

  it('R-11: the Ring row Need cell reads "2/3" — denominator is the rendered roster, never 8', () => {
    renderMatrix();
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    const cells = ringRow.querySelectorAll('td');
    expect(cells[cells.length - 1].textContent).toBe('2/3');
  });

  it('FREE: a zero-needer gear row renders a FREE tag in its Need cell', () => {
    renderMatrix();
    const earsRow = screen.getByText('Ears').closest('tr') as HTMLElement;
    expect(within(earsRow).getByText('FREE')).toBeInTheDocument();
  });

  it('canEdit=true: the Ring×T1 cell is a button with an accessible "Log" name, and clicking it fires onLogGear', () => {
    const onLogGear = vi.fn();
    renderMatrix({ canEdit: true, onLogGear });
    const btn = screen.getByRole('button', { name: `Log Ring for ${t1.name}` });
    fireEvent.click(btn);
    expect(onLogGear).toHaveBeenCalledWith({ slot: 'ring', label: 'Ring', floorNumber: 1 }, t1.id);
  });

  it('canEdit=false: no buttons render anywhere, but needer cells carry sr-only "<player> needs <label>" text', () => {
    renderMatrix({ canEdit: false });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText(`${t1.name} needs Ring`)).toBeInTheDocument();
    expect(screen.getByText(`${m1.name} needs Ring`)).toBeInTheDocument();
  });

  it('scopes rows to the selected floor; "all" renders every gear row', () => {
    renderMatrix({ floorScope: 2 });
    expect(screen.getByText('Head')).toBeInTheDocument();
    expect(screen.getByText('Hands')).toBeInTheDocument();
    expect(screen.getByText('Feet')).toBeInTheDocument();
    expect(screen.queryByText('Weapon')).not.toBeInTheDocument();
    expect(screen.queryByText('Ring')).not.toBeInTheDocument();
    expect(screen.getByText('Glaze')).toBeInTheDocument();
    expect(screen.getByText('Universal Tomestone')).toBeInTheDocument();
    expect(screen.queryByText('Twine')).not.toBeInTheDocument();
    expect(screen.queryByText('Solvent')).not.toBeInTheDocument();
  });

  it('"all" scope renders every gear row (all ten slots)', () => {
    renderMatrix({ floorScope: 'all' });
    const labels = ['Ring', 'Weapon', 'Ears', 'Neck', 'Wrists', 'Head', 'Hands', 'Feet', 'Body', 'Legs'];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('material cell shows the per-player count and fires onLogMaterial; Need cell shows the bare total', () => {
    const onLogMaterial = vi.fn();
    renderMatrix({ canEdit: true, onLogMaterial });
    const twineRow = screen.getByText('Twine').closest('tr') as HTMLElement;
    const cells = twineRow.querySelectorAll('td');
    // Sorted order is T1, H1, M1 — M1's cell is the 3rd player column (index 2).
    const m1Cell = cells[2];
    const needCell = cells[cells.length - 1];
    expect(within(m1Cell as HTMLElement).getByText('2')).toBeInTheDocument();
    const btn = within(m1Cell as HTMLElement).getByRole('button', { name: `Log Twine for ${m1.name}` });
    fireEvent.click(btn);
    expect(onLogMaterial).toHaveBeenCalledWith('twine', expect.objectContaining({ id: m1.id }));
    // Bare total, no "/3" denominator (R-11's internal-consistency note).
    expect(needCell.textContent).toBe('2');
  });

  it('renders a no-players message and no table when the roster is empty', () => {
    renderMatrix({ players: [] });
    expect(screen.getByText(/no configured players/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('applies the warning tone once needers reach half the roster (ceil), and not below that', () => {
    renderMatrix();
    // Ring: 2 of 3 needers — 2 >= ceil(3/2) = 2 → warning.
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    const ringCells = ringRow.querySelectorAll('td');
    const ringNeedCell = ringCells[ringCells.length - 1];
    expect(ringNeedCell.querySelector('span')?.className).toContain('text-status-warning');

    // Weapon: 1 of 3 needers — below the ceiling → no warning.
    const weaponRow = screen.getByText('Weapon').closest('tr') as HTMLElement;
    const weaponCells = weaponRow.querySelectorAll('td');
    const weaponNeedCell = weaponCells[weaponCells.length - 1];
    expect(weaponNeedCell.querySelector('span')?.className).not.toContain('text-status-warning');
  });
});
