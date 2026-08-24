import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LogWeekGrid } from './LogWeekGrid';
import { TooltipProvider } from '../primitives';
import { logCellDomId, type LogGridEntryRef } from './logWeekGridData';
import { GEAR_SLOT_NAMES } from '../../types';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

// Step 0 (D6b, director F-1 blocker): the FILLED interactive cell's edit
// `Button` is about to be wrapped in `<Tooltip>` — Tooltip -> useDevice needs
// `window.matchMedia` (unimplemented in jsdom) and Radix `Tooltip` throws
// without a `TooltipProvider` ancestor. NeedMatrix shape (NOT FloorCard's
// `matches: false`, which would make Tooltip a passthrough and the tooltip
// assertions below could never pass) — always resolve "can hover" so every
// Tooltip-wrapped cell renders normally.
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
  // Radix Popper (the Tooltip's Arrow measurement) needs ResizeObserver,
  // which jsdom lacks — RosterCard.test.tsx:44-49 precedent. Only exercised
  // once a test actually opens a tooltip (`fireEvent.focus`), which is why
  // Step 0's harness-neutrality run didn't need this yet.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

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

// D6a Task 6 (sanctioned edit, class 4): the four now-required props —
// `onCopyEntryLink` / `onJumpToPlayer` / `onDeleteEntry` (tightened from
// optional) + the new `highlightEntry` (defaults to null, "nothing
// highlighted") — so every pre-existing call site keeps compiling without
// having to name them individually.
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
    onCopyEntryLink: vi.fn(),
    onJumpToPlayer: vi.fn(),
    onDeleteEntry: vi.fn(),
    highlightEntry: null,
    ...overrides,
  };
}

// Step 0 (D6b harness rewrite): every `<LogWeekGrid>` render now needs a
// `TooltipProvider` ancestor (the FILLED-cell edit button is about to be
// `<Tooltip>`-wrapped) — NeedMatrix.test.tsx:83-94 precedent. Takes the JSX
// element itself (not a props object) so the ~43 existing
// `renderGrid(<LogWeekGrid {...baseProps(...)} />)` call sites migrate by
// renaming the function only; RETURNS the RTL render result — several
// existing tests destructure `container`.
function renderGrid(el: ReactElement) {
  return render(<TooltipProvider>{el}</TooltipProvider>);
}

describe('LogWeekGrid — sections and R-19 headers', () => {
  it('renders four floor sections, ascending 1 -> 4', () => {
    renderGrid(<LogWeekGrid {...baseProps()} />);
    const headings = screen.getAllByText(/^Floor [1-4]$/);
    expect(headings.map((h) => h.textContent)).toEqual(['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4']);
  });

  it('R-19: floor 2 header carries the accent stripe class and "Floor 2 · Book II" content', () => {
    renderGrid(<LogWeekGrid {...baseProps()} />);
    const heading = screen.getByText('Floor 2');
    expect(heading.className).toContain('text-floor-2');
    const header = heading.closest('div');
    expect(header?.className).toContain('border-l-floor-2');
    expect(within(header as HTMLElement).getByText('· Book II')).toBeInTheDocument();
  });

  it('shows the duty-name Tag when the floor is actually named', () => {
    renderGrid(<LogWeekGrid {...baseProps({ floors: ['M9S', 'M10S', 'M11S', 'M12S'] })} />);
    expect(screen.getByText('M9S')).toBeInTheDocument();
  });

  it('never shows a duplicate "Floor N" chip beside the "Floor N" heading on the fallback name', () => {
    const { container } = renderGrid(<LogWeekGrid {...baseProps()} />);
    const spans = container.querySelectorAll('span');
    const dupFloor1Chip = Array.from(spans).some((el) => el.textContent === 'Floor 1' && el.className.includes('rounded-full'));
    expect(dupFloor1Chip).toBe(false);
  });
});

describe('LogWeekGrid — per-floor column sets', () => {
  it('F1 has 4 gear columns, F2 5 (3 gear + 2 material), F3 4 (2 gear + 2 material), F4 1', () => {
    const { container } = renderGrid(<LogWeekGrid {...baseProps()} />);
    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(4);
    const colCounts = Array.from(tables).map((t) => t.querySelectorAll('thead th[scope="col"]').length);
    expect(colCounts).toEqual([4, 5, 4, 1]);
  });
});

