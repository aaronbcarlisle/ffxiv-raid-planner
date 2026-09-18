import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LootHistoryTable } from './LootHistoryTable';
import { historyRowDomId } from './logWeekGridData';
import { DEFAULT_HISTORY_FILTERS } from '../../utils/historyItems';
import { GEAR_SLOT_ICONS } from '../../types';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

function makePlayer(overrides: Partial<SnapshotPlayer> = {}): SnapshotPlayer {
  return {
    id: 'p1',
    tierSnapshotId: 't1',
    name: 'Aria',
    job: 'WHM',
    role: 'healer',
    configured: true,
    sortOrder: 0,
    isSubstitute: false,
    gear: [],
    tomeWeapon: {},
    weaponPriorities: [],
    ...overrides,
  } as unknown as SnapshotPlayer;
}

function makeLootEntry(overrides: Partial<LootLogEntry> = {}): LootLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    itemSlot: 'body',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    isExtra: false,
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

function makeMaterialEntry(overrides: Partial<MaterialLogEntry> = {}): MaterialLogEntry {
  return {
    id: 1,
    tierSnapshotId: 't1',
    weekNumber: 2,
    floor: 'M10S',
    materialType: 'twine',
    recipientPlayerId: 'p1',
    recipientPlayerName: 'Aria',
    method: 'drop',
    createdAt: '2026-06-24T12:00:00Z',
    createdByUserId: 'u1',
    createdByUsername: 'aria',
    ...overrides,
  };
}

const floors = ['M9S', 'M10S', 'M11S', 'M12S'];
const players = [makePlayer()];

function renderTable(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}, initialEntries: string[] = ['/']) {
  const props = {
    lootLog: [],
    materialLog: [],
    players,
    floors,
    filters: DEFAULT_HISTORY_FILTERS,
    canEdit: true,
    onEdit: vi.fn(),
    onCopyLink: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LootHistoryTable {...props} />
    </MemoryRouter>
  );
}

function openKebab(container: HTMLElement) {
  fireEvent.keyDown(within(container).getByRole('button', { name: 'Entry actions' }), { key: 'Enter' });
}

/** Column order is the table's contract: Week · Floor · Slot · Player · Method · Date · Type · ⋮ */
const COL = { week: 0, floor: 1, slot: 2, player: 3, method: 4, date: 5, type: 6, actions: 7 } as const;

function rowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr[id]')).map((tr) => tr.id);
}

function cell(rowId: string, col: number): HTMLElement {
  const row = document.getElementById(rowId);
  if (!row) throw new Error(`row ${rowId} not rendered`);
  return row.querySelectorAll('td')[col];
}

function header(label: string): HTMLElement {
  return screen.getByRole('columnheader', { name: label });
}

const GEAR_SLOT_ART = '/images/gear-slots/';

function spansWithGearArt(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('span')).filter((s) =>
    (s.getAttribute('style') ?? '').includes(GEAR_SLOT_ART)
  );
}

