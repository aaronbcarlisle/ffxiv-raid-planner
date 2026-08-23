import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LogWeekGrid } from './LogWeekGrid';
import { GEAR_SLOT_NAMES } from '../../types';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

// ── Fixture factories — shape modeled on FloorCard.test.tsx / logWeekGridData.test.ts ──

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Alice',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as SnapshotPlayer;
}

let nextLootId = 1;
function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: nextLootId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'Floor 1',
    itemSlot: 'earring',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

let nextMaterialId = 1;
function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: nextMaterialId++,
    tierSnapshotId: 't1',
    weekNumber: 1,
    floor: 'Floor 2',
    materialType: 'glaze',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Alice',
    method: 'drop',
    createdAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'gm',
    ...overrides,
  };
}

const EMPTY_FLOORS: string[] = [];

function baseProps(overrides: Partial<Parameters<typeof LogWeekGrid>[0]> = {}) {
  return {
    floors: EMPTY_FLOORS,
    week: 1,
    lootLog: [] as LootLogEntry[],
    materialLog: [] as MaterialLogEntry[],
    players: [makePlayer()],
    canEdit: true,
    canAssignMaterial: true,
    onAssignGear: vi.fn(),
    onEditGear: vi.fn(),
    onAssignMaterial: vi.fn(),
    onEditMaterial: vi.fn(),
    ...overrides,
  };
}

describe('LogWeekGrid — sections and R-19 headers', () => {
  it('renders four floor sections, ascending 1 -> 4', () => {
    render(<LogWeekGrid {...baseProps()} />);
    const headings = screen.getAllByText(/^Floor [1-4]$/);
    expect(headings.map((h) => h.textContent)).toEqual(['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4']);
  });

  it('R-19: floor 2 header carries the accent stripe class and "Floor 2 · Book II" content', () => {
    render(<LogWeekGrid {...baseProps()} />);
    const heading = screen.getByText('Floor 2');
    expect(heading.className).toContain('text-floor-2');
    const header = heading.closest('div');
    expect(header?.className).toContain('border-l-floor-2');
    expect(within(header as HTMLElement).getByText('· Book II')).toBeInTheDocument();
  });

  it('shows the duty-name Tag when the floor is actually named', () => {
    render(<LogWeekGrid {...baseProps({ floors: ['M9S', 'M10S', 'M11S', 'M12S'] })} />);
    expect(screen.getByText('M9S')).toBeInTheDocument();
  });

  it('never shows a duplicate "Floor N" chip beside the "Floor N" heading on the fallback name', () => {
    const { container } = render(<LogWeekGrid {...baseProps()} />);
    const spans = container.querySelectorAll('span');
    const dupFloor1Chip = Array.from(spans).some((el) => el.textContent === 'Floor 1' && el.className.includes('rounded-full'));
    expect(dupFloor1Chip).toBe(false);
  });
});

describe('LogWeekGrid — per-floor column sets', () => {
  it('F1 has 4 gear columns, F2 5 (3 gear + 2 material), F3 4 (2 gear + 2 material), F4 1', () => {
    const { container } = render(<LogWeekGrid {...baseProps()} />);
    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(4);
    const colCounts = Array.from(tables).map((t) => t.querySelectorAll('thead th[scope="col"]').length);
    expect(colCounts).toEqual([4, 5, 4, 1]);
  });
});

describe('LogWeekGrid — empty gear cell', () => {
  it('renders an em-dash and an assign button with the "Log {label} — {floorName}" aria-label', () => {
    const onAssignGear = vi.fn();
    render(<LogWeekGrid {...baseProps({ onAssignGear })} />);
    const label = GEAR_SLOT_NAMES.earring;
    const button = screen.getByRole('button', { name: `Log ${label} — Floor 1` });
    expect(within(button).getByText('—')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onAssignGear).toHaveBeenCalledWith({ slot: 'earring', label, floorNumber: 1 });
  });
});

describe('LogWeekGrid — filled gear cell', () => {
  it('renders a RecipientBadge (name + job icon) and an edit button that fires onEditGear with the entry', () => {
    const entry = makeLootEntry({ itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    const onEditGear = vi.fn();
    render(<LogWeekGrid {...baseProps({ lootLog: [entry], onEditGear })} />);
    const label = GEAR_SLOT_NAMES.earring;
    const button = screen.getByRole('button', { name: `Edit ${label} for Alice — Floor 1` });
    expect(within(button).getByText('Alice')).toBeInTheDocument();
    expect(within(button).getByAltText('WHM')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onEditGear).toHaveBeenCalledWith(entry);
  });
});

describe('LogWeekGrid — multi-entry cell', () => {
  it('shows a ×2 chip and edits the NEWEST entry (drives createdAt apart)', () => {
    const older = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-01T00:00:00Z', recipientPlayerId: 'p1', recipientPlayerName: 'Alice',
    });
    const newer = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-05T00:00:00Z', recipientPlayerId: 'p1', recipientPlayerName: 'Alice',
    });
    const onEditGear = vi.fn();
    // lootLog order shouldn't matter — buildLogWeekGrid sorts newest-first.
    render(<LogWeekGrid {...baseProps({ lootLog: [older, newer], onEditGear })} />);
    const label = GEAR_SLOT_NAMES.earring;
    const button = screen.getByRole('button', { name: `Edit ${label} for Alice — Floor 1` });
    expect(within(button).getByText('×2')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onEditGear).toHaveBeenCalledWith(newer);
    expect(onEditGear).not.toHaveBeenCalledWith(older);
  });
});

