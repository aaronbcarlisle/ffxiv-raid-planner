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
    // D6a Task 4: the accessible name folds the count in, and the ×N chip is
    // now a SIBLING (`LogCellEntriesMenu`'s own trigger), not nested inside
    // the edit button.
    const button = screen.getByRole('button', { name: `Edit ${label} for Alice — Floor 1 (newest of 2)` });
    expect(within(button).queryByText('×2')).not.toBeInTheDocument();
    const chip = screen.getByRole('button', { name: `2 entries for ${label} — Floor 1` });
    expect(within(chip).getByText('×2')).toBeInTheDocument();
    expect(button).not.toContainElement(chip);

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

describe('D6 modifier layer', () => {
  const tankOne = makePlayer({
    id: 'p1', name: 'Tank One', job: 'PLD', role: 'tank',
  });
  const ears = makeLootEntry({
    itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
  });

  // Accepts a substring regex the same way `cellButton(/Log Neck/)` does below —
  // a bare string is wrapped so callers don't need the FULL dynamic aria-label
  // ("Edit Ears for Tank One — Floor 1") just to find the "Ears" cell.
  //
  // D6a Task 4: a filled cell's sibling row now also carries a kebab
  // (`${label} entry actions`, R-D6b) and, when multi-entry, a chip trigger
  // (`N entries for ${label} — ${floorName}`) — both of which ALSO match a
  // bare label fragment like 'Ears' or 'Neck'. Disambiguate by preferring
  // the Edit/Log-prefixed control (the one this helper always meant).
  function cellButton(fragment: string | RegExp) {
    const matcher = typeof fragment === 'string' ? new RegExp(fragment) : fragment;
    const candidates = screen.getAllByRole('button', { name: matcher });
    const edit = candidates.find((el) => /^(Edit|Log) /.test(el.getAttribute('aria-label') ?? ''));
    return edit ?? candidates[0];
  }

  // Mouse-path tests PIN detail: 1 (director F-14) — fireEvent.click defaults to detail: 0,
  // which is the AT path; the C4 precedent is RosterGearTable.test.tsx:381,523.
  it('Shift+Click copies and does NOT open the edit door', () => {
    const onEditGear = vi.fn(); const onCopyEntryLink = vi.fn();
    render(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], onEditGear, onCopyEntryLink,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { shiftKey: true, detail: 1 });
    expect(onCopyEntryLink).toHaveBeenCalledWith({ kind: 'loot', entry: ears });
    expect(onEditGear).not.toHaveBeenCalled();
  });

  it('Alt+Click jumps to the recipient and does NOT edit', () => {
    const onEditGear = vi.fn(); const onJumpToPlayer = vi.fn();
    render(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], onEditGear, onJumpToPlayer,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { altKey: true, detail: 1 });
    expect(onJumpToPlayer).toHaveBeenCalledWith(ears.recipientPlayerId);
    expect(onEditGear).not.toHaveBeenCalled();
  });

  it('Alt+Click is a no-op when the recipient is not on the roster', () => {
    const ghost = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed',
    });
    const onEditGear = vi.fn(); const onJumpToPlayer = vi.fn();
    render(<LogWeekGrid {...baseProps({
      lootLog: [ghost], players: [tankOne], onEditGear, onJumpToPlayer,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { altKey: true, detail: 1 });
    expect(onJumpToPlayer).not.toHaveBeenCalled();
    expect(onEditGear).not.toHaveBeenCalled();
  });

  it('an unmodified synthetic click (detail: 0, no altKey) edits — the AT route never jumps (D6-c)', () => {
    const onEditGear = vi.fn(); const onJumpToPlayer = vi.fn();
    render(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], onEditGear, onJumpToPlayer,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { detail: 0 });
    expect(onEditGear).toHaveBeenCalledWith(ears);
    expect(onJumpToPlayer).not.toHaveBeenCalled();
  });

  it('cursor-pointer appears only while Alt is held AND a jump target exists', () => {
    const onJumpToPlayer = vi.fn();
    const unresolvable = makeLootEntry({
      itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed',
    });
    render(<LogWeekGrid {...baseProps({
      lootLog: [ears, unresolvable], players: [tankOne], onJumpToPlayer,
    })}
    />);
    const earsButton = cellButton('Ears');
    const neckButton = cellButton('Neck');
    expect(earsButton.className).not.toContain('cursor-pointer');

    fireEvent.keyDown(window, { key: 'Alt' });
    expect(earsButton.className).toContain('cursor-pointer');
    expect(neckButton.className).not.toContain('cursor-pointer');

    fireEvent.keyUp(window, { key: 'Alt' });
    expect(earsButton.className).not.toContain('cursor-pointer');
  });

  it('right-click opens the menu with Edit/Copy link/Jump/Delete and menu-key anchors to the cell', () => {
    const onCopyEntryLink = vi.fn(); const onJumpToPlayer = vi.fn(); const onDeleteEntry = vi.fn();
    render(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], onCopyEntryLink, onJumpToPlayer, onDeleteEntry,
    })}
    />);
    fireEvent.contextMenu(cellButton('Ears'));
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: `Jump to ${tankOne.name}` })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('menu Delete calls onDeleteEntry with the newest ref', () => {
    const onDeleteEntry = vi.fn();
    render(<LogWeekGrid {...baseProps({ lootLog: [ears], players: [tankOne], onDeleteEntry })} />);
    fireEvent.contextMenu(cellButton('Ears'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDeleteEntry).toHaveBeenCalledWith({ kind: 'loot', entry: ears });
  });

  it('the Jump item is absent when the recipient is unresolvable', () => {
    const ghost = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed',
    });
    const onJumpToPlayer = vi.fn();
    render(<LogWeekGrid {...baseProps({ lootLog: [ghost], players: [tankOne], onJumpToPlayer })} />);
    fireEvent.contextMenu(cellButton('Ears'));
    expect(screen.queryByRole('menuitem', { name: /Jump to/ })).not.toBeInTheDocument();
  });

  it('Shift/Alt clicks on an EMPTY interactive cell are no-ops (D6-h)', () => {
    const onAssignGear = vi.fn();
    render(<LogWeekGrid {...baseProps({ lootLog: [ears], players: [tankOne], onAssignGear })} />);
    fireEvent.click(cellButton(/Log Neck/), { shiftKey: true });
    fireEvent.click(cellButton(/Log Neck/), { altKey: true });
    expect(onAssignGear).not.toHaveBeenCalled();
  });
});

