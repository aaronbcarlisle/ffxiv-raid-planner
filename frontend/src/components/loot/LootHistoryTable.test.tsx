import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { LootHistoryTable } from './LootHistoryTable';
import { historyRowDomId } from './logWeekGridData';
import { parseHistoryQuery } from '../../utils/historyQuery';
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

/**
 * D10: the table takes a PARSED query where it used to take `HistoryFilterState`.
 * Fixtures go through the real parser rather than hand-built objects so a test
 * exercises the same shape `Loot` hands down — a hand-rolled `{ filters: [...] }`
 * could drift from what `parseHistoryQuery` actually emits and still pass.
 */
function q(query = '') {
  return parseHistoryQuery(query);
}

/**
 * A UTC-pinned range generator: week N starts Jun 16 2026 UTC + (N-1) weeks.
 * Week 3 therefore spans Jun 30 - Jul 7. Built from `Date.UTC` so that a
 * formatter which lost its `timeZone: 'UTC'` renders a DIFFERENT day — note
 * this only bites off UTC (it does locally, `America/New_York`; a UTC CI
 * runner cannot tell the two apart, so treat this as a local guard).
 */
const rangeOfWeek = (week: number) => ({
  start: new Date(Date.UTC(2026, 5, 16 + (week - 1) * 7)),
  end: new Date(Date.UTC(2026, 5, 23 + (week - 1) * 7)),
});

/**
 * Reports the live query string, so a test can assert that the deep-link
 * effect CLEANED UP rather than inferring it from the absence of a pulse.
 * Inert: outside the table, no role, no aria.
 */
function LocationProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

function search(): string {
  return screen.getByTestId('location-search').textContent ?? '';
}

/** One author for the default prop set — `renderTable` and the T-9 rerender both read it. */
function tableProps(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}) {
  return {
    lootLog: [],
    materialLog: [],
    players,
    floors,
    query: q(),
    currentWeek: 3,
    rangeOfWeek,
    logsLoading: false,
    logsFailed: false,
    canEdit: true,
    onEdit: vi.fn(),
    onEditMaterial: vi.fn(),
    onJumpToPlayer: vi.fn(),
    onViewWeekInLog: vi.fn(),
    onCopyLink: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function renderTable(overrides: Partial<Parameters<typeof LootHistoryTable>[0]> = {}, initialEntries: string[] = ['/']) {
  const props = tableProps(overrides);
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LootHistoryTable {...props} />
      <LocationProbe />
    </MemoryRouter>
  );
}

/**
 * Row-scoped: the kebab's accessible name is row-specific, so match the shared
 * middle. D11 (R-D11-D): the kebab is a `ui/ContextMenu` trigger — it opens on
 * a plain CLICK; the Radix `Dropdown` it replaced opened on Enter-keydown.
 */
function openKebab(container: HTMLElement) {
  fireEvent.click(within(container).getByRole('button', { name: /entry actions/ }));
}

/** The open menu's item labels, in DOM order (separators are not menuitems). */
function menuLabels(): (string | null)[] {
  return screen.getAllByRole('menuitem').map((m) => m.textContent);
}

/** `ui/ContextMenu` closes on a document-level Escape. */
function closeMenu() {
  fireEvent.keyDown(document, { key: 'Escape' });
}

/**
 * A live browser selection over `el`'s text — what a drag-select leaves behind
 * at mouseup, which is what R-D11-G's guard reads (`window.getSelection()`).
 * jsdom implements the Selection API for real, so this is not a stub.
 */
function selectText(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Column order is the table's contract: Week · Floor · Slot · Player · Method · Date · Type · ⋮ */
const COL = { week: 0, floor: 1, slot: 2, player: 3, method: 4, date: 5, type: 6, actions: 7 } as const;

function rowIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr[id]')).map((tr) => tr.id);
}

/**
 * Separators are the only `<tbody>` rows without an entry id (the empty-state
 * row aside). Read as ` | `-joined span text, not raw `textContent`: JSX drops
 * the whitespace between sibling elements, so a plain concatenation would run
 * "WEEK 3" straight into the range.
 */
function separatorText(tr: Element): string {
  return Array.from(tr.querySelectorAll('span'))
    .map((sp) => sp.textContent?.trim() ?? '')
    .join(' | ');
}

function separatorTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr:not([id])')).map(separatorText);
}