describe('LogWeekGrid — empty gear cell', () => {
  it('renders an em-dash and an assign button with the "Log {label} — {floorName}" aria-label', () => {
    const onAssignGear = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({ onAssignGear })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [entry], onEditGear })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [older, newer], onEditGear })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({ materialLog: [filledEntry], onAssignMaterial, onEditMaterial })} />);

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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [entry] })} />);
    expect(screen.getByRole('button', { name: 'Edit Ring for Alice — Floor 1' })).toBeInTheDocument();
  });
});

describe('LogWeekGrid — read-only (canEdit=false)', () => {
  it('renders zero buttons but still shows badges', () => {
    const entry = makeLootEntry({ itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [entry], canEdit: false })} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});

describe('LogWeekGrid — canAssignMaterial=false (F-12)', () => {
  it('renders no button on an empty material cell but keeps the edit button on a filled one', () => {
    const filledEntry = makeMaterialEntry({ materialType: 'twine', floor: 'Floor 3', recipientPlayerId: 'p1', recipientPlayerName: 'Alice' });
    renderGrid(<LogWeekGrid {...baseProps({ materialLog: [filledEntry], canAssignMaterial: false })} />);

    // Empty glaze cell (floor 2) — read-only, no button.
    expect(screen.queryByRole('button', { name: 'Log Glaze — Floor 2' })).not.toBeInTheDocument();
    expect(screen.getByText('Glaze: not logged')).toBeInTheDocument();

    // Filled twine cell (floor 3) — still editable.
    expect(screen.getByRole('button', { name: 'Edit Twine for Alice — Floor 3' })).toBeInTheDocument();
  });
});

describe('LogWeekGrid — F-4 GearSlotIcon hazard', () => {
  it('every GearSlotIcon rendered in a <th> sits inside an inline-flex wrapper', () => {
    const { container } = renderGrid(<LogWeekGrid {...baseProps()} />);
    const headerIcons = container.querySelectorAll('th[scope="col"] [aria-hidden="true"]');
    expect(headerIcons.length).toBeGreaterThan(0);
    headerIcons.forEach((icon) => {
      expect(icon.parentElement?.className).toContain('inline-flex');
    });
  });

  it('every aria-hidden element that is itself a flex/grid container carries role="presentation"', () => {
    const entry = makeLootEntry({ itemSlot: 'earring', floor: 'Floor 1' });
    const { container } = renderGrid(<LogWeekGrid {...baseProps({ lootLog: [entry] })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [entry], players: [makePlayer({ id: 'p1' })] })} />);
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
  // (`${label} entry actions — ${floorName}`, R-D6b + F3/PR #244 review) and,
  // when multi-entry, a chip trigger
  // (`N entries for ${label} — ${floorName}`) — both of which ALSO match a
  // bare label fragment like 'Ears' or 'Neck'. Disambiguate by preferring
  // the Edit/Log-prefixed control (the one this helper always meant).
  function cellButton(fragment: string | RegExp) {
    const matcher = typeof fragment === 'string' ? new RegExp(fragment) : fragment;
    const candidates = screen.getAllByRole('button', { name: matcher });
    const edit = candidates.find((el) => /^(Edit|Log) /.test(el.getAttribute('aria-label') ?? ''));
    // F6 (director M4): no silent fallback to candidates[0] — that would
    // quietly select the kebab (or chip trigger) if the aria-label prefix
    // ever drifts, masking a real selection failure behind a passing test.
    if (!edit) throw new Error(`cellButton(${String(fragment)}): no Edit/Log-prefixed control among ${candidates.length} candidate(s)`);
    return edit;
  }

  // Mouse-path tests PIN detail: 1 (director F-14) — fireEvent.click defaults to detail: 0,
  // which is the AT path; the C4 precedent is RosterGearTable.test.tsx:381,523.
  it('Shift+Click copies and does NOT open the edit door', () => {
    const onEditGear = vi.fn(); const onCopyEntryLink = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], onEditGear, onCopyEntryLink,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { shiftKey: true, detail: 1 });
    expect(onCopyEntryLink).toHaveBeenCalledWith({ kind: 'loot', entry: ears });
    expect(onEditGear).not.toHaveBeenCalled();
  });

  it('Alt+Click jumps to the recipient and does NOT edit', () => {
    const onEditGear = vi.fn(); const onJumpToPlayer = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
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
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ghost], players: [tankOne], onEditGear, onJumpToPlayer,
    })}
    />);
    fireEvent.click(cellButton('Ears'), { altKey: true, detail: 1 });
    expect(onJumpToPlayer).not.toHaveBeenCalled();
    expect(onEditGear).not.toHaveBeenCalled();
  });

  it('an unmodified synthetic click (detail: 0, no altKey) edits — the AT route never jumps (D6-c)', () => {
    const onEditGear = vi.fn(); const onJumpToPlayer = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
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
    renderGrid(<LogWeekGrid {...baseProps({
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

  it('right-click opens the menu with Edit/Copy link/Jump/Delete', () => {
    const onCopyEntryLink = vi.fn(); const onJumpToPlayer = vi.fn(); const onDeleteEntry = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [ears], players: [tankOne], onDeleteEntry })} />);
    fireEvent.contextMenu(cellButton('Ears'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDeleteEntry).toHaveBeenCalledWith({ kind: 'loot', entry: ears });
  });

  it('the Jump item is absent when the recipient is unresolvable', () => {
    const ghost = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed',
    });
    const onJumpToPlayer = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [ghost], players: [tankOne], onJumpToPlayer })} />);
    fireEvent.contextMenu(cellButton('Ears'));
    expect(screen.queryByRole('menuitem', { name: /Jump to/ })).not.toBeInTheDocument();
  });

  it('Shift/Alt clicks on an EMPTY interactive cell are no-ops (D6-h)', () => {
    const onAssignGear = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [ears], players: [tankOne], onAssignGear })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne] })} />);
    const edit = screen.getByRole('button', { name: 'Edit Ears for Healer One — Floor 1 (newest of 2)' });
    const chip = screen.getByRole('button', { name: '2 entries for Ears — Floor 1' });
    expect(edit).not.toContainElement(chip);
  });

  it('multi-entry accessible name folds the count in (D5-owed fix); single-entry name has no suffix', () => {
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne] })} />);
    expect(screen.getByRole('button', { name: 'Edit Ears for Healer One — Floor 1 (newest of 2)' })).toBeInTheDocument();

    const single = makeLootEntry({
      itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne] })} />);
    expect(screen.getByRole('button', { name: 'Edit Neck for Tank One — Floor 1' })).toBeInTheDocument();
  });

  it('chip menu item click opens the edit door for the OLDER entry', async () => {
    const onEditGear = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [older, newer], players: [tankOne, healerOne], onEditGear })} />);
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
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne, healerOne], canEdit: false,
    })}
    />);
    expect(screen.getByText('Ears: Healer One, 2 entries')).toBeInTheDocument();
  });

  it('review fix: read-only multi-entry cell shows a visible static ×2 span alongside the sr-only sentence', () => {
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne, healerOne], canEdit: false,
    })}
    />);
    const chip = screen.getByText('×2');
    expect(chip).toBeInTheDocument();
    expect(screen.getByText('Ears: Healer One, 2 entries')).toBeInTheDocument();

    // F2 (director M2): the chip lives INSIDE the same `inline-flex ...
    // gap-1` wrapper as the badge (D5's shape) — not as a sibling outside
    // it — so `gap-1`/`items-center` actually apply to it.
    const badge = screen.getByText('Healer One');
    const wrapper = chip.parentElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('gap-1');
    expect(wrapper?.className).toContain('items-center');
    expect(wrapper).toContainElement(badge);
  });

  it('review fix: read-only single-entry cell shows neither a ×N span nor a count in the sr-only sentence', () => {
    const single = makeLootEntry({
      itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne], canEdit: false })} />);
    expect(screen.queryByText(/^×\d/)).not.toBeInTheDocument();
    expect(screen.getByText('Neck: Tank One')).toBeInTheDocument();
  });

  it('the revealed kebab renders on every FILLED interactive cell (single or multi-entry) with hover/focus reveal classes', () => {
    const single = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne] })} />);
    const kebab = screen.getByRole('button', { name: 'Ears entry actions — Floor 1' });
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
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [single], players: [tankOne], onEditGear, onCopyEntryLink, onJumpToPlayer, onDeleteEntry,
    })}
    />);
    const kebab = screen.getByRole('button', { name: 'Ears entry actions — Floor 1' });
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
    const { container } = renderGrid(<LogWeekGrid {...baseProps({
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

// ── PR #244 r3 fix: whole-cell right-click target (wrapper-level menu) ──────
// claude[bot] round-3 finding: `onContextMenu` lived only on the edit
// `Button` (D6 modifier layer's `requestMenu`), so right-clicking the ×N
// chip, the kebab, or the cell's own padding fell through to the native
// browser menu instead of `buildEntryMenuItems` — narrower than "right-click
// a cell" as the file header / release note describe. The existing
// `fireEvent.contextMenu(cellButton(...))` tests above still pass unchanged
// after the fix — their continuing to pass is the bubbling proof (Shift+F10
// fires `contextmenu` on the focused control, which bubbles to the wrapper).
describe('D6a right-click target (PR #244 r3 fix): whole-cell right-click', () => {
  const tankOne = makePlayer({ id: 'p1', name: 'Tank One', job: 'PLD', role: 'tank' });
  const healerOne = makePlayer({ id: 'p2', name: 'Healer One', job: 'WHM', role: 'healer' });
  const older = makeLootEntry({
    itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-01T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
  });
  const newer = makeLootEntry({
    itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-05T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
  });

  it('right-clicking the cell WRAPPER itself (not the edit button) opens the menu with the full item set', () => {
    const onCopyEntryLink = vi.fn(); const onJumpToPlayer = vi.fn(); const onDeleteEntry = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne, healerOne], onCopyEntryLink, onJumpToPlayer, onDeleteEntry,
    })}
    />);
    // Reach the wrapper via the ×2 chip's own ancestor — `.group` is the
    // `<span className="group flex items-center gap-1">` wrapper D6a Task 4
    // introduced (same idiom the highlightEntry tests above use).
    const chip = screen.getByRole('button', { name: '2 entries for Ears — Floor 1' });
    const wrapper = chip.closest('.group')!;
    expect(wrapper).not.toBe(chip);
    fireEvent.contextMenu(wrapper);
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: `Jump to ${healerOne.name}` })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('right-clicking the ×N chip trigger opens the ENTRY context menu (bubbles to the wrapper), not nothing', () => {
    const onDeleteEntry = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne, healerOne], onDeleteEntry,
    })}
    />);
    const chip = screen.getByRole('button', { name: '2 entries for Ears — Floor 1' });
    fireEvent.contextMenu(chip);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    // The menu targets the NEWEST entry — same contract as the edit button's
    // own right-click (`buildRef(newest)` in `requestMenu`).
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDeleteEntry).toHaveBeenCalledWith({ kind: 'loot', entry: newer });
  });
});