describe('D6 cell anatomy (D6a Task 4)', () => {
  const tankOne = makePlayer({
    id: 'p1', name: 'Tank One', job: 'PLD', role: 'tank',
  });
  const healerOne = makePlayer({
    id: 'p2', name: 'Healer One', job: 'WHM', role: 'healer',
  });
  const older = makeLootEntry({
    itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-01T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
  });
  const newer = makeLootEntry({
    itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-05T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
  });

  it('multi-entry: chip is a sibling button, not nested in the edit button', () => {
    render(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne] })} />);
    const edit = screen.getByRole('button', { name: 'Edit Ears for Healer One — Floor 1 (newest of 2)' });
    const chip = screen.getByRole('button', { name: '2 entries for Ears — Floor 1' });
    expect(edit).not.toContainElement(chip);
  });

  it('multi-entry accessible name folds the count in (D5-owed fix); single-entry name has no suffix', () => {
    render(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne] })} />);
    expect(screen.getByRole('button', { name: 'Edit Ears for Healer One — Floor 1 (newest of 2)' })).toBeInTheDocument();

    const single = makeLootEntry({
      itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    render(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne] })} />);
    expect(screen.getByRole('button', { name: 'Edit Neck for Tank One — Floor 1' })).toBeInTheDocument();
  });

  it('chip menu item click opens the edit door for the OLDER entry', async () => {
    const onEditGear = vi.fn();
    render(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne], onEditGear })} />);
    const chip = screen.getByRole('button', { name: '2 entries for Ears — Floor 1' });
    fireEvent.keyDown(chip, { key: 'Enter' });
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    // newest-first order (D6 Task 2) — index 1 is the OLDER entry.
    fireEvent.click(items[1]);
    expect(onEditGear).toHaveBeenCalledWith(older);
    expect(onEditGear).not.toHaveBeenCalledWith(newer);
  });

  it('read-only multi-entry sr-only sentence includes the count', () => {
    render(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne, healerOne], canEdit: false,
    })}
    />);
    expect(screen.getByText('Ears: Healer One, 2 entries')).toBeInTheDocument();
  });

  it('the revealed kebab renders on every FILLED interactive cell (single or multi-entry) with hover/focus reveal classes', () => {
    const single = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    render(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne] })} />);
    const kebab = screen.getByRole('button', { name: 'Ears entry actions' });
    expect(kebab.className).toContain('opacity-0');
    expect(kebab.className).toContain('focus-visible:opacity-100');
    expect(kebab.className).toContain('group-hover:opacity-100');
  });

  it('kebab click opens the SAME gated item set the right-click menu opens (Edit + Copy link + Jump + Delete, all handlers passed)', () => {
    const onEditGear = vi.fn();
    const onCopyEntryLink = vi.fn();
    const onJumpToPlayer = vi.fn();
    const onDeleteEntry = vi.fn();
    const single = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    render(<LogWeekGrid {...baseProps({
      lootLog: [single], players: [tankOne], onEditGear, onCopyEntryLink, onJumpToPlayer, onDeleteEntry,
    })}
    />);
    const kebab = screen.getByRole('button', { name: 'Ears entry actions' });
    fireEvent.click(kebab);
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: `Jump to ${tankOne.name}` })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEditGear).toHaveBeenCalledWith(single);
  });

  it('the aria-hidden flex/grid sweep still passes over the new anatomy (F-4 re-run)', () => {
    const neck = makeLootEntry({
      itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    const glaze = makeMaterialEntry({
      materialType: 'glaze', floor: 'Floor 2', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    const { container } = render(<LogWeekGrid {...baseProps({
      lootLog: [older, newer, neck], materialLog: [glaze], players: [tankOne, healerOne],
    })}
    />);
    const ariaHiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenEls.length).toBeGreaterThan(0);
    ariaHiddenEls.forEach((el) => {
      const isFlexOrGrid = /\b(flex|inline-flex|grid|inline-grid)\b/.test(el.className);
      if (isFlexOrGrid) {
        expect(el.getAttribute('role')).toBe('presentation');
      }
    });
  });
});