describe('LogWeekGrid — material cells', () => {
  it('fires onAssignMaterial(material, floorNumber) for an empty cell and onEditMaterial(entry) for a filled one', () => {
    const filledEntry = makeMaterialEntry({ materialType: 'universal_tomestone', floor: 'Floor 2', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    const onAssignMaterial = vi.fn();
    const onEditMaterial = vi.fn();
    render(<LogWeekGrid {...baseProps({ materialLog: [filledEntry], onAssignMaterial, onEditMaterial })} />);

    const assignButton = screen.getByRole('button', { name: 'Log Glaze — Floor 2' });
    fireEvent.click(assignButton);
    expect(onAssignMaterial).toHaveBeenCalledWith('glaze', 2);

    const editButton = screen.getByRole('button', { name: 'Edit Tome for Alice — Floor 2' });
    fireEvent.click(editButton);
    expect(onEditMaterial).toHaveBeenCalledWith(filledEntry);
  });
});

describe('LogWeekGrid — ring bucketing', () => {
  it('a ring2 entry lands in the single Ring cell', () => {
    const entry = makeLootEntry({ itemSlot: 'ring2', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    render(<LogWeekGrid {...baseProps({ lootLog: [entry] })} />);
    expect(screen.getByRole('button', { name: 'Edit Ring for Alice — Floor 1' })).toBeInTheDocument();
  });
});

describe('LogWeekGrid — read-only (canEdit=false)', () => {
  it('renders zero buttons but still shows badges', () => {
    const entry = makeLootEntry({ itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    render(<LogWeekGrid {...baseProps({ lootLog: [entry], canEdit: false })} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});

describe('LogWeekGrid — canAssignMaterial=false (F-12)', () => {
  it('renders no button on an empty material cell but keeps the edit button on a filled one', () => {
    const filledEntry = makeMaterialEntry({ materialType: 'twine', floor: 'Floor 3', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    render(<LogWeekGrid {...baseProps({ materialLog: [filledEntry], canAssignMaterial: false })} />);

    // Empty glaze cell (floor 2) — read-only, no button.
    expect(screen.queryByRole('button', { name: 'Log Glaze — Floor 2' })).not.toBeInTheDocument();
    expect(screen.getByText('Glaze: not logged')).toBeInTheDocument();

    // Filled twine cell (floor 3) — still editable.
    expect(screen.getByRole('button', { name: 'Edit Twine for Alice — Floor 3' })).toBeInTheDocument();
  });
});

describe('LogWeekGrid — F-4 GearSlotIcon hazard', () => {
  it('every GearSlotIcon rendered in a <th> sits inside an inline-flex wrapper', () => {
    const { container } = render(<LogWeekGrid {...baseProps()} />);
    const headerIcons = container.querySelectorAll('th[scope="col"] [aria-hidden="true"]');
    expect(headerIcons.length).toBeGreaterThan(0);
    headerIcons.forEach((icon) => {
      expect(icon.parentElement?.className).toContain('inline-flex');
    });
  });

  it('every aria-hidden element that is itself a flex/grid container carries role="presentation"', () => {
    const entry = makeLootEntry({ itemSlot: 'earring', floor: 'Floor 1' });
    const { container } = render(<LogWeekGrid {...baseProps({ lootLog: [entry] })} />);
    const ariaHiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    ariaHiddenEls.forEach((el) => {
      const isFlexOrGrid = /\b(flex|inline-flex|grid|inline-grid)\b/.test(el.className);
      if (isFlexOrGrid) {
        expect(el.getAttribute('role')).toBe('presentation');
      }
    });
  });
});

describe('LogWeekGrid — unknown recipient', () => {
  it('falls back to entry.recipientPlayerName with no job icon when recipientPlayerId is unknown', () => {
    const entry = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player',
    });
    render(<LogWeekGrid {...baseProps({ lootLog: [entry], players: [makePlayer({ id: 'p1' })] })} />);
    const button = screen.getByRole('button', { name: 'Edit Ears for Departed Player — Floor 1' });
    expect(within(button).getByText('Departed Player')).toBeInTheDocument();
    expect(within(button).queryByRole('img')).not.toBeInTheDocument();
    const badge = within(button).getByText('Departed Player');
    expect(badge.style.color).toBe('var(--color-text-secondary)');
  });
});