// ── D6a Task 6: highlightEntry — the `?entry=` deep-link target ─────────────
describe('D6a Task 6: highlightEntry', () => {
  const tankOne = makePlayer({ id: 'p1', name: 'Tank One', job: 'PLD', role: 'tank' });
  const ears = makeLootEntry({
    id: 501, itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
  });
  const neck = makeLootEntry({
    id: 502, itemSlot: 'necklace', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
  });

  it('renders the pulse class + DOM id on the matching cell only', () => {
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears, neck], players: [tankOne],
      highlightEntry: { kind: 'loot', id: ears.id },
    })}
    />);
    const earsWrapper = screen.getByRole('button', { name: 'Edit Ears for Tank One — Floor 1' }).closest('.group')!;
    const neckWrapper = screen.getByRole('button', { name: 'Edit Neck for Tank One — Floor 1' }).closest('.group')!;
    expect(earsWrapper.className).toContain('highlight-pulse');
    expect(earsWrapper.id).toBe(`log-cell-loot-${ears.id}`);
    expect(neckWrapper.className).not.toContain('highlight-pulse');
    expect(neckWrapper.id).toBe('');
  });

  it('highlightEntry: null renders neither the pulse class nor an id anywhere', () => {
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], highlightEntry: null,
    })}
    />);
    const wrapper = screen.getByRole('button', { name: 'Edit Ears for Tank One — Floor 1' }).closest('.group')!;
    expect(wrapper.className).not.toContain('highlight-pulse');
    expect(wrapper.id).toBe('');
  });

  it("kind discriminates, not just id — a material ref sharing the loot entry's numeric id does not highlight it", () => {
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne],
      highlightEntry: { kind: 'material', id: ears.id },
    })}
    />);
    const wrapper = screen.getByRole('button', { name: 'Edit Ears for Tank One — Floor 1' }).closest('.group')!;
    expect(wrapper.className).not.toContain('highlight-pulse');
  });

  it('the cross-file id contract (F-2): document.getElementById(logCellDomId(ref)) resolves to the pulsed wrapper — the same helper both sides consume', () => {
    const ref: LogGridEntryRef = { kind: 'loot', entry: ears };
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne],
      highlightEntry: { kind: ref.kind, id: ref.entry.id },
    })}
    />);
    const el = document.getElementById(logCellDomId(ref));
    expect(el).not.toBeNull();
    expect(el?.className).toContain('highlight-pulse');
  });

  // F1 (director R2) — the read-only (canEdit=false, share-code viewer) FILLED
  // branch must carry the SAME landing contract as the interactive branch, or a
  // viewer following a copied deep link gets week re-pointing with no scroll/pulse
  // while the URL params silently self-clear as if the link worked.
  it('F1: read-only FILLED cell also gets the deep-link landing contract — id + highlight-pulse', () => {
    const ref: LogGridEntryRef = { kind: 'loot', entry: ears };
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears, neck], players: [tankOne], canEdit: false,
      highlightEntry: { kind: ref.kind, id: ref.entry.id },
    })}
    />);
    const el = document.getElementById(logCellDomId(ref));
    expect(el).not.toBeNull();
    expect(el?.className).toContain('highlight-pulse');
  });

  it('F1: read-only cell renders neither an id nor the pulse class when highlightEntry is null', () => {
    const ref: LogGridEntryRef = { kind: 'loot', entry: ears };
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [ears], players: [tankOne], canEdit: false, highlightEntry: null,
    })}
    />);
    expect(document.getElementById(logCellDomId(ref))).toBeNull();
    expect(document.querySelector('.highlight-pulse')).toBeNull();
  });

  // F1 (director R2, PR #244 review): the highlighted ref used to be assumed
  // `entries[0]` (newest) — a deep link copied before a second entry landed
  // in the same cell targets an OLDER entry that `Loot.tsx`'s `?entry=`
  // validation (searches the whole unfiltered log) happily resolves, so the
  // id + pulse must land wherever that entry actually sits in the cell, not
  // just on whichever is newest. The edit door still targets the newest
  // entry regardless — highlighting and editing are separate concerns.
  it('F1: a multi-entry cell highlighting the OLDER (non-newest) entry gets that entry\'s DOM id + pulse', () => {
    const older = makeLootEntry({
      id: 601, itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-01T00:00:00Z',
      recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    const newer = makeLootEntry({
      id: 602, itemSlot: 'earring', floor: 'Floor 1', createdAt: '2026-01-05T00:00:00Z',
      recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    const olderRef: LogGridEntryRef = { kind: 'loot', entry: older };
    renderGrid(<LogWeekGrid {...baseProps({
      lootLog: [older, newer], players: [tankOne],
      highlightEntry: { kind: 'loot', id: older.id },
    })}
    />);
    const editButton = screen.getByRole('button', { name: 'Edit Ears for Tank One — Floor 1 (newest of 2)' });
    const wrapper = editButton.closest('.group')!;
    expect(wrapper.id).toBe(logCellDomId(olderRef));
    expect(wrapper.className).toContain('highlight-pulse');
  });
});

// ── D6b Task 4 remainder: teaching tooltip + recipient hover-× ──────────────
describe('D6b teaching tooltip + hover-×', () => {
  const tankOne = makePlayer({ id: 'p1', name: 'Tank One', job: 'PLD', role: 'tank' });
  const healerOne = makePlayer({ id: 'p2', name: 'Healer One', job: 'WHM', role: 'healer' });
  // Real floor names (not the "Floor N" fallback) so the aria-labels below
  // read "— M9S" — same fixture shape `LogWeekGrid — sections and R-19
  // headers > shows the duty-name Tag...` already uses.
  const NAMED_FLOORS = ['M9S', 'M10S', 'M11S', 'M12S'];

  // Same disambiguation helper as the `D6 modifier layer` describe above — a
  // filled cell's kebab/chip/hover-× all also match a bare label fragment
  // like 'Ears', so this always resolves to the Edit-prefixed control.
  function cellButton(fragment: string | RegExp) {
    const matcher = typeof fragment === 'string' ? new RegExp(fragment) : fragment;
    const candidates = screen.getAllByRole('button', { name: matcher });
    const edit = candidates.find((el) => /^(Edit|Log) /.test(el.getAttribute('aria-label') ?? ''));
    if (!edit) throw new Error(`cellButton(${String(fragment)}): no Edit/Log-prefixed control among ${candidates.length} candidate(s)`);
    return edit;
  }

  it('filled cells carry the teaching tooltip; the Alt row is omitted when no jump target', async () => {
    const ears = makeLootEntry({
      itemSlot: 'earring', floor: 'M9S', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
    });
    const { unmount } = renderGrid(<LogWeekGrid {...baseProps({
      floors: NAMED_FLOORS, lootLog: [ears], players: [tankOne, healerOne],
    })}
    />);
    fireEvent.focus(cellButton('Ears'));
    // Radix renders the open content twice (visible popup + visually-hidden
    // aria-describedby copy) for non-string content — findAllByText per the
    // RosterCard.test.tsx precedent.
    expect((await screen.findAllByText('Edit entry')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shift+Click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Copy link').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alt+Click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Go to player').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Right-click').length).toBeGreaterThan(0);
    expect(screen.getAllByText('More options').length).toBeGreaterThan(0);
    unmount();

    // Re-render with an entry whose recipientPlayerId matches no player —
    // the jump target never resolves, so the Alt row must not render.
    const ghost = makeLootEntry({
      itemSlot: 'earring', floor: 'M9S', recipientPlayerId: 'ghost', recipientPlayerName: 'Departed',
    });
    renderGrid(<LogWeekGrid {...baseProps({
      floors: NAMED_FLOORS, lootLog: [ghost], players: [tankOne],
    })}
    />);
    fireEvent.focus(cellButton('Ears'));
    expect((await screen.findAllByText('Edit entry')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Alt+Click')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to player')).not.toBeInTheDocument();
  });

  it('empty interactive cells teach "Click to log {label}"', async () => {
    renderGrid(<LogWeekGrid {...baseProps()} />);
    const neckButton = screen.getByRole('button', { name: /Log Neck/ });
    fireEvent.focus(neckButton);
    expect((await screen.findAllByText('Click to log Neck')).length).toBeGreaterThan(0);
  });

  it('teaching tooltip kbd chips are text-xs (12px floor)', async () => {
    const ears = makeLootEntry({
      itemSlot: 'earring', floor: 'M9S', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ floors: NAMED_FLOORS, lootLog: [ears], players: [tankOne] })} />);
    fireEvent.focus(cellButton('Ears'));
    await screen.findAllByText('Edit entry');
    // Query the portal content directly (it renders outside RTL's own
    // `container`, so a container-scoped query would miss it).
    const kbds = document.querySelectorAll('kbd');
    expect(kbds.length).toBeGreaterThan(0);
    kbds.forEach((kbd) => expect(kbd.className).toContain('text-xs'));
  });

  it('hover-× requests deletion of the newest entry and is focus-revealable', () => {
    const older = makeLootEntry({
      itemSlot: 'earring', floor: 'M9S', createdAt: '2026-01-01T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
    });
    const newest = makeLootEntry({
      itemSlot: 'earring', floor: 'M9S', createdAt: '2026-01-05T00:00:00Z', recipientPlayerId: 'p2', recipientPlayerName: 'Healer One',
    });
    const onDeleteEntry = vi.fn();
    renderGrid(<LogWeekGrid {...baseProps({
      floors: NAMED_FLOORS, lootLog: [older, newest], players: [tankOne, healerOne], onDeleteEntry,
    })}
    />);
    const del = screen.getByRole('button', { name: 'Delete Ears entry for Healer One — M9S' });
    expect(del.className).toContain('focus-visible:opacity-100');
    fireEvent.click(del);
    expect(onDeleteEntry).toHaveBeenCalledWith({ kind: 'loot', entry: newest });
  });

  it('the aria-hidden flex/grid sweep still passes over the new anatomy (open tooltip portal)', async () => {
    const ears = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    const glaze = makeMaterialEntry({
      materialType: 'glaze', floor: 'Floor 2', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [ears], materialLog: [glaze], players: [tankOne] })} />);
    fireEvent.focus(cellButton('Ears'));
    await screen.findAllByText('Edit entry');
    // Sweep the whole document (not just RTL's `container`) — the open
    // tooltip's content is Portal-rendered outside it.
    const ariaHiddenEls = document.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenEls.length).toBeGreaterThan(0);
    ariaHiddenEls.forEach((el) => {
      const isFlexOrGrid = /\b(flex|inline-flex|grid|inline-grid)\b/.test(el.className);
      if (isFlexOrGrid) {
        expect(el.getAttribute('role')).toBe('presentation');
      }
    });
  });

  it('cell kebab announces aria-haspopup=menu (B-R3 fold-in)', () => {
    const single = makeLootEntry({
      itemSlot: 'earring', floor: 'Floor 1', recipientPlayerId: 'p1', recipientPlayerName: 'Tank One',
    });
    renderGrid(<LogWeekGrid {...baseProps({ lootLog: [single], players: [tankOne] })} />);
    const kebab = screen.getByRole('button', { name: 'Ears entry actions — Floor 1' });
    expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
  });
});