describe('LootHistoryTable', () => {
  describe('headers + caption', () => {
    it('renders seven sortable column headers, an sr-only Actions header and a caption', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry()] });

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(8);

      expect(header('Week')).toHaveAttribute('aria-sort', 'descending');
      for (const label of ['Floor', 'Slot', 'Player', 'Method', 'Date', 'Type']) {
        expect(header(label)).toHaveAttribute('aria-sort', 'none');
      }

      const actions = header('Actions');
      expect(actions).toHaveTextContent('Actions');
      expect(within(actions).queryByRole('button')).not.toBeInTheDocument();

      const caption = container.querySelector('caption');
      expect(caption).not.toBeNull();
      expect(caption).toHaveClass('sr-only');
      expect(caption?.textContent?.trim()).not.toBe('');
    });
  });

  describe('sorting', () => {
    it('renders the default order (week desc, newest first within a week) from out-of-order seeding', () => {
      // Seeded deliberately NOT in display order: [loot W1 old, mat W2 old, loot W2 new, loot W1 new].
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 1, createdAt: '2026-06-17T10:00:00Z' }),
        makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 4, weekNumber: 1, createdAt: '2026-06-17T12:00:00Z' }),
      ];
      const materialLog = [makeMaterialEntry({ id: 2, weekNumber: 2, createdAt: '2026-06-24T10:00:00Z' })];
      const { container } = renderTable({ lootLog, materialLog });

      expect(rowIds(container)).toEqual(['loot-entry-3', 'material-entry-2', 'loot-entry-4', 'loot-entry-1']);
    });

    it('clicking Player sorts A→Z, again Z→A, and clicking Week (inactive) restores the natural desc', () => {
      const roster = [
        makePlayer({ id: 'p1', name: 'Aria' }),
        makePlayer({ id: 'p2', name: 'Zed' }),
        makePlayer({ id: 'p3', name: 'Mira' }),
      ];
      // createdAt order (desc) is Zed, Aria, Mira — distinct from every name order,
      // so the default and both Player directions are three different sequences.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p2', recipientPlayerName: 'Zed', createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T11:00:00Z' }),
        makeLootEntry({ id: 3, recipientPlayerId: 'p3', recipientPlayerName: 'Mira', createdAt: '2026-06-24T10:00:00Z' }),
      ];
      const { container } = renderTable({ lootLog, players: roster });
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-2', 'loot-entry-3']);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-2', 'loot-entry-3', 'loot-entry-1']);
      expect(header('Player')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Week')).toHaveAttribute('aria-sort', 'none');

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-3', 'loot-entry-2']);
      expect(header('Player')).toHaveAttribute('aria-sort', 'descending');

      fireEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(rowIds(container)).toEqual(['loot-entry-1', 'loot-entry-2', 'loot-entry-3']);
      expect(header('Week')).toHaveAttribute('aria-sort', 'descending');
      expect(header('Player')).toHaveAttribute('aria-sort', 'none');
    });

    it('keeps ties newest-first under a text sort (Player asc)', () => {
      const roster = [makePlayer({ id: 'p1', name: 'Aria' }), makePlayer({ id: 'p2', name: 'Zed' })];
      // Three Aria rows with three createdAts, plus a NEWER Zed row so the default
      // order (Zed first) differs from Player asc (Aria's three first) — the
      // assertion can't pass on the unsorted default.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T10:00:00Z' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T12:00:00Z' }),
        makeLootEntry({ id: 3, recipientPlayerId: 'p1', recipientPlayerName: 'Aria', createdAt: '2026-06-24T11:00:00Z' }),
        makeLootEntry({ id: 4, recipientPlayerId: 'p2', recipientPlayerName: 'Zed', createdAt: '2026-06-24T13:00:00Z' }),
      ];
      const { container } = renderTable({ lootLog, players: roster });
      expect(rowIds(container)).toEqual(['loot-entry-4', 'loot-entry-2', 'loot-entry-3', 'loot-entry-1']);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(rowIds(container)).toEqual(['loot-entry-2', 'loot-entry-3', 'loot-entry-1', 'loot-entry-4']);
    });
  });

  describe('Floor cell (R-33 / R-45 / D9a-r)', () => {
    it('renders a token-toned floor chip with no inline colour', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, floor: 'M10S' })] });
      const chip = within(cell('loot-entry-1', COL.floor)).getByText('M10S');
      expect(chip).toHaveClass('text-floor-2', 'bg-floor-2/10');
      expect(chip.getAttribute('style')).toBeNull();
    });

    it('falls back to the muted tone for a floor the tier does not know', () => {
      expect(() => renderTable({ lootLog: [makeLootEntry({ id: 1, floor: 'XYZ' })] })).not.toThrow();
      const chip = within(cell('loot-entry-1', COL.floor)).getByText('XYZ');
      expect(chip).toHaveClass('text-text-secondary');
      expect(chip.className).not.toMatch(/text-floor-/);
    });

    it('renders an em dash — and no Tag — for an empty floor', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, floor: '' })] });
      const floorCell = cell('loot-entry-1', COL.floor);
      expect(floorCell.textContent?.trim()).toBe('—');
      expect(floorCell.querySelector('[class*="text-floor-"]')).toBeNull();
      expect(floorCell.querySelector('.bg-surface-elevated')).toBeNull();
    });
  });

  describe('Slot cell (R-39)', () => {
    it('leads a loot row with the aria-hidden slot glyph and the slot display name', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      const glyph = slotCell.querySelector('[aria-hidden="true"]');
      expect(glyph).not.toBeNull();
      expect(glyph?.getAttribute('style')).toContain(GEAR_SLOT_ICONS.body);
      expect(slotCell).toHaveTextContent('Body');
    });

    it('leads a material row with the material dot, never the gear-slot art', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, materialType: 'twine' })] });
      const slotCell = cell('material-entry-5', COL.slot);
      expect(slotCell.querySelector('span.bg-material-twine')).not.toBeNull();
      expect(spansWithGearArt(slotCell)).toHaveLength(0);
      expect(slotCell).toHaveTextContent('Twine');
    });

    it("maps the loot-log 'ring' value to the shared ring art and the generic 'Ring' name", () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'ring' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell).toHaveTextContent('Ring');
      expect(slotCell.querySelector('[aria-hidden="true"]')?.getAttribute('style')).toContain(GEAR_SLOT_ICONS.ring1);
    });

    it('renders an unknown slot as raw text with no glyph, without throwing', () => {
      expect(() => renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'not_a_slot' })] })).not.toThrow();
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell).toHaveTextContent('not_a_slot');
      expect(slotCell.querySelector('[aria-hidden="true"]')).toBeNull();
      expect(spansWithGearArt(slotCell)).toHaveLength(0);
    });
  });

  describe('weapon row (R-38)', () => {
    it("shows the WEAPON's job in Slot and the RECIPIENT's job in Player — never swapped", () => {
      // Recipient is a WHM; the weapon that dropped is a DRG weapon.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'weapon', weaponJob: 'DRG' })],
        players: [makePlayer({ id: 'p1', job: 'WHM' })],
      });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(within(slotCell).getByAltText('DRG')).toBeInTheDocument();
      expect(within(slotCell).queryByAltText('WHM')).not.toBeInTheDocument();

      const playerCell = cell('loot-entry-1', COL.player);
      expect(within(playerCell).getByAltText('WHM')).toBeInTheDocument();
      expect(within(playerCell).queryByAltText('DRG')).not.toBeInTheDocument();
    });

    it('renders no job icon in Slot for a non-weapon row', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })] });
      expect(cell('loot-entry-1', COL.slot).querySelector('img')).toBeNull();
    });

    it('ignores a stale weaponJob on a non-weapon row (the edit API keeps weapon_job when the slot changes)', () => {
      // A weapon entry later edited to Body keeps its old `weaponJob`; the icon
      // is gated on the slot, not on the field's presence.
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'body', weaponJob: 'DRG' })] });
      const slotCell = cell('loot-entry-1', COL.slot);
      expect(slotCell.querySelector('img')).toBeNull();
      expect(within(slotCell).queryByAltText('DRG')).not.toBeInTheDocument();
      expect(slotCell).toHaveTextContent('Body');
    });
  });

  describe('Player cell', () => {
    it('renders the resolved roster name with the job icon', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const playerCell = cell('loot-entry-1', COL.player);
      expect(playerCell).toHaveTextContent('Aria');
      expect(within(playerCell).getByAltText('WHM')).toBeInTheDocument();
    });

    it('falls back to the stored recipient name, with no job icon, when the player is unknown', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' })],
        players: [],
      });
      const playerCell = cell('loot-entry-1', COL.player);
      expect(playerCell).toHaveTextContent('Departed Player');
      expect(playerCell.querySelector('img')).toBeNull();
    });
  });

  describe('Method / Date cells', () => {
    it('renders the method label, falling back to the raw method for an unknown one', () => {
      renderTable({
        lootLog: [
          makeLootEntry({ id: 1, method: 'book' }),
          makeLootEntry({ id: 2, method: 'tome' }),
          makeLootEntry({ id: 3, method: 'xyz' as LootLogEntry['method'] }),
        ],
      });
      expect(cell('loot-entry-1', COL.method)).toHaveTextContent('Book');
      expect(cell('loot-entry-2', COL.method)).toHaveTextContent('Tome');
      expect(cell('loot-entry-3', COL.method)).toHaveTextContent('xyz');
    });

    it('renders an absolute date (date half asserted only — the time half is local, D9a-o)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, createdAt: '2026-06-24T15:45:00Z' })] });
      // Built the same way the component does (Intl, local tz) — a literal
      // 'Jun 24' fails on runners at UTC+8:15 or later, where the local date
      // is already Jun 25.
      const expectedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
        new Date('2026-06-24T15:45:00Z'),
      );
      expect(cell('loot-entry-1', COL.date).textContent?.startsWith(`${expectedDate}, `)).toBe(true);
    });

    it('renders an em dash for an unparseable date instead of throwing (M4)', () => {
      expect(() =>
        renderTable({ lootLog: [makeLootEntry({ id: 1, createdAt: 'not-a-date' })] }),
      ).not.toThrow();
      expect(cell('loot-entry-1', COL.date).textContent?.trim()).toBe('—');
    });
  });

  describe('Type cell (R-34 / R-D9a-A / D9a-t)', () => {
    it('renders BiS for a loot row and Extra when isExtra — the old badge copy is gone', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 }), makeLootEntry({ id: 2, isExtra: true })] });
      expect(cell('loot-entry-1', COL.type)).toHaveTextContent('BiS');
      expect(cell('loot-entry-2', COL.type)).toHaveTextContent('Extra');
      expect(screen.queryByText('BiS need')).toBeNull();
      expect(screen.queryByText('free / sell')).toBeNull();
    });

    it('renders aug body for a material with slotAugmented body', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, slotAugmented: 'body' })] });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug body');
    });

    it('renders aug tome wpn for slotAugmented null AND tome_weapon (never the raw enum)', () => {
      renderTable({
        materialLog: [
          makeMaterialEntry({ id: 5, slotAugmented: null }),
          makeMaterialEntry({ id: 6, slotAugmented: 'tome_weapon' }),
        ],
      });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug tome wpn');
      expect(cell('material-entry-6', COL.type)).toHaveTextContent('aug tome wpn');
      expect(screen.queryByText(/tome_weapon/)).toBeNull();

      const tag = within(cell('material-entry-5', COL.type)).getByText('aug tome wpn');
      expect(tag.className).toContain('whitespace-nowrap');
    });
  });

  describe('filters + empty', () => {
    it('applies the filters prop to narrow rendered rows', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 2, method: 'drop' }),
        makeLootEntry({ id: 2, weekNumber: 2, method: 'tome' }),
      ];
      renderTable({ lootLog, filters: { ...DEFAULT_HISTORY_FILTERS, source: 'tome' } });
      expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
    });

    it('renders the muted empty line in one full-width cell, headers still present', () => {
      const { container } = renderTable({ lootLog: [], materialLog: [] });
      const emptyCell = screen.getByText('No entries match — log a drop from the Priority view.');
      expect(emptyCell.tagName).toBe('TD');
      expect(emptyCell).toHaveAttribute('colspan', '8');
      expect(container.querySelectorAll('tbody td')).toHaveLength(1);
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    });

    it('renders material rows with the material-entry id', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog });
      expect(document.getElementById('material-entry-5')).toBeInTheDocument();
    });
  });

  describe('kebab', () => {
    it('shows Edit/Copy link/Delete for a loot row when canEdit is true', async () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      openKebab(document.getElementById('loot-entry-1')!);
      expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides Edit for a material row even when canEdit is true (loot rows only)', async () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5 })] });
      openKebab(document.getElementById('material-entry-5')!);
      expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides Edit and Delete but keeps Copy link when canEdit is false', async () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })], canEdit: false });
      openKebab(document.getElementById('loot-entry-1')!);
      expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('fires onEdit with the underlying entry when the kebab Edit item is selected', async () => {
      const onEdit = vi.fn();
      const entry = makeLootEntry({ id: 1, weekNumber: 2 });
      renderTable({ lootLog: [entry], onEdit });
      openKebab(document.getElementById('loot-entry-1')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledWith(entry);
    });

    it('fires onCopyLink(item) with the loot ref when Copy link is selected', async () => {
      const onCopyLink = vi.fn();
      const entry = makeLootEntry({ id: 1 });
      renderTable({ lootLog: [entry], onCopyLink });
      openKebab(document.getElementById('loot-entry-1')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Copy link' }));
      expect(onCopyLink).toHaveBeenCalledWith({ kind: 'loot', entry });
    });

    it('fires onDelete(item) with the material ref when Delete is selected', async () => {
      const onDelete = vi.fn();
      const entry = makeMaterialEntry({ id: 5 });
      renderTable({ materialLog: [entry], onDelete });
      openKebab(document.getElementById('material-entry-5')!);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledWith({ kind: 'material', entry });
    });
  });

  describe('inert row (D9a-i)', () => {
    it('the row carries no tabindex, no cursor-pointer and no aria-label', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const tr = container.querySelector('tbody tr')!;
      expect(tr).not.toHaveAttribute('tabindex');
      expect(tr).not.toHaveAttribute('aria-label');
      expect(tr).not.toHaveClass('cursor-pointer');
    });
  });

  describe('deep-link highlight', () => {
    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView.
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('marks the row matching ?entry= as highlight-pulse and clears the param after 2.5s', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=1']);

      const row = document.getElementById('loot-entry-1')!;
      expect(row).toHaveClass('highlight-pulse');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(row).not.toHaveClass('highlight-pulse');
    });

    it('honors entryType=material for the deep link', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog }, ['/?entry=5&entryType=material']);

      const row = document.getElementById('material-entry-5')!;
      expect(row).toHaveClass('highlight-pulse');
    });

    it('does not highlight when the entry id is not present in the unfiltered log', () => {
      const lootLog = [makeLootEntry({ id: 1, weekNumber: 2 })];
      renderTable({ lootLog }, ['/?entry=999']);
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
    });

    it('scrolls the element whose id historyRowDomId returns (one author for effect + row)', () => {
      const scrolled: Element[] = [];
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: function (this: Element) {
          scrolled.push(this);
        },
      });
      const entry = makeLootEntry({ id: 42, weekNumber: 2 });
      renderTable({ lootLog: [entry] }, ['/?entry=42']);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const expectedId = historyRowDomId({ kind: 'loot', id: entry.id });
      expect(scrolled.map((el) => el.id)).toEqual([expectedId]);
      expect(document.getElementById(expectedId)).toHaveClass('highlight-pulse');
    });
  });

  describe('F-4 aria-hidden hazard sweep', () => {
    it('every aria-hidden lead-in in a Slot cell sits inside the inline-flex wrapper', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'body' })],
        materialLog: [makeMaterialEntry({ id: 5, materialType: 'glaze' })],
      });
      const leadIns = [
        ...Array.from(cell('loot-entry-1', COL.slot).querySelectorAll('[aria-hidden="true"]')),
        ...Array.from(cell('material-entry-5', COL.slot).querySelectorAll('[aria-hidden="true"]')),
      ];
      expect(leadIns.length).toBeGreaterThan(0);
      leadIns.forEach((el) => {
        expect(el.parentElement?.className).toContain('inline-flex');
      });
    });

    it('every aria-hidden element that is itself a flex/grid container carries role="presentation"', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'weapon', weaponJob: 'DRG' })],
        materialLog: [makeMaterialEntry({ id: 5, materialType: 'solvent', slotAugmented: 'legs' })],
      });
      const ariaHiddenEls = container.querySelectorAll('[aria-hidden="true"]');
      ariaHiddenEls.forEach((el) => {
        const isFlexOrGrid = /\b(flex|inline-flex|grid|inline-grid)\b/.test(el.className);
        if (isFlexOrGrid) {
          expect(el.getAttribute('role')).toBe('presentation');
        }
      });
    });
  });
});