/** The interleave, in DOM order: entry ids as-is, separators as `sep:<text>`. */
function rowSequence(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr')).map((tr) =>
    tr.id ? tr.id : `sep:${separatorText(tr)}`
  );
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

    // T1-i1 (R-E1-D): the aug-slot label is `GEAR_SLOT_NAMES[slot]` verbatim
    // (Title Case, the one author of slot text) — not the raw lowercase enum.
    // `toHaveTextContent` is case-sensitive, so this pins the exact casing.
    it('renders aug Body for a material with slotAugmented body', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, slotAugmented: 'body' })] });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug Body');
    });

    it('renders aug R. Ring for a material with slotAugmented ring1', () => {
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, slotAugmented: 'ring1' })] });
      expect(cell('material-entry-5', COL.type)).toHaveTextContent('aug R. Ring');
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
    it('applies the parsed query prop to narrow rendered rows', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 2, method: 'drop' }),
        makeLootEntry({ id: 2, weekNumber: 2, method: 'tome' }),
      ];
      renderTable({ lootLog, query: q('source:tome') });
      expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
    });

    it('matches player: and job: through the ROSTER, exactly as the cells render them', () => {
      // The query context must read the SAME `playersById` map the Player cell
      // and the player sort key read: `player:` against the roster name (not
      // the stale snapshot name frozen on the entry) and `job:` against the
      // roster job behind the cell's icon. Wire either to something else and
      // the table would filter on a value the user cannot see.
      const lootLog = [
        makeLootEntry({ id: 1, recipientPlayerId: 'p1', recipientPlayerName: 'Stale Snapshot Name' }),
        makeLootEntry({ id: 2, recipientPlayerId: 'p2', recipientPlayerName: 'Bob' }),
      ];
      const roster = [
        makePlayer({ id: 'p1', name: 'Renamed', job: 'WHM' }),
        makePlayer({ id: 'p2', name: 'Bob', job: 'DRK' }),
      ];

      const renamed = renderTable({ lootLog, players: roster, query: q('player:renamed') });
      expect(document.getElementById('loot-entry-1')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-2')).not.toBeInTheDocument();
      renamed.unmount();

      // The name ON THE ENTRY matches nothing — the ctx never falls back to it
      // while the roster has the player.
      const stale = renderTable({ lootLog, players: roster, query: q('player:"Stale Snapshot Name"') });
      expect(document.querySelectorAll('tbody tr[id]')).toHaveLength(0);
      stale.unmount();

      renderTable({ lootLog, players: roster, query: q('job:drk') });
      expect(document.getElementById('loot-entry-2')).toBeInTheDocument();
      expect(document.getElementById('loot-entry-1')).not.toBeInTheDocument();
    });

    it('distinguishes "nothing logged" from "nothing matches" (R-34)', () => {
      const { container, unmount } = renderTable({ lootLog: [], materialLog: [] });
      const emptyCell = screen.getByText('No loot or materials logged this tier.');
      expect(emptyCell.tagName).toBe('TD');
      expect(emptyCell).toHaveAttribute('colspan', '8');
      expect(container.querySelectorAll('tbody td')).toHaveLength(1);
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
      expect(screen.queryByText('No entries match your filters.')).not.toBeInTheDocument();
      unmount();

      // Same zero rows on screen, different cause: the tier HAS entries and the
      // filter excludes them. The shipped single message conflated the two.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
      });
      expect(screen.getByText('No entries match your filters.')).toBeInTheDocument();
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
    });

    it('renders no week separator alongside an empty state', () => {
      const { container } = renderTable({ lootLog: [], materialLog: [] });
      // One row total = the empty-state row; there is no week band to draw.
      expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(container.querySelector('tbody tr:not([id]) td')).toHaveAttribute('colspan', '8');
    });

    it('says the load FAILED rather than claiming the tier is empty', () => {
      renderTable({ lootLog: [], materialLog: [], logsFailed: true });
      expect(screen.getByText("Couldn't load this tier's entries.")).toBeInTheDocument();
      // The falsehood this replaces: empty arrays after a failed request are
      // not evidence of an empty tier.
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
      // And no count is asserted either — "0 entries" would be equally untrue.
      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('never claims a load failure while it is HOLDING logs — zero rows is the filter', () => {
      // A stale `logsFailed` must not outrank the evidence in the component's
      // own hands. The tier has an entry; the filter excludes it.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
        logsFailed: true,
      });
      expect(screen.getByText('No entries match your filters.')).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load this tier's entries.")).not.toBeInTheDocument();
      // And the count is a real one here — zero IS the honest answer.
      expect(screen.getByRole('status')).toHaveTextContent('0 entries');
    });

    it('prefers "loading" over "failed" while a retry is in flight', () => {
      renderTable({ lootLog: [], materialLog: [], logsLoading: true, logsFailed: true });
      expect(screen.getByText('Loading entries…')).toBeInTheDocument();
      expect(screen.queryByText("Couldn't load this tier's entries.")).not.toBeInTheDocument();
    });

    it('withholds the "nothing logged" claim while the logs are still loading (M1)', () => {
      const { unmount } = renderTable({ lootLog: [], materialLog: [], logsLoading: true });
      expect(screen.getByText('Loading entries…')).toBeInTheDocument();
      // The claim is about the TIER; empty-because-unfetched must not assert it.
      expect(screen.queryByText('No loot or materials logged this tier.')).not.toBeInTheDocument();
      expect(screen.queryByText('No entries match your filters.')).not.toBeInTheDocument();
      unmount();

      // Same empty arrays, load finished — now the claim is earned.
      renderTable({ lootLog: [], materialLog: [], logsLoading: false });
      expect(screen.getByText('No loot or materials logged this tier.')).toBeInTheDocument();
    });

    it('keeps rendering rows while loading — only the empty message is withheld', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        logsLoading: true,
      });
      expect(rowIds(container)).toEqual(['loot-entry-1']);
      expect(screen.queryByText('Loading entries…')).not.toBeInTheDocument();
    });

    it('renders material rows with the material-entry id', () => {
      const materialLog = [makeMaterialEntry({ id: 5, weekNumber: 2 })];
      renderTable({ materialLog });
      expect(document.getElementById('material-entry-5')).toBeInTheDocument();
    });
  });

  describe('week separators (R-29 / R-D9b-A / R-D9b-B / R-D9b-E)', () => {
    const threeWeeks = [
      makeLootEntry({ id: 1, weekNumber: 3, createdAt: '2026-07-01T12:00:00Z' }),
      makeLootEntry({ id: 2, weekNumber: 3, createdAt: '2026-07-01T10:00:00Z' }),
      makeLootEntry({ id: 3, weekNumber: 2, createdAt: '2026-06-24T10:00:00Z' }),
      makeLootEntry({ id: 4, weekNumber: 1, createdAt: '2026-06-17T10:00:00Z' }),
    ];

    it('precedes each week group with one separator: pill, UTC range, current marker, count', () => {
      const { container } = renderTable({ lootLog: threeWeeks });

      // currentWeek is 3. The ranges are UTC-pinned: a formatter that lost
      // `timeZone: 'UTC'` reads Jun 29 / Jul 6 in a UTC-negative zone.
      expect(rowSequence(container)).toEqual([
        'sep:WEEK 3 | Jun 30 – Jul 7 · current | 2 entries',
        'loot-entry-1',
        'loot-entry-2',
        'sep:WEEK 2 | Jun 23 – Jun 30 | 1 entry',
        'loot-entry-3',
        'sep:WEEK 1 | Jun 16 – Jun 23 | 1 entry',
        'loot-entry-4',
      ]);
    });

    it('spans the separator across every column, the kebab included', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const cells = container.querySelectorAll('tbody tr:not([id]) > td');
      expect(cells).toHaveLength(3);
      for (const td of cells) {
        expect(td).toHaveAttribute('colspan', '8');
      }
    });

    it('tints ONLY the current week pill, with the measured accent-hover token', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const pills = Array.from(container.querySelectorAll('tbody tr:not([id]) span')).filter((sp) =>
        (sp.textContent ?? '').startsWith('WEEK ')
      );
      expect(pills.map((pill) => pill.textContent)).toEqual(['WEEK 3', 'WEEK 2', 'WEEK 1']);
      expect(pills[0]).toHaveClass('bg-accent/15', 'text-accent-hover');
      expect(pills[0]).not.toHaveClass('bg-surface-elevated');
      for (const past of pills.slice(1)) {
        expect(past).toHaveClass('bg-surface-elevated', 'text-text-secondary');
        expect(past).not.toHaveClass('text-accent-hover');
      }
    });

    it('marks the current week in TEXT as well as tint, so the signal is not colour-only', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      const withCurrent = separatorTexts(container).filter((t) => t.includes('· current'));
      expect(withCurrent).toHaveLength(1);
      expect(withCurrent[0]).toContain('WEEK 3');
    });

    it('drops every separator under a non-week sort, and restores them on the way back', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      expect(separatorTexts(container)).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'Player' }));
      expect(separatorTexts(container)).toEqual([]);
      expect(rowIds(container)).toHaveLength(4);

      fireEvent.click(screen.getByRole('button', { name: 'Date' }));
      expect(separatorTexts(container)).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(separatorTexts(container)).toHaveLength(3);
    });

    it('keeps separators under week ASC (R-D9b-E: the axis, not the direction)', () => {
      const { container } = renderTable({ lootLog: threeWeeks });
      fireEvent.click(screen.getByRole('button', { name: 'Week' }));

      expect(header('Week')).toHaveAttribute('aria-sort', 'ascending');
      expect(rowSequence(container)).toEqual([
        'sep:WEEK 1 | Jun 16 – Jun 23 | 1 entry',
        'loot-entry-4',
        'sep:WEEK 2 | Jun 23 – Jun 30 | 1 entry',
        'loot-entry-3',
        'sep:WEEK 3 | Jun 30 – Jul 7 · current | 2 entries',
        'loot-entry-1',
        'loot-entry-2',
      ]);
    });

    it('renders no range, and no stray separator dot, when rangeOfWeek returns null', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 3 }), makeLootEntry({ id: 2, weekNumber: 2 })],
        rangeOfWeek: () => null,
      });
      expect(separatorTexts(container)).toEqual([
        'WEEK 3 | current | 1 entry',
        'WEEK 2 | 1 entry',
      ]);
    });

    it('counts only the rows the filter left, per week', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3, method: 'drop' }),
        makeLootEntry({ id: 2, weekNumber: 3, method: 'tome' }),
        makeLootEntry({ id: 3, weekNumber: 2, method: 'tome' }),
      ];
      const { container } = renderTable({ lootLog, query: q('source:tome') });
      expect(separatorTexts(container)).toEqual([
        'WEEK 3 | Jun 30 – Jul 7 · current | 1 entry',
        'WEEK 2 | Jun 23 – Jun 30 | 1 entry',
      ]);
    });

    it('counts material rows in the separator total (entries, not just drops — R-D9b-A)', () => {
      const { container } = renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 2 })],
      });
      expect(separatorTexts(container)).toEqual(['WEEK 2 | Jun 23 – Jun 30 | 2 entries']);
    });
  });

  describe('stats count (R-34 / R-D9b-C)', () => {
    it('counts the filtered set and splits gear vs material when both are present', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 }), makeLootEntry({ id: 2, weekNumber: 3 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 2 })],
      });
      expect(screen.getByRole('status')).toHaveTextContent('3 entries (2 gear, 1 material)');
    });

    it('omits the split when one kind is absent, and reads it off the FILTERED set', () => {
      const props = {
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 }), makeLootEntry({ id: 2, weekNumber: 3 })],
        materialLog: [makeMaterialEntry({ id: 9, weekNumber: 3 })],
      };
      const { unmount } = renderTable(props);
      expect(screen.getByRole('status')).toHaveTextContent('3 entries (2 gear, 1 material)');
      unmount();

      // Week 2 leaves one loot row and no materials — the split must vanish.
      renderTable({ ...props, query: q('week:2') });
      expect(screen.getByRole('status')).toHaveTextContent('1 entry');
      expect(screen.getByRole('status').textContent).not.toContain('gear');
    });

    it('stays blank rather than claiming "0 entries" while the logs are loading', () => {
      const { unmount } = renderTable({ lootLog: [], materialLog: [], logsLoading: true });
      const status = screen.getByRole('status');
      // Mounted (a live region inserted pre-populated is not reliably
      // announced) but silent — there is no count to report yet.
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent('');
      unmount();

      // A count that IS knowable still renders while loading — only the
      // unknowable one is withheld.
      renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })], logsLoading: true });
      expect(screen.getByRole('status')).toHaveTextContent('1 entry');
    });

    it('reads 0 entries when nothing matches', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        query: q('week:9'),
      });
      expect(screen.getByRole('status')).toHaveTextContent('0 entries');
    });

    it('sits inside the table card above the header row, not in a table cell', () => {
      const { container } = renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const status = screen.getByRole('status');
      const table = container.querySelector('table')!;
      expect(status.closest('table')).toBeNull();
      expect(status.parentElement).toBe(table.parentElement);
      expect(status.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    // INVERTED in D11 (R-32): this case used to assert Edit was ABSENT for a
    // material row ("loot rows only"). R-32 names material Edit as v2's net-new
    // item and D-37 restores it; it opens D8's modal through Loot's existing
    // edit door (R-D11-H), so the row's Edit must reach `onEditMaterial`, not
    // `onEdit`.
    it('shows Edit for a material row when canEdit is true, wired to onEditMaterial (R-32 — inverts the D9a assertion)', async () => {
      const onEdit = vi.fn();
      const onEditMaterial = vi.fn();
      const entry = makeMaterialEntry({ id: 5 });
      renderTable({ materialLog: [entry], onEdit, onEditMaterial });
      openKebab(document.getElementById('material-entry-5')!);
      expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
      expect(onEditMaterial).toHaveBeenCalledWith(entry);
      expect(onEdit).not.toHaveBeenCalled();
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

    // R-D6b precedent (`LogWeekGrid.tsx:519` — `${label} entry actions — ${floorName}`):
    // the name names the ROW, so tabbing the column tells a screen-reader user
    // which entry the focused menu would edit or delete.
    it('names every kebab by its own slot and recipient, never a shared "Entry actions"', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })], materialLog: [makeMaterialEntry({ id: 5 })] });
      expect(
        within(document.getElementById('loot-entry-1')!).getByRole('button', {
          name: 'Body entry actions — Aria',
        }),
      ).toBeInTheDocument();
      expect(
        within(document.getElementById('material-entry-5')!).getByRole('button', {
          name: 'Twine entry actions — Aria',
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Entry actions' })).not.toBeInTheDocument();
    });

    it('resolves the kebab name through the roster, exactly as the Player cell does', () => {
      renderTable({
        lootLog: [makeLootEntry({ id: 1, itemSlot: 'earring', recipientPlayerName: 'Stale Snapshot Name' })],
        players: [makePlayer({ name: 'Renamed' })],
      });
      expect(
        within(document.getElementById('loot-entry-1')!).getByRole('button', {
          name: 'Ears entry actions — Renamed',
        }),
      ).toBeInTheDocument();
    });
  });

  // R-D11-K: this block REPLACES the `inert row (D9a-i)` suite that stood here.
  // That suite asserted no tabindex / no aria-label / no cursor-pointer on the
  // row — precisely what R-31 reverses — so it is rewritten in place with the
  // supersession named rather than deleted silently (the D9b/D10 convention
  // for a ruling that ages out). T-5 and T-9 carry its assertions forward for
  // the one row they still describe: a VIEWER's.
  describe('row as a control (R-31; supersedes D9a-i per R-D11-K)', () => {
    const lootEntry = makeLootEntry({ id: 1, weekNumber: 2 });
    const materialEntry = makeMaterialEntry({ id: 5, weekNumber: 2 });
    const row = (id: string) => document.getElementById(id)!;
    /** Every activation outlet, so "only X fired" is a real claim rather than an unchecked one. */
    const outlets = () => ({
      onEdit: vi.fn(), onEditMaterial: vi.fn(), onCopyLink: vi.fn(), onJumpToPlayer: vi.fn(),
    });

    afterEach(() => {
      window.getSelection()?.removeAllRanges();
    });

    it('T-1: a plain click edits — onEdit(entry) on a loot row, onEditMaterial(entry) on a material row (R-31, R-D11-H)', () => {
      const o = outlets();
      renderTable({ lootLog: [lootEntry], materialLog: [materialEntry], ...o });

      fireEvent.click(row('loot-entry-1'));
      expect(o.onEdit).toHaveBeenCalledWith(lootEntry);
      expect(o.onEditMaterial).not.toHaveBeenCalled();

      fireEvent.click(row('material-entry-5'));
      expect(o.onEditMaterial).toHaveBeenCalledWith(materialEntry);
      expect(o.onEdit).toHaveBeenCalledTimes(1);
      expect(o.onCopyLink).not.toHaveBeenCalled();
      expect(o.onJumpToPlayer).not.toHaveBeenCalled();
    });

    it('T-2: Shift+click copies the link and nothing else — and clears the selection Shift+click extends (V1 :315)', () => {
      const o = outlets();
      renderTable({ lootLog: [lootEntry], ...o });
      selectText(cell('loot-entry-1', COL.player));
      expect(window.getSelection()?.toString()).toContain('Aria');

      fireEvent.click(row('loot-entry-1'), { shiftKey: true });
      expect(o.onCopyLink).toHaveBeenCalledWith({ kind: 'loot', entry: lootEntry });
      expect(o.onEdit).not.toHaveBeenCalled();
      expect(o.onEditMaterial).not.toHaveBeenCalled();
      expect(o.onJumpToPlayer).not.toHaveBeenCalled();
      expect(window.getSelection()?.toString()).toBe('');
    });

    it('T-3: Alt+click jumps to the recipient and nothing else; with an UNRESOLVABLE recipient nothing fires at all (the jump gate)', () => {
      const o = outlets();
      const resolvable = renderTable({ lootLog: [lootEntry], ...o });
      fireEvent.click(row('loot-entry-1'), { altKey: true });
      // D12: the second arg is the entry's anchor slot — 'body' for `lootEntry`.
      expect(o.onJumpToPlayer).toHaveBeenCalledWith('p1', 'body');
      expect(o.onEdit).not.toHaveBeenCalled();
      expect(o.onCopyLink).not.toHaveBeenCalled();
      resolvable.unmount();

      const ghost = outlets();
      renderTable({
        lootLog: [makeLootEntry({ id: 2, recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' })],
        ...ghost,
      });
      fireEvent.click(row('loot-entry-2'), { altKey: true });
      expect(ghost.onJumpToPlayer).not.toHaveBeenCalled();
      expect(ghost.onEdit).not.toHaveBeenCalled();
      expect(ghost.onEditMaterial).not.toHaveBeenCalled();
      expect(ghost.onCopyLink).not.toHaveBeenCalled();
    });

    // D12: the anchor slot rides beside the player id — a slot other than
    // `lootEntry`'s default 'body' proves the value is DERIVED, not a fixed arg.
    it("Alt+Click on a row passes the entry's anchor slot to the jump", () => {
      const o = outlets();
      renderTable({ lootLog: [makeLootEntry({ id: 1, itemSlot: 'legs' })], ...o });
      fireEvent.click(row('loot-entry-1'), { altKey: true });
      expect(o.onJumpToPlayer).toHaveBeenCalledWith('p1', 'legs');
    });

    it('T-4: canEdit=false — a plain click and a plain Enter fire nothing; Shift and Alt still fire (R-D11-E)', () => {
      const o = outlets();
      renderTable({ lootLog: [lootEntry], canEdit: false, ...o });
      const tr = row('loot-entry-1');

      fireEvent.click(tr);
      fireEvent.keyDown(tr, { key: 'Enter' });
      fireEvent.keyDown(tr, { key: ' ' });
      expect(o.onEdit).not.toHaveBeenCalled();
      expect(o.onEditMaterial).not.toHaveBeenCalled();

      fireEvent.click(tr, { shiftKey: true });
      expect(o.onCopyLink).toHaveBeenCalledWith({ kind: 'loot', entry: lootEntry });
      fireEvent.click(tr, { altKey: true });
      expect(o.onJumpToPlayer).toHaveBeenCalledWith('p1', 'body');
      expect(o.onEdit).not.toHaveBeenCalled();
    });

    it("T-5: only an editable row is focusable and roled, and its label names kind, slot, player and week (R-D11-E, R-D11-L)", () => {
      const viewer = renderTable({ lootLog: [lootEntry], materialLog: [materialEntry], canEdit: false });
      for (const id of ['loot-entry-1', 'material-entry-5']) {
        expect(row(id)).not.toHaveAttribute('tabindex');
        expect(row(id)).not.toHaveAttribute('role');
        expect(row(id)).not.toHaveAttribute('aria-label');
      }
      viewer.unmount();

      const editor = renderTable({ lootLog: [lootEntry], materialLog: [materialEntry], canEdit: true });
      expect(row('loot-entry-1')).toHaveAttribute('tabindex', '0');
      expect(row('loot-entry-1')).toHaveAttribute('role', 'button');
      expect(row('loot-entry-1')).toHaveAttribute('aria-label', 'Loot: Body — Aria, Week 2');
      expect(row('material-entry-5')).toHaveAttribute('tabindex', '0');
      expect(row('material-entry-5')).toHaveAttribute('role', 'button');
      expect(row('material-entry-5')).toHaveAttribute('aria-label', 'Material: Twine — Aria, Week 2');
      editor.unmount();

      // The name resolves through the ROSTER, exactly as the Player cell and the kebab do.
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 4, recipientPlayerName: 'Stale Snapshot Name' })],
        players: [makePlayer({ name: 'Renamed' })],
      });
      expect(row('loot-entry-1')).toHaveAttribute('aria-label', 'Loot: Body — Renamed, Week 4');
    });

    it('T-6: no row carries select-none, either permission (R-31 q2)', () => {
      for (const canEdit of [true, false]) {
        const { container, unmount } = renderTable({ lootLog: [lootEntry], materialLog: [materialEntry], canEdit });
        const trs = container.querySelectorAll('tbody tr');
        expect(trs.length).toBeGreaterThan(0);
        for (const tr of trs) expect(tr.className).not.toMatch(/\bselect-none\b/);
        unmount();
      }
    });

    it('T-7: a plain click that completes a text selection does not edit; the same click edits once the selection is gone (R-D11-G) — and a focused row\'s Enter is never gated by a stale selection', () => {
      const o = outlets();
      renderTable({ lootLog: [lootEntry], ...o });
      const tr = row('loot-entry-1');
      selectText(cell('loot-entry-1', COL.player));
      expect(window.getSelection()?.toString()).toContain('Aria'); // the guard's input is real

      fireEvent.click(tr);
      expect(o.onEdit).not.toHaveBeenCalled();

      // Keyboard is exempt: Enter cannot complete a drag-select, so a stale
      // selection elsewhere on the page must not silently swallow it.
      fireEvent.keyDown(tr, { key: 'Enter' });
      expect(o.onEdit).toHaveBeenCalledTimes(1);

      window.getSelection()?.removeAllRanges();
      fireEvent.click(tr);
      expect(o.onEdit).toHaveBeenCalledTimes(2);
      expect(o.onCopyLink).not.toHaveBeenCalled();
      expect(o.onJumpToPlayer).not.toHaveBeenCalled();
    });

    it('T-8: Enter edits · Shift+Enter copies · Alt+Enter jumps · Space edits (both prevented); other keys and a keydown bubbling up from the kebab do nothing (R-31 q3)', () => {
      const o = outlets();
      renderTable({ lootLog: [lootEntry], ...o });
      const tr = row('loot-entry-1');

      // `fireEvent` returns false when the default was prevented — Space
      // would otherwise scroll the page.
      expect(fireEvent.keyDown(tr, { key: 'Enter' })).toBe(false);
      expect(o.onEdit).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(tr, { key: 'Enter', shiftKey: true });
      expect(o.onCopyLink).toHaveBeenCalledWith({ kind: 'loot', entry: lootEntry });
      fireEvent.keyDown(tr, { key: 'Enter', altKey: true });
      expect(o.onJumpToPlayer).toHaveBeenCalledWith('p1', 'body');
      expect(fireEvent.keyDown(tr, { key: ' ' })).toBe(false);
      expect(o.onEdit).toHaveBeenCalledTimes(2);

      expect(fireEvent.keyDown(tr, { key: 'a' })).toBe(true);
      fireEvent.keyDown(tr, { key: 'Escape' });
      // The kebab's own Enter bubbles through the row on its way to the
      // button's native click; it must not ALSO count as a row activation.
      fireEvent.keyDown(within(tr).getByRole('button', { name: /entry actions/ }), { key: 'Enter' });
      expect(o.onEdit).toHaveBeenCalledTimes(2);
      expect(o.onCopyLink).toHaveBeenCalledTimes(1);
      expect(o.onJumpToPlayer).toHaveBeenCalledTimes(1);
      expect(o.onEditMaterial).not.toHaveBeenCalled();
    });

    it('T-9: cursor-pointer — editor: yes; viewer: no; viewer + Alt held + resolvable recipient: yes; viewer + Alt held + UNRESOLVABLE recipient: still no (R-D11-F)', () => {
      const editor = renderTable({ lootLog: [lootEntry] });
      expect(row('loot-entry-1')).toHaveClass('cursor-pointer');
      editor.unmount();

      renderTable({
        lootLog: [lootEntry, makeLootEntry({ id: 2, recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' })],
        canEdit: false,
      });
      expect(row('loot-entry-1')).not.toHaveClass('cursor-pointer');
      expect(row('loot-entry-2')).not.toHaveClass('cursor-pointer');

      fireEvent.keyDown(window, { key: 'Alt' });
      expect(row('loot-entry-1')).toHaveClass('cursor-pointer');
      // The anti-vacuous half: Alt alone is not enough — the jump must have somewhere to go.
      expect(row('loot-entry-2')).not.toHaveClass('cursor-pointer');

      fireEvent.keyUp(window, { key: 'Alt' });
      expect(row('loot-entry-1')).not.toHaveClass('cursor-pointer');
    });

    it('T-9b: cursor-pointer — an EDITOR holding Alt over an UNRESOLVABLE recipient loses it too (R-D11-E/F)', () => {
      // T-9 pins the matrix for a viewer only, which is why the editor leg of
      // it went unnoticed: while Alt is held, `activate` takes the `altKey`
      // branch and RETURNS before the `canEdit` edit path, so on a ghost row
      // the click does nothing at all — and a `canEdit`-driven pointer would
      // be advertising that nothing. R-D11-E's own defect, on the one control
      // this slice exists to make honest.
      renderTable({
        lootLog: [lootEntry, makeLootEntry({ id: 2, recipientPlayerId: 'ghost', recipientPlayerName: 'Departed Player' })],
      });
      // At rest an editor's rows both advertise the edit a plain click performs.
      expect(row('loot-entry-1')).toHaveClass('cursor-pointer');
      expect(row('loot-entry-2')).toHaveClass('cursor-pointer');

      fireEvent.keyDown(window, { key: 'Alt' });
      // Alt held: the resolvable row keeps it — the jump WILL fire.
      expect(row('loot-entry-1')).toHaveClass('cursor-pointer');
      // The ghost row must drop it: the jump cannot fire and the edit is
      // unreachable, so nothing happens on click.
      expect(row('loot-entry-2')).not.toHaveClass('cursor-pointer');

      // Releasing Alt restores the edit's own advertisement.
      fireEvent.keyUp(window, { key: 'Alt' });
      expect(row('loot-entry-2')).toHaveClass('cursor-pointer');
    });

    it('T-10: the editable row carries the focus-visible INSET ring; the viewer row carries no ring classes at all (M3, R-D11-E)', () => {
      const editor = renderTable({ lootLog: [lootEntry] });
      expect(row('loot-entry-1')).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-accent',
        'focus-visible:ring-inset',
      );
      editor.unmount();

      renderTable({ lootLog: [lootEntry], canEdit: false });
      expect(row('loot-entry-1').className).not.toMatch(/focus-visible/);
    });
  });

  describe('row menu — one items list, two triggers (R-32 / R-D11-D / R-D11-M)', () => {
    it("T-11: a kebab click opens the menu WITHOUT also firing the row's plain-click editor (m4: stopPropagation)", () => {
      const onEdit = vi.fn();
      const onEditMaterial = vi.fn();
      renderTable({
        lootLog: [makeLootEntry({ id: 1 })],
        materialLog: [makeMaterialEntry({ id: 5 })],
        onEdit,
        onEditMaterial,
      });
      openKebab(document.getElementById('loot-entry-1')!);
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      closeMenu();
      openKebab(document.getElementById('material-entry-5')!);
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      expect(onEdit).not.toHaveBeenCalled();
      expect(onEditMaterial).not.toHaveBeenCalled();
    });

    it('T-12: the kebab and a row right-click open the SAME items in the SAME order (R-D11-D)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })] });
      const tr = document.getElementById('loot-entry-1')!;
      openKebab(tr);
      const viaKebab = menuLabels();
      closeMenu();
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0);

      fireEvent.contextMenu(tr);
      expect(menuLabels()).toEqual(viaKebab);
      expect(viaKebab).toEqual(['Edit', 'Copy link', 'Jump to Aria', 'View week 2 in Log', 'Delete']);
    });

    it('T-13: items by permission and kind — viewer: Copy link · Jump · View week; editor loot: + Edit + Delete (danger, behind the family separator); editor material: Edit PRESENT (R-32 inverts D9a)', () => {
      const viewer = renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })], canEdit: false });
      fireEvent.contextMenu(document.getElementById('loot-entry-1')!);
      expect(menuLabels()).toEqual(['Copy link', 'Jump to Aria', 'View week 2 in Log']);
      expect(screen.getByRole('menu').querySelector('[role="separator"]')).toBeNull();
      closeMenu();
      viewer.unmount();

      const onEdit = vi.fn();
      const onEditMaterial = vi.fn();
      const material = makeMaterialEntry({ id: 5, weekNumber: 2 });
      renderTable({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 2 })],
        materialLog: [material],
        onEdit,
        onEditMaterial,
      });
      fireEvent.contextMenu(document.getElementById('loot-entry-1')!);
      expect(menuLabels()).toEqual(['Edit', 'Copy link', 'Jump to Aria', 'View week 2 in Log', 'Delete']);
      const del = screen.getByRole('menuitem', { name: 'Delete' });
      expect(del).toHaveClass('text-status-error');
      // R-D11-M: the entry family's separator sits immediately before Delete.
      expect(del.previousElementSibling).toHaveAttribute('role', 'separator');
      closeMenu();

      fireEvent.contextMenu(document.getElementById('material-entry-5')!);
      expect(menuLabels()).toEqual(['Edit', 'Copy link', 'Jump to Aria', 'View week 2 in Log', 'Delete']);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
      expect(onEditMaterial).toHaveBeenCalledWith(material);
      expect(onEdit).not.toHaveBeenCalled();
    });

    /**
     * T-13b (whole-branch review): the MENU's jump gate, which T-3 covers only
     * for the ROW. `buildRowMenuItems` gates "Jump to {name}" on the recipient
     * resolving in the roster — without that gate a ghost row offers "Jump to
     * Departed Player" and the click navigates to `?player=ghost`, landing on
     * no card. That is the same "advertises what it won't honour" defect
     * R-D11-E removes from the row, one control over, so it gets the same
     * treatment: asserted for BOTH permission levels and for both kinds,
     * because the gate sits outside the `canEdit` branches.
     */
    it('T-13b: a ghost recipient drops the Jump item from the menu entirely — editor, viewer, and material rows (the menu half of the jump gate)', () => {
      const ghostLoot = makeLootEntry({
        id: 7,
        weekNumber: 2,
        recipientPlayerId: 'ghost',
        recipientPlayerName: 'Departed Player',
      });
      const ghostMaterial = makeMaterialEntry({
        id: 8,
        weekNumber: 2,
        recipientPlayerId: 'ghost',
        recipientPlayerName: 'Departed Player',
      });

      const editor = renderTable({ lootLog: [ghostLoot], materialLog: [ghostMaterial] });
      fireEvent.contextMenu(document.getElementById('loot-entry-7')!);
      expect(menuLabels()).toEqual(['Edit', 'Copy link', 'View week 2 in Log', 'Delete']);
      expect(screen.queryByRole('menuitem', { name: /Jump to/ })).not.toBeInTheDocument();
      closeMenu();

      fireEvent.contextMenu(document.getElementById('material-entry-8')!);
      expect(menuLabels()).toEqual(['Edit', 'Copy link', 'View week 2 in Log', 'Delete']);
      closeMenu();
      editor.unmount();

      // The viewer case is the one that matters most: the kebab is their ONLY
      // route, so a dead item there has no working alternative beside it.
      renderTable({ lootLog: [ghostLoot], canEdit: false });
      fireEvent.contextMenu(document.getElementById('loot-entry-7')!);
      expect(menuLabels()).toEqual(['Copy link', 'View week 2 in Log']);
      expect(screen.queryByRole('menuitem', { name: /Jump to/ })).not.toBeInTheDocument();
    });

    // D12: the menu's "Jump to" item mirrors the row's own Alt+Click — same
    // anchor slot. A material entry whose `slotAugmented` IS a gear slot
    // (unlike the default universal-tomestone `materialEntry` fixture above)
    // proves the menu resolves it through `jumpAnchorSlotOf`, not a fixed arg.
    it('the menu Jump item passes the same slot', () => {
      const onJumpToPlayer = vi.fn();
      renderTable({ materialLog: [makeMaterialEntry({ id: 5, slotAugmented: 'tome_weapon' })], onJumpToPlayer });
      fireEvent.contextMenu(document.getElementById('material-entry-5')!);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Jump to Aria' }));
      expect(onJumpToPlayer).toHaveBeenCalledWith('p1', 'tome_weapon');
    });

    it("T-14: View week N in Log fires onViewWeekInLog({kind, entry}) with the ROW's own week — two rows, two weeks (R-D11-A)", () => {
      const onViewWeekInLog = vi.fn();
      const loot = makeLootEntry({ id: 1, weekNumber: 2 });
      const material = makeMaterialEntry({ id: 5, weekNumber: 5 });
      renderTable({ lootLog: [loot], materialLog: [material], onViewWeekInLog });

      openKebab(document.getElementById('loot-entry-1')!);
      expect(screen.queryByRole('menuitem', { name: 'View week 5 in Log' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: 'View week 2 in Log' }));
      expect(onViewWeekInLog).toHaveBeenLastCalledWith({ kind: 'loot', entry: loot });
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0); // the item closes the menu

      openKebab(document.getElementById('material-entry-5')!);
      expect(screen.queryByRole('menuitem', { name: 'View week 2 in Log' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: 'View week 5 in Log' }));
      expect(onViewWeekInLog).toHaveBeenLastCalledWith({ kind: 'material', entry: material });
      expect(onViewWeekInLog).toHaveBeenCalledTimes(2);
    });

    it('T-15: a keyboard-invoked context menu (clientX/Y 0,0) anchors to the ROW rect; a mouse right-click anchors to the cursor (R-32 note 2)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const tr = document.getElementById('loot-entry-1')!;
      tr.getBoundingClientRect = () =>
        ({ left: 40, top: 100, right: 400, bottom: 124, width: 360, height: 24, x: 40, y: 100, toJSON: () => ({}) }) as DOMRect;

      fireEvent.contextMenu(tr, { clientX: 0, clientY: 0 });
      let menu = screen.getByRole('menu');
      expect(menu.style.left).toBe('40px');
      expect(menu.style.top).toBe('124px');
      closeMenu();

      fireEvent.contextMenu(tr, { clientX: 200, clientY: 300 });
      menu = screen.getByRole('menu');
      expect(menu.style.left).toBe('200px');
      expect(menu.style.top).toBe('300px');
    });

    it('T-16: the kebab keeps its row-specific name and announces its popup (aria-haspopup="menu", R-D7b)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1 })] });
      const kebab = within(document.getElementById('loot-entry-1')!).getByRole('button', {
        name: 'Body entry actions — Aria',
      });
      expect(kebab).toHaveAttribute('aria-haspopup', 'menu');
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

    /**
     * The D9b obligation named in the plan row. `RosterCard.tsx:281-297`'s C7
     * jump lands here with whatever History filter the user last left behind,
     * so "found" must be decided against the RAW logs, not the rendered rows.
     * If it were decided against the filtered set, a jump to a filtered-out
     * entry would leave `?entry=` stuck in the URL forever — and the next
     * filter change would suddenly pulse a row nobody asked for.
     */
    it('resolves ?entry= against the UNFILTERED logs, so a filtered-out entry still self-clears', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 7, weekNumber: 2 }),
      ];
      // Week 3 only: entry 7 exists in the tier but is not on screen.
      renderTable({ lootLog, query: q('week:3') }, ['/?entry=7']);
      expect(document.getElementById('loot-entry-7')).not.toBeInTheDocument();
      expect(search()).toContain('entry=7');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      // The param is GONE: the effect ran, which it only does when the id
      // resolved. Resolve against `rows` instead and this assertion fails,
      // because the effect would never have armed.
      expect(search()).not.toContain('entry=7');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
    });

    /**
     * T-9 (D10), the third case the D10 row adds to the pair above. The pin
     * proves the id RESOLVES while a filter hides the row; this proves what the
     * user then sees, and pins the resolution to the RAW logs a second way —
     * through the clear timer's ORIGIN. Widen the query inside the 2.5 s window
     * and the row appears ALREADY PULSING, then self-clears on the schedule the
     * FIRST render started.
     *
     * Derive `entryFound` from `rows` instead and the first assertion still
     * passes (the row is visible once the query clears, so the effect arms
     * then) — but the timer would have started 500 ms late, so the param is
     * still in the URL at t=2500 and the last two assertions fail. That late
     * re-arm is exactly the bug: a pulse fired at whatever moment the user
     * happened to change the filter.
     */
    it('an ?entry= the active query filters out is still found — pulses when the query widens, on the ORIGINAL clock', () => {
      const props = tableProps({
        lootLog: [makeLootEntry({ id: 1, weekNumber: 3 }), makeLootEntry({ id: 7, weekNumber: 2 })],
      });
      const tree = (query: ReturnType<typeof q>) => (
        <MemoryRouter initialEntries={['/?entry=7']}>
          <LootHistoryTable {...props} query={query} />
          <LocationProbe />
        </MemoryRouter>
      );
      const { rerender } = render(tree(q('week:3')));
      expect(document.getElementById('loot-entry-7')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender(tree(q('')));

      expect(document.getElementById('loot-entry-7')).toHaveClass('highlight-pulse');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(search()).not.toContain('entry=7');
      expect(document.getElementById('loot-entry-7')).not.toHaveClass('highlight-pulse');
    });

    it('never arms the effect for an id absent from the raw logs (the control for the above)', () => {
      renderTable({ lootLog: [makeLootEntry({ id: 1, weekNumber: 3 })] }, ['/?entry=404']);
      expect(search()).toContain('entry=404');

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      // Still there — nothing resolved, so nothing cleaned up. This is what
      // separates "found but filtered out" from "not found at all".
      expect(search()).toContain('entry=404');
    });

    it('still pulses the right row with week separators rendered between the rows', () => {
      const lootLog = [
        makeLootEntry({ id: 1, weekNumber: 3 }),
        makeLootEntry({ id: 7, weekNumber: 2 }),
        makeLootEntry({ id: 8, weekNumber: 1 }),
      ];
      const { container } = renderTable({ lootLog }, ['/?entry=7']);

      expect(separatorTexts(container)).toHaveLength(3);
      expect(document.getElementById('loot-entry-7')).toHaveClass('highlight-pulse');
      expect(document.getElementById('loot-entry-1')).not.toHaveClass('highlight-pulse');
      // The separator rows are inert decoration — never a pulse target.
      for (const sep of container.querySelectorAll('tbody tr:not([id])')) {
        expect(sep).not.toHaveClass('highlight-pulse');
      }
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
