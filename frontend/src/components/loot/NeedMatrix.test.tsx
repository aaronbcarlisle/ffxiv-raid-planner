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

// M1 melee — needs Ring + Weapon, and progresses 2 of 3 twine slots (body +
// legs unaugmented — still owed; feet already augmented — the "done" slice
// that counts toward total but not needed).
const m1: SnapshotPlayer = {
  id: 'm1-id', tierSnapshotId: 'ts1', name: 'Meleey', job: 'DRG', role: 'melee', position: 'M1',
  configured: true, sortOrder: 0, isSubstitute: false,
  gear: [
    { slot: 'weapon', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'ring1', bisSource: 'raid', hasItem: false, isAugmented: false },
    { slot: 'ring2', bisSource: 'raid', hasItem: true, isAugmented: false },
    { slot: 'body', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Body Piece' },
    { slot: 'legs', bisSource: 'tome', hasItem: true, isAugmented: false, itemName: 'Aug. Legs Piece' },
    { slot: 'feet', bisSource: 'tome', hasItem: true, isAugmented: true, itemName: 'Aug. Feet Piece' },
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

  it('R-P3: floor scope highlights the selected floor\'s rows and dims + disables the rest — no row leaves the DOM', () => {
    renderMatrix({ floorScope: 2, canEdit: true });
    // Every gear + material row from every floor stays mounted — nothing is filtered out.
    ['Ring', 'Weapon', 'Head', 'Hands', 'Feet', 'Glaze', 'Universal Tomestone', 'Twine', 'Solvent'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Floor 2's own row (Head) is relevant: not dimmed, carries the floor-accent edge.
    const headRow = screen.getByText('Head').closest('tr') as HTMLElement;
    const headHeader = screen.getByText('Head').closest('th') as HTMLElement;
    expect(headRow.className).not.toContain('opacity-30');
    expect(headHeader.className).toContain('border-l-floor-2');

    // Off-floor rows dim AND their log buttons disable, even though someone needs them.
    const weaponRow = screen.getByText('Weapon').closest('tr') as HTMLElement;
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    expect(weaponRow.className).toContain('opacity-30');
    expect(ringRow.className).toContain('opacity-30');
    expect(within(weaponRow).getByRole('button', { name: `Log Weapon for ${m1.name}` })).toBeDisabled();
    expect(within(ringRow).getByRole('button', { name: `Log Ring for ${t1.name}` })).toBeDisabled();
  });

  it('floorScope 1: no upgrade materials drop there, so every material row dims — but the "Materials" separator still renders (rows stay mounted)', () => {
    renderMatrix({ floorScope: 1, canEdit: true });
    expect(screen.getByText('Ring')).toBeInTheDocument();
    expect(screen.getByText('Materials')).toBeInTheDocument();

    const twineRow = screen.getByText('Twine').closest('tr') as HTMLElement;
    expect(twineRow.className).toContain('opacity-30');
    expect(
      within(twineRow).getByRole('button', { name: `Log Twine for ${m1.name} — needs 2 of 3` })
    ).toBeDisabled();

    // Ring is floor 1's own row — relevant, not dimmed.
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    expect(ringRow.className).not.toContain('opacity-30');
  });

  it('"all" scope renders every gear row (all ten slots)', () => {
    renderMatrix({ floorScope: 'all' });
    const labels = ['Ring', 'Weapon', 'Ears', 'Neck', 'Wrists', 'Head', 'Hands', 'Feet', 'Body', 'Legs'];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it('material cell shows the needed count (progress ring center), carries a "needs N of M" aria-label, and fires onLogMaterial; Need cell shows the bare total', () => {
    const onLogMaterial = vi.fn();
    renderMatrix({ canEdit: true, onLogMaterial });
    const twineRow = screen.getByText('Twine').closest('tr') as HTMLElement;
    const cells = twineRow.querySelectorAll('td');
    // Sorted order is T1, H1, M1 — M1's cell is the 3rd player column (index 2).
    const m1Cell = cells[2];
    const needCell = cells[cells.length - 1];
    // M1 needs 2 of 3 twine slots (feet already augmented — the "done" slice).
    expect(within(m1Cell as HTMLElement).getByText('2')).toBeInTheDocument();
    const btn = within(m1Cell as HTMLElement).getByRole(
      'button', { name: `Log Twine for ${m1.name} — needs 2 of 3` },
    );
    fireEvent.click(btn);
    expect(onLogMaterial).toHaveBeenCalledWith('twine', expect.objectContaining({ id: m1.id }));
    // Bare total (sum of needed across players), no "/3" denominator (R-11's internal-consistency note).
    expect(needCell.textContent).toBe('2');
  });

  it('material cell aria-label carries "needs N of M" progress when total > 1, and omits "of" when total is 1', () => {
    renderMatrix({ canEdit: false });
    // m1 needs 2 of 3 twine slots — sr-only text carries the "of 3".
    expect(screen.getByText(`${m1.name} needs 2 of 3 Twine`)).toBeInTheDocument();

    // A solo fixture with total === 1 (pursuing a tome weapon, not yet acquired)
    // exercises the "of" omission the shared fixture can't reach.
    const solo: SnapshotPlayer = {
      id: 'solo-id', tierSnapshotId: 'ts1', name: 'Solo', job: 'BLM', role: 'caster', position: 'R1',
      configured: true, sortOrder: 0, isSubstitute: false,
      gear: [],
      tomeWeapon: { pursuing: true, hasItem: false }, weaponPriorities: [],
    } as unknown as SnapshotPlayer;
    renderMatrix({ players: [solo], canEdit: false });
    expect(screen.getByText('Solo needs 1 Universal Tomestone')).toBeInTheDocument();
    expect(screen.queryByText(/needs 1 of/)).not.toBeInTheDocument();
  });

  it('renders a no-players message and no table when the roster is empty', () => {
    renderMatrix({ players: [] });
    expect(screen.getByText(/no configured players/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('V1-style gear cells: needer cells carry a role-colored ring (2px) + role-tint fill, per role — tank and melee', () => {
    renderMatrix();
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    const cells = ringRow.querySelectorAll('td');
    // Sorted order T1, H1, M1 — T1 (tank) and M1 (melee) both need Ring; H1 doesn't.
    const tankDot = cells[0].querySelector('span[aria-hidden]') as HTMLElement;
    const meleeDot = cells[2].querySelector('span[aria-hidden]') as HTMLElement;
    expect(tankDot.className).toContain('border-2');
    expect(tankDot.getAttribute('style')).toContain('--color-role-tank');
    expect(tankDot.style.backgroundColor).toContain('color-mix');
    expect(tankDot.style.backgroundColor).toContain('--color-role-tank');
    expect(meleeDot.getAttribute('style')).toContain('--color-role-melee');
    expect(meleeDot.style.backgroundColor).toContain('color-mix');
    expect(meleeDot.style.backgroundColor).toContain('--color-role-melee');

    // The inner solid dot must be a block-level box — a bare inline <span>
    // ignores width/height per CSS spec and renders 0x0 in a real browser
    // even though it passes class-token assertions in jsdom (measured live:
    // outer ring 24x24, inner dot 0x0 without this).
    const tankInnerDot = tankDot.querySelector('span') as HTMLElement;
    expect(tankInnerDot.className).toContain('block');
    expect(tankInnerDot.className).toContain('h-2');
    expect(tankInnerDot.className).toContain('w-2');
  });

  it('non-needer gear cells render the neutral empty treatment, not a role-colored dot', () => {
    renderMatrix();
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    const cells = ringRow.querySelectorAll('td');
    // H1 (index 1) has both rings — doesn't need Ring.
    const emptyDot = cells[1].querySelector('span[aria-hidden]') as HTMLElement;
    expect(emptyDot.className).toContain('border-border-subtle');
    expect(emptyDot.getAttribute('style')).toBeFalsy();
  });

  it('read-only mode: needer cells still carry the role-colored dot but render no button (non-interactive)', () => {
    renderMatrix({ canEdit: false });
    const ringRow = screen.getByText('Ring').closest('tr') as HTMLElement;
    const cells = ringRow.querySelectorAll('td');
    const tankDot = cells[0].querySelector('span[aria-hidden]') as HTMLElement;
    expect(tankDot.getAttribute('style')).toContain('--color-role-tank');
    expect(within(cells[0] as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('material cells unchanged: progress ring still renders as a conic-gradient, not the ring-cell treatment', () => {
    renderMatrix({ canEdit: false });
    const twineRow = screen.getByText('Twine').closest('tr') as HTMLElement;
    const cells = twineRow.querySelectorAll('td');
    const m1Cell = cells[2];
    const ring = within(m1Cell as HTMLElement).getByText('2').closest('span[aria-hidden]') as HTMLElement;
    expect(ring.getAttribute('style')).toContain('conic-gradient');
    expect(ring.className).not.toContain('border-2');
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
